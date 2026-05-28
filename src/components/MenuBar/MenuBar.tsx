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

export const MenuBar: React.FC = () => {
  const { report, saveReport } = useDesignerStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleNew = () => {
    if (confirm("创建新报表？未保存的更改将丢失。")) {
      const { setReport } = useDesignerStore.getState();
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

  const handleLoad = () => {
    fileInputRef.current?.click();
  };

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
            switch (el.type) {
              case "text":
                rows.push([
                  (el as TextElement).content ||
                    (el as TextElement).dataField ||
                    "",
                ]);
                break;
              case "table": {
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
        if (ds.data?.length) {
          const ws = XLSX.utils.json_to_sheet(ds.data);
          XLSX.utils.book_append_sheet(wb, ws, ds.name);
        }
      });

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

  const handleExportImage = async () => {
    const store = useDesignerStore.getState();
    const currentZoom = store.zoom;
    store.setZoom(1);
    store.setPreviewMode(true);
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
      useDesignerStore.getState().setZoom(currentZoom);
      useDesignerStore.getState().setPreviewMode(false);
    }
  };

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
