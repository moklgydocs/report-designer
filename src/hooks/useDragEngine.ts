/**
 * @file useDragEngine.ts
 * Custom React hook that implements the drag/resize/snap interaction engine
 * for the Report Designer canvas.
 *
 * Handles five interaction modes:
 * - **dragging**: Move selected elements within and across bands
 * - **resizing**: Resize an element via its 8 corner/edge handles
 * - **creating**: Place a new element by clicking and dragging on the canvas
 * - **rubber-band**: Multi-select elements by dragging a selection rectangle
 * - **band-resizing**: Resize a band's height by dragging its bottom edge
 *
 * Integrates with the Zustand designer store for state persistence and
 * provides snap-to-grid and smart snap-guide computation.
 */
import { useRef, useCallback, useEffect } from "react";
import { useDesignerStore } from "../store/designerStore";
import {
  snapToGrid,
  computeSnapGuides,
  createElement,
} from "../utils/elementFactory";

/** Interaction modes for the drag engine state machine */
type DragMode =
  | "idle"
  | "dragging"
  | "resizing"
  | "creating"
  | "rubber-band"
  | "band-resizing";

/** Internal state for the drag engine, tracking mode-specific data */
interface DragState {
  mode: DragMode;
  startClientX: number;
  startClientY: number;
  // dragging
  dragElementIds: string[];
  elementStartPositions: Record<string, { x: number; y: number }>;
  dragBandId: string;
  currentBandId: string; // tracks which band the element is currently in during drag
  // resizing
  resizeElementId: string;
  resizeHandle: string;
  elementStartBounds: { x: number; y: number; w: number; h: number };
  resizeBandId: string;
  // creating
  createBandId: string;
  createStartX: number;
  createStartY: number;
  currentX: number;
  currentY: number;
  // rubber-band
  rubberBandStart: { x: number; y: number } | null;
  rubberBandEnd: { x: number; y: number } | null;
  rubberBandBandId: string;
  // flags
  moved: boolean;
  historyPushed: boolean;
}

/** Minimum width/height for an element when resizing (prevents collapsing to zero). */
const MIN_SIZE = 20;
/** Pixel distance within which an element edge snaps to a nearby guide or sibling edge. */
const SNAP_THRESHOLD = 5;

/**
 * Custom hook providing the drag/resize/create interaction engine for the report canvas.
 *
 * All interaction state is held in a mutable ref (stateRef) to avoid re-renders
 * during drag. Store updates are batched per animation frame via requestAnimationFrame.
 *
 * @returns An object containing:
 *  - containerRef:    ref to attach to the scrollable canvas container
 *  - handleElementDragStart:  begin dragging one or more elements
 *  - handleResizeStart:       begin resizing an element via a handle
 *  - handleBandMouseDown:     begin creating an element or rubber-band selection on a band
 *  - handleBandResizeStart:   begin resizing a band's height
 *  - dragState:               the mutable DragState ref (for reading mode/position in components)
 */
export function useDragEngine() {
  /** Mutable state tracking the current drag interaction (mode, positions, flags). */
  const stateRef = useRef<DragState>({
    mode: "idle",
    startClientX: 0,
    startClientY: 0,
    dragElementIds: [],
    elementStartPositions: {},
    dragBandId: "",
    currentBandId: "",
    resizeElementId: "",
    resizeHandle: "",
    elementStartBounds: { x: 0, y: 0, w: 0, h: 0 },
    resizeBandId: "",
    createBandId: "",
    createStartX: 0,
    createStartY: 0,
    currentX: 0,
    currentY: 0,
    rubberBandStart: null,
    rubberBandEnd: null,
    rubberBandBandId: "",
    moved: false,
    historyPushed: false,
  });

  /** requestAnimationFrame ID used to throttle mousemove updates to once per frame. */
  const rafIdRef = useRef(0);
  /** Ref to the scrollable canvas container element (currently unused but available for future use). */
  const containerRef = useRef<HTMLDivElement | null>(null);

  /** Direct accessor for the Zustand store (avoids re-renders from useStore). */
  const getStore = () => useDesignerStore.getState();

  /**
   * Convert client (screen) coordinates to canvas (unzoomed, band-relative) coordinates.
   *
   * Steps:
   * 1. Subtract the canvas-content element's bounding rect and divide by zoom
   *    to get unzoomed canvas coordinates.
   * 2. If a band element is provided, compute that band's cumulative Y offset
   *    and subtract it to get band-relative Y coordinates.
   *
   * @param clientX - Screen X coordinate from the mouse event.
   * @param clientY - Screen Y coordinate from the mouse event.
   * @param bandEl  - Optional band DOM element (used to compute band-relative Y).
   * @returns An { x, y } object in unzoomed canvas (or band-relative) coordinates.
   */
  const clientToCanvas = useCallback(
    (clientX: number, clientY: number, bandEl?: HTMLElement) => {
      const store = getStore();
      const { zoom } = store;
      // Always use canvas-content for consistency
      const contentEl = document.querySelector(
        ".canvas-content",
      ) as HTMLElement;
      if (contentEl) {
        const rect = contentEl.getBoundingClientRect();
        // Position relative to canvas-content (in unscaled coords)
        const contentX = (clientX - rect.left) / zoom;
        const contentY = (clientY - rect.top) / zoom;
        // If we know the band, subtract its Y offset to get band-relative coords
        if (bandEl) {
          const bandId = bandEl.getAttribute("data-band-id");
          if (bandId) {
            let bandYOffset = 0;
            for (const band of store.report.bands) {
              if (band.id === bandId) break;
              bandYOffset += band.height;
            }
            return { x: contentX, y: contentY - bandYOffset };
          }
        }
        return { x: contentX, y: contentY };
      }
      return { x: clientX, y: clientY };
    },
    [],
  );

  /**
   * Get all sibling elements in the same band, excluding the given IDs.
   * Used to compute snap-guide candidates — we don't snap an element to itself.
   *
   * @param bandId     - The band whose elements to return.
   * @param excludeIds - Element IDs to exclude (typically the dragged/resized ones).
   * @returns An array of ReportElement objects.
   */
  const getSiblingElements = useCallback(
    (bandId: string, excludeIds: string[]) => {
      const store = getStore();
      const band = store.report.bands.find((b) => b.id === bandId);
      if (!band) return [];
      return band.elements
        .filter((eid) => !excludeIds.includes(eid))
        .map((eid) => store.report.elements[eid])
        .filter(Boolean);
    },
    [],
  );

  // ─── Drag Start Handlers ───────────────────────────────────────────────

  /**
   * Begin dragging one or more elements.
   *
   * Handles selection logic: if the element was not already selected, it becomes
   * the sole selection (or joins the selection with Ctrl/Meta). If already selected,
   * all selected elements drag together.
   *
   * Undo history is deferred until the first actual movement (to avoid empty history
   * entries from clicks that don't result in a drag).
   *
   * @param elementId - The ID of the element that received the mousedown.
   * @param e         - The originating React mouse event.
   */
  const handleElementDragStart = useCallback(
    (elementId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const store = getStore();
      if (store.previewMode) return;
      const el = store.report.elements[elementId];
      if (!el || el.locked) return;

      const isAlreadySelected = store.selectedElementIds.includes(elementId);
      if (!isAlreadySelected) {
        store.selectElement(elementId, e.ctrlKey || e.metaKey);
      }

      // Determine which IDs to drag: all selected if Ctrl/Meta or already-selected, else just this one
      const ids =        e.ctrlKey || e.metaKey
          ? store.selectedElementIds
          : isAlreadySelected
            ? store.selectedElementIds
            : [elementId];

      const positions: Record<string, { x: number; y: number }> = {};
      ids.forEach((id) => {
        const elem = store.report.elements[id];
        if (elem) positions[id] = { x: elem.x, y: elem.y };
      });

      // Find which band the element belongs to
      let bandId = "";
      for (const band of store.report.bands) {
        if (band.elements.includes(elementId)) {
          bandId = band.id;
          break;
        }
      }
      if (bandId) store.setActiveBandId(bandId);

      stateRef.current = {
        ...stateRef.current,
        mode: "dragging",
        startClientX: e.clientX,
        startClientY: e.clientY,
        dragElementIds: ids,
        elementStartPositions: positions,
        dragBandId: bandId,
        currentBandId: bandId,
        moved: false,
        historyPushed: false,
      };
      store.setIsDragging(true);
    },
    [],
  );

  /**
   * Begin resizing an element via one of its 8 handles (n, s, e, w, ne, nw, se, sw).
   * Pushes undo history immediately since any resize is significant.
   *
   * @param elementId - The element being resized.
   * @param handle    - A compass-direction string indicating which handle was grabbed (e.g. "ne", "sw").
   * @param e         - The originating React mouse event.
   */
  const handleResizeStart = useCallback(
    (elementId: string, handle: string, e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const store = getStore();
      if (store.previewMode) return;
      const el = store.report.elements[elementId];
      if (!el) return;

      if (!stateRef.current.historyPushed) {
        store.pushHistory();
        stateRef.current.historyPushed = true;
      }

      // Find which band the element belongs to
      let bandId = "";
      for (const band of store.report.bands) {
        if (band.elements.includes(elementId)) {
          bandId = band.id;
          break;
        }
      }
      if (bandId) store.setActiveBandId(bandId);

      stateRef.current = {
        ...stateRef.current,
        mode: "resizing",
        startClientX: e.clientX,
        startClientY: e.clientY,
        resizeElementId: elementId,
        resizeHandle: handle,
        elementStartBounds: { x: el.x, y: el.y, w: el.width, h: el.height },
        resizeBandId: bandId,
        moved: false,
        historyPushed: true,
      };
      store.setIsResizing(true);
    },
    [],
  );

  /**
   * Begin resizing a band's height by dragging its bottom edge.
   * The band's starting height is stored in elementStartBounds.h (reusing the struct).
   *
   * @param bandId - The band being resized.
   * @param e      - The originating React mouse event.
   */
  const handleBandResizeStart = useCallback(
    (bandId: string, e: React.MouseEvent) => {
      const store = getStore();
      const band = store.report.bands.find((b) => b.id === bandId);
      if (!band) return;

      store.pushHistory();
      stateRef.current = {
        ...stateRef.current,
        mode: "band-resizing",
        startClientX: e.clientX,
        startClientY: e.clientY,
        resizeBandId: bandId,
        elementStartBounds: { x: 0, y: 0, w: 0, h: band.height }, // hijack h for starting height
        moved: false,
        historyPushed: true,
      };
      store.setIsResizing(true);
      e.stopPropagation();
      e.preventDefault();
    },
    [],
  );

  /**
   * Handle mousedown on a band surface. Dispatches to one of two modes:
   *
   * - If a creation tool is active (not "select" / "pan"), enters "creating" mode
   *   so the user can draw a new element by dragging.
   * - If the "select" tool is active, enters "rubber-band" mode for marquee selection.
   *
   * Uses element.closest("[data-band-id]") instead of e.currentTarget because
   * React 18+ may recycle event targets.
   *
   * @param bandId - The band that was clicked.
   * @param e      - The originating React mouse event.
   */
  const handleBandMouseDown = useCallback(
    (bandId: string, e: React.MouseEvent) => {
      const store = getStore();
      store.setActiveBandId(bandId);

      if (store.activeTool !== "select" && store.activeTool !== "pan") {
        // Use closest to find the band element reliably (e.currentTarget may be recycled in React 18+)
        const bandEl = (e.target as HTMLElement).closest(
          "[data-band-id]",
        ) as HTMLElement;
        const pos = bandEl
          ? clientToCanvas(e.clientX, e.clientY, bandEl)
          : { x: 0, y: 0 };
        stateRef.current = {
          ...stateRef.current,
          mode: "creating",
          startClientX: e.clientX,
          startClientY: e.clientY,
          createBandId: bandId,
          createStartX: pos.x,
          createStartY: pos.y,
          currentX: pos.x,
          currentY: pos.y,
          moved: false,
          historyPushed: false,
        };
        e.stopPropagation();
        return;
      }

      if (store.activeTool === "select") {
        const bandEl = (e.target as HTMLElement).closest(
          "[data-band-id]",
        ) as HTMLElement;
        const pos = bandEl
          ? clientToCanvas(e.clientX, e.clientY, bandEl)
          : { x: 0, y: 0 };
        stateRef.current = {
          ...stateRef.current,
          mode: "rubber-band",
          startClientX: e.clientX,
          startClientY: e.clientY,
          rubberBandStart: pos,
          rubberBandEnd: pos,
          rubberBandBandId: bandId,
          moved: false,
          historyPushed: false,
        };
      }
    },
    [clientToCanvas],
  );

  // ─── Global Mouse Move / Up Effect ─────────────────────────────────────
  // Registers window-level mousemove and mouseup listeners so drags continue
  // even when the cursor leaves the canvas element. Uses requestAnimationFrame
  // throttling to avoid overwhelming the store with per-pixel updates.

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const s = stateRef.current;
      if (s.mode === "idle") return;

      // Throttle: only one update per animation frame
      if (rafIdRef.current) return;
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = 0;
        const store = getStore();
        const { snapEnabled, gridSize, zoom } = store;
        const st = stateRef.current;

        // ─── Dragging mode: element-to-element snap ───
        if (st.mode === "dragging") {
          const dx = (e.clientX - st.startClientX) / zoom;
          const dy = (e.clientY - st.startClientY) / zoom;

          // Dead-zone check: only start a real drag after moving >2px to avoid
          // accidental drags from simple clicks
          if (!st.moved && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
            st.moved = true;
            if (!st.historyPushed) {
              store.pushHistory();
              st.historyPushed = true;
            }
          }

          if (st.moved) {
            // Use the first element as the reference for snap calculation
            const firstId = st.dragElementIds[0];
            const firstStart = st.elementStartPositions[firstId];
            if (!firstStart) return;

            const firstEl = store.report.elements[firstId];
            if (!firstEl) return;

            let refNewX = firstStart.x + dx;
            let refNewY = firstStart.y + dy;

            // ─── Cross-band detection: check if mouse is over a different band ───
            const contentEl = document.querySelector(
              ".canvas-content",
            ) as HTMLElement;
            if (contentEl) {
              const rect = contentEl.getBoundingClientRect();
              const contentY = (e.clientY - rect.top) / zoom;
              let bandTop = 0;
              for (const band of store.report.bands) {
                const bandBottom = bandTop + band.height;
                if (contentY >= bandTop && contentY < bandBottom) {
                  if (band.id !== st.currentBandId) {
                    // Element crossed into a new band — migrate it
                    store.moveElementsToBand(st.dragElementIds, band.id);
                    st.currentBandId = band.id;
                    store.setActiveBandId(band.id);
                    // Clamp Y to be within the new band
                    // (element position is band-relative, so we don't need to adjust y)
                  }
                  break;
                }
                bandTop = bandBottom;
              }
            }

            // Compute snap guides against sibling elements + canvas edges.
            // Uses the first (primary) element as the snap reference; all other
            // dragged elements follow the same offset.
            const siblings = getSiblingElements(
              st.currentBandId,
              st.dragElementIds,
            );
            let guides: {
              type: "vertical" | "horizontal";
              position: number;
            }[] = [];

            if (snapEnabled) {
              // Get band bounds for canvas-edge snap
              const band = store.report.bands.find(
                (b) => b.id === st.currentBandId,
              );
              const canvasBounds = band
                ? {
                    width:
                      store.report.pageSettings.width -
                      store.report.pageSettings.marginLeft -
                      store.report.pageSettings.marginRight,
                    height: band.height,
                  }
                : undefined;

              const snapResult = computeSnapGuides(
                {
                  x: refNewX,
                  y: refNewY,
                  width: firstEl.width,
                  height: firstEl.height,
                },
                siblings,
                SNAP_THRESHOLD,
                canvasBounds,
              );
              refNewX = snapResult.x;
              refNewY = snapResult.y;
              guides = snapResult.guides;

              // If element snap didn't fire, fall back to grid snap
              if (guides.length === 0) {
                refNewX = snapToGrid(refNewX, gridSize);
                refNewY = snapToGrid(refNewY, gridSize);
              }
            }

            // Calculate the actual offset from the reference element's start position
            const actualDx = refNewX - firstStart.x;
            const actualDy = refNewY - firstStart.y;

            // Apply the same offset to all dragged elements
            const currentBand = store.report.bands.find(
              (b) => b.id === st.currentBandId,
            );
            const { width, marginLeft, marginRight } =
              store.report.pageSettings;
            const contentWidth = width - marginLeft - marginRight;

            for (const id of st.dragElementIds) {
              const startPos = st.elementStartPositions[id];
              if (!startPos) continue;
              let newX = startPos.x + actualDx;
              let newY = startPos.y + actualDy;
              const el = store.report.elements[id];

              // Clamp X horizontally
              const elWidth = el?.width || 100;
              newX = Math.max(0, Math.min(newX, contentWidth - elWidth));

              // Clamp Y to stay within current band during drag
              if (currentBand) {
                const maxY = currentBand.height - (el?.height || 30);
                newY = Math.max(0, Math.min(newY, maxY));
              }
              store.moveElement(id, newX, newY);
            }

            store.setSnapGuides(guides);
          }
        }

        // ─── Resizing mode: compute new bounds from handle direction ───
        if (st.mode === "resizing") {
          const dx = (e.clientX - st.startClientX) / zoom;
          const dy = (e.clientY - st.startClientY) / zoom;
          const b = st.elementStartBounds;
          const h = st.resizeHandle;

          let newX = b.x,
            newY = b.y,
            newW = b.w,
            newH = b.h;

          // Compute new position/size based on which handle is being dragged.
          // Handle direction is encoded as compass letters: n/s/e/w.
          // "e" = east (right edge), "w" = west (left edge), etc.
          if (h.includes("e")) newW = Math.max(MIN_SIZE, b.w + dx);
          if (h.includes("w")) {
            newW = Math.max(MIN_SIZE, b.w - dx);
            newX = b.x + (b.w - newW);
          }
          if (h.includes("s")) newH = Math.max(MIN_SIZE, b.h + dy);
          if (h.includes("n")) {
            newH = Math.max(MIN_SIZE, b.h - dy);
            newY = b.y + (b.h - newH);
          }

          let guides: { type: "vertical" | "horizontal"; position: number }[] =
            [];

          if (snapEnabled) {
            const siblings = getSiblingElements(st.resizeBandId, [
              st.resizeElementId,
            ]);
            const band = store.report.bands.find(
              (b) => b.id === st.resizeBandId,
            );
            const canvasBounds = band
              ? {
                  width:
                    store.report.pageSettings.width -
                    store.report.pageSettings.marginLeft -
                    store.report.pageSettings.marginRight,
                  height: band.height,
                }
              : undefined;

            // Snap the position (x, y) using element-to-element alignment.
            // For west/north handles, the position snaps and width/height adjust
            // to keep the opposite edge fixed. For east/south handles, only
            // width/height change; the anchor edge stays put.
            const snapResult = computeSnapGuides(
              { x: newX, y: newY, width: newW, height: newH },
              siblings,
              SNAP_THRESHOLD,
              canvasBounds,
            );

            // Adjust position and size based on snap
            const snapDx = snapResult.x - newX;
            const snapDy = snapResult.y - newY;

            if (Math.abs(snapDx) > 0) {
              if (h.includes("w")) {
                newX = snapResult.x;
                // Keep right edge fixed, adjust width
                newW = b.x + b.w - newX;
              }
              // For 'e' handle, left edge stays, so don't adjust x
            }
            if (Math.abs(snapDy) > 0) {
              if (h.includes("n")) {
                newY = snapResult.y;
                newH = b.y + b.h - newY;
              }
            }

            guides = snapResult.guides;

            // Grid snap for size if no element snap on that axis
            if (!guides.some((g) => g.type === "vertical")) {
              newW = snapToGrid(newW, gridSize);
            }
            if (!guides.some((g) => g.type === "horizontal")) {
              newH = snapToGrid(newH, gridSize);
            }

            // Ensure minimum size
            if (newW < MIN_SIZE) newW = MIN_SIZE;
            if (newH < MIN_SIZE) newH = MIN_SIZE;
          }

          // Ensure maximum boundaries (A4 margin-left/right boundaries and Band height vertical boundaries)
          const targetBand = store.report.bands.find(
            (b) => b.id === st.resizeBandId,
          );
          const { width, marginLeft, marginRight } = store.report.pageSettings;
          const contentWidth = width - marginLeft - marginRight;
          const bandHeight = targetBand ? targetBand.height : 1000;

          // Horizontal bounds clamping during resize
          if (newX < 0) {
            newW = Math.max(MIN_SIZE, newW + newX);
            newX = 0;
          }
          if (newX + newW > contentWidth) {
            if (h.includes("e") || h.includes("ne") || h.includes("se")) {
              newW = Math.max(MIN_SIZE, contentWidth - newX);
            } else if (
              h.includes("w") ||
              h.includes("nw") ||
              h.includes("sw")
            ) {
              newX = contentWidth - newW;
              if (newX < 0) {
                newX = 0;
                newW = contentWidth;
              }
            }
          }

          // Vertical bounds clamping during resize
          if (newY < 0) {
            newH = Math.max(MIN_SIZE, newH + newY);
            newY = 0;
          }
          if (newY + newH > bandHeight) {
            if (h.includes("s") || h.includes("se") || h.includes("sw")) {
              newH = Math.max(MIN_SIZE, bandHeight - newY);
            } else if (
              h.includes("n") ||
              h.includes("ne") ||
              h.includes("nw")
            ) {
              newY = bandHeight - newH;
              if (newY < 0) {
                newY = 0;
                newH = bandHeight;
              }
            }
          }

          store.moveElement(st.resizeElementId, newX, newY);
          store.resizeElement(st.resizeElementId, newW, newH);
          store.setSnapGuides(guides);
        }

        // ─── Creating mode: track current cursor position for element draw-preview ───
        if (st.mode === "creating") {
          const bandEl = document.querySelector(
            `[data-band-id="${st.createBandId}"]`,
          ) as HTMLElement;
          if (bandEl) {
            const pos = clientToCanvas(e.clientX, e.clientY, bandEl);
            st.currentX = pos.x;
            st.currentY = pos.y;
            store.setDragOffset({ x: pos.x, y: pos.y });
          }
        }

        // ─── Rubber-band mode: update the end point of the selection rectangle ───
        if (st.mode === "rubber-band") {
          const bandEl = document.querySelector(
            `[data-band-id="${st.rubberBandBandId}"]`,
          ) as HTMLElement;
          if (bandEl) {
            const pos = clientToCanvas(e.clientX, e.clientY, bandEl);
            st.rubberBandEnd = pos;
            st.moved = true;
            store.setDragOffset({ x: pos.x, y: pos.y });
          }
        }

        // ─── Band-resizing mode: adjust the band height based on vertical drag ───
        if (st.mode === "band-resizing") {
          const dy = (e.clientY - st.startClientY) / zoom;
          const startHeight = st.elementStartBounds.h;
          let newHeight = startHeight + dy;
          if (snapEnabled) {
            newHeight = Math.round(newHeight / gridSize) * gridSize;
          }
          newHeight = Math.max(20, newHeight);
          store.updateBand(st.resizeBandId, { height: newHeight });
        }
      });
    };

    // ─── Mouse Up: finalize the interaction ──────────────────────────────
    const onMouseUp = (_e: MouseEvent) => {
      const s = stateRef.current;
      if (s.mode === "idle") return;
      const store = getStore();
      const { snapEnabled } = store;

      // ─── Dragging: clamp elements within their final band and recalculate heights ───
      if (s.mode === "dragging" && s.moved) {
        const targetBand = store.report.bands.find(
          (b) => b.id === s.currentBandId,
        );
        if (targetBand) {
          for (const id of s.dragElementIds) {
            const el = store.report.elements[id];
            if (!el) continue;
            // Clamp y so element stays within band (with a small margin)
            const maxY = targetBand.height - el.height;
            if (el.y > maxY || el.y < 0) {
              store.moveElement(id, el.x, Math.max(0, Math.min(el.y, maxY)));
            }
          }
        }
        // Recalculate all band heights (source band may shrink, target band may grow)
        store.recalcBandHeights();
      }

      // ─── Creating: finalize the new element ────────────────────────────
      if (s.mode === "creating" && s.moved) {
        // User dragged to define a size — normalize the rectangle and snap
        const { activeTool } = store;
        let x = Math.min(s.createStartX, s.currentX);
        let y = Math.min(s.createStartY, s.currentY);
        let w = Math.abs(s.currentX - s.createStartX);
        let h = Math.abs(s.currentY - s.createStartY);
        if (snapEnabled) {
          x = snapToGrid(x, store.gridSize);
          y = snapToGrid(y, store.gridSize);
          w = snapToGrid(w, store.gridSize);
          h = snapToGrid(h, store.gridSize);
        }
        // If the user barely dragged (<10px), use default dimensions instead
        if (w < 10) w = 150;
        if (h < 10) h = 30;

        const el = createElement(activeTool as any, x, y);
        (el as any).width = w;
        (el as any).height = h;
        store.addElement(el, s.createBandId);
        store.setActiveTool("select");
      } else if (s.mode === "creating" && !s.moved) {
        // Simple click (no drag) — create element at click position with default size
        const { activeTool } = store;
        const el = createElement(
          activeTool as any,
          s.createStartX,
          s.createStartY,
        );
        store.addElement(el, s.createBandId);
        store.setActiveTool("select");
      }

      // ─── Rubber-band: finalize the marquee selection ───────────────────
      if (
        s.mode === "rubber-band" &&
        s.moved &&
        s.rubberBandStart &&
        s.rubberBandEnd
      ) {
        store.selectElementsInRect(
          s.rubberBandStart.x,
          s.rubberBandStart.y,
          s.rubberBandEnd.x,
          s.rubberBandEnd.y,
          s.rubberBandBandId,
        );
      } else if (s.mode === "rubber-band" && !s.moved) {
        store.clearSelection();
      }

      // ─── Reset all interaction state ──────────────────────────────────
      store.setIsDragging(false);
      store.setIsResizing(false);
      store.setSnapGuides([]);

      stateRef.current = {
        ...stateRef.current,
        mode: "idle",
        moved: false,
        historyPushed: false,
        rubberBandStart: null,
        rubberBandEnd: null,
      };
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [clientToCanvas, getSiblingElements]);

  // ─── Return the hook's public API ──────────────────────────────────────
  return {
    containerRef,
    handleElementDragStart,
    handleResizeStart,
    handleBandMouseDown,
    handleBandResizeStart,
    dragState: stateRef,
  };
}
