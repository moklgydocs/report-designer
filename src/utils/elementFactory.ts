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

const defaultFont: FontConfig = {
  family: "Microsoft YaHei",
  size: 12,
  bold: false,
  italic: false,
  underline: false,
  color: "#333333",
};

const defaultBorders: Borders = {
  top: { style: "none", width: 1, color: "#000000" },
  right: { style: "none", width: 1, color: "#000000" },
  bottom: { style: "none", width: 1, color: "#000000" },
  left: { style: "none", width: 1, color: "#000000" },
};

const defaultPadding: Padding = { top: 2, right: 4, bottom: 2, left: 4 };

function createDefaultTable(): TableData {
  const cols: TableColumn[] = [
    { id: uuidv4(), width: 120 },
    { id: uuidv4(), width: 120 },
    { id: uuidv4(), width: 120 },
  ];
  const headerRow: TableRow = { id: uuidv4(), height: 30, isHeader: true };
  const dataRow: TableRow = { id: uuidv4(), height: 28, isHeader: false };
  const rows = [headerRow, dataRow];

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

function createDefaultChartData(): ChartData {
  return {
    chartType: "bar",
    title: "示例图表",
    categories: ["Q1", "Q2", "Q3", "Q4"],
    series: [
      { name: "销售额", data: [120, 200, 150, 180] },
      { name: "利润", data: [50, 80, 60, 75] },
    ],
  };
}

export function createElement(
  type: ElementType,
  x: number,
  y: number,
): ReportElement {
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

    case "subreport":
      return {
        ...base,
        type: "subreport",
        width: 300,
        height: 200,
        name: "子报表",
        parameters: {},
      } as any;

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

import { evaluateFormula } from "./formulaEngine";

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

/**
 * Apply a display mask to a value.
 * '#' = digit placeholder, '*' = character placeholder, other = literal
 * Example: applyMask("13812345678", "###-####-####") => "138-1234-5678"
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
 * Number: "#,##0.00", "0.00%", "#,##0"
 * Date: "yyyy-MM-dd", "yyyy/MM/dd HH:mm", "MM/dd/yyyy"
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

export function bordersToCSS(borders: Borders): React.CSSProperties {
  const toBorder = (b?: { style: string; width: number; color: string }) =>
    b && b.style !== "none" ? `${b.style} ${b.width}px ${b.color}` : "none";
  return {
    borderTop: toBorder(borders.top),
    borderRight: toBorder(borders.right),
    borderBottom: toBorder(borders.bottom),
    borderLeft: toBorder(borders.left),
  };
}

export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

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

  const movingCX = movingEl.x + movingEl.width / 2;
  const movingCY = movingEl.y + movingEl.height / 2;
  const movingRight = movingEl.x + movingEl.width;
  const movingBottom = movingEl.y + movingEl.height;

  // Canvas edge snap targets
  const edgeTargets: { x: number; y: number; width: number; height: number }[] =
    [];
  if (canvasBounds) {
    // Left edge (x=0), right edge (x=canvasWidth), center (x=canvasWidth/2)
    // Top edge (y=0), bottom edge (y=canvasHeight), center (y=canvasHeight/2)
    edgeTargets.push({ x: 0, y: 0, width: 0, height: 0 }); // origin point
    edgeTargets.push({
      x: canvasBounds.width,
      y: canvasBounds.height,
      width: 0,
      height: 0,
    }); // far corner
    edgeTargets.push({
      x: canvasBounds.width / 2,
      y: canvasBounds.height / 2,
      width: 0,
      height: 0,
    }); // center
  }

  const snapTargets = [...allElements, ...edgeTargets];

  for (const el of snapTargets) {
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    const right = el.x + el.width;
    const bottom = el.y + el.height;

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
    // Snap center X
    if (Math.abs(movingCX - cx) < threshold) {
      snappedX = cx - movingEl.width / 2;
      guides.push({ type: "vertical", position: cx });
    }
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
    // Snap center Y
    if (Math.abs(movingCY - cy) < threshold) {
      snappedY = cy - movingEl.height / 2;
      guides.push({ type: "horizontal", position: cy });
    }
  }

  return { x: snappedX, y: snappedY, guides };
}
