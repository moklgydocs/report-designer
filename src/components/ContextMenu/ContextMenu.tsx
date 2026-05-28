import React, { useEffect, useRef, useCallback } from 'react';
import { useDesignerStore } from '../../store/designerStore';
import type { BandType } from '../../types';
import './ContextMenu.css';

export interface ContextMenuState {
  x: number;
  y: number;
  type: 'element' | 'band' | 'canvas';
  elementId?: string;
  bandId?: string;
  bandType?: BandType;
}

interface Props {
  menu: ContextMenuState;
  onClose: () => void;
}

const BAND_LABELS: Record<string, string> = {
  title: '标题', pageHeader: '页眉', reportHeader: '报表头',
  groupHeader: '分组头', data: '数据', groupFooter: '分组尾',
  reportFooter: '报表尾', pageFooter: '页脚',
};

const ADDABLE_BAND_TYPES: BandType[] = ['groupHeader', 'data', 'groupFooter', 'reportHeader', 'reportFooter'];

export const ContextMenu: React.FC<Props> = ({ menu, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);
  const {
    copySelected, pasteElements, deleteElement, duplicateElement,
    bringToFront, sendToBack, selectElement, addBand, removeBand,
    alignElements, selectedElementIds, report,
  } = useDesignerStore();

  // Close on click outside or Escape
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  // Position: keep within viewport
  const style: React.CSSProperties = {
    left: menu.x,
    top: menu.y,
  };

  const handleAction = useCallback((action: () => void) => {
    action();
    onClose();
  }, [onClose]);

  return (
    <div ref={ref} className="context-menu" style={style}>
      {menu.type === 'element' && (
        <>
          <button className="ctx-item" onClick={() => handleAction(() => copySelected())}>
            <span className="ctx-icon">📋</span> 复制<span className="ctx-shortcut">Ctrl+C</span>
          </button>
          <button className="ctx-item" onClick={() => handleAction(() => pasteElements())}>
            <span className="ctx-icon">📄</span> 粘贴<span className="ctx-shortcut">Ctrl+V</span>
          </button>
          <button className="ctx-item" onClick={() => handleAction(() => menu.elementId && duplicateElement(menu.elementId))}>
            <span className="ctx-icon">📑</span> 复制元素
          </button>
          <div className="ctx-sep" />
          <button className="ctx-item" onClick={() => handleAction(() => menu.elementId && bringToFront(menu.elementId))}>
            <span className="ctx-icon">⬆</span> 置于顶层
          </button>
          <button className="ctx-item" onClick={() => handleAction(() => menu.elementId && sendToBack(menu.elementId))}>
            <span className="ctx-icon">⬇</span> 置于底层
          </button>
          {selectedElementIds.length > 1 && (
            <>
              <div className="ctx-sep" />
              <div className="ctx-group-label">对齐</div>
              <button className="ctx-item" onClick={() => handleAction(() => alignElements('left'))}>左对齐</button>
              <button className="ctx-item" onClick={() => handleAction(() => alignElements('centerH'))}>水平居中</button>
              <button className="ctx-item" onClick={() => handleAction(() => alignElements('right'))}>右对齐</button>
              <button className="ctx-item" onClick={() => handleAction(() => alignElements('top'))}>顶部对齐</button>
              <button className="ctx-item" onClick={() => handleAction(() => alignElements('bottom'))}>底部对齐</button>
            </>
          )}
          <div className="ctx-sep" />
          <button className="ctx-item danger" onClick={() => handleAction(() => menu.elementId && deleteElement(menu.elementId))}>
            <span className="ctx-icon">🗑</span> 删除<span className="ctx-shortcut">Del</span>
          </button>
        </>
      )}

      {menu.type === 'band' && (
        <>
          <div className="ctx-group-label">{BAND_LABELS[menu.bandType || ''] || menu.bandType} 带</div>
          <button className="ctx-item" onClick={() => handleAction(() => {
            const band = report.bands.find(b => b.id === menu.bandId);
            if (band) {
              const elIds = band.elements;
              if (elIds.length > 0) selectElement(elIds);
            }
          })}>
            <span className="ctx-icon">☐</span> 选中所有元素
          </button>
          {ADDABLE_BAND_TYPES.includes(menu.bandType as BandType) && (
            <>
              <div className="ctx-sep" />
              <div className="ctx-group-label">添加带</div>
              {ADDABLE_BAND_TYPES.map(bt => (
                <button key={bt} className="ctx-item" onClick={() => handleAction(() => addBand(bt))}>
                  {BAND_LABELS[bt]}
                </button>
              ))}
            </>
          )}
          <div className="ctx-sep" />
          <button className="ctx-item danger" onClick={() => handleAction(() => menu.bandId && removeBand(menu.bandId))}>
            <span className="ctx-icon">🗑</span> 删除此带
          </button>
        </>
      )}

      {menu.type === 'canvas' && (
        <>
          <button className="ctx-item" onClick={() => handleAction(() => pasteElements())}>
            <span className="ctx-icon">📄</span> 粘贴<span className="ctx-shortcut">Ctrl+V</span>
          </button>
          <div className="ctx-sep" />
          <div className="ctx-group-label">添加带</div>
          {ADDABLE_BAND_TYPES.map(bt => (
            <button key={bt} className="ctx-item" onClick={() => handleAction(() => addBand(bt))}>
              {BAND_LABELS[bt]}
            </button>
          ))}
        </>
      )}
    </div>
  );
};
