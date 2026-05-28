import { useRef, useCallback, useEffect } from "react";
import { useDesignerStore } from "../store/designerStore";
import {
  snapToGrid,
  computeSnapGuides,
  createElement,
} from "../utils/elementFactory";

type DragMode =
  | "idle"
  | "dragging"
  | "resizing"
  | "creating"
  | "rubber-band"
  | "band-resizing";

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

const MIN_SIZE = 20;
const SNAP_THRESHOLD = 5;

export function useDragEngine() {
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

  const rafIdRef = useRef(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const getStore = () => useDesignerStore.getState();

  /**
   * Convert client (screen) coordinates to canvas (unzoomed band-relative) coordinates.
   * Uses the canvas-content element's bounding rect and subtracts the band's Y offset
   * to get band-relative coordinates.
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

  /** Get sibling elements in the same band (excluding the given ids) */
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

      const ids =
        e.ctrlKey || e.metaKey
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

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const s = stateRef.current;
      if (s.mode === "idle") return;

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

            // Compute snap guides against sibling elements + canvas edges
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

        // ─── Resizing mode: element-to-element snap ───
        if (st.mode === "resizing") {
          const dx = (e.clientX - st.startClientX) / zoom;
          const dy = (e.clientY - st.startClientY) / zoom;
          const b = st.elementStartBounds;
          const h = st.resizeHandle;

          let newX = b.x,
            newY = b.y,
            newW = b.w,
            newH = b.h;

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

            // Snap the position (x, y) using element-to-element alignment
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

      if (s.mode === "creating" && s.moved) {
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
        if (w < 10) w = 150;
        if (h < 10) h = 30;

        const el = createElement(activeTool as any, x, y);
        (el as any).width = w;
        (el as any).height = h;
        store.addElement(el, s.createBandId);
        store.setActiveTool("select");
      } else if (s.mode === "creating" && !s.moved) {
        const { activeTool } = store;
        const el = createElement(
          activeTool as any,
          s.createStartX,
          s.createStartY,
        );
        store.addElement(el, s.createBandId);
        store.setActiveTool("select");
      }

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

  return {
    containerRef,
    handleElementDragStart,
    handleResizeStart,
    handleBandMouseDown,
    handleBandResizeStart,
    dragState: stateRef,
  };
}
