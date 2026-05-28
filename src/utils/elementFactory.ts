/**
 * @file elementFactory.ts
 * Element factory and utility functions for the Report Designer.
 *
 * Provides:
 * - Default style presets (font, borders, padding)
 * - Factory function `createElement` to instantiate any of the 10 element types
 * - Expression evaluator `evaluateExpression` for data-bound fields and formulas
 * - Snap-to-grid and snap-guide computation helpers
 * - Default table/chart data generators
 */
import { v4 as uuidv4 } from "uuid";
import type {
  ReportElement,
  ElementType,
  TextElement,
  RectangleElement,
  LineElement,
  ImageElement,
  BarcodeElement,
  QRCodeElement,
  ChartElement,
  TableElement,
  FontConfig,
  Borders,
  Padding,
  TableData,
  TableCell,
  TableRow,
  TableColumn,
  ChartData,
} from "../types";

/* ─── Default Style Presets ─── */

/** Default font configuration: Microsoft YaHei 12pt, regular weight, dark gray */
const defaultFont: FontConfig = {
  family: "Microsoft YaHei",
  size: 12,
  bold: false,
  italic: false,
  underline: false,
  color: "#333333",
};

/** Default borders: invisible (style "none") on all four sides */
const defaultBorders: Borders = {
  top: { style: "none", width: 1, color: "#000000" },
  right: { style: "none", width: 1, color: "#000000" },
  bottom: { style: "none", width: 1, color: "#000000" },
  left: { style: "none", width: 1, color: "#000000" },
};

/** Default padding: 2px top/bottom, 4px left/right */
const defaultPadding: Padding = { top: 2, right: 4, bottom: 2, left: 4 };

/* ─── Default Data Generators ─── */

/** Creates a default 3-column × 2-row table with one header row and one data row */
function createDefaultTable(): TableData {
  const cols: TableColumn[] = [
    { id: uuidv4(), width: 120 },
    { id: uuidv4(), width: 120 },
    { id: uuidv4(), width: 120 },
  ];
  const headerRow: TableRow = { id: uuidv4(), height: 30, isHeader: true };
  const dataRow: TableRow = { id: uuidv4(), height: 28, isHeader: false };
  const rows = [headerRow, dataRow];

  // Generate cells: header row gets bold text on light background, data row is blank
  const cells: TableCell[][] = rows.map((_row, ri) =>
    cols.map((_col, ci) => ({
      id: uuidv4(),
      rowSpan: 1,
      colSpan: 1,
      content: ri === 0 ? `表头${ci + 1}` : "",
      dataField: ri === 0 ? undefined : "",
      font: { ...defaultFont, bold: ri === 0, size: ri === 0 ? 13 : 12 },
      backgroundColor: ri === 0 ? "#f0f4f8" : "#ffffff",
      borders: {
        top: { style: "solid", width: 1, color: "#d0d5dd" },
        right: { style: "solid", width: 1, color: "#d0d5dd" },
        bottom: { style: "solid", width: 1, color: "#d0d5dd" },
        left: { style: "solid", width: 1, color: "#d0d5dd" },
      },
      padding: { ...defaultPadding },
      horizontalAlign: "center" as const,
      verticalAlign: "middle" as const,
      diagonalLine: false,
      wordWrap: false,
      autoGrow: false,
      mask: "",
      format: "",
    })),
  );

  return { columns: cols, rows, cells };
}

/** Creates default chart data with a single bar series and sample categories */
function createDefaultChartData(): ChartData {
  return {
    chartType: "bar",
    title: "示例图表",
    // Quarterly categories with two sample series
    categories: ["Q1", "Q2", "Q3", "Q4"],
    series: [
      { name: "销售额", data: [120, 200, 150, 180] },
      { name: "利润", data: [50, 80, 60, 75] },
    ],
  };
}

/* ─── Element Factory ─── */

/**
 * Creates a new report element of the given type at the specified position.
 *
 * Each element type is initialized with sensible defaults (size, style, name).
 * The returned element gets a unique ID and a zOrder based on the current timestamp.
 *
 * @param type - The element type to create (text, rectangle, line, image, barcode, qrcode, chart, table, subreport, crosstab)
 * @param x    - Initial X position within the band
 * @param y    - Initial Y position within the band
 * @returns A fully-initialized ReportElement of the requested type
 */
export function createElement(
  type: ElementType,
  x: number,
  y: number,
): ReportElement {
  // Common properties shared by all element types
  const base = {
    id: uuidv4(),
    x,
    y,
    rotation: 0,
    locked: false,
    visible: true,
    zOrder: Date.now(),
  };

  switch (type) {
    /* ─── Text ─── */
    case "text":
      return {
        ...base,
        type: "text",
        width: 150,
        height: 30,
        name: "文本",
        content: "文本内容",
        font: { ...defaultFont },
        backgroundColor: "transparent",
        borders: { ...defaultBorders },
        padding: { ...defaultPadding },
        horizontalAlign: "left",
        verticalAlign: "middle",
        wordWrap: true,
        autoSize: false,
      } as TextElement;

    /* ─── Rectangle ─── */
    case "rectangle":
      return {
        ...base,
        type: "rectangle",
        width: 200,
        height: 100,
        name: "矩形",
        fillColor: "#ffffff",
        borderColor: "#333333",
        borderWidth: 1,
        borderRadius: 0,
        borders: { ...defaultBorders },
      } as RectangleElement;

    /* ─── Line ─── */
    case "line":
      return {
        ...base,
        type: "line",
        width: 200,
        height: 1,
        name: "线条",
        direction: "horizontal",
        color: "#333333",
        lineWidth: 1,
        style: "solid",
      } as LineElement;

    /* ─── Image ─── */
    case "image":
      return {
        ...base,
        type: "image",
        width: 150,
        height: 150,
        name: "图片",
        src: "",
        objectFit: "contain",
      } as ImageElement;

    /* ─── Barcode ─── */
    case "barcode":
      return {
        ...base,
        type: "barcode",
        width: 180,
        height: 60,
        name: "条形码",
        format: "CODE128",
        value: "1234567890",
        showText: true,
      } as BarcodeElement;

    /* ─── QR Code ─── */
    case "qrcode":
      return {
        ...base,
        type: "qrcode",
        width: 80,
        height: 80,
        name: "二维码",
        value: "https://example.com",
        errorLevel: "M",
        size: 80,
      } as QRCodeElement;

    /* ─── Chart ─── */
    case "chart":
      return {
        ...base,
        type: "chart",
        width: 350,
        height: 250,
        name: "图表",
        chartData: createDefaultChartData(),
        backgroundColor: "#ffffff",
      } as ChartElement;

    /* ─── Table ─── */
    case "table":
      return {
        ...base,
        type: "table",
        width: 360,
        height: 58,
        name: "表格",
        tableData: createDefaultTable(),
        repeatHeader: true,
      } as TableElement;

    /* ─── Sub-report ─── */
    case "subreport":
      return {
        ...base,
        type: "subreport",
        width: 300,
        height: 200,
        name: "子报表",
        parameters: {},
      } as any;

    /* ─── Cross-tab (pivot table) ─── */
    case "crosstab":
      return {
        ...base,
        type: "crosstab",
        width: 300,
        height: 200,
        name: "交叉表",
        rowField: "",
        columnField: "",
        valueField: "",
        valueFunction: "sum",
      } as any;

    // Fallback: create a text element for unknown types
    default:
      return {
        ...base,
        type: "text",
        width: 150,
        height: 30,
        name: "文本",
        content: "文本内容",
        font: { ...defaultFont },
        backgroundColor: "transparent",
        borders: { ...defaultBorders },
        padding: { ...defaultPadding },
        horizontalAlign: "left",
        verticalAlign: "middle",
        wordWrap: true,
        autoSize: false,
      } as TextElement;
  }
}

/* ─── Expression Evaluation ─── */

import { evaluateFormula } from "./formulaEngine";

/**
 * Evaluates a report expression (data field binding, formula, or built-in variable)
 * against the provided data and rendering context.
 *
 * Delegates to the formula engine for parsing and evaluation.
 *
 * @param expression - The expression string (e.g. "{fieldName}", "=Sum(\"qty\")", "{PageNumber}")
 * @param data       - The current row of data (for field bindings)
 * @param context    - Rendering context providing page numbers, aggregated data, etc.
 * @returns The evaluated result (string, number, or other type)
 */
export function evaluateExpression(
  expression: string,
  data?: any,
  context?: {
    pageNumber?: number;
    totalPages?: number;
    allData?: any[];
    groupData?: any[];
  },
): any {
  return evaluateFormula(expression, data, context);
}

/* ─── Display Mask & Format ─── */

/**
 * Apply a display mask to a value.
 *
 * Mask characters:
 *   '#' = digit placeholder (replaced by the corresponding value character)
 *   '*' = character placeholder (replaced by value char or '*' if no more chars)
 *   Any other character = literal (inserted as-is into the output)
 *
 * @param value - The raw string value to mask
 * @param mask  - The mask pattern
 * @returns The masked string
 *
 * @example applyMask("13812345678", "###-####-####") => "138-1234-5678"
 */
export function applyMask(value: string, mask: string): string {
  if (!mask || !value) return value;
  const result: string[] = [];
  let vi = 0;
  for (let i = 0; i < mask.length && vi < value.length; i++) {
    const ch = mask[i];
    if (ch === "#" || ch === "*") {
      result.push(value[vi] || (ch === "*" ? "*" : ""));
      vi++;
    } else {
      result.push(ch);
    }
  }
  return result.join("");
}

/**
 * Apply a format string to a value.
 *
 * Supports number formats and date formats:
 * - Number: "#,##0.00", "0.00%", "#,##0", "0.00", "0%", or generic patterns with commas/decimals/percent
 * - Date:   "yyyy-MM-dd", "yyyy/MM/dd HH:mm", "MM/dd/yyyy", etc.
 *
 * Values starting with "[" are treated as non-numeric (skip number formatting).
 *
 * @param value  - The raw string value to format
 * @param format - The format pattern string
 * @returns The formatted string, or the original value if no format matched
 */
export function applyFormat(value: string, format: string): string {
  if (!format || !value) return value;

  // Try as number
  const num = Number(value);
  if (!isNaN(num) && value.trim() !== "" && !value.startsWith("[")) {
    if (format === "#,##0.00")
      return num.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    if (format === "#,##0")
      return num.toLocaleString("en-US", { maximumFractionDigits: 0 });
    if (format === "0.00") return num.toFixed(2);
    if (format === "0.00%") return (num * 100).toFixed(2) + "%";
    if (format === "0%") return Math.round(num * 100) + "%";
    // Generic pattern
    if (format.includes(",") || format.includes(".")) {
      const decimalMatch = format.match(/\.(0+)/);
      const decimals = decimalMatch ? decimalMatch[1].length : 0;
      return num.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
        useGrouping: format.includes(","),
      });
    }
    if (format.endsWith("%")) {
      const pct = num * 100;
      const dm = format.match(/\.(0+)/);
      const dec = dm ? dm[1].length : 0;
      return pct.toFixed(dec) + "%";
    }
  }

  // Try as date
  const dateVal = new Date(value);
  if (
    !isNaN(dateVal.getTime()) &&
    (format.includes("y") || format.includes("M") || format.includes("d"))
  ) {
    const pad = (n: number) => String(n).padStart(2, "0");
    let result = format;
    result = result.replace("yyyy", String(dateVal.getFullYear()));
    result = result.replace("MM", pad(dateVal.getMonth() + 1));
    result = result.replace("dd", pad(dateVal.getDate()));
    result = result.replace("HH", pad(dateVal.getHours()));
    result = result.replace("mm", pad(dateVal.getMinutes()));
    result = result.replace("ss", pad(dateVal.getSeconds()));
    return result;
  }

  return value;
}

/* ─── CSS Conversion Utilities ─── */

/**
 * Converts a FontConfig object to a React CSS properties object.
 *
 * @param font - The font configuration to convert
 * @returns CSS properties for fontFamily, fontSize, fontWeight, fontStyle, textDecoration, and color
 */
export function fontToCSS(font: FontConfig): React.CSSProperties {
  return {
    fontFamily: font.family,
    fontSize: `${font.size}px`,
    fontWeight: font.bold ? "bold" : "normal",
    fontStyle: font.italic ? "italic" : "normal",
    textDecoration: font.underline ? "underline" : "none",
    color: font.color,
  };
}

/**
 * Converts a Borders object to a React CSS properties object with per-side border strings.
 * Borders with style "none" are converted to the CSS value "none".
 *
 * @param borders - The borders configuration to convert
 * @returns CSS properties for borderTop, borderRight, borderBottom, and borderLeft
 */
export function bordersToCSS(borders: Borders): React.CSSProperties {
  /** Helper: converts a single border side to a CSS border string, or "none" if hidden. */
  const toBorder = (b?: { style: string; width: number; color: string }) =>
    b && b.style !== "none" ? `${b.style} ${b.width}px ${b.color}` : "none";
  return {
    borderTop: toBorder(borders.top),
    borderRight: toBorder(borders.right),
    borderBottom: toBorder(borders.bottom),
    borderLeft: toBorder(borders.left),
  };
}

/* ─── Snap-to-Grid & Snap-Guide Helpers ─── */

/**
 * Snaps a coordinate value to the nearest grid line.
 *
 * @param value    - The raw coordinate value
 * @param gridSize - The grid spacing in pixels
 * @returns The coordinate rounded to the nearest grid multiple
 */
export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

/**
 * Computes snap guides and adjusted position for a moving element relative to
 * other elements and canvas edges.
 *
 * Checks 10 alignment scenarios (5 per axis):
 *   - Edge-to-edge: left↔left, right↔right
 *   - Adjacent:     left↔right, right↔left
 *   - Center:       centerX↔centerX / centerY↔centerY
 *   - Top/bottom analogues of the above
 *
 * Canvas edge targets include origin (0,0), far corner, and center point.
 *
 * @param movingEl     - The element being dragged (position + dimensions)
 * @param allElements  - All other elements on the canvas to snap against
 * @param threshold    - Maximum pixel distance for a snap to trigger (default 5px)
 * @param canvasBounds - Optional canvas dimensions for edge/center snapping
 * @returns An object with the snapped x/y position and an array of guide lines to render
 */
export function computeSnapGuides(
  movingEl: { x: number; y: number; width: number; height: number },
  allElements: { x: number; y: number; width: number; height: number }[],
  threshold: number = 5,
  canvasBounds?: { width: number; height: number },
): {
  x: number;
  y: number;
  guides: { type: "vertical" | "horizontal"; position: number }[];
} {
  const guides: { type: "vertical" | "horizontal"; position: number }[] = [];
  let snappedX = movingEl.x;
  let snappedY = movingEl.y;

  // Pre-compute key reference points on the moving element
  const movingCX = movingEl.x + movingEl.width / 2;
  const movingCY = movingEl.y + movingEl.height / 2;
  const movingRight = movingEl.x + movingEl.width;
  const movingBottom = movingEl.y + movingEl.height;

  // Build snap targets: canvas edges (origin, far corner, center) plus all other elements
  const edgeTargets: { x: number; y: number; width: number; height: number }[] =
    [];
  if (canvasBounds) {
    // Canvas edges and center serve as snap reference points
    edgeTargets.push({ x: 0, y: 0, width: 0, height: 0 }); // top-left origin
    edgeTargets.push({
      x: canvasBounds.width,
      y: canvasBounds.height,
      width: 0,
      height: 0,
    }); // bottom-right corner
    edgeTargets.push({
      x: canvasBounds.width / 2,
      y: canvasBounds.height / 2,
      width: 0,
      height: 0,
    }); // canvas center
  }

  const snapTargets = [...allElements, ...edgeTargets];

  // Check each target for horizontal (X) and vertical (Y) snap alignment
  for (const el of snapTargets) {
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    const right = el.x + el.width;
    const bottom = el.y + el.height;

    // ── Horizontal (X-axis) snaps ──

    // Snap left edges
    if (Math.abs(movingEl.x - el.x) < threshold) {
      snappedX = el.x;
      guides.push({ type: "vertical", position: el.x });
    }
    // Snap right edges
    if (Math.abs(movingRight - right) < threshold) {
      snappedX = right - movingEl.width;
      guides.push({ type: "vertical", position: right });
    }
    // Snap left to right
    if (Math.abs(movingEl.x - right) < threshold) {
      snappedX = right;
      guides.push({ type: "vertical", position: right });
    }
    // Snap right to left
    if (Math.abs(movingRight - el.x) < threshold) {
      snappedX = el.x - movingEl.width;
      guides.push({ type: "vertical", position: el.x });
    }
    // Snap center X (align horizontal midpoints)
    if (Math.abs(movingCX - cx) < threshold) {
      snappedX = cx - movingEl.width / 2;
      guides.push({ type: "vertical", position: cx });
    }

    // ── Vertical (Y-axis) snaps ──

    // Snap top edges
    if (Math.abs(movingEl.y - el.y) < threshold) {
      snappedY = el.y;
      guides.push({ type: "horizontal", position: el.y });
    }
    // Snap bottom edges
    if (Math.abs(movingBottom - bottom) < threshold) {
      snappedY = bottom - movingEl.height;
      guides.push({ type: "horizontal", position: bottom });
    }
    // Snap top to bottom
    if (Math.abs(movingEl.y - bottom) < threshold) {
      snappedY = bottom;
      guides.push({ type: "horizontal", position: bottom });
    }
    // Snap bottom to top
    if (Math.abs(movingBottom - el.y) < threshold) {
      snappedY = el.y - movingEl.height;
      guides.push({ type: "horizontal", position: el.y });
    }
    // Snap center Y (align vertical midpoints)
    if (Math.abs(movingCY - cy) < threshold) {
      snappedY = cy - movingEl.height / 2;
      guides.push({ type: "horizontal", position: cy });
    }
  }

  return { x: snappedX, y: snappedY, guides };
}
