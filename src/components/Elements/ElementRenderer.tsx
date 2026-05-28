import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import JsBarcode from "jsbarcode";
import QRCodeLib from "qrcode";
import type {
  ReportElement,
  TextElement,
  RectangleElement,
  LineElement,
  ImageElement,
  BarcodeElement,
  QRCodeElement,
  ChartElement,
  TableElement,
  CrossTabElement,
  SubreportElement,
  RenderContext,
} from "../../types";
import {
  fontToCSS,
  bordersToCSS,
  evaluateExpression,
  applyFormat,
  applyMask,
} from "../../utils/elementFactory";
import {
  drawBarChart,
  drawLineChart,
  drawPieChart,
  drawAreaChart,
} from "../../utils/chartRenderer";
import { computeCrossTab } from "../../utils/reportRenderer";
import { useDesignerStore } from "../../store/designerStore";
import "./ElementRenderer.css";

interface ElementRendererProps {
  element: ReportElement;
  isSelected: boolean;
  zoom: number;
  previewMode: boolean;
  dataRow?: Record<string, any>;
  renderContext?: RenderContext;
  onDragStart: (e: React.MouseEvent) => void;
  onResizeStart: (handle: string, e: React.MouseEvent) => void;
  onSelect: (e: React.MouseEvent) => void;
}

export const ElementRenderer: React.FC<ElementRendererProps> = React.memo(
  ({
    element,
    isSelected,
    zoom: _zoom,
    previewMode,
    dataRow,
    renderContext,
    onDragStart,
    onResizeStart,
    onSelect,
  }) => {
    const { editingElementId, setEditingElementId, pushHistory } =
      useDesignerStore();
    const isEditing =
      editingElementId === element.id && element.type === "text";

    if (!element.visible && previewMode) return null;

    const handleMouseDown = (e: React.MouseEvent) => {
      if (!element.locked && !isEditing) {
        onDragStart(e);
      }
      onSelect(e);
    };

    const handleDoubleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (element.type === "text" && !element.locked) {
        pushHistory();
        setEditingElementId(element.id);
      }
    };

    const renderContent = () => {
      switch (element.type) {
        case "text":
          return (
            <TextContent
              element={element}
              previewMode={previewMode}
              isEditing={isEditing}
              dataRow={dataRow}
              renderContext={renderContext}
            />
          );
        case "rectangle":
          return <RectangleContent element={element} />;
        case "line":
          return <LineContent element={element} />;
        case "image":
          return (
            <ImageContent
              element={element}
              dataRow={dataRow}
              renderContext={renderContext}
              previewMode={previewMode}
            />
          );
        case "barcode":
          return (
            <BarcodeContent
              element={element}
              dataRow={dataRow}
              previewMode={previewMode}
            />
          );
        case "qrcode":
          return (
            <QRCodeContent
              element={element}
              dataRow={dataRow}
              previewMode={previewMode}
            />
          );
        case "chart":
          return <ChartContent element={element} />;
        case "table":
          return (
            <TableContent
              element={element}
              previewMode={previewMode}
              dataRow={dataRow}
              renderContext={renderContext}
            />
          );
        case "subreport":
          return (
            <SubreportContent
              element={element}
              dataRow={dataRow}
              previewMode={previewMode}
            />
          );
        case "crosstab":
          return (
            <CrossTabContent
              element={element}
              dataRow={dataRow}
              previewMode={previewMode}
            />
          );
        default:
          return <div className="element-content">未知元素</div>;
      }
    };

    return (
      <div
        className={`report-element ${isSelected ? "selected" : ""} ${element.locked ? "locked" : ""}`}
        data-element-id={element.id}
        style={{
          left: `${element.x}px`,
          top: `${element.y}px`,
          width: `${element.width}px`,
          height: `${element.height}px`,
          transform: element.rotation
            ? `rotate(${element.rotation}deg)`
            : undefined,
          zIndex: element.zOrder,
          opacity: element.visible ? 1 : 0.4,
        }}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
      >
        <div className="element-hover-border" />
        {isSelected && <div className="element-selection-border" />}
        <div className="element-content">{renderContent()}</div>
        {isSelected && !previewMode && !element.locked && !isEditing && (
          <>
            {["nw", "n", "ne", "e", "se", "s", "sw", "w"].map((handle) => (
              <div
                key={handle}
                className={`element-resize-handle ${handle}`}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onResizeStart(handle, e);
                }}
              />
            ))}
          </>
        )}
      </div>
    );
  },
);
ElementRenderer.displayName = "ElementRenderer";

/* ───── Text ───── */
const TextContent: React.FC<{
  element: TextElement;
  previewMode: boolean;
  isEditing: boolean;
  dataRow?: Record<string, any>;
  renderContext?: RenderContext;
}> = React.memo(
  ({ element, previewMode, isEditing, dataRow, renderContext }) => {
    const editRef = useRef<HTMLDivElement>(null);
    const { updateElement, setEditingElementId } = useDesignerStore();

    useEffect(() => {
      if (isEditing && editRef.current) {
        editRef.current.focus();
        const range = document.createRange();
        range.selectNodeContents(editRef.current);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }, [isEditing]);

    const commitEdit = useCallback(() => {
      if (editRef.current) {
        updateElement(element.id, {
          content: editRef.current.innerText,
        } as any);
      }
      setEditingElementId(null);
    }, [element.id, updateElement, setEditingElementId]);

    const rawDisplayText = previewMode
      ? evaluateExpression(
          element.content || element.expression || element.dataField || "",
          dataRow,
          renderContext,
        )
      : element.content || element.expression || element.dataField || "文本";

    const displayText = String(
      rawDisplayText !== undefined && rawDisplayText !== null
        ? rawDisplayText
        : "",
    );

    // Format numbers in preview mode
    const formatNumber = (text: string): string => {
      if (!previewMode) return text;
      // If the resolved value is a number, format it with commas
      const num = Number(text);
      if (
        !isNaN(num) &&
        text.trim() !== "" &&
        !text.startsWith("[") &&
        text.trim() !== "0"
      ) {
        // Check if the original field reference suggests it's a monetary/quantity field
        const raw = element.content || element.dataField || "";
        if (
          raw.includes("price") ||
          raw.includes("amount") ||
          raw.includes("Price") ||
          raw.includes("Amount") ||
          raw.includes("金额") ||
          raw.includes("单价")
        ) {
          return num.toLocaleString("zh-CN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
        }
        if (
          raw.includes("qty") ||
          raw.includes("Qty") ||
          raw.includes("数量")
        ) {
          return num.toLocaleString("zh-CN");
        }
      }
      return text;
    };

    if (isEditing) {
      return (
        <div
          ref={editRef}
          contentEditable
          suppressContentEditableWarning
          className="text-element-content editing"
          style={{
            ...fontToCSS(element.font),
            backgroundColor:
              element.backgroundColor !== "transparent"
                ? element.backgroundColor
                : "#fff",
            ...bordersToCSS(element.borders),
            justifyContent:
              element.verticalAlign === "middle"
                ? "center"
                : element.verticalAlign === "bottom"
                  ? "flex-end"
                  : "flex-start",
            textAlign: element.horizontalAlign,
            padding: `${element.padding?.top || 2}px ${element.padding?.right || 4}px ${element.padding?.bottom || 2}px ${element.padding?.left || 4}px`,
            wordBreak: element.wordWrap ? "break-word" : "normal",
            whiteSpace: element.wordWrap ? "pre-wrap" : "nowrap",
          }}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === "Escape" || (e.key === "Enter" && !e.shiftKey)) {
              e.preventDefault();
              commitEdit();
            }
            e.stopPropagation();
          }}
        >
          {element.content}
        </div>
      );
    }

    return (
      <div
        className="text-element-content"
        style={{
          ...fontToCSS(element.font),
          backgroundColor:
            element.backgroundColor !== "transparent"
              ? element.backgroundColor
              : undefined,
          ...bordersToCSS(element.borders),
          justifyContent:
            element.verticalAlign === "middle"
              ? "center"
              : element.verticalAlign === "bottom"
                ? "flex-end"
                : "flex-start",
          textAlign: element.horizontalAlign,
          padding: `${element.padding?.top || 2}px ${element.padding?.right || 4}px ${element.padding?.bottom || 2}px ${element.padding?.left || 4}px`,
          wordBreak: element.wordWrap ? "break-word" : "normal",
          whiteSpace: element.wordWrap ? "pre-wrap" : "nowrap",
        }}
      >
        {formatNumber(displayText)}
      </div>
    );
  },
);
TextContent.displayName = "TextContent";

/* ───── Rectangle ───── */
const RectangleContent: React.FC<{ element: RectangleElement }> = React.memo(
  ({ element }) => (
    <div
      className="rectangle-element-content"
      style={{
        backgroundColor: element.fillColor,
        border: `${element.borderWidth}px solid ${element.borderColor}`,
        borderRadius: `${element.borderRadius}px`,
      }}
    />
  ),
);
RectangleContent.displayName = "RectangleContent";

/* ───── Line ───── */
const LineContent: React.FC<{ element: LineElement }> = React.memo(
  ({ element }) => (
    <div className="line-element-content">
      <svg
        width="100%"
        height="100%"
        style={{ position: "absolute", inset: 0 }}
      >
        {element.direction === "horizontal" && (
          <line
            x1="0"
            y1="50%"
            x2="100%"
            y2="50%"
            stroke={element.color}
            strokeWidth={element.lineWidth || 1}
            strokeDasharray={
              element.style === "dashed"
                ? "8,4"
                : element.style === "dotted"
                  ? "2,2"
                  : undefined
            }
          />
        )}
        {element.direction === "vertical" && (
          <line
            x1="50%"
            y1="0"
            x2="50%"
            y2="100%"
            stroke={element.color}
            strokeWidth={element.lineWidth || 1}
            strokeDasharray={
              element.style === "dashed"
                ? "8,4"
                : element.style === "dotted"
                  ? "2,2"
                  : undefined
            }
          />
        )}
        {element.direction === "diagonal" && (
          <line
            x1="0"
            y1="0"
            x2="100%"
            y2="100%"
            stroke={element.color}
            strokeWidth={element.lineWidth || 1}
            strokeDasharray={
              element.style === "dashed"
                ? "8,4"
                : element.style === "dotted"
                  ? "2,2"
                  : undefined
            }
          />
        )}
      </svg>
    </div>
  ),
);
LineContent.displayName = "LineContent";

/* ───── Image ───── */
function formatImageSrc(src: string): string {
  if (!src) return "";
  const s = src.trim();
  if (
    s.startsWith("data:") ||
    s.startsWith("http://") ||
    s.startsWith("https://") ||
    s.startsWith("blob:")
  ) {
    return s;
  }
  // Base64 auto detect
  if (s.startsWith("iVBORw")) {
    return `data:image/png;base64,${s}`;
  }
  if (s.startsWith("/9j/")) {
    return `data:image/jpeg;base64,${s}`;
  }
  if (s.startsWith("R0lGOD")) {
    return `data:image/gif;base64,${s}`;
  }
  if (s.startsWith("PHN2")) {
    return `data:image/svg+xml;base64,${s}`;
  }
  if (/^[A-Za-z0-9+/=]+$/.test(s) && s.length > 50) {
    return `data:image/png;base64,${s}`;
  }
  return s;
}

const ImageContent: React.FC<{
  element: ImageElement;
  dataRow?: any;
  renderContext?: any;
  previewMode?: boolean;
}> = React.memo(({ element, dataRow, renderContext, previewMode }) => {
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        useDesignerStore.getState().pushHistory();
        useDesignerStore.getState().updateElement(element.id, {
          src: ev.target?.result as string,
        } as any);
      };
      reader.readAsDataURL(file);
    }
  };

  let resolvedSrc = "";
  if (previewMode && ((element as any).expression || element.dataField)) {
    const rawVal = evaluateExpression(
      (element as any).expression || element.dataField || "",
      dataRow,
      renderContext,
    );
    resolvedSrc = formatImageSrc(String(rawVal || ""));
  } else {
    resolvedSrc = formatImageSrc(element.src || "");
  }

  return (
    <div
      className="image-element-content"
      onDrop={handleDrop}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {resolvedSrc ? (
        <img
          src={resolvedSrc}
          alt=""
          style={{
            objectFit: element.objectFit,
            width: "100%",
            height: "100%",
          }}
          onError={(e) => {
            (e.target as HTMLElement).style.display = "none";
          }}
        />
      ) : (
        <div className="image-placeholder">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#94a3b8"
            strokeWidth="1.5"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
          <div style={{ fontSize: 10, marginTop: 4 }}>拖放图片到此处</div>
        </div>
      )}
    </div>
  );
});
ImageContent.displayName = "ImageContent";

/* ───── Barcode ───── */
const BarcodeContent: React.FC<{
  element: BarcodeElement;
  dataRow?: Record<string, any>;
  previewMode: boolean;
}> = React.memo(({ element, dataRow, previewMode }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  const displayValue =
    previewMode && dataRow
      ? evaluateExpression(element.value || element.dataField || "", dataRow)
      : element.value;

  useEffect(() => {
    if (svgRef.current && element.value) {
      try {
        JsBarcode(svgRef.current, String(displayValue || element.value), {
          format: element.format === "QR" ? "CODE128" : element.format,
          width: 2,
          height: 50,
          displayValue: element.showText,
          fontSize: 10,
          margin: 2,
        });
      } catch {
        try {
          JsBarcode(svgRef.current, String(displayValue || element.value), {
            format: "CODE128",
            width: 2,
            height: 50,
            displayValue: element.showText,
            margin: 2,
          });
        } catch {}
      }
    }
  }, [element.value, element.format, element.showText, displayValue]);

  return (
    <div className="barcode-element-content">
      <svg ref={svgRef} />
    </div>
  );
});
BarcodeContent.displayName = "BarcodeContent";

/* ───── QR Code ───── */
const QRCodeContent: React.FC<{
  element: QRCodeElement;
  dataRow?: Record<string, any>;
  previewMode: boolean;
}> = React.memo(({ element, dataRow, previewMode }) => {
  const [dataUrl, setDataUrl] = useState("");

  const displayValue =
    previewMode && dataRow
      ? evaluateExpression(element.value || element.dataField || "", dataRow)
      : element.value;

  useEffect(() => {
    const val = String(displayValue || element.value);
    if (val) {
      QRCodeLib.toDataURL(val, {
        errorCorrectionLevel: element.errorLevel,
        width: element.size || 80,
        margin: 1,
      })
        .then((url) => setDataUrl(url))
        .catch(() => setDataUrl(""));
    }
  }, [displayValue, element.value, element.errorLevel, element.size]);

  return (
    <div className="qrcode-element-content">
      {dataUrl ? (
        <img
          src={dataUrl}
          alt="QR"
          style={{
            maxWidth: "100%",
            maxHeight: "100%",
            imageRendering: "pixelated",
          }}
        />
      ) : (
        <span style={{ color: "#94a3b8", fontSize: 11 }}>二维码</span>
      )}
    </div>
  );
});
QRCodeContent.displayName = "QRCodeContent";

/* ───── Chart ───── */
const ChartContent: React.FC<{ element: ChartElement }> = React.memo(
  ({ element }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const { chartData } = element;
      const w = canvas.width;
      const h = canvas.height;
      const padding = { top: 30, right: 20, bottom: 30, left: 40 };
      const plotW = w - padding.left - padding.right;
      const plotH = h - padding.top - padding.bottom;
      const colors = ["#4f46e5", "#06b6d4", "#10b981", "#f59e0b", "#ef4444"];

      ctx.clearRect(0, 0, w, h);

      if (chartData.title) {
        ctx.font = "bold 12px sans-serif";
        ctx.fillStyle = "#333";
        ctx.textAlign = "center";
        ctx.fillText(chartData.title, w / 2, 16);
      }

      const maxVal = Math.max(...chartData.series.flatMap((s) => s.data), 1);
      const params = {
        ctx,
        categories: chartData.categories,
        series: chartData.series,
        padding,
        plotW,
        plotH,
        maxVal,
        colors,
      };

      switch (chartData.chartType) {
        case "bar":
          drawBarChart(params);
          break;
        case "line":
          drawLineChart(params);
          break;
        case "pie":
          drawPieChart(
            ctx,
            chartData.categories,
            chartData.series,
            w,
            h,
            colors,
          );
          break;
        case "area":
          drawAreaChart(params);
          break;
      }

      if (chartData.chartType !== "pie") {
        const legendY = h - 4;
        let lx = padding.left;
        chartData.series.forEach((s, i) => {
          ctx.fillStyle = colors[i % colors.length];
          ctx.fillRect(lx, legendY - 6, 8, 8);
          ctx.fillStyle = "#666";
          ctx.font = "9px sans-serif";
          ctx.textAlign = "left";
          ctx.fillText(s.name, lx + 12, legendY);
          lx += ctx.measureText(s.name).width + 24;
        });
      }
    }, [element.chartData, element.width, element.height]);

    return (
      <div
        className="chart-element-content"
        style={{ background: element.backgroundColor }}
      >
        <canvas
          ref={canvasRef}
          width={element.width}
          height={element.height}
          style={{ width: "100%", height: "100%" }}
        />
      </div>
    );
  },
);
ChartContent.displayName = "ChartContent";

/* ───── Table ───── */
const TableContent: React.FC<{
  element: TableElement;
  previewMode: boolean;
  dataRow?: Record<string, any>;
  renderContext?: RenderContext;
}> = React.memo(({ element, previewMode, dataRow, renderContext }) => {
  const { tableData } = element;
  const tableRef = useRef<HTMLTableElement>(null);
  const { updateElement } = useDesignerStore();
  const measuredRef = useRef(false);

  // AutoGrow: measure cell heights in preview mode and adjust row heights
  useEffect(() => {
    if (!previewMode || measuredRef.current) return;
    const table = tableRef.current;
    if (!table) return;

    const hasAutoGrow = tableData.cells.some((row) =>
      row.some((c) => c.autoGrow && c.rowSpan <= 1),
    );
    if (!hasAutoGrow) return;

    const trs = table.querySelectorAll("tr");
    let needsUpdate = false;
    const newRows = tableData.rows.map((row, ri) => {
      const tr = trs[ri];
      if (!tr) return row;

      const rowCells = tableData.cells[ri] || [];
      const hasRowAutoGrow = rowCells.some((c) => c.autoGrow && c.rowSpan <= 1);
      if (!hasRowAutoGrow) return row;

      const tds = tr.querySelectorAll("td");
      let maxCellHeight = row.height;
      let cellIdx = 0;
      rowCells.forEach((cell, _ci) => {
        if (cell.rowSpan <= 0 || cell.colSpan <= 0) return;
        const td = tds[cellIdx];
        cellIdx++;
        if (cell.autoGrow && td) {
          const scrollHeight = td.scrollHeight;
          if (scrollHeight > maxCellHeight) {
            maxCellHeight = scrollHeight;
            needsUpdate = true;
          }
        }
      });

      return maxCellHeight > row.height
        ? { ...row, height: maxCellHeight }
        : row;
    });

    if (needsUpdate) {
      measuredRef.current = true;
      const totalHeight = newRows.reduce((sum, r) => sum + r.height, 0);
      updateElement(element.id, {
        tableData: { ...tableData, rows: newRows },
        height: totalHeight,
      } as any);
    }
  }, [previewMode, tableData, element.id, dataRow]);

  // Reset measurement flag when data changes
  useEffect(() => {
    measuredRef.current = false;
  }, [dataRow]);

  const renderCellValue = (cell: (typeof tableData.cells)[0][0]): string => {
    const raw = previewMode
      ? evaluateExpression(
          cell.content || cell.expression || cell.dataField || "",
          dataRow,
          renderContext,
        )
      : cell.content || cell.dataField || "";

    if (!previewMode) return raw;

    let displayValue = String(raw !== undefined && raw !== null ? raw : "");

    // Apply explicit format first
    if (cell.format) {
      displayValue = applyFormat(displayValue, cell.format);
    } else {
      // Fallback heuristic formatting
      const num = Number(displayValue);
      if (
        !isNaN(num) &&
        displayValue.trim() !== "" &&
        !displayValue.startsWith("[")
      ) {
        const fieldRef = cell.content || cell.dataField || "";
        if (
          fieldRef.includes("price") ||
          fieldRef.includes("amount") ||
          fieldRef.includes("Price") ||
          fieldRef.includes("Amount") ||
          fieldRef.includes("金额") ||
          fieldRef.includes("单价")
        ) {
          displayValue = num.toLocaleString("zh-CN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
        } else if (
          fieldRef.includes("qty") ||
          fieldRef.includes("Qty") ||
          fieldRef.includes("no") ||
          fieldRef.includes("数量")
        ) {
          displayValue = num.toLocaleString("zh-CN");
        }
      }
    }

    // Apply mask
    if (cell.mask) {
      displayValue = applyMask(displayValue, cell.mask);
    }

    return displayValue;
  };

  return (
    <div className="table-element-content">
      <table ref={tableRef}>
        <colgroup>
          {tableData.columns.map((col) => (
            <col key={col.id} style={{ width: col.width }} />
          ))}
        </colgroup>
        <tbody>
          {tableData.rows.map((row, ri) => (
            <tr key={row.id} style={{ height: row.height }}>
              {tableData.cells[ri]?.map((cell) => {
                if (cell.rowSpan <= 0 || cell.colSpan <= 0) return null;
                return (
                  <td
                    key={cell.id}
                    rowSpan={cell.rowSpan}
                    colSpan={cell.colSpan}
                    style={{
                      backgroundColor:
                        cell.backgroundColor ||
                        (row.isHeader ? "#f0f4f8" : "#fff"),
                      ...bordersToCSS(cell.borders || {}),
                      ...fontToCSS(
                        cell.font || {
                          family: "Microsoft YaHei",
                          size: 12,
                          bold: false,
                          italic: false,
                          underline: false,
                          color: "#333",
                        },
                      ),
                      textAlign: cell.horizontalAlign || "left",
                      verticalAlign: cell.verticalAlign || "middle",
                      padding: `${cell.padding?.top || 2}px ${cell.padding?.right || 4}px ${cell.padding?.bottom || 2}px ${cell.padding?.left || 4}px`,
                      whiteSpace: cell.wordWrap ? "pre-wrap" : "nowrap",
                      wordBreak: cell.wordWrap ? "break-word" : "normal",
                      overflow: cell.wordWrap ? "hidden" : "hidden",
                    }}
                  >
                    {renderCellValue(cell)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});
TableContent.displayName = "TableContent";

/* ───── Subreport (with data binding) ───── */
const SubreportContent: React.FC<{
  element: SubreportElement;
  dataRow?: Record<string, any>;
  previewMode: boolean;
}> = React.memo(({ element, dataRow, previewMode }) => {
  if (!previewMode || !element.reportPath) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          border: "2px dashed #8b5cf6",
          borderRadius: 4,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(139,92,246,0.05)",
          color: "#8b5cf6",
          fontSize: 13,
        }}
      >
        子报表: {element.reportPath || "未绑定"}
      </div>
    );
  }

  // In preview mode, show parameter bindings
  const paramText = element.parameters
    ? Object.entries(element.parameters)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ")
    : "";

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        border: "1px solid #8b5cf6",
        borderRadius: 4,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(139,92,246,0.05)",
        color: "#7c3aed",
        fontSize: 11,
        padding: 4,
      }}
    >
      <div style={{ fontWeight: "bold", fontSize: 12 }}>
        子报表: {element.reportPath}
      </div>
      {paramText && (
        <div style={{ fontSize: 10, color: "#a78bfa", marginTop: 2 }}>
          参数: {paramText}
        </div>
      )}
      {dataRow && (
        <div style={{ fontSize: 9, color: "#a78bfa", marginTop: 2 }}>
          数据已绑定
        </div>
      )}
    </div>
  );
});
SubreportContent.displayName = "SubreportContent";

/* ───── CrossTab (with actual pivot rendering) ───── */
const CrossTabContent: React.FC<{
  element: CrossTabElement;
  dataRow?: Record<string, any>;
  previewMode: boolean;
}> = React.memo(({ element, previewMode }) => {
  const { rowField, columnField, valueField, valueFunction } = element;

  if (!previewMode || !rowField || !columnField || !valueField) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          border: "2px dashed #f59e0b",
          borderRadius: 4,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(245,158,11,0.05)",
          color: "#d97706",
          fontSize: 12,
          gap: 4,
        }}
      >
        <div style={{ fontWeight: "bold" }}>交叉表</div>
        <div style={{ fontSize: 10, color: "#92400e" }}>
          行: {rowField || "-"} | 列: {columnField || "-"} | 值:{" "}
          {valueField || "-"}
        </div>
      </div>
    );
  }

  // Get all data from the store for CrossTab computation
  const report = useDesignerStore.getState().report;
  const data = report.dataSources[0]?.data || [];

  const result = useMemo(() => {
    if (data.length === 0) return null;
    return computeCrossTab(
      data,
      rowField,
      columnField,
      valueField,
      valueFunction,
    );
  }, [data, rowField, columnField, valueField, valueFunction]);

  if (!result) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#d97706",
          fontSize: 12,
        }}
      >
        无数据
      </div>
    );
  }

  const {
    rowHeaders,
    columnHeaders,
    values,
    rowTotals,
    columnTotals,
    grandTotal,
  } = result;
  const funcLabel: Record<string, string> = {
    sum: "合计",
    count: "计数",
    avg: "均值",
    min: "最小",
    max: "最大",
  };

  return (
    <div className="table-element-content" style={{ overflow: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          tableLayout: "auto",
          fontSize: 11,
        }}
      >
        <thead>
          <tr>
            <th style={crosstabHeaderStyle}>{rowField}</th>
            {columnHeaders.map((ch) => (
              <th key={ch} style={crosstabHeaderStyle}>
                {ch}
              </th>
            ))}
            <th
              style={{
                ...crosstabHeaderStyle,
                fontWeight: "bold",
                color: "#1e40af",
              }}
            >
              {funcLabel[valueFunction] || "合计"}
            </th>
          </tr>
        </thead>
        <tbody>
          {rowHeaders.map((rh, ri) => (
            <tr key={rh}>
              <td style={crosstabCellStyle}>{rh}</td>
              {columnHeaders.map((ch, ci) => (
                <td key={ch} style={crosstabCellStyle}>
                  {typeof values[ri]?.[ci] === "number"
                    ? (values[ri][ci] as number).toFixed(
                        valueFunction === "avg" ? 2 : 0,
                      )
                    : (values[ri]?.[ci] ?? "")}
                </td>
              ))}
              <td
                style={{
                  ...crosstabCellStyle,
                  fontWeight: "bold",
                  color: "#1e40af",
                }}
              >
                {typeof rowTotals[ri] === "number"
                  ? (rowTotals[ri] as number).toFixed(
                      valueFunction === "avg" ? 2 : 0,
                    )
                  : rowTotals[ri]}
              </td>
            </tr>
          ))}
          <tr style={{ background: "#eff6ff" }}>
            <td
              style={{
                ...crosstabCellStyle,
                fontWeight: "bold",
                color: "#1e40af",
              }}
            >
              {funcLabel[valueFunction] || "合计"}
            </td>
            {columnTotals.map((ct, ci) => (
              <td
                key={ci}
                style={{
                  ...crosstabCellStyle,
                  fontWeight: "bold",
                  color: "#1e40af",
                }}
              >
                {typeof ct === "number"
                  ? ct.toFixed(valueFunction === "avg" ? 2 : 0)
                  : ct}
              </td>
            ))}
            <td
              style={{
                ...crosstabCellStyle,
                fontWeight: "bold",
                color: "#1e3a8a",
                background: "#dbeafe",
              }}
            >
              {typeof grandTotal === "number"
                ? grandTotal.toFixed(valueFunction === "avg" ? 2 : 0)
                : grandTotal}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
});
CrossTabContent.displayName = "CrossTabContent";

const crosstabHeaderStyle: React.CSSProperties = {
  border: "1px solid #93c5fd",
  padding: "3px 6px",
  backgroundColor: "#dbeafe",
  color: "#1e40af",
  fontWeight: "bold",
  textAlign: "center",
  fontSize: 11,
  whiteSpace: "nowrap",
};

const crosstabCellStyle: React.CSSProperties = {
  border: "1px solid #d0d5dd",
  padding: "2px 6px",
  textAlign: "right",
  fontSize: 11,
  whiteSpace: "nowrap",
};
