import React, { useMemo } from "react";
import type { Band, ReportElement, RenderContext } from "../../types";
import { ElementRenderer } from "../Elements/ElementRenderer";
import "./Canvas.css";

interface BandRendererProps {
  band: Band;
  elements: ReportElement[];
  selectedIds: string[];
  zoom: number;
  previewMode: boolean;
  contentWidth: number;
  dataRow?: Record<string, any>;
  renderContext?: RenderContext;
  onBandMouseDown: (bandId: string, e: React.MouseEvent) => void;
  onBandResizeStart: (bandId: string, e: React.MouseEvent) => void;
  onElementDragStart: (elementId: string, e: React.MouseEvent) => void;
  onResizeStart: (
    elementId: string,
    handle: string,
    e: React.MouseEvent,
  ) => void;
  onSelectElement: (id: string, e: React.MouseEvent) => void;
}

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
        {!previewMode && <div className="band-hover-overlay" />}
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
        {!previewMode && (
          <div
            className="band-resizer-handle"
            onMouseDown={(e) => {
              e.stopPropagation();
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
