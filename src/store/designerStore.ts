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

interface HistoryEntry {
  elements: Record<string, ReportElement>;
  bands: Band[];
}

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

const MAX_HISTORY = 50;

/** Fast deep clone using structuredClone (available in modern browsers) */
const deepClone =
  typeof structuredClone !== "undefined"
    ? <T>(val: T): T => structuredClone(val)
    : <T>(val: T): T => JSON.parse(JSON.stringify(val));

/** Calculate the minimum band height needed to contain all its elements */
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
  report: createDefaultReport(),
  selectedElementIds: [],
  activeTool: "select",
  zoom: 1,
  snapEnabled: true,
  gridSize: 8,
  snapGuides: [],
  showGrid: true,
  clipboard: [],
  history: [],
  historyIndex: -1,
  isDragging: false,
  isResizing: false,
  dragOffset: { x: 0, y: 0 },
  activeBandId: null,
  previewMode: false,
  editingElementId: null,
  previewData: {},
  selectedTableCell: null,
  parameterAnswers: {},

  setParameterAnswers: (answers) => set({ parameterAnswers: answers }),

  setReport: (report) => set({ report }),

  updatePageSettings: (settings) =>
    set((state) => ({
      report: {
        ...state.report,
        pageSettings: { ...state.report.pageSettings, ...settings },
      },
    })),

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

  clearSelection: () =>
    set({ selectedElementIds: [], selectedTableCell: null }),

  setActiveTool: (tool) => set({ activeTool: tool, editingElementId: null }),

  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(3, zoom)) }),

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

  recalcBandHeights: () =>
    set((state) => {
      const newBands = state.report.bands.map((b) => {
        const minH = calcMinBandHeight(b, state.report.elements);
        return minH !== b.height ? { ...b, height: minH } : b;
      });
      return { report: { ...state.report, bands: newBands } };
    }),

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
      const insertIndex = bandOrder.indexOf(type);
      const newBands = [...state.report.bands];
      newBands.splice(Math.min(insertIndex, newBands.length), 0, newBand);
      return { report: { ...state.report, bands: newBands } };
    }),

  updateBand: (id, updates) =>
    set((state) => ({
      report: {
        ...state.report,
        bands: state.report.bands.map((b) =>
          b.id === id ? { ...b, ...updates } : b,
        ),
      },
    })),

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

  addDataSource: (ds) =>
    set((state) => ({
      report: {
        ...state.report,
        dataSources: [...state.report.dataSources, ds],
      },
    })),

  updateDataSource: (id, updates) =>
    set((state) => ({
      report: {
        ...state.report,
        dataSources: state.report.dataSources.map((ds) =>
          ds.id === id ? { ...ds, ...updates } : ds,
        ),
      },
    })),

  removeDataSource: (id) =>
    set((state) => ({
      report: {
        ...state.report,
        dataSources: state.report.dataSources.filter((ds) => ds.id !== id),
      },
    })),

  copySelected: () =>
    set((state) => ({
      clipboard: state.selectedElementIds
        .map((id) => state.report.elements[id])
        .filter(Boolean)
        .map((el) => deepClone(el)),
    })),

  pasteElements: () =>
    set((state) => {
      get().pushHistory();
      const newElements = { ...state.report.elements };
      const newIds: string[] = [];
      const activeBandId = state.activeBandId || state.report.bands[0]?.id;
      if (!activeBandId) return state;
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

  pushHistory: () =>
    set((state) => {
      const entry: HistoryEntry = {
        elements: deepClone(state.report.elements),
        bands: deepClone(state.report.bands),
      };
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(entry);
      if (newHistory.length > MAX_HISTORY) newHistory.shift();
      return { history: newHistory, historyIndex: newHistory.length - 1 };
    }),

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

  bringToFront: (id) =>
    set((state) => {
      const elements = { ...state.report.elements };
      const maxZ = Math.max(...Object.values(elements).map((e) => e.zOrder));
      elements[id] = { ...elements[id], zOrder: maxZ + 1 } as ReportElement;
      return { report: { ...state.report, elements } };
    }),

  sendToBack: (id) =>
    set((state) => {
      const elements = { ...state.report.elements };
      const minZ = Math.min(...Object.values(elements).map((e) => e.zOrder));
      elements[id] = { ...elements[id], zOrder: minZ - 1 } as ReportElement;
      return { report: { ...state.report, elements } };
    }),

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
          const sorted = [...els].sort((a, b) => a.x - b.x);
          const tw = sorted.reduce((s, e) => s + e.width, 0);
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

  setSnapEnabled: (enabled) => set({ snapEnabled: enabled }),
  setShowGrid: (show) => set({ showGrid: show }),
  setGridSize: (size) => set({ gridSize: size }),
  setSnapGuides: (guides) => set({ snapGuides: guides }),
  setIsDragging: (dragging) => set({ isDragging: dragging }),
  setIsResizing: (resizing) => set({ isResizing: resizing }),
  setDragOffset: (offset) => set({ dragOffset: offset }),
  setActiveBandId: (id) => set({ activeBandId: id }),
  setPreviewMode: (mode) => set({ previewMode: mode, editingElementId: null }),
  setEditingElementId: (id) => set({ editingElementId: id }),
  selectTableCell: (cell) => set({ selectedTableCell: cell }),
  setPreviewData: (data) => set({ previewData: data }),

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

  saveReport: () => JSON.stringify(get().report, null, 2),

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

  selectElementsInRect: (x1, y1, x2, y2, bandId) =>
    set((state) => {
      const band = state.report.bands.find((b) => b.id === bandId);
      if (!band) return { selectedElementIds: [] };
      const left = Math.min(x1, x2),
        top = Math.min(y1, y2);
      const right = Math.max(x1, x2),
        bottom = Math.max(y1, y2);
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
