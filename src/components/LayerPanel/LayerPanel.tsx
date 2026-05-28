import React from 'react';
import { useDesignerStore } from '../../store/designerStore';
import './LayerPanel.css';

const TYPE_ICONS: Record<string, string> = {
  text: 'T', rectangle: '▭', line: '╱', image: '▨',
  barcode: '▐', qrcode: '⬜', chart: 'ǂ', table: '⊞',
  subreport: '⧉', crosstab: '⊞',
};

export const LayerPanel: React.FC = () => {
  const { report, selectedElementIds, selectElement, moveLayerUp, moveLayerDown, bringToFront, sendToBack, updateElement } = useDesignerStore();

  const allElements = Object.values(report.elements).sort((a, b) => b.zOrder - a.zOrder);

  return (
    <div className="layer-panel">
      <div className="layer-header">
        <span className="layer-title">图层</span>
        <span className="layer-count">{allElements.length}</span>
      </div>
      <div className="layer-list">
        {allElements.map(el => (
          <div
            key={el.id}
            className={`layer-item ${selectedElementIds.includes(el.id) ? 'selected' : ''}`}
            onClick={() => selectElement(el.id)}
          >
            <span className="layer-icon">{TYPE_ICONS[el.type] || '?'}</span>
            <span className="layer-name">{el.name || el.type}</span>
            <div className="layer-actions">
              <button
                className="layer-action-btn"
                onClick={(e) => { e.stopPropagation(); updateElement(el.id, { visible: !el.visible }); }}
                title={el.visible ? '隐藏' : '显示'}
              >
                {el.visible ? '👁' : '🚫'}
              </button>
              <button
                className="layer-action-btn"
                onClick={(e) => { e.stopPropagation(); updateElement(el.id, { locked: !el.locked }); }}
                title={el.locked ? '解锁' : '锁定'}
              >
                {el.locked ? '🔒' : '🔓'}
              </button>
            </div>
          </div>
        ))}
      </div>
      {selectedElementIds.length === 1 && (
        <div className="layer-order-actions">
          <button className="layer-order-btn" onClick={() => moveLayerUp(selectedElementIds[0])} title="上移一层">↑</button>
          <button className="layer-order-btn" onClick={() => moveLayerDown(selectedElementIds[0])} title="下移一层">↓</button>
          <button className="layer-order-btn" onClick={() => bringToFront(selectedElementIds[0])} title="置顶">⤒</button>
          <button className="layer-order-btn" onClick={() => sendToBack(selectedElementIds[0])} title="置底">⤓</button>
        </div>
      )}
    </div>
  );
};
