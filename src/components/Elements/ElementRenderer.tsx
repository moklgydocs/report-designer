/**
 * @file ElementRenderer.tsx
 * @description Unified renderer for all 10 report element types in the Report Designer.
 *
 * This component serves as the top-level dispatch hub that:
 * - Renders the shared element wrapper (positioning, selection, resize handles, lock state)
 * - Delegates to a dedicated sub-component per element type:
 *     Text, Rectangle, Line, Image, Barcode, QRCode, Chart, Table, Subreport, CrossTab
 * - Supports both design-time (editing, drag, resize) and preview (data-bound) modes.
 *
 * Each sub-component is memoized with React.memo for performance, as the canvas may
 * contain hundreds of elements that re-render independently.
 */

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

/**
 * Props for the ElementRenderer component.
 * @property element - The report element data model to render (any of the 10 types).
 * @property isSelected - Whether the element is currently selected in the designer.
 * @property zoom - Current canvas zoom level (reserved for future scaling logic).
 * @property previewMode - True when rendering a live preview with bound data; false in design mode.
 * @property dataRow - Current data row from the report's data source (used for expression evaluation).
 * @property renderContext - Additional context for expression evaluation (variables, aggregates, page number, etc.).
 * @property onDragStart - Callback fired when the user starts dragging the element.
 * @property onResizeStart - Callback fired when the user starts resizing from a handle; provides the handle direction.
 * @property onSelect - Callback fired when the element is clicked/selected.
 */
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

/**
 * ElementRenderer — top-level wrapper that positions, selects, and dispatches rendering
 * for any report element type. Wrapped in React.memo to avoid re-renders when unrelated
 * elements change.
 *
 * @param props - See {@link ElementRendererProps}.
 * @returns The positioned element wrapper with selection/resize chrome and type-specific content.
 */
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
    /** Only text elements support inline editing. */
    const isEditing =
      editingElementId === element.id && element.type === "text";

    /** Hidden elements are suppressed entirely in preview mode. */
    if (!element.visible && previewMode) return null;

    /**
     * Mouse-down handler: initiates a drag if the element is unlocked and not
     * currently being inline-edited, then fires the selection callback.
     */
    const handleMouseDown = (e: React.MouseEvent) => {
      if (!element.locked && !isEditing) {
        onDragStart(e);
      }
      onSelect(e);
    };

    /**
     * Double-click handler: enters inline-edit mode for unlocked text elements.
     * Pushes a history snapshot first so the edit can be undone.
     */
    const handleDoubleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (element.type === "text" && !element.locked) {
        pushHistory();
        setEditingElementId(element.id);
      }
    };

    /** Dispatch to the appropriate sub-renderer based on element type. */
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
          /* Hidden elements are dimmed in design mode rather than removed, so the
             user can still select and re-show them. */
          opacity: element.visible ? 1 : 0.4,
        }}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
      >
        {/* Hover border — always present, visible only on hover via CSS */}
        <div className="element-hover-border" />
        {/* Selection border — shown when the element is the active selection */}
        {isSelected && <div className="element-selection-border" />}
        {/* Type-specific content area */}
        <div className="element-content">{renderContent()}</div>
        {/* 8-direction resize handles (nw, n, ne, e, se, s, sw, w) —
            visible only when selected, not in preview, not locked, and not editing */}
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

/* ═══════════════════════════════════════════════════════════════════════════════
 * TEXT ELEMENT
 * Renders static text, data-bound expressions, or inline-editable content.
 * Supports font styling, alignment, padding, word-wrap, and heuristic number
 * formatting for monetary/quantity fields in preview mode.
 * ═══════════════════════════════════════════════════════════════════════════════ */

/**
 * TextContent — renders a text element with optional inline editing.
 *
 * In design mode the raw content/expression/dataField is displayed as-is.
 * In preview mode the expression is evaluated against the current data row and
 * the result is optionally formatted (e.g. thousands separators for amounts).
 *
 * @param element - The TextElement data model.
 * @param previewMode - Whether the report is in live-preview mode.
 * @param isEditing - Whether this element is currently being inline-edited.
 * @param dataRow - Current data row for expression evaluation.
 * @param renderContext - Context for expression evaluation (variables, aggregates, etc.).
 */
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

    /** When entering edit mode, auto-focus the contentEditable div and select all text. */
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

    /** Commit the inline-edit value back to the store and exit edit mode. */
    const commitEdit = useCallback(() => {
      if (editRef.current) {
        updateElement(element.id, {
          content: editRef.current.innerText,
        } as any);
      }
      setEditingElementId(null);
    }, [element.id, updateElement, setEditingElementId]);

    /**
     * Resolve the display text:
     * - Preview mode: evaluate the expression/dataField against the data row.
     * - Design mode: show the raw content, expression, or dataField placeholder.
     * Falls back to "文本" (Chinese for "Text") when all sources are empty.
     */
    const rawDisplayText = previewMode
      ? evaluateExpression(
          element.content || element.expression || element.dataField || "",
          dataRow,
          renderContext,
        )
      : element.content || element.expression || element.dataField || "文本";

    /** Coerce the resolved value to a string, treating null/undefined as empty. */
    const displayText = String(
      rawDisplayText !== undefined && rawDisplayText !== null
        ? rawDisplayText
        : "",
    );

    /**
     * Heuristic number formatting for preview mode.
     * Detects common field-name patterns (price, amount, qty) and applies
     * locale-appropriate formatting (2 decimal places for monetary fields,
     * integer formatting for quantity fields). Fields with an explicit format
     * should use applyFormat/applyMask instead.
     *
     * @param text - The resolved text value to potentially format.
     * @returns The formatted string, or the original text if no rule matches.
     */

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

    /** Inline-edit mode: contentEditable div that commits on blur, Escape, or Enter. */
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
            /* Escape or Enter (without Shift) commits the edit;
               Shift+Enter allows multi-line input. */
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

    /** Read-only mode: display the (possibly formatted) text with full styling. */
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

/* ═══════════════════════════════════════════════════════════════════════════════
 * RECTANGLE ELEMENT
 * Renders a filled/stroked rectangle with configurable corner radius.
 * ═══════════════════════════════════════════════════════════════════════════════ */

/**
 * RectangleContent — renders a decorative rectangle with fill color, border, and corner radius.
 * @param element - The RectangleElement data model.
 */
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

/* ═══════════════════════════════════════════════════════════════════════════════
 * LINE ELEMENT
 * Renders an SVG line in one of three directions: horizontal, vertical, or diagonal.
 * Supports solid, dashed, and dotted stroke styles.
 * ═══════════════════════════════════════════════════════════════════════════════ */

/**
 * LineContent — renders a line element using an SVG <line>.
 * The line stretches across the element's bounding box in the configured direction.
 *
 * @param element - The LineElement data model with direction, color, width, and style.
 */
const LineContent: React.FC<{ element: LineElement }> = React.memo(
  ({ element }) => (
    <div className="line-element-content">
      <svg
        width="100%"
        height="100%"
        style={{ position: "absolute", inset: 0 }}
      >
        {/* Horizontal line: centered vertically across the full width */}
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
        {/* Vertical line: centered horizontally across the full height */}
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
        {/* Diagonal line: top-left to bottom-right corner */}
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

/* ═══════════════════════════════════════════════════════════════════════════════
 * IMAGE ELEMENT
 * Renders an image from a URL, base64 data URI, or data-bound expression.
 * Supports drag-and-drop file upload and auto-detection of base64 formats.
 * ═══════════════════════════════════════════════════════════════════════════════ */

/**
 * Normalizes an image source string into a valid URL or data URI.
 *
 * Handles the following cases:
 * - Already-valid URLs/data URIs/blob URIs are returned as-is.
 * - Known base64 prefixes are auto-detected and wrapped with the correct MIME type
 *   (PNG, JPEG, GIF, SVG).
 * - Long base64-only strings (no prefix) are assumed to be PNG.
 *
 * @param src - Raw image source string (URL, base64, data URI, etc.).
 * @returns A valid `src` attribute for an <img> element, or empty string.
 */
function formatImageSrc(src: string): string {
  if (!src) return "";
  const s = src.trim();
  /* Pass through already-valid URL schemes unchanged. */
  if (
    s.startsWith("data:") ||
    s.startsWith("http://") ||
    s.startsWith("https://") ||
    s.startsWith("blob:")
  ) {
    return s;
  }
  /* Auto-detect common base64 image prefixes and wrap with the correct MIME type. */
  // PNG: starts with iVBORw (base64 of the PNG magic bytes)
  if (s.startsWith("iVBORw")) {
    return `data:image/png;base64,${s}`;
  }
  // JPEG: starts with /9j/ (base64 of the JPEG SOI marker)
  if (s.startsWith("/9j/")) {
    return `data:image/jpeg;base64,${s}`;
  }
  // GIF: starts with R0lGOD (base64 of "GIF")
  if (s.startsWith("R0lGOD")) {
    return `data:image/gif;base64,${s}`;
  }
  // SVG: starts with PHN2 (base64 of "<sv")
  if (s.startsWith("PHN2")) {
    return `data:image/svg+xml;base64,${s}`;
  }
  /* Fallback: if the string looks like a long base64 blob, assume PNG. */
  if (/^[A-Za-z0-9+/=]+$/.test(s) && s.length > 50) {
    return `data:image/png;base64,${s}`;
  }
  return s;
}

/**
 * ImageContent — renders an image element with drag-and-drop upload support.
 *
 * In preview mode, if the element has an expression/dataField, the source is
 * resolved from the data row. Otherwise the static `src` property is used.
 *
 * @param element - The ImageElement data model.
 * @param dataRow - Current data row for expression evaluation.
 * @param renderContext - Context for expression evaluation.
 * @param previewMode - Whether the report is in live-preview mode.
 */
const ImageContent: React.FC<{
  element: ImageElement;
  dataRow?: any;
  renderContext?: any;
  previewMode?: boolean;
}> = React.memo(({ element, dataRow, renderContext, previewMode }) => {
  /** Handle drag-and-drop image upload: reads the file as a data URI and stores it. */
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

  /** Resolve the image source: data-bound in preview mode, static otherwise. */
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
          /* Hide the <img> on load error (broken URL) rather than showing a broken icon. */
          onError={(e) => {
            (e.target as HTMLElement).style.display = "none";
          }}
        />
      ) : (
        /* Placeholder shown when no image source is available — invites the user to drop an image. */
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

/* ═══════════════════════════════════════════════════════════════════════════════
 * BARCODE ELEMENT
 * Renders a 1D barcode using JsBarcode. Supports various formats (CODE128,
 * EAN-13, etc.) with a fallback to CODE128 if the chosen format fails.
 * ═══════════════════════════════════════════════════════════════════════════════ */

/**
 * BarcodeContent — renders a 1D barcode into an SVG element via JsBarcode.
 *
 * In preview mode the barcode value is resolved from the data row; otherwise
 * the static `value` property is used. If the selected format cannot encode
 * the value, it falls back to CODE128.
 *
 * @param element - The BarcodeElement data model.
 * @param dataRow - Current data row for expression evaluation.
 * @param previewMode - Whether the report is in live-preview mode.
 */
const BarcodeContent: React.FC<{
  element: BarcodeElement;
  dataRow?: Record<string, any>;
  previewMode: boolean;
}> = React.memo(({ element, dataRow, previewMode }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  /** Resolve the barcode value from data in preview mode, or use the static value. */
  const displayValue =
    previewMode && dataRow
      ? evaluateExpression(element.value || element.dataField || "", dataRow)
      : element.value;

  /** Render the barcode into the SVG ref whenever the value or format changes.
   *  If the selected format throws (e.g. invalid characters for EAN-13),
   *  fall back to CODE128 which accepts any ASCII input. */
  useEffect(() => {
    if (svgRef.current && element.value) {
      try {
        JsBarcode(svgRef.current, String(displayValue || element.value), {
          /* "QR" is not a valid JsBarcode format; map it to CODE128. */
          format: element.format === "QR" ? "CODE128" : element.format,
          width: 2,
          height: 50,
          displayValue: element.showText,
          fontSize: 10,
          margin: 2,
        });
      } catch {
        /* Fallback: if the selected format cannot encode the value (e.g. invalid
           characters for EAN-13), retry with CODE128 which accepts any ASCII. */
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

/* ═══════════════════════════════════════════════════════════════════════════════
 * QR CODE ELEMENT
 * Renders a 2D QR code using the `qrcode` library. The QR image is generated
 * asynchronously and stored as a data URL in component state.
 * ═══════════════════════════════════════════════════════════════════════════════ */

/**
 * QRCodeContent — renders a QR code element as a data-URL image.
 *
 * @param element - The QRCodeElement data model (value, errorLevel, size).
 * @param dataRow - Current data row for expression evaluation.
 * @param previewMode - Whether the report is in live-preview mode.
 */
const QRCodeContent: React.FC<{
  element: QRCodeElement;
  dataRow?: Record<string, any>;
  previewMode: boolean;
}> = React.memo(({ element, dataRow, previewMode }) => {
  /** Data URL of the rendered QR code image, generated asynchronously. */
  const [dataUrl, setDataUrl] = useState("");

  /** Resolve the QR value from data in preview mode, or use the static value. */
  const displayValue =
    previewMode && dataRow
      ? evaluateExpression(element.value || element.dataField || "", dataRow)
      : element.value;

  /** Generate the QR code data URL whenever the value, error level, or size changes. */
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

/* ═══════════════════════════════════════════════════════════════════════════════
 * CHART ELEMENT
 * Renders a chart (bar, line, pie, or area) onto an HTML5 <canvas> using the
 * chartRenderer utility functions. Chart data is static (not data-bound).
 * ═══════════════════════════════════════════════════════════════════════════════ */

/**
 * ChartContent — renders a chart element onto a canvas.
 *
 * Draws the chart title, axes, and data series using the 2D canvas API,
 * delegating to specialized draw functions per chart type. A legend is
 * rendered at the bottom for non-pie charts.
 *
 * @param element - The ChartElement data model containing chartData, dimensions, etc.
 */
const ChartContent: React.FC<{ element: ChartElement }> = React.memo(
  ({ element }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    /** Redraw the chart whenever the chart data or element dimensions change. */
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const { chartData } = element;
      const w = canvas.width;
      const h = canvas.height;
      /** Padding around the plot area for title, axis labels, and legend. */
      const padding = { top: 30, right: 20, bottom: 30, left: 40 };
      const plotW = w - padding.left - padding.right;
      const plotH = h - padding.top - padding.bottom;
      /** Color palette for chart series; cycles if there are more series than colors. */
      const colors = ["#4f46e5", "#06b6d4", "#10b981", "#f59e0b", "#ef4444"];

      ctx.clearRect(0, 0, w, h);

      /* Draw the chart title at the top center, if provided. */
      if (chartData.title) {
        ctx.font = "bold 12px sans-serif";
        ctx.fillStyle = "#333";
        ctx.textAlign = "center";
        ctx.fillText(chartData.title, w / 2, 16);
      }

      /* Compute the maximum data value across all series for Y-axis scaling.
         Floor at 1 to avoid division by zero when all values are 0. */
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
          /* Pie chart uses a different parameter shape (no padding/plotW/plotH). */
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

      /* Draw a horizontal legend at the bottom for non-pie chart types. */
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

/* ═══════════════════════════════════════════════════════════════════════════════
 * TABLE ELEMENT
 * Renders a data table with rows, columns, cell spanning, styling, and an
 * AutoGrow mechanism that expands row heights to fit content in preview mode.
 * ═══════════════════════════════════════════════════════════════════════════════ */

/**
 * TableContent — renders a table element with row/column definitions, cell styling,
 * data binding, and AutoGrow support.
 *
 * AutoGrow: In preview mode, cells marked with `autoGrow` will cause their row's
 * height to increase to fit the rendered content. This is done by measuring
 * `scrollHeight` of each autoGrow cell after the initial render and updating
 * the row heights in the store.
 *
 * @param element - The TableElement data model.
 * @param previewMode - Whether the report is in live-preview mode.
 * @param dataRow - Current data row for expression evaluation.
 * @param renderContext - Context for expression evaluation.
 */
const TableContent: React.FC<{
  element: TableElement;
  previewMode: boolean;
  dataRow?: Record<string, any>;
  renderContext?: RenderContext;
}> = React.memo(({ element, previewMode, dataRow, renderContext }) => {
  const { tableData } = element;
  const tableRef = useRef<HTMLTableElement>(null);
  const { updateElement } = useDesignerStore();
  /** Flag to prevent repeated AutoGrow measurements on the same data. */
  const measuredRef = useRef(false);

  // AutoGrow: measure cell heights in preview mode and adjust row heights
  /**
   * AutoGrow effect: after the table renders in preview mode, measure the
   * scrollHeight of each autoGrow cell. If any cell overflows its row height,
   * expand the row and update the element's total height accordingly.
   * The `measuredRef` flag ensures this runs only once per data change.
   */
  useEffect(() => {
    if (!previewMode || measuredRef.current) return;
    const table = tableRef.current;
    if (!table) return;

    /* Only proceed if at least one cell in the table has autoGrow enabled
       and is not a merged cell (rowSpan <= 1). */
    const hasAutoGrow = tableData.cells.some((row) =>
      row.some((c) => c.autoGrow && c.rowSpan <= 1),
    );
    if (!hasAutoGrow) return;

    const trs = table.querySelectorAll("tr");
    let needsUpdate = false;
    /** Build updated row definitions where row height is expanded to the
        tallest autoGrow cell's scrollHeight. */
    const newRows = tableData.rows.map((row, ri) => {
      const tr = trs[ri];
      if (!tr) return row;

      const rowCells = tableData.cells[ri] || [];
      const hasRowAutoGrow = rowCells.some((c) => c.autoGrow && c.rowSpan <= 1);
      if (!hasRowAutoGrow) return row;

      const tds = tr.querySelectorAll("td");
      let maxCellHeight = row.height;
      let cellIdx = 0;
      /* Iterate over logical cells, advancing the DOM cell index for merged cells
         (which still occupy a <td> even with rowSpan/colSpan). */
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
      /* Recalculate the total element height from the updated row heights. */
      const totalHeight = newRows.reduce((sum, r) => sum + r.height, 0);
      updateElement(element.id, {
        tableData: { ...tableData, rows: newRows },
        height: totalHeight,
      } as any);
    }
  }, [previewMode, tableData, element.id, dataRow]);

  // Reset measurement flag when data changes
  /** Reset the AutoGrow measurement flag when the data row changes
      so that re-measurement occurs on the next render. */
  useEffect(() => {
    measuredRef.current = false;
  }, [dataRow]);

  /**
   * Resolves and formats a cell's display value.
   *
   * Priority:
   * 1. In preview mode, evaluate the cell's expression/dataField against the data row.
   * 2. Apply explicit format (if any) via `applyFormat`.
   * 3. Fallback heuristic: detect monetary/quantity fields by name pattern and
   *    apply locale-specific number formatting.
   * 4. Apply mask (if any) via `applyMask`.
   *
   * @param cell - The table cell definition.
   * @returns The formatted string to display in the cell.
   */
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
      /* Fallback heuristic formatting — same logic as TextContent.formatNumber. */
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

    // Apply mask (e.g. hiding sensitive data like ID numbers)
    if (cell.mask) {
      displayValue = applyMask(displayValue, cell.mask);
    }

    return displayValue;
  };

  return (
    <div className="table-element-content">
      <table ref={tableRef}>
        {/* Column group: defines per-column widths for the table layout */}
        <colgroup>
          {tableData.columns.map((col) => (
            <col key={col.id} style={{ width: col.width }} />
          ))}
        </colgroup>
        <tbody>
          {tableData.rows.map((row, ri) => (
            <tr key={row.id} style={{ height: row.height }}>
              {tableData.cells[ri]?.map((cell) => {
                /* Merged cells with rowSpan/colSpan <= 0 are placeholder slots;
                   they should not render a <td> in the DOM. */
                if (cell.rowSpan <= 0 || cell.colSpan <= 0) return null;
                return (
                  <td
                    key={cell.id}
                    rowSpan={cell.rowSpan}
                    colSpan={cell.colSpan}
                    style={{
                      backgroundColor:
                        cell.backgroundColor ||
                        /* Header rows get a light blue-gray background by default. */
                        (row.isHeader ? "#f0f4f8" : "#fff"),
                      ...bordersToCSS(cell.borders || {}),
                      ...fontToCSS(
                        /* Default font for cells without an explicit font override. */
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

/* ═══════════════════════════════════════════════════════════════════════════════
 * SUBREPORT ELEMENT
 * Renders a placeholder for an embedded sub-report. In design mode shows a
 * dashed border with the report path; in preview mode shows parameter bindings.
 * Actual sub-report rendering is handled at a higher level during report generation.
 * ═══════════════════════════════════════════════════════════════════════════════ */

/**
 * SubreportContent — renders a subreport element placeholder.
 *
 * @param element - The SubreportElement data model (reportPath, parameters).
 * @param dataRow - Current data row (indicates whether data is bound).
 * @param previewMode - Whether the report is in live-preview mode.
 */
const SubreportContent: React.FC<{
  element: SubreportElement;
  dataRow?: Record<string, any>;
  previewMode: boolean;
}> = React.memo(({ element, dataRow, previewMode }) => {
  /** In design mode or when no report path is set, show a dashed placeholder. */
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
  /** Build a display string of parameter key=value pairs for the preview. */
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

/* ═══════════════════════════════════════════════════════════════════════════════
 * CROSSTAB ELEMENT
 * Renders a cross-tabulation (pivot table) that aggregates data by row and column
 * fields. Uses `computeCrossTab` from reportRenderer to perform the pivot, then
 * displays the result as an HTML table with row/column totals and a grand total.
 * ═══════════════════════════════════════════════════════════════════════════════ */

/**
 * CrossTabContent — renders a cross-tabulation (pivot table) element.
 *
 * In design mode (or when fields are not configured), shows a dashed placeholder
 * indicating the row/column/value field configuration. In preview mode, computes
 * the pivot table from the report's data source and renders it with totals.
 *
 * @param element - The CrossTabElement data model (rowField, columnField, valueField, valueFunction).
 * @param dataRow - Current data row (unused; CrossTab reads from the full data source).
 * @param previewMode - Whether the report is in live-preview mode.
 */
const CrossTabContent: React.FC<{
  element: CrossTabElement;
  dataRow?: Record<string, any>;
  previewMode: boolean;
}> = React.memo(({ element, previewMode }) => {
  const { rowField, columnField, valueField, valueFunction } = element;

  /** Show a placeholder when not in preview mode or when fields are not yet configured. */
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
  /** Read the full dataset from the first data source for pivot computation.
      CrossTab operates on the entire dataset, not just the current row. */
  const report = useDesignerStore.getState().report;
  const data = report.dataSources[0]?.data || [];

  /** Compute the pivot table result, memoized to avoid recomputation on every render. */
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
    /** No data available for the pivot — show an empty state message. */
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
  /** Chinese labels for the aggregate function used in the CrossTab. */
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
          /* Use auto layout so columns size to content rather than equal widths. */
          tableLayout: "auto",
          fontSize: 11,
        }}
      >
        <thead>
          <tr>
            {/* Top-left corner: row field label */}
            <th style={crosstabHeaderStyle}>{rowField}</th>
            {/* Column headers: one per unique column field value */}
            {columnHeaders.map((ch) => (
              <th key={ch} style={crosstabHeaderStyle}>
                {ch}
              </th>
            ))}
            {/* Row totals column header */}
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
          {/* Data rows: one per unique row field value */}
          {rowHeaders.map((rh, ri) => (
            <tr key={rh}>
              <td style={crosstabCellStyle}>{rh}</td>
              {/* Value cells: one per (row, column) intersection */}
              {columnHeaders.map((ch, ci) => (
                <td key={ch} style={crosstabCellStyle}>
                  {/* Format numbers: 2 decimal places for avg, 0 for others. */}
                  {typeof values[ri]?.[ci] === "number"
                    ? (values[ri][ci] as number).toFixed(
                        valueFunction === "avg" ? 2 : 0,
                      )
                    : (values[ri]?.[ci] ?? "")}
                </td>
              ))}
              {/* Row total cell */}
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
          {/* Grand totals row at the bottom */}
          <tr style={{ background: "#eff6ff" }}>
            {/* Bottom-left corner: aggregate function label */}
            <td
              style={{
                ...crosstabCellStyle,
                fontWeight: "bold",
                color: "#1e40af",
              }}
            >
              {funcLabel[valueFunction] || "合计"}
            </td>
            {/* Column totals: one per column */}
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
            {/* Grand total cell (bottom-right corner) */}
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

/** Shared inline styles for CrossTab header cells (<th>). */
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

/** Shared inline styles for CrossTab data cells (<td>). */
const crosstabCellStyle: React.CSSProperties = {
  border: "1px solid #d0d5dd",
  padding: "2px 6px",
  textAlign: "right",
  fontSize: 11,
  whiteSpace: "nowrap",
};
