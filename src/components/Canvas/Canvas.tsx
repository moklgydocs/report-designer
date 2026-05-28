/**
 * @file Canvas.tsx
 * Main canvas component for the Report Designer. Provides the primary visual editing
 * surface where users design report layouts using a band-based paradigm (similar to
 * FastReport / Jasper Reports). Supports two modes:
 *   - **Edit Mode**: Interactive template editor with drag-and-drop, resize, snap
 *     guides, rubber-band selection, and context menus.
 *   - **Preview Mode**: Paginated report rendering with async data source support
 *     and progress feedback.
 */
import React, { useRef, useEffect, useCallback, useState } from "react";
import { useDesignerStore } from "../../store/designerStore";
import { useDragEngine } from "../../hooks/useDragEngine";
import { createElement } from "../../utils/elementFactory";
import {
  renderReportPaginated,
  renderReportAsync,
} from "../../utils/reportRenderer";
import type { BandType } from "../../types";
import type {
  RenderedBand,
  RenderedPage,
  RenderedReport,
} from "../../utils/reportRenderer";
import { ElementRenderer } from "../Elements/ElementRenderer";
import { BandRenderer } from "./BandRenderer";
import { ContextMenu } from "../ContextMenu/ContextMenu";
import type { ContextMenuState } from "../ContextMenu/ContextMenu";
import "./Canvas.css";

/** Chinese labels for each band type, displayed in the band label sidebar. */
const BAND_LABELS: Record<string, string> = {
  title: "标题",
  pageHeader: "页眉",
  reportHeader: "报表头",
  groupHeader: "分组头",
  data: "数据",
  groupFooter: "分组尾",
  reportFooter: "报表尾",
  pageFooter: "页脚",
};

/**
 * Main Canvas component — the central editing surface of the Report Designer.
 *
 * Renders the report template as a visual page with bands, elements, grid, margins,
 * and snap guides in edit mode. In preview mode, renders the fully paginated report
 * with data-bound content.
 *
 * Key responsibilities:
 * - Report preview rendering (sync/async with progress)
 * - Ctrl+Wheel zoom handling
 * - Drag-and-drop field placement from data source panel
 * - Right-click context menu for bands, elements, and canvas
 * - Rubber-band selection and element creation preview overlays
 * - Snap alignment guide rendering
 */
export const Canvas: React.FC = () => {
  const {
    report,
    selectedElementIds,
    zoom,
    gridSize,
    showGrid,
    previewMode,
    addElement,
    clearSelection,
    setZoom,
    snapGuides,
    activeBandId,
  } = useDesignerStore();

  const {
    containerRef,
    handleElementDragStart,
    handleResizeStart,
    handleBandMouseDown,
    handleBandResizeStart,
    dragState,
  } = useDragEngine();

  /** Ref to the outermost canvas container div. */
  const canvasRef = useRef<HTMLDivElement>(null);

  /** The fully rendered report output (populated only in preview mode). */
  const [renderedReport, setRenderedReport] = useState<RenderedReport | null>(
    null,
  );

  /** Current rendering stage label (e.g. "resolving" for data fetching). */
  const [renderStage, setRenderStage] = useState<string>("");

  /** Percentage progress for async report rendering (0–100). */
  const [renderProgress, setRenderProgress] = useState(0);

  /** State for the right-click context menu (position, type, target id). */
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const { width, height, marginTop, marginBottom, marginLeft, marginRight } =
    report.pageSettings;

  /** Usable content width after subtracting left and right margins. */
  const contentWidth = width - marginLeft - marginRight;

  // ─── Report Rendering (Preview Mode) ───────────────────────────
  // Render report when entering preview mode or data changes.
  // Uses async renderer for API/database sources, sync for static data.
  useEffect(() => {
    if (!previewMode) {
      setRenderedReport(null);
      return;
    }

    // Determine whether any data sources require async resolution (API/database)
    const hasAsyncSources = report.dataSources.some(
      (ds) => ds.type === "api" || ds.type === "database",
    );

    if (hasAsyncSources) {
      setRenderStage("resolving");
      renderReportAsync(report, (stage, current, total) => {
        setRenderStage(stage);
        setRenderProgress(total > 0 ? Math.round((current / total) * 100) : 0);
      })
        .then((result) => {
          setRenderedReport(result);
          setRenderStage("");
        })
        .catch(() => {
          // Fallback to synchronous paginated rendering on async failure
          const result = renderReportPaginated(report);
          setRenderedReport(result);
          setRenderStage("");
        });
    } else {
      const result = renderReportPaginated(report);
      setRenderedReport(result);
    }
  }, [previewMode, report, report.dataSources, report.bands, report.elements]);

  // ─── Zoom Handling ─────────────────────────────────────────────
  // Ctrl+Wheel zooms in/out the canvas viewport.
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom(zoom + delta);
      }
    };
    const el = canvasRef.current;
    if (el) {
      el.addEventListener("wheel", handleWheel, { passive: false });
      return () => el.removeEventListener("wheel", handleWheel);
    }
  }, [zoom, setZoom]);

  // ─── Drag & Drop from Data Source Panel ────────────────────────
  // When a field is dropped from the data source panel onto a band,
  // create a new text element bound to that field at the drop position.
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const field = e.dataTransfer.getData("text/plain");
      if (!field) return;

      const bandEl = (e.target as HTMLElement).closest(
        "[data-band-id]",
      ) as HTMLElement;
      if (!bandEl) return;
      const bandId = bandEl.getAttribute("data-band-id")!;
      const bandRect = bandEl.getBoundingClientRect();

      const x = (e.clientX - bandRect.left) / zoom;
      const y = (e.clientY - bandRect.top) / zoom;

      const el = createElement("text", x, y) as any;
      el.content = field;
      el.dataField = field;
      addElement(el, bandId);
    },
    [zoom, addElement],
  );

  /** Allow drop by preventing default and signaling copy effect. */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  // ─── Right-Click Context Menu ──────────────────────────────────
  // Determines context menu type based on what was right-clicked:
  // element → element menu, band → band menu, else → canvas menu.
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (previewMode) return;

      // Check if right-clicked on an element
      const elTarget = (e.target as HTMLElement).closest(
        "[data-element-id]",
      ) as HTMLElement;
      if (elTarget) {
        const elementId = elTarget.getAttribute("data-element-id")!;
        setContextMenu({
          x: e.clientX,
          y: e.clientY,
          type: "element",
          elementId,
        });
        return;
      }

      // Check if right-clicked on a band
      const bandTarget = (e.target as HTMLElement).closest(
        "[data-band-id]",
      ) as HTMLElement;
      if (bandTarget) {
        const bandId = bandTarget.getAttribute("data-band-id")!;
        const band = report.bands.find((b) => b.id === bandId);
        setContextMenu({
          x: e.clientX,
          y: e.clientY,
          type: "band",
          bandId,
          bandType: band?.type,
        });
        return;
      }

      // Canvas background
      setContextMenu({ x: e.clientX, y: e.clientY, type: "canvas" });
    },
    [previewMode, report.bands],
  );

  /**
   * Calculate the Y offset of a band by summing the heights of all
   * bands that appear before it in the band order. Used for positioning
   * band labels in the sidebar.
   */
  const getBandY = (targetBandId: string) => {
    let y = 0;
    for (const band of report.bands) {
      if (band.id === targetBandId) return y;
      y += band.height;
    }
    return 0;
  };

  /** Shorthand reference to the current drag state from the drag engine. */
  const st = dragState.current;

  // ─── Preview Mode: Render paginated report ───
  if (previewMode && renderedReport) {
    return (
      <div
        ref={(el) => {
          canvasRef.current = el;
          containerRef.current = el;
        }}
        className="canvas-container preview-mode"
      >
        {renderStage && (
          <div className="render-progress-overlay">
            <div
              className="render-progress-bar"
              style={{ width: `${renderProgress}%` }}
            />
            <span>
              {renderStage === "resolving" ? "正在加载数据..." : "正在渲染..."}
            </span>
          </div>
        )}
        <div
          className="canvas-viewport"
          style={{ position: "relative", display: "inline-block" }}
        >
          {renderedReport.pages.map((page, pageIdx) => (
            <div key={pageIdx} style={{ marginBottom: 20 }}>
              <PreviewPage
                page={page}
                report={report}
                zoom={zoom}
                contentWidth={contentWidth}
              />
              {renderedReport.pages.length > 1 && (
                <div className="page-number-label">
                  第 {page.pageNumber} 页 / 共 {renderedReport.totalPages} 页
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="zoom-indicator">{Math.round(zoom * 100)}%</div>
      </div>
    );
  }

  // ─── Edit Mode: Template view ───
  return (
    <div
      ref={(el) => {
        canvasRef.current = el;
        containerRef.current = el;
      }}
      className={`canvas-container ${previewMode ? "preview-mode" : ""}`}
      onMouseDown={(e) => {
        if (e.target === canvasRef.current) clearSelection();
      }}
      onContextMenu={handleContextMenu}
    >
      <div
        className="canvas-viewport"
        style={{ position: "relative", display: "inline-block" }}
      >
        {/* Band labels layer */}
        {!previewMode && (
          <div className="band-labels-layer">
            {report.bands.map((band) => {
              const y = (getBandY(band.id) + marginTop) * zoom;
              return (
                <div
                  key={band.id}
                  className="band-label-fixed"
                  style={{ top: `${y}px`, height: `${band.height * zoom}px` }}
                >
                  <span className="band-type-tag">
                    {BAND_LABELS[band.type] || band.type}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Canvas page */}
        <div
          className="canvas-page"
          style={{
            width: `${width}px`,
            minHeight: `${height}px`,
            transform: `scale(${zoom})`,
            transformOrigin: "top left",
          }}
        >
          {/* Margins */}
          <div
            className="page-margin"
            style={{
              top: 0,
              left: 0,
              width: `${marginLeft}px`,
              height: "100%",
            }}
          />
          <div
            className="page-margin"
            style={{
              top: 0,
              right: 0,
              width: `${marginRight}px`,
              height: "100%",
            }}
          />
          <div
            className="page-margin"
            style={{ top: 0, left: 0, width: "100%", height: `${marginTop}px` }}
          />
          <div
            className="page-margin"
            style={{
              bottom: 0,
              left: 0,
              width: "100%",
              height: `${marginBottom}px`,
            }}
          />

          {/* Grid */}
          {showGrid && !previewMode && (
            <div
              className="canvas-grid"
              style={{
                left: `${marginLeft}px`,
                top: `${marginTop}px`,
                width: `${contentWidth}px`,
                height: `${height - marginTop - marginBottom}px`,
                backgroundSize: `${gridSize}px ${gridSize}px`,
              }}
            />
          )}

          {/* Content Area */}
          <div
            className="canvas-content"
            style={{
              marginLeft: `${marginLeft}px`,
              marginRight: `${marginRight}px`,
              marginTop: `${marginTop}px`,
              marginBottom: `${marginBottom}px`,
              width: `${contentWidth}px`,
            }}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            {report.bands.map((band) => {
              return (
                <BandRenderer
                  key={band.id}
                  band={band}
                  elements={(band.elements || [])
                    .map((eid) => report.elements[eid])
                    .filter(Boolean)}
                  selectedIds={selectedElementIds}
                  zoom={zoom}
                  previewMode={previewMode}
                  contentWidth={contentWidth}
                  onBandMouseDown={(bandId: string, e: React.MouseEvent) =>
                    handleBandMouseDown(bandId, e as any)
                  }
                  onBandResizeStart={(bandId: string, e: React.MouseEvent) =>
                    handleBandResizeStart(bandId, e as any)
                  }
                  onElementDragStart={(
                    elementId: string,
                    e: React.MouseEvent,
                  ) => handleElementDragStart(elementId, e as any)}
                  onResizeStart={(
                    elementId: string,
                    handle: string,
                    e: React.MouseEvent,
                  ) => handleResizeStart(elementId, handle, e as any)}
                  onSelectElement={(id: string, e: React.MouseEvent) =>
                    useDesignerStore
                      .getState()
                      .selectElement(id, e.ctrlKey || e.metaKey)
                  }
                />
              );
            })}

            {/* Rubber band selection rectangle — shown during drag-select within a band */}
            {st.mode === "rubber-band" &&
              st.rubberBandStart &&
              st.rubberBandEnd &&
              (() => {
                // Compute cumulative Y offset of bands above the rubber-band's band,
                // so the rectangle is positioned correctly within the content area
                let bandYOff = 0;
                for (const b of report.bands) {
                  if (b.id === st.rubberBandBandId) break;
                  bandYOff += b.height;
                }
                return (
                  <div
                    className="rubber-band-rect"
                    style={{
                      left: Math.min(st.rubberBandStart.x, st.rubberBandEnd.x),
                      top:
                        Math.min(st.rubberBandStart.y, st.rubberBandEnd.y) +
                        bandYOff,
                      width: Math.abs(
                        st.rubberBandEnd.x - st.rubberBandStart.x,
                      ),
                      height: Math.abs(
                        st.rubberBandEnd.y - st.rubberBandStart.y,
                      ),
                    }}
                  />
                );
              })()}

            {/* Element creation preview — shown while dragging to create a new element */}
            {st.mode === "creating" &&
              st.moved &&
              (() => {
                // Calculate band Y offset so preview renders at correct content-relative position
                let bandYOff = 0;
                for (const b of report.bands) {
                  if (b.id === st.createBandId) break;
                  bandYOff += b.height;
                }
                return (
                  <div
                    className="create-preview"
                    style={{
                      left: Math.min(st.createStartX, st.currentX),
                      top: Math.min(st.createStartY, st.currentY) + bandYOff,
                      width: Math.abs(st.currentX - st.createStartX),
                      height: Math.abs(st.currentY - st.createStartY),
                    }}
                  />
                );
              })()}

            {/* Snap alignment guides — horizontal/vertical lines shown during drag to indicate alignment */}
            {snapGuides.length > 0 &&
              (() => {
                // Offset guides by the Y position of the active band so they appear at the right position
                let bandYOffset = 0;
                for (const band of report.bands) {
                  if (band.id === activeBandId) break;
                  bandYOffset += band.height;
                }
                return snapGuides.map((guide, i) => (
                  <div
                    key={i}
                    className={`snap-guide ${guide.type}`}
                    style={
                      guide.type === "vertical"
                        ? { left: guide.position }
                        : { top: guide.position + bandYOffset }
                    }
                  />
                ));
              })()}
          </div>
        </div>
      </div>

      <div className="zoom-indicator">{Math.round(zoom * 100)}%</div>
      {contextMenu && (
        <ContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} />
      )}
    </div>
  );
};

// ─── Preview Page ──────────────────────────────────────────────

/**
 * Renders a single page of the paginated preview output.
 * Displays the page with proper margins and renders each band via PreviewBand.
 * Wrapped in React.memo to avoid re-rendering when other pages change.
 */
const PreviewPage: React.FC<{
  /** The rendered page data containing bands and page number. */
  page: RenderedPage;
  /** Report-level page settings (dimensions, margins). */
  report: {
    pageSettings: {
      width: number;
      height: number;
      marginTop: number;
      marginBottom: number;
      marginLeft: number;
      marginRight: number;
    };
  };
  zoom: number;
  contentWidth: number;
}> = React.memo(({ page, report, zoom, contentWidth }) => {
  const { width, height, marginTop, marginBottom, marginLeft, marginRight } =
    report.pageSettings;

  return (
    <div
      className="canvas-page"
      style={{
        width: `${width}px`,
        minHeight: `${height}px`,
        transform: `scale(${zoom})`,
        transformOrigin: "top left",
      }}
    >
      {/* Margin overlays — shaded areas showing non-printable margins */}
      <div
        className="page-margin"
        style={{ top: 0, left: 0, width: `${marginLeft}px`, height: "100%" }}
      />
      <div
        className="page-margin"
        style={{ top: 0, right: 0, width: `${marginRight}px`, height: "100%" }}
      />
      <div
        className="page-margin"
        style={{ top: 0, left: 0, width: "100%", height: `${marginTop}px` }}
      />
      <div
        className="page-margin"
        style={{
          bottom: 0,
          left: 0,
          width: "100%",
          height: `${marginBottom}px`,
        }}
      />

      <div
        className="canvas-content"
        style={{
          marginLeft: `${marginLeft}px`,
          marginRight: `${marginRight}px`,
          marginTop: `${marginTop}px`,
          marginBottom: `${marginBottom}px`,
          width: `${contentWidth}px`,
        }}
      >
        {page.bands.map((rb, idx) => (
          <PreviewBand
            key={`${rb.bandId}-${idx}`}
            renderedBand={rb}
            contentWidth={contentWidth}
          />
        ))}
      </div>
    </div>
  );
});
PreviewPage.displayName = "PreviewPage";

// ─── Preview Band ──────────────────────────────────────────────

/**
 * Renders a single band within a preview page. Filters elements by their
 * `printOn` property (controlling visibility per band type) and sorts by
 * z-order for correct layering. Wrapped in React.memo for performance.
 */
const PreviewBand: React.FC<{
  /** The pre-rendered band data with elements, data row, and styling. */
  renderedBand: RenderedBand;
  /** Available content width after margins. */
  contentWidth: number;
}> = React.memo(({ renderedBand, contentWidth }) => {
  const {
    height,
    backgroundColor,
    elements,
    dataRow,
    renderContext,
    bandType,
  } = renderedBand;

  // Filter elements based on printOn: only include elements whose printOn
  // list includes this band's type; if printOn is empty, show on all bands.
  const filteredElements = elements.filter((el) => {
    if (!el.printOn || el.printOn.length === 0) return true;
    return el.printOn.includes(bandType as BandType);
  });

  // Sort by z-order so elements render in the correct visual layer order
  const sorted = [...filteredElements].sort((a, b) => a.zOrder - b.zOrder);

  return (
    <div
      className="band-container"
      style={{
        height: `${height}px`,
        backgroundColor,
        width: `${contentWidth}px`,
      }}
      data-band-id={renderedBand.bandId}
      data-band-type={bandType}
    >
      {/* Render each element in z-order; all interaction handlers are no-ops in preview mode */}
      {sorted.map((el) => (
        <ElementRenderer
          key={el.id}
          element={el}
          isSelected={false}
          zoom={1}
          previewMode={true}
          dataRow={dataRow}
          renderContext={renderContext}
          onDragStart={() => {}}
          onResizeStart={() => {}}
          onSelect={() => {}}
        />
      ))}
    </div>
  );
});
PreviewBand.displayName = "PreviewBand";
