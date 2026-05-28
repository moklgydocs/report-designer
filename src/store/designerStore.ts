/**
 * @file designerStore.ts
 *
 * Central Zustand store for the Report Designer application.
 *
 * Manages the full report document model (bands, elements, page settings, data sources),
 * as well as UI state such as selection, zoom, snap/grid, undo/redo history, and
 * drag/resize interaction flags. All mutations to the report go through this store so
 * that React components can subscribe to granular slices of state efficiently.
 */

import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";
import type {
  Report,
  Band,
  ReportElement,
  BandType,
  ElementType,
  PageSettings,
  DataSource,
  SnapGuide,
} from "../types";

// ─── Default Page Settings ───────────────────────────────────────────────
// A4 portrait at 96 DPI (794×1123 px) with 40 px margins on all sides.

const DEFAULT_PAGE_SETTINGS: PageSettings = {
  width: 794,
  height: 1123,
  orientation: "portrait",
  marginTop: 40,
  marginBottom: 40,
  marginLeft: 40,
  marginRight: 40,
  columns: 1,
  columnGap: 0,
};

// ─── Default Band Configuration ──────────────────────────────────────────
// The standard set of bands created for every new report, ordered top-to-bottom
// following the classic band-report layout: title → page header → report header →
// group header → data → group footer → report footer → page footer.

const DEFAULT_BANDS: Band[] = [
  {
    id: uuidv4(),
    type: "title",
    height: 60,
    backgroundColor: "#ffffff",
    visible: true,
    elements: [],
  },
  {
    id: uuidv4(),
    type: "pageHeader",
    height: 40,
    backgroundColor: "#ffffff",
    visible: true,
    elements: [],
    repeatOnEveryPage: true,
  },
  {
    id: uuidv4(),
    type: "reportHeader",
    height: 50,
    backgroundColor: "#ffffff",
    visible: true,
    elements: [],
  },
  {
    id: uuidv4(),
    type: "groupHeader",
    height: 40,
    backgroundColor: "#ffffff",
    visible: true,
    elements: [],
    groupExpression: "",
  },
  {
    id: uuidv4(),
    type: "data",
    height: 100,
    backgroundColor: "#ffffff",
    visible: true,
    elements: [],
  },
  {
    id: uuidv4(),
    type: "groupFooter",
    height: 40,
    backgroundColor: "#ffffff",
    visible: true,
    elements: [],
  },
  {
    id: uuidv4(),
    type: "reportFooter",
    height: 50,
    backgroundColor: "#ffffff",
    visible: true,
    elements: [],
  },
  {
    id: uuidv4(),
    type: "pageFooter",
    height: 40,
    backgroundColor: "#ffffff",
    visible: true,
    elements: [],
  },
];

/**
 * Create a new report with default page settings, bands, and empty collections.
 * @returns A freshly initialized Report object with a unique ID.
 */
function createDefaultReport(): Report {
  return {
    id: uuidv4(),
    name: "未命名报表",
    version: "1.0.0",
    pageSettings: { ...DEFAULT_PAGE_SETTINGS },
    bands: DEFAULT_BANDS.map((b) => ({ ...b })),
    elements: {},
    dataSources: [],
    parameters: [],
    styles: [],
    variables: {},
  };
}

// ─── Undo/Redo History Types ─────────────────────────────────────────────

/** A snapshot of the mutable parts of the report that can be undone/redone. */
interface HistoryEntry {
  elements: Record<string, ReportElement>;
  bands: Band[];
}

// ─── Store Interface ─────────────────────────────────────────────────────

/**
 * Full shape of the designer store.
 *
 * Divided into:
 *  - Report model state (report, previewData, parameterAnswers)
 *  - Selection & editing state (selectedElementIds, activeTool, editingElementId, etc.)
 *  - Interaction state (isDragging, isResizing, dragOffset, activeBandId)
 *  - Canvas settings (zoom, snapEnabled, gridSize, showGrid, snapGuides)
 *  - Clipboard & history (clipboard, history, historyIndex)
 *  - Mutator methods (all the set* / add* / update* / delete* / move* functions)
 */
interface DesignerState {
  report: Report;
  selectedElementIds: string[];
  activeTool: ElementType | "select" | "pan";
  zoom: number;
  snapEnabled: boolean;
  gridSize: number;
  snapGuides: SnapGuide[];
  showGrid: boolean;
  clipboard: ReportElement[];
  history: HistoryEntry[];
  historyIndex: number;
  isDragging: boolean;
  isResizing: boolean;
  dragOffset: { x: number; y: number };
  activeBandId: string | null;
  previewMode: boolean;
  editingElementId: string | null;
  previewData: Record<string, any[]>;
  selectedTableCell: { elementId: string; row: number; col: number } | null;

  setReport: (report: Report) => void;
  updatePageSettings: (settings: Partial<PageSettings>) => void;
  addElement: (element: ReportElement, bandId: string) => void;
  updateElement: (id: string, updates: Partial<ReportElement>) => void;
  deleteElement: (id: string) => void;
  selectElement: (id: string | string[], multi?: boolean) => void;
  clearSelection: () => void;
  setActiveTool: (tool: ElementType | "select" | "pan") => void;
  setZoom: (zoom: number) => void;
  moveElement: (id: string, x: number, y: number) => void;
  resizeElement: (id: string, width: number, height: number) => void;
  moveElements: (ids: string[], dx: number, dy: number) => void;
  moveElementsToBand: (ids: string[], targetBandId: string) => void;
  recalcBandHeights: () => void;
  addBand: (type: BandType) => void;
  updateBand: (id: string, updates: Partial<Band>) => void;
  removeBand: (id: string) => void;
  reorderBand: (id: string, direction: "up" | "down") => void;
  addDataSource: (ds: DataSource) => void;
  updateDataSource: (id: string, updates: Partial<DataSource>) => void;
  removeDataSource: (id: string) => void;
  copySelected: () => void;
  pasteElements: () => void;
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;
  moveLayerUp: (id: string) => void;
  moveLayerDown: (id: string) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  alignElements: (
    alignment:
      | "left"
      | "right"
      | "top"
      | "bottom"
      | "centerH"
      | "centerV"
      | "distributeH"
      | "distributeV",
  ) => void;
  setSnapEnabled: (enabled: boolean) => void;
  setShowGrid: (show: boolean) => void;
  setGridSize: (size: number) => void;
  setSnapGuides: (guides: SnapGuide[]) => void;
  setIsDragging: (dragging: boolean) => void;
  setIsResizing: (resizing: boolean) => void;
  setDragOffset: (offset: { x: number; y: number }) => void;
  setActiveBandId: (id: string | null) => void;
  setPreviewMode: (mode: boolean) => void;
  setEditingElementId: (id: string | null) => void;
  selectTableCell: (
    cell: { elementId: string; row: number; col: number } | null,
  ) => void;
  setPreviewData: (data: Record<string, any[]>) => void;
  loadReport: (report: Report) => void;
  saveReport: () => string;
  duplicateElement: (id: string) => void;
  selectElementsInRect: (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    bandId: string,
  ) => void;
  parameterAnswers: Record<string, any>;
  setParameterAnswers: (answers: Record<string, any>) => void;
}

/** Maximum number of undo history entries retained. */
const MAX_HISTORY = 50;

/** Fast deep clone using structuredClone (available in modern browsers), falls back to JSON round-trip. */
const deepClone =
  typeof structuredClone !== "undefined"
    ? <T>(val: T): T => structuredClone(val)
    : <T>(val: T): T => JSON.parse(JSON.stringify(val));

/**
 * Calculate the minimum band height needed to contain all its elements.
 * Iterates every element in the band and finds the lowest bottom edge.
 * Returns at least 20px so empty bands are still visible/clickable.
 *
 * @param band     - The band whose minimum height is being calculated.
 * @param elements - The full elements lookup (band.elements contains IDs to resolve here).
 * @returns The minimum height in pixels that fully encloses all elements.
 */
function calcMinBandHeight(
  band: Band,
  elements: Record<string, ReportElement>,
): number {
  let maxBottom = 0;
  for (const eid of band.elements) {
    const el = elements[eid];
    if (el) {
      const bottom = el.y + el.height;
      if (bottom > maxBottom) maxBottom = bottom;
    }
  }
  return Math.max(20, maxBottom);
}

export const useDesignerStore = create<DesignerState>((set, get) => ({
  // ─── Report Model State ──────────────────────────────────────────────
  report: createDefaultReport(),
  previewData: {},
  parameterAnswers: {},

  // ─── Selection & Editing State ───────────────────────────────────────
  selectedElementIds: [],
  activeTool: "select",
  editingElementId: null,
  selectedTableCell: null,
  activeBandId: null,
  previewMode: false,

  // ─── Canvas / Viewport Settings ──────────────────────────────────────
  zoom: 1,
  snapEnabled: true,
  gridSize: 8,
  snapGuides: [],
  showGrid: true,

  // ─── Interaction State ───────────────────────────────────────────────
  isDragging: false,
  isResizing: false,
  dragOffset: { x: 0, y: 0 },

  // ─── Clipboard & History ─────────────────────────────────────────────
  clipboard: [],
  history: [],
  historyIndex: -1,

  // ─── Simple Setters ──────────────────────────────────────────────────

  /** Replace all parameter answers (used by the parameter dialog). */
  setParameterAnswers: (answers) => set({ parameterAnswers: answers }),

  /** Replace the entire report object. */
  setReport: (report) => set({ report }),

  /**
   * Merge partial updates into the current page settings.
   * @param settings - A subset of PageSettings fields to override.
   */
  updatePageSettings: (settings) =>
    set((state) => ({
      report: {
        ...state.report,
        pageSettings: { ...state.report.pageSettings, ...settings },
      },
    })),

  // ─── Element Mutations ───────────────────────────────────────────────

  /**
   * Add a new element to a band. Pushes undo history, inserts the element
   * into the lookup and band's element list, auto-expands the band height,
   * and selects the new element.
   *
   * @param element - The fully constructed ReportElement to add.
   * @param bandId  - ID of the band that will own this element.
   */
  addElement: (element, bandId) =>
    set((state) => {
      get().pushHistory();
      const newElements = { ...state.report.elements, [element.id]: element };
      const newBands = state.report.bands.map((b) => {
        if (b.id !== bandId) return b;
        const updated = { ...b, elements: [...b.elements, element.id] };
        return {
          ...updated,
          height: Math.max(b.height, calcMinBandHeight(updated, newElements)),
        };
      });
      return {
        report: { ...state.report, elements: newElements, bands: newBands },
        selectedElementIds: [element.id],
        editingElementId: null,
      };
    }),

  /**
   * Apply partial updates to an existing element.
   * Does NOT push undo history (caller should pushHistory manually if needed).
   * Auto-expands band height if size/position changes push element beyond band bounds.
   *
   * @param id      - ID of the element to update.
   * @param updates - Partial fields to merge into the element.
   */
  updateElement: (id, updates) =>
    set((state) => {
      const existing = state.report.elements[id];
      if (!existing) return state;
      const newElements = {
        ...state.report.elements,
        [id]: { ...existing, ...updates } as ReportElement,
      };
      // Auto-expand band if size/position changes push element beyond band
      const newBands = state.report.bands.map((b) => {
        if (!b.elements.includes(id)) return b;
        const minH = calcMinBandHeight(b, newElements);
        return minH > b.height ? { ...b, height: minH } : b;
      });
      return {
        report: { ...state.report, elements: newElements, bands: newBands },
      };
    }),

  /**
   * Remove an element by ID. Pushes undo history, deletes from the lookup,
   * removes the ID from its band's element list, and recalculates band height.
   *
   * @param id - ID of the element to delete.
   */
  deleteElement: (id) =>
    set((state) => {
      get().pushHistory();
      const newElements = { ...state.report.elements };
      delete newElements[id];
      const newBands = state.report.bands.map((b) => {
        if (!b.elements.includes(id)) return b;
        const updated = {
          ...b,
          elements: b.elements.filter((eid) => eid !== id),
        };
        return { ...updated, height: calcMinBandHeight(updated, newElements) };
      });
      return {
        report: { ...state.report, elements: newElements, bands: newBands },
        selectedElementIds: state.selectedElementIds.filter(
          (sid) => sid !== id,
        ),
      };
    }),

  /**
   * Select one or more elements.
   *
   * @param idOrIds - A single element ID, or an array of IDs to select.
   * @param multi   - If true, toggle the element in/out of the current selection
   *                   (Ctrl+Click behavior). If false, replace the selection.
   */
  selectElement: (idOrIds, multi = false) =>
    set((state) => {
      if (Array.isArray(idOrIds)) {
        return { selectedElementIds: idOrIds };
      }
      const id = idOrIds;
      if (multi) {
        const exists = state.selectedElementIds.includes(id);
        return {
          selectedElementIds: exists
            ? state.selectedElementIds.filter((sid) => sid !== id)
            : [...state.selectedElementIds, id],
        };
      }
      return { selectedElementIds: [id] };
    }),

  /** Clear all element selections and the selected table cell. */
  clearSelection: () =>
    set({ selectedElementIds: [], selectedTableCell: null }),

  /** Switch the active tool (select, pan, or an element type). Also clears editing state. */
  setActiveTool: (tool) => set({ activeTool: tool, editingElementId: null }),

  /**
   * Set the canvas zoom level, clamped between 0.1× and 3×.
   * @param zoom - Desired zoom factor (1 = 100%).
   */
  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(3, zoom)) }),

  /**
   * Move a single element to absolute coordinates. Auto-expands band height if needed.
   * @param id - Element ID.
   * @param x  - New X position (band-relative).
   * @param y  - New Y position (band-relative).
   */
  moveElement: (id, x, y) =>
    set((state) => {
      const el = state.report.elements[id];
      if (!el) return state;
      const newElements = { ...state.report.elements, [id]: { ...el, x, y } };
      // Auto-expand band height if element extends beyond
      const newBands = state.report.bands.map((b) => {
        if (!b.elements.includes(id)) return b;
        const minH = calcMinBandHeight(b, newElements);
        return minH > b.height ? { ...b, height: minH } : b;
      });
      return {
        report: { ...state.report, elements: newElements, bands: newBands },
      };
    }),

  /**
   * Resize a single element. Auto-expands band height if the new bounds extend beyond.
   * @param id     - Element ID.
   * @param width  - New width in pixels.
   * @param height - New height in pixels.
   */
  resizeElement: (id, width, height) =>
    set((state) => {
      const el = state.report.elements[id];
      if (!el) return state;
      const newElements = {
        ...state.report.elements,
        [id]: { ...el, width, height },
      };
      // Auto-expand band height if element extends beyond
      const newBands = state.report.bands.map((b) => {
        if (!b.elements.includes(id)) return b;
        const minH = calcMinBandHeight(b, newElements);
        return minH > b.height ? { ...b, height: minH } : b;
      });
      return {
        report: { ...state.report, elements: newElements, bands: newBands },
      };
    }),

  /**
   * Move multiple elements by a relative offset (dx, dy).
   * Skips locked elements. Auto-expands affected bands.
   *
   * @param ids - Element IDs to move.
   * @param dx  - Horizontal offset in pixels.
   * @param dy  - Vertical offset in pixels.
   */
  moveElements: (ids, dx, dy) =>
    set((state) => {
      const elements = { ...state.report.elements };
      for (const id of ids) {
        const el = elements[id];
        if (el && !el.locked) {
          elements[id] = { ...el, x: el.x + dx, y: el.y + dy } as ReportElement;
        }
      }
      // Auto-expand affected bands
      const newBands = state.report.bands.map((b) => {
        const hasMoved = b.elements.some((eid) => ids.includes(eid));
        if (!hasMoved) return b;
        const minH = calcMinBandHeight(b, elements);
        return minH > b.height ? { ...b, height: minH } : b;
      });
      return { report: { ...state.report, elements, bands: newBands } };
    }),

  /**
   * Migrate elements from their current band to a different band.
   * Removes element IDs from the source band and appends them to the target band,
   * then recalculates heights for all bands (source may shrink, target may grow).
   *
   * @param ids          - Element IDs to migrate.
   * @param targetBandId - ID of the destination band.
   */
  moveElementsToBand: (ids, targetBandId) =>
    set((state) => {
      const newBands = state.report.bands.map((b) => ({
        ...b,
        elements: b.elements.filter((eid) => !ids.includes(eid)),
      }));
      const targetBand = newBands.find((b) => b.id === targetBandId);
      if (targetBand) {
        targetBand.elements = [...targetBand.elements, ...ids];
      }
      // Recalculate heights for all bands (source bands may shrink, target band may grow)
      const finalBands = newBands.map((b) => {
        const minH = calcMinBandHeight(b, state.report.elements);
        return { ...b, height: minH };
      });
      return { report: { ...state.report, bands: finalBands } };
    }),

  /**
   * Recalculate and update the height of every band based on its elements.
   * Useful after drag operations that may have changed element positions.
   */
  recalcBandHeights: () =>
    set((state) => {
      const newBands = state.report.bands.map((b) => {
        const minH = calcMinBandHeight(b, state.report.elements);
        return minH !== b.height ? { ...b, height: minH } : b;
      });
      return { report: { ...state.report, bands: newBands } };
    }),

  // ─── Band Mutations ──────────────────────────────────────────────────

  /**
   * Add a new empty band of the given type, inserted at the canonical position
   * according to the band order: title → pageHeader → reportHeader → groupHeader →
   * data → groupFooter → reportFooter → pageFooter.
   *
   * @param type - The BandType to create.
   */
  addBand: (type) =>
    set((state) => {
      const newBand: Band = {
        id: uuidv4(),
        type,
        height: 40,
        backgroundColor: "#ffffff",
        visible: true,
        elements: [],
      };
      const bandOrder: BandType[] = [
        "title",
        "pageHeader",
        "reportHeader",
        "groupHeader",
        "data",
        "groupFooter",
        "reportFooter",
        "pageFooter",
      ];
      // Insert at the canonical position for this band type
      const insertIndex = bandOrder.indexOf(type);
      const newBands = [...state.report.bands];
      newBands.splice(Math.min(insertIndex, newBands.length), 0, newBand);
      return { report: { ...state.report, bands: newBands } };
    }),

  /**
   * Apply partial updates to a band.
   * @param id      - Band ID.
   * @param updates - Partial Band fields to merge.
   */
  updateBand: (id, updates) =>
    set((state) => ({
      report: {
        ...state.report,
        bands: state.report.bands.map((b) =>
          b.id === id ? { ...b, ...updates } : b,
        ),
      },
    })),

  /**
   * Remove a band and all elements it contains.
   * @param id - Band ID to remove.
   */
  removeBand: (id) =>
    set((state) => {
      const band = state.report.bands.find((b) => b.id === id);
      if (!band) return state;
      const newElements = { ...state.report.elements };
      band.elements.forEach((eid) => delete newElements[eid]);
      return {
        report: {
          ...state.report,
          bands: state.report.bands.filter((b) => b.id !== id),
          elements: newElements,
        },
      };
    }),

  /**
   * Swap a band with its neighbor in the given direction.
   * @param id        - Band ID to move.
   * @param direction - "up" swaps with the band above, "down" with the band below.
   */
  reorderBand: (id, direction) =>
    set((state) => {
      const bands = [...state.report.bands];
      const idx = bands.findIndex((b) => b.id === id);
      if (idx === -1) return state;
      const newIdx = direction === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= bands.length) return state;
      [bands[idx], bands[newIdx]] = [bands[newIdx], bands[idx]];
      return { report: { ...state.report, bands } };
    }),

  // ─── Data Source Mutations ───────────────────────────────────────────

  /** Append a new data source to the report. */
  addDataSource: (ds) =>
    set((state) => ({
      report: {
        ...state.report,
        dataSources: [...state.report.dataSources, ds],
      },
    })),

  /** Merge partial updates into an existing data source. */
  updateDataSource: (id, updates) =>
    set((state) => ({
      report: {
        ...state.report,
        dataSources: state.report.dataSources.map((ds) =>
          ds.id === id ? { ...ds, ...updates } : ds,
        ),
      },
    })),

  /** Remove a data source by ID. */
  removeDataSource: (id) =>
    set((state) => ({
      report: {
        ...state.report,
        dataSources: state.report.dataSources.filter((ds) => ds.id !== id),
      },
    })),

  // ─── Clipboard Operations ────────────────────────────────────────────

  /**
   * Deep-clone all currently selected elements into the clipboard.
   * The clipboard stores independent copies so later edits don't affect pasted content.
   */
  copySelected: () =>
    set((state) => ({
      clipboard: state.selectedElementIds
        .map((id) => state.report.elements[id])
        .filter(Boolean)
        .map((el) => deepClone(el)),
    })),

  /**
   * Paste clipboard contents into the active band. Each pasted element gets a new ID
   * and is offset by (20, 20) pixels from the original position to provide visual feedback.
   * Pushes undo history and selects the newly pasted elements.
   */
  pasteElements: () =>
    set((state) => {
      get().pushHistory();
      const newElements = { ...state.report.elements };
      const newIds: string[] = [];
      const activeBandId = state.activeBandId || state.report.bands[0]?.id;
      if (!activeBandId) return state;
      // Clone each clipboard element with a new ID and slight offset
      state.clipboard.forEach((el) => {
        const newId = uuidv4();
        newElements[newId] = {
          ...deepClone(el),
          id: newId,
          x: el.x + 20,
          y: el.y + 20,
        };
        newIds.push(newId);
      });
      const newBands = state.report.bands.map((b) => {
        if (b.id !== activeBandId) return b;
        const updated = { ...b, elements: [...b.elements, ...newIds] };
        return {
          ...updated,
          height: Math.max(b.height, calcMinBandHeight(updated, newElements)),
        };
      });
      return {
        report: { ...state.report, elements: newElements, bands: newBands },
        selectedElementIds: newIds,
      };
    }),

  // ─── Undo / Redo ─────────────────────────────────────────────────────

  /**
   * Push a snapshot of the current elements and bands onto the undo history stack.
   * Any redo entries beyond the current index are discarded (branch is lost).
   * The history is capped at MAX_HISTORY entries; oldest entries are dropped.
   */
  pushHistory: () =>
    set((state) => {
      const entry: HistoryEntry = {
        elements: deepClone(state.report.elements),
        bands: deepClone(state.report.bands),
      };
      // Discard any redo entries beyond the current index
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(entry);
      if (newHistory.length > MAX_HISTORY) newHistory.shift();
      return { history: newHistory, historyIndex: newHistory.length - 1 };
    }),

  /**
   * Restore the previous history snapshot. No-op if already at the earliest entry.
   * Clears the current element selection after restoring.
   */
  undo: () =>
    set((state) => {
      if (state.historyIndex <= 0) return state;
      const newIndex = state.historyIndex - 1;
      const entry = state.history[newIndex];
      if (!entry) return state;
      return {
        report: {
          ...state.report,
          elements: deepClone(entry.elements),
          bands: deepClone(entry.bands),
        },
        historyIndex: newIndex,
        selectedElementIds: [],
      };
    }),

  /**
   * Restore the next history snapshot. No-op if already at the latest entry.
   * Clears the current element selection after restoring.
   */
  redo: () =>
    set((state) => {
      if (state.historyIndex >= state.history.length - 1) return state;
      const newIndex = state.historyIndex + 1;
      const entry = state.history[newIndex];
      if (!entry) return state;
      return {
        report: {
          ...state.report,
          elements: deepClone(entry.elements),
          bands: deepClone(entry.bands),
        },
        historyIndex: newIndex,
        selectedElementIds: [],
      };
    }),

  // ─── Z-Order / Layer Operations ──────────────────────────────────────

  /**
   * Move an element one layer up by swapping its zOrder with the element above it.
   * @param id - Element ID to promote.
   */
  moveLayerUp: (id) =>
    set((state) => {
      const elements = { ...state.report.elements };
      const sorted = Object.values(elements).sort(
        (a, b) => a.zOrder - b.zOrder,
      );
      const idx = sorted.findIndex((el) => el.id === id);
      if (idx >= sorted.length - 1) return state;
      const current = elements[id],
        above = sorted[idx + 1];
      const temp = current.zOrder;
      elements[id] = { ...current, zOrder: above.zOrder } as ReportElement;
      elements[above.id] = { ...above, zOrder: temp } as ReportElement;
      return { report: { ...state.report, elements } };
    }),

  /**
   * Move an element one layer down by swapping its zOrder with the element below it.
   * @param id - Element ID to demote.
   */
  moveLayerDown: (id) =>
    set((state) => {
      const elements = { ...state.report.elements };
      const sorted = Object.values(elements).sort(
        (a, b) => a.zOrder - b.zOrder,
      );
      const idx = sorted.findIndex((el) => el.id === id);
      if (idx <= 0) return state;
      const current = elements[id],
        below = sorted[idx - 1];
      const temp = current.zOrder;
      elements[id] = { ...current, zOrder: below.zOrder } as ReportElement;
      elements[below.id] = { ...below, zOrder: temp } as ReportElement;
      return { report: { ...state.report, elements } };
    }),

  /**
   * Move an element to the very top of the z-order stack by assigning maxZOrder + 1.
   * @param id - Element ID to bring to front.
   */
  bringToFront: (id) =>
    set((state) => {
      const elements = { ...state.report.elements };
      const maxZ = Math.max(...Object.values(elements).map((e) => e.zOrder));
      elements[id] = { ...elements[id], zOrder: maxZ + 1 } as ReportElement;
      return { report: { ...state.report, elements } };
    }),

  /**
   * Move an element to the very bottom of the z-order stack by assigning minZOrder - 1.
   * @param id - Element ID to send to back.
   */
  sendToBack: (id) =>
    set((state) => {
      const elements = { ...state.report.elements };
      const minZ = Math.min(...Object.values(elements).map((e) => e.zOrder));
      elements[id] = { ...elements[id], zOrder: minZ - 1 } as ReportElement;
      return { report: { ...state.report, elements } };
    }),

  // ─── Alignment & Distribution ────────────────────────────────────────

  /**
   * Align or distribute the currently selected elements.
   * Requires at least 2 selected elements. Auto-expands affected bands.
   *
   * @param alignment - Alignment type:
   *   - "left" / "right" / "top" / "bottom": align to the min/max edge
   *   - "centerH" / "centerV": center on the midline of the bounding box
   *   - "distributeH" / "distributeV": evenly space elements across the bounding box
   */
  alignElements: (alignment) =>
    set((state) => {
      const ids = state.selectedElementIds;
      if (ids.length < 2) return state;
      const els = ids.map((id) => state.report.elements[id]).filter(Boolean);
      const elements = { ...state.report.elements };
      switch (alignment) {
        case "left": {
          const v = Math.min(...els.map((e) => e.x));
          ids.forEach((id) => {
            if (elements[id])
              elements[id] = { ...elements[id], x: v } as ReportElement;
          });
          break;
        }
        case "right": {
          const v = Math.max(...els.map((e) => e.x + e.width));
          ids.forEach((id) => {
            if (elements[id])
              elements[id] = {
                ...elements[id],
                x: v - elements[id].width,
              } as ReportElement;
          });
          break;
        }
        case "top": {
          const v = Math.min(...els.map((e) => e.y));
          ids.forEach((id) => {
            if (elements[id])
              elements[id] = { ...elements[id], y: v } as ReportElement;
          });
          break;
        }
        case "bottom": {
          const v = Math.max(...els.map((e) => e.y + e.height));
          ids.forEach((id) => {
            if (elements[id])
              elements[id] = {
                ...elements[id],
                y: v - elements[id].height,
              } as ReportElement;
          });
          break;
        }
        case "centerH": {
          const c =
            (Math.min(...els.map((e) => e.x)) +
              Math.max(...els.map((e) => e.x + e.width))) /
            2;
          ids.forEach((id) => {
            if (elements[id])
              elements[id] = {
                ...elements[id],
                x: c - elements[id].width / 2,
              } as ReportElement;
          });
          break;
        }
        case "centerV": {
          const c =
            (Math.min(...els.map((e) => e.y)) +
              Math.max(...els.map((e) => e.y + e.height))) /
            2;
          ids.forEach((id) => {
            if (elements[id])
              elements[id] = {
                ...elements[id],
                y: c - elements[id].height / 2,
              } as ReportElement;
          });
          break;
        }
        case "distributeH": {
          // Evenly distribute horizontal gaps between elements
          const sorted = [...els].sort((a, b) => a.x - b.x);
          // Total width occupied by all elements
          const tw = sorted.reduce((s, e) => s + e.width, 0);
          // Gap = (span - totalWidth) / (count - 1)
          const g =
            (Math.max(...els.map((e) => e.x + e.width)) -
              Math.min(...els.map((e) => e.x)) -
              tw) /
            (sorted.length - 1);
          let cx = Math.min(...els.map((e) => e.x));
          sorted.forEach((el) => {
            elements[el.id] = { ...elements[el.id], x: cx } as ReportElement;
            cx += el.width + g;
          });
          break;
        }
        case "distributeV": {
          // Evenly distribute vertical gaps between elements
          const sorted = [...els].sort((a, b) => a.y - b.y);
          const th = sorted.reduce((s, e) => s + e.height, 0);
          const g =
            (Math.max(...els.map((e) => e.y + e.height)) -
              Math.min(...els.map((e) => e.y)) -
              th) /
            (sorted.length - 1);
          let cy = Math.min(...els.map((e) => e.y));
          sorted.forEach((el) => {
            elements[el.id] = { ...elements[el.id], y: cy } as ReportElement;
            cy += el.height + g;
          });
          break;
        }
      }
      // Auto-expand affected bands
      const newBands = state.report.bands.map((b) => {
        const minH = calcMinBandHeight(b, elements);
        return minH > b.height ? { ...b, height: minH } : b;
      });
      return { report: { ...state.report, elements, bands: newBands } };
    }),

  // ─── Canvas Setting Setters ──────────────────────────────────────────

  /** Enable or disable snap-to-element alignment. */
  setSnapEnabled: (enabled) => set({ snapEnabled: enabled }),
  /** Show or hide the grid overlay. */
  setShowGrid: (show) => set({ showGrid: show }),
  /** Change the grid cell size (in pixels, in canvas coordinates). */
  setGridSize: (size) => set({ gridSize: size }),
  /** Replace the current snap guides (visual alignment indicators). */
  setSnapGuides: (guides) => set({ snapGuides: guides }),

  // ─── Interaction State Setters ───────────────────────────────────────

  /** Set whether a drag operation is in progress. */
  setIsDragging: (dragging) => set({ isDragging: dragging }),
  /** Set whether a resize operation is in progress. */
  setIsResizing: (resizing) => set({ isResizing: resizing }),
  /** Store the current drag offset (used for drag-preview positioning). */
  setDragOffset: (offset) => set({ dragOffset: offset }),
  /** Set the currently active/focused band. */
  setActiveBandId: (id) => set({ activeBandId: id }),
  /** Toggle preview mode; clears editing state when entering preview. */
  setPreviewMode: (mode) => set({ previewMode: mode, editingElementId: null }),
  /** Set which element is currently being text-edited inline. */
  setEditingElementId: (id) => set({ editingElementId: id }),
  /** Select a specific table cell (elementId + row/col coordinates). */
  selectTableCell: (cell) => set({ selectedTableCell: cell }),
  /** Replace the preview data used when rendering the report in preview mode. */
  setPreviewData: (data) => set({ previewData: data }),

  // ─── Report I/O ──────────────────────────────────────────────────────

  /**
   * Load an external report, resetting all UI state (selection, history, editing).
   * @param report - The complete Report object to load.
   */
  loadReport: (report) =>
    set({
      report,
      selectedElementIds: [],
      history: [],
      historyIndex: -1,
      editingElementId: null,
      selectedTableCell: null,
      parameterAnswers: {},
    }),

  /**
   * Serialize the current report to a pretty-printed JSON string.
   * @returns JSON string representation of the report.
   */
  saveReport: () => JSON.stringify(get().report, null, 2),

  /**
   * Duplicate an element within the same band. The copy is offset by (20, 20) px
   * and receives a new ID. Pushes undo history and selects the duplicate.
   *
   * @param id - Element ID to duplicate.
   */
  duplicateElement: (id) =>
    set((state) => {
      const el = state.report.elements[id];
      if (!el) return state;
      get().pushHistory();
      const newId = uuidv4();
      const duplicated = {
        ...deepClone(el),
        id: newId,
        x: el.x + 20,
        y: el.y + 20,
      };
      const bandId = state.report.bands.find((b) =>
        b.elements.includes(id),
      )?.id;
      const newElements = { ...state.report.elements, [newId]: duplicated };
      const newBands = state.report.bands.map((b) => {
        if (b.id !== bandId) return b;
        const updated = { ...b, elements: [...b.elements, newId] };
        return {
          ...updated,
          height: Math.max(b.height, calcMinBandHeight(updated, newElements)),
        };
      });
      return {
        report: { ...state.report, elements: newElements, bands: newBands },
        selectedElementIds: [newId],
      };
    }),

  // ─── Rectangular Selection ────────────────────────────────────────────

  /**
   * Select all visible elements within a rectangular region of a specific band.
   * Used for rubber-band (marquee) selection.
   *
   * @param x1     - Left edge of the rectangle (band-relative).
   * @param y1     - Top edge of the rectangle.
   * @param x2     - Right edge of the rectangle.
   * @param y2     - Bottom edge of the rectangle.
   * @param bandId - The band to search within.
   */
  selectElementsInRect: (x1, y1, x2, y2, bandId) =>
    set((state) => {
      const band = state.report.bands.find((b) => b.id === bandId);
      if (!band) return { selectedElementIds: [] };
      // Normalize the rectangle (handle drag in any direction)
      const left = Math.min(x1, x2),
        top = Math.min(y1, y2);
      const right = Math.max(x1, x2),
        bottom = Math.max(y1, y2);
      // AABB intersection test: element overlaps the selection rect
      const hitIds = band.elements.filter((eid) => {
        const el = state.report.elements[eid];
        if (!el || !el.visible) return false;
        return (
          el.x < right &&
          el.x + el.width > left &&
          el.y < bottom &&
          el.y + el.height > top
        );
      });
      return { selectedElementIds: hitIds };
    }),
}));
