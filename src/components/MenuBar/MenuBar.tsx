/**
 * @file MenuBar component for the Report Designer.
 *
 * Provides the top-level menu bar with file operations (new, open, save),
 * template loading, and multi-format export (PDF, Excel, image, print).
 * Also includes a preview/edit toggle and displays the current report name.
 */
import React, { useRef } from "react";
import { useDesignerStore } from "../../store/designerStore";
import type {
  TextElement,
  TableElement,
  BarcodeElement,
  QRCodeElement,
  ChartElement,
} from "../../types";
import { renderReportPaginated } from "../../utils/reportRenderer";
import {
  generateVectorReportPDF,
  printVectorReportDirectly,
} from "../../utils/pdfGenerator";
import { createPurchaseOrderTemplate, createSalesInvoiceTemplate } from "../../utils/templates";
import "./MenuBar.css";

/**
 * MenuBar component – the horizontal menu strip at the top of the designer.
 *
 * Renders file actions (new / open / save), template & export dropdowns,
 * and a preview/edit toggle. Each handler reads or mutates the global
 * designer store directly.
 *
 * @returns The menu bar React element.
 */
export const MenuBar: React.FC = () => {
  /** Current report state & save helper from the global store. */
  const { report, saveReport } = useDesignerStore();

  /** Hidden file input used to trigger the "Open" file dialog. */
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---------------------------------------------------------------------------
  // File operations
  // ---------------------------------------------------------------------------

  /**
   * Creates a new blank report after confirming with the user.
   * Discards any unsaved changes in the current report.
   */
  const handleNew = () => {
    if (confirm("创建新报表？未保存的更改将丢失。")) {
      const { setReport } = useDesignerStore.getState();
      // Initialise a default A4-portrait report with empty bands & elements
      setReport({
        id: crypto.randomUUID?.() || Date.now().toString(),
        name: "未命名报表",
        version: "1.0.0",
        pageSettings: {
          width: 794,
          height: 1123,
          orientation: "portrait",
          marginTop: 40,
          marginBottom: 40,
          marginLeft: 40,
          marginRight: 40,
          columns: 1,
          columnGap: 0,
        },
        bands: [],
        elements: {},
        dataSources: [],
        parameters: [],
        styles: [],
        variables: {},
      });
    }
  };

  /**
   * Serialises the current report to JSON and triggers a browser download
   * with a `.rpt.json` extension.
   */
  const handleSave = () => {
    const json = saveReport();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.name || "report"}.rpt.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /** Opens the native file picker by forwarding the click to the hidden input. */
  const handleLoad = () => {
    fileInputRef.current?.click();
  };

  /**
   * Reads the selected file, parses it as JSON, and loads it into the store.
   * Resets the file input value afterwards so the same file can be re-selected.
   */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        useDesignerStore
          .getState()
          .loadReport(JSON.parse(ev.target?.result as string));
      } catch {
        alert("文件格式不正确");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ---------------------------------------------------------------------------
  // Export operations
  // ---------------------------------------------------------------------------

  /**
   * Exports the current report as a vector PDF.
   * Renders the report to paginated pages first, then generates the PDF.
   */
  const handleExportPDF = async () => {
    try {
      const rendered = renderReportPaginated(report);
      const pdf = await generateVectorReportPDF(report, rendered.pages);
      pdf.save(`${report.name || "report"}.pdf`);
    } catch (err) {
      console.error("PDF export error:", err);
      alert("PDF导出失败");
    }
  };

  /**
   * Exports the current report as an Excel (.xlsx) workbook.
   *
   * Dynamically imports the `xlsx` library, then iterates over each rendered
   * page and extracts element content (text, tables, charts, barcodes, QR codes)
   * into row arrays. Each page becomes a worksheet; data sources are appended
   * as additional sheets.
   */
  const handleExportExcel = async () => {
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();

      // Use paginated render for complete data export
      const rendered = renderReportPaginated(report);

      // Export by page
      rendered.pages.forEach((page, pageIdx) => {
        const rows: any[][] = [];
        page.bands.forEach((rb) => {
          rb.elements.forEach((el) => {
            // Extract content depending on element type
            switch (el.type) {
              case "text":
                // Prefer static content, fall back to bound data field name
                rows.push([
                  (el as TextElement).content ||
                    (el as TextElement).dataField ||
                    "",
                ]);
                break;
              case "table": {
                // Filter out merged/hidden cells (rowSpan/colSpan ≤ 0) and extract content
                (el as TableElement).tableData.cells.forEach((row) => {
                  rows.push(
                    row
                      .filter((c) => c.rowSpan > 0 && c.colSpan > 0)
                      .map((c) => c.content || ""),
                  );
                });
                break;
              }
              case "chart": {
                // Build a header row from series names, then a data row per category
                const chart = el as ChartElement;
                rows.push([
                  "类别",
                  ...chart.chartData.series.map((s) => s.name),
                ]);
                chart.chartData.categories.forEach((cat, i) => {
                  rows.push([
                    cat,
                    ...chart.chartData.series.map((s) => s.data[i] ?? ""),
                  ]);
                });
                break;
              }
              case "barcode":
                rows.push([`条形码: ${(el as BarcodeElement).value}`]);
                break;
              case "qrcode":
                rows.push([`二维码: ${(el as QRCodeElement).value}`]);
                break;
            }
          });
        });
        if (rows.length > 0) {
          const ws = XLSX.utils.aoa_to_sheet(rows);
          XLSX.utils.book_append_sheet(wb, ws, `第${pageIdx + 1}页`);
        }
      });

      // Also add data source sheets
      report.dataSources.forEach((ds) => {
        // Only create a sheet if the data source has actual row data
        if (ds.data?.length) {
          const ws = XLSX.utils.json_to_sheet(ds.data);
          XLSX.utils.book_append_sheet(wb, ws, ds.name);
        }
      });

      // Ensure at least one sheet exists so the file is valid
      if (wb.SheetNames.length === 0) {
        const ws = XLSX.utils.aoa_to_sheet([["无数据"]]);
        XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
      }
      XLSX.writeFile(wb, `${report.name || "report"}.xlsx`);
    } catch (err) {
      console.error("Excel export error:", err);
      alert("Excel导出失败");
    }
  };

  /**
   * Exports the current report as a PNG image.
   *
   * Temporarily sets zoom to 1× and enters preview mode so the canvas renders
   * at full fidelity, then uses html2canvas to capture the page element at 2×
   * resolution. Restores the original zoom/preview state afterwards.
   */
  const handleExportImage = async () => {
    const store = useDesignerStore.getState();
    const currentZoom = store.zoom;
    // Switch to 1:1 zoom and preview mode for a clean capture
    store.setZoom(1);
    store.setPreviewMode(true);
    // Wait for the canvas to re-render before capturing
    await new Promise((r) => setTimeout(r, 400));

    try {
      const html2canvas = (await import("html2canvas")).default;
      const pageEl = document.querySelector(".canvas-page") as HTMLElement;
      if (!pageEl) return;
      const canvas = await html2canvas(pageEl, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      const link = document.createElement("a");
      link.download = `${report.name || "report"}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error("Image export error:", err);
      alert("图片导出失败");
    } finally {
      // Always restore the previous zoom & preview state, even on error
      useDesignerStore.getState().setZoom(currentZoom);
      useDesignerStore.getState().setPreviewMode(false);
    }
  };

  /**
   * Sends the report directly to the printer using the vector print pipeline.
   */
  const handlePrint = async () => {
    try {
      const rendered = renderReportPaginated(report);
      await printVectorReportDirectly(report, rendered.pages);
    } catch (err) {
      console.error("Direct print error:", err);
      alert("打印失败");
    }
  };

  return (
    <div className="menubar">
      {/* ---- Brand / logo ---- */}
      <div className="menubar-brand">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#60a5fa"
          strokeWidth="2"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18" />
          <path d="M9 3v18" />
        </svg>
        <span className="brand-name">ReportDesigner</span>
      </div>
      {/* ---- Menu buttons ---- */}
      <div className="menubar-items">
        <button className="menu-btn" onClick={handleNew}>
          新建
        </button>
        <button className="menu-btn" onClick={handleLoad}>
          打开
        </button>
        <button className="menu-btn" onClick={handleSave}>
          保存
        </button>
        <div className="menu-divider" />
        {/* Template dropdown – loads pre-built report templates */}
        <div className="menu-item has-dropdown">
          <button className="menu-btn">模板</button>
          <div className="menu-dropdown">
            <button
              className="dropdown-btn"
              onClick={() => {
                const tpl = createPurchaseOrderTemplate();
                useDesignerStore.getState().loadReport(tpl);
              }}
            >
              采购订单
            </button>
            <button
              className="dropdown-btn"
              onClick={() => {
                const tpl = createSalesInvoiceTemplate();
                useDesignerStore.getState().loadReport(tpl);
              }}
            >
              销售出库发票
            </button>
          </div>
        </div>
        <div className="menu-divider" />
        {/* Export dropdown – PDF, Excel, Image, Print */}
        <div className="menu-item has-dropdown">
          <button className="menu-btn">导出</button>
          <div className="menu-dropdown">
            <button className="dropdown-btn" onClick={handleExportPDF}>
              PDF
            </button>
            <button className="dropdown-btn" onClick={handleExportExcel}>
              Excel
            </button>
            <button className="dropdown-btn" onClick={handleExportImage}>
              图片
            </button>
            <div className="dropdown-divider" />
            <button className="dropdown-btn" onClick={handlePrint}>
              打印
            </button>
          </div>
        </div>
      </div>
      <div className="menubar-spacer" />
      {/* ---- Report name & preview toggle ---- */}
      <div className="menubar-info">
        <span className="report-name">{report.name}</span>
      </div>
      <div className="menu-divider" />
      <PreviewToggle />
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.rpt.json"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
    </div>
  );
};

/**
 * PreviewToggle – a small button that switches between edit and preview modes.
 *
 * In preview mode the design canvas renders the final output; in edit mode
 * the full designer interaction (drag, resize, select) is available.
 */
const PreviewToggle: React.FC = () => {
  const { previewMode, setPreviewMode } = useDesignerStore();
  return (
    <button
      className={`menu-btn preview-menu-btn ${previewMode ? "active" : ""}`}
      onClick={() => setPreviewMode(!previewMode)}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      {previewMode ? "编辑" : "预览"}
    </button>
  );
};
