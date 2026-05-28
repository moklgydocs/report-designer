/**
 * @file Toolbar component for the Report Designer.
 *
 * Renders a vertical tool palette that lets the user select an active drawing tool
 * (e.g. text, rectangle, table) or the select/pointer tool. The active tool is
 * tracked in the global designer store and determines the interaction mode on the
 * design canvas.
 */
import React from 'react';
import { useDesignerStore } from '../../store/designerStore';
import type { ElementType } from '../../types';
import './Toolbar.css';

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

/**
 * Static list of available element tools displayed in the toolbar.
 * Each entry maps a tool type to its display label, icon character, and
 * optional keyboard shortcut (number key) for quick switching.
 */
const ELEMENT_TOOLS: { type: ElementType | 'select'; label: string; icon: string; shortcut?: string }[] = [
  { type: 'select', label: '选择', icon: '⊹', shortcut: '1' },
  { type: 'text', label: '文本', icon: 'T', shortcut: '2' },
  { type: 'rectangle', label: '矩形', icon: '▭', shortcut: '3' },
  { type: 'line', label: '线条', icon: '╱', shortcut: '4' },
  { type: 'image', label: '图片', icon: '▨' },
  { type: 'table', label: '表格', icon: '⊞', shortcut: '5' },
  { type: 'barcode', label: '条形码', icon: '▐' },
  { type: 'qrcode', label: '二维码', icon: '⬜' },
  { type: 'chart', label: '图表', icon: 'ǂ' },
  { type: 'subreport', label: '子报表', icon: '⧉' },
  { type: 'crosstab', label: '交叉表', icon: '⊞' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Toolbar component – a vertical sidebar of element-creation tools.
 *
 * Reads the currently active tool from the designer store and renders a button
 * for each entry in {@link ELEMENT_TOOLS}. Clicking a button updates the store's
 * `activeTool` so the canvas knows which placement mode to use.
 *
 * @returns The toolbar React element.
 */
export const Toolbar: React.FC = () => {
  /** Currently active tool type from the global store. */
  const { activeTool, setActiveTool } = useDesignerStore();

  return (
    <div className="toolbar">
      {/* ---- Tool selection section ---- */}
      <div className="toolbar-section">
        <div className="toolbar-section-label">工具</div>
        <div className="toolbar-tools">
          {ELEMENT_TOOLS.map(tool => (
            <button
              key={tool.type}
              className={`toolbar-btn tool-btn ${activeTool === tool.type ? 'active' : ''}`}
              onClick={() => setActiveTool(tool.type)}
              title={`${tool.label}${tool.shortcut ? ` (${tool.shortcut})` : ''}`}
            >
              <span className="tool-icon">{tool.icon}</span>
            </button>
          ))}
        </div>
      </div>
      {/* Spacer pushes remaining content to the bottom */}
      <div className="toolbar-spacer" />
    </div>
  );
};
