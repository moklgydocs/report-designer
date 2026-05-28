/**
 * @file BandRenderer.tsx
 * Renders a single report band with its contained elements.
 *
 * Each band is a horizontal section of the report (e.g. page header, data row,
 * group footer) that holds a collection of report elements. This component:
 * - Sorts elements by zOrder for correct layering
 * - Renders the band container with its configured height and background
 * - Delegates each element to {@link ElementRenderer}
 * - Provides a resize handle at the bottom of the band (edit mode only)
 */
import React, { useMemo } from "react";
import type { Band, ReportElement, RenderContext } from "../../types";
import { ElementRenderer } from "../Elements/ElementRenderer";
import "./Canvas.css";

/** Props for the BandRenderer component */
interface BandRendererProps {
  /** The band definition (type, height, backgroundColor, etc.). */
  band: Band;
  /** Elements belonging to this band, resolved from the report element map. */
  elements: ReportElement[];
  /** IDs of currently selected elements (for highlight rendering). */
  selectedIds: string[];
  /** Current zoom level of the canvas. */
  zoom: number;
  /** Whether the canvas is in preview mode (disables interactions). */
  previewMode: boolean;
  /** Usable content width after subtracting page margins. */
  contentWidth: number;
  /** Optional data row for preview/data-bound rendering. */
  dataRow?: Record<string, any>;
  /** Optional render context with evaluated expressions and page info. */
  renderContext?: RenderContext;
  /** Callback when mouse is pressed on the band (for selection/drag). */
  onBandMouseDown: (bandId: string, e: React.MouseEvent) => void;
  /** Callback when the band resize handle is dragged. */
  onBandResizeStart: (bandId: string, e: React.MouseEvent) => void;
  /** Callback when dragging an element within this band starts. */
  onElementDragStart: (elementId: string, e: React.MouseEvent) => void;
  /** Callback when resizing an element handle starts. */
  onResizeStart: (
    elementId: string,
    handle: string,
    e: React.MouseEvent,
  ) => void;
  /** Callback when an element is clicked for selection. */
  onSelectElement: (id: string, e: React.MouseEvent) => void;
}

/**
 * BandRenderer — renders a single band with its elements.
 * Memoized to avoid re-rendering when unrelated bands change.
 */
export const BandRenderer: React.FC<BandRendererProps> = React.memo(
  ({
    band,
    elements,
    selectedIds,
    zoom,
    previewMode,
    contentWidth,
    dataRow,
    renderContext,
    onBandMouseDown,
    onBandResizeStart,
    onElementDragStart,
    onResizeStart,
    onSelectElement,
  }) => {
    /** Sort elements by zOrder to ensure correct visual layering (lower = behind, higher = in front). */
    const sortedElements = useMemo(
      () => [...elements].sort((a, b) => a.zOrder - b.zOrder),
      [elements],
    );

    return (
      <div
        className="band-container"
        style={{
          height: `${band.height}px`,
          backgroundColor: band.backgroundColor,
          width: `${contentWidth}px`,
        }}
        onMouseDown={(e) => onBandMouseDown(band.id, e)}
        data-band-id={band.id}
        data-band-type={band.type}
      >
        {/* Hover overlay shown in edit mode to highlight band on mouse-over */}
        {!previewMode && <div className="band-hover-overlay" />}
        {/* Render each element, passing interaction callbacks (no-ops in preview mode) */}
        {sortedElements.map((el) => (
          <ElementRenderer
            key={el.id}
            element={el}
            isSelected={selectedIds.includes(el.id)}
            zoom={zoom}
            previewMode={previewMode}
            dataRow={dataRow}
            renderContext={renderContext}
            onDragStart={(e) =>
              previewMode ? undefined : onElementDragStart(el.id, e)
            }
            onResizeStart={(handle, e) =>
              previewMode ? undefined : onResizeStart(el.id, handle, e)
            }
            onSelect={(e) =>
              previewMode ? undefined : onSelectElement(el.id, e)
            }
          />
        ))}
        {/* Band resize handle — drag to change band height (edit mode only) */}
        {!previewMode && (
          <div
            className="band-resizer-handle"
            onMouseDown={(e) => {
              e.stopPropagation(); // Prevent triggering band mouse-down
              e.preventDefault();
              onBandResizeStart(band.id, e);
            }}
          />
        )}
      </div>
    );
  },
);
BandRenderer.displayName = "BandRenderer";
