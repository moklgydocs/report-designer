import React, { useState, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useDesignerStore } from '../../store/designerStore';
import type {
  ReportElement, TextElement, RectangleElement, LineElement,
  ImageElement, BarcodeElement, QRCodeElement, ChartElement,
  TableElement, CrossTabElement, BorderStyle, TableCell, FontConfig, Padding, Borders,
  BandType,
} from '../../types';
import { TableEditor } from '../TableEditor/TableEditor';
import { testConnection, discoverFields } from '../../services/api';
import './PropertyPanel.css';

const FONT_FAMILIES = [
  'Microsoft YaHei', 'SimSun', 'SimHei', 'KaiTi', 'FangSong',
  'Arial', 'Times New Roman', 'Courier New', 'Verdana',
  'Georgia', 'Tahoma', 'Impact',
];

const BAND_TYPES: { value: BandType; label: string }[] = [
  { value: 'title', label: '标题' },
  { value: 'pageHeader', label: '页眉' },
  { value: 'reportHeader', label: '报表头' },
  { value: 'groupHeader', label: '分组头' },
  { value: 'data', label: '数据' },
  { value: 'groupFooter', label: '分组尾' },
  { value: 'reportFooter', label: '报表尾' },
  { value: 'pageFooter', label: '页脚' },
];

export const PropertyPanel: React.FC = () => {
  const { report, selectedElementIds, updateElement, updateBand, addBand, removeBand, pushHistory } = useDesignerStore();
  const [activeTab, setActiveTab] = useState<'element' | 'band' | 'page' | 'data'>('element');
  const historyPushedRef = useRef(false);

  // Wrapper that pushes history on first edit in a sequence
  const updateWithHistory = useCallback((id: string, updates: Partial<ReportElement>) => {
    if (!historyPushedRef.current) {
      pushHistory();
      historyPushedRef.current = true;
    }
    updateElement(id, updates);
  }, [pushHistory, updateElement]);


  const selectedElement = selectedElementIds.length === 1
    ? report.elements[selectedElementIds[0]]
    : null;

  const selectedBand = report.bands.find(b => b.elements.some(eid => selectedElementIds.includes(eid)));

  const renderElementProperties = () => {
    if (!selectedElement) {
      return (
        <div className="prop-empty">
          <div className="prop-empty-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5">
              <path d="M4 4h16v16H4z" /><path d="M4 4l16 16" />
            </svg>
          </div>
          <div>选择元素以编辑属性</div>
        </div>
      );
    }

    return (
      <div className="prop-sections">
        {/* Basic Properties */}
        <PropSection title="基本属性">
          <PropRow label="名称">
            <input type="text" className="prop-input" value={selectedElement.name}
              onChange={e => updateWithHistory(selectedElement.id, { name: e.target.value })} />
          </PropRow>
          <PropRow label="类型">
            <span className="prop-type-badge">{getTypeLabel(selectedElement.type)}</span>
          </PropRow>
          <div className="prop-grid-4">
            <div className="prop-field">
              <label>X</label>
              <input type="number" className="prop-input-sm" value={Math.round(selectedElement.x)}
                onChange={e => updateWithHistory(selectedElement.id, { x: Number(e.target.value) })} />
            </div>
            <div className="prop-field">
              <label>Y</label>
              <input type="number" className="prop-input-sm" value={Math.round(selectedElement.y)}
                onChange={e => updateWithHistory(selectedElement.id, { y: Number(e.target.value) })} />
            </div>
            <div className="prop-field">
              <label>宽</label>
              <input type="number" className="prop-input-sm" value={Math.round(selectedElement.width)}
                onChange={e => updateWithHistory(selectedElement.id, { width: Number(e.target.value) })} />
            </div>
            <div className="prop-field">
              <label>高</label>
              <input type="number" className="prop-input-sm" value={Math.round(selectedElement.height)}
                onChange={e => updateWithHistory(selectedElement.id, { height: Number(e.target.value) })} />
            </div>
          </div>
          <PropRow label="旋转">
            <input type="number" className="prop-input-sm" value={selectedElement.rotation}
              onChange={e => updateWithHistory(selectedElement.id, { rotation: Number(e.target.value) })} />
            <span className="prop-unit">°</span>
          </PropRow>
          <PropRow label="可见">
            <label className="prop-switch">
              <input type="checkbox" checked={selectedElement.visible}
                onChange={e => updateWithHistory(selectedElement.id, { visible: e.target.checked })} />
              <span className="switch-slider" />
            </label>
          </PropRow>
          <PropRow label="锁定">
            <label className="prop-switch">
              <input type="checkbox" checked={selectedElement.locked}
                onChange={e => updateWithHistory(selectedElement.id, { locked: e.target.checked })} />
              <span className="switch-slider" />
            </label>
          </PropRow>
        </PropSection>

        {/* Type-specific properties */}
        {renderTypeSpecificProperties(selectedElement)}

        {/* Conditional Formatting */}
        <PropSection title="条件格式">
          {(selectedElement?.conditionalFormats || []).map((cf, idx) => (
            <div key={cf.id} className="conditional-format-item" style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 4, padding: 6, marginBottom: 4 }}>
              <PropRow label="条件">
                <input type="text" className="prop-input" value={cf.condition}
                  onChange={e => {
                    const newFormats = [...(selectedElement.conditionalFormats || [])];
                    newFormats[idx] = { ...cf, condition: e.target.value };
                    updateWithHistory(selectedElement.id, { conditionalFormats: newFormats });
                  }}
                  placeholder="{field} > 100" />
              </PropRow>
              <PropRow label="背景色">
                <input type="color" className="prop-color" value={cf.backgroundColor || '#ff0000'}
                  onChange={e => {
                    const newFormats = [...(selectedElement.conditionalFormats || [])];
                    newFormats[idx] = { ...cf, backgroundColor: e.target.value };
                    updateWithHistory(selectedElement.id, { conditionalFormats: newFormats });
                  }} />
              </PropRow>
              <PropRow label="字体色">
                <input type="color" className="prop-color" value={cf.font?.color || '#333333'}
                  onChange={e => {
                    const newFormats = [...(selectedElement.conditionalFormats || [])];
                    newFormats[idx] = { ...cf, font: { ...cf.font, color: e.target.value } as any };
                    updateWithHistory(selectedElement.id, { conditionalFormats: newFormats });
                  }} />
              </PropRow>
              <button className="prop-btn" style={{ fontSize: 10, padding: '2px 8px', color: '#f87171' }} onClick={() => {
                const newFormats = (selectedElement.conditionalFormats || []).filter((_, i) => i !== idx);
                updateWithHistory(selectedElement.id, { conditionalFormats: newFormats });
              }}>删除</button>
            </div>
          ))}
          <button className="prop-btn primary" onClick={() => {
            const newFormats = [...(selectedElement?.conditionalFormats || []), {
              id: uuidv4(), condition: '', backgroundColor: '#ff0000',
            }];
            updateWithHistory(selectedElement!.id, { conditionalFormats: newFormats });
          }}>添加条件</button>
        </PropSection>
      </div>
    );
  };

  const renderTypeSpecificProperties = (el: ReportElement) => {
    switch (el.type) {
      case 'text': return <TextProperties element={el} onUpdate={updateWithHistory} />;
      case 'rectangle': return <RectangleProperties element={el} onUpdate={updateWithHistory} />;
      case 'line': return <LineProperties element={el} onUpdate={updateWithHistory} />;
      case 'image': return <ImageProperties element={el} onUpdate={updateWithHistory} />;
      case 'barcode': return <BarcodeProperties element={el} onUpdate={updateWithHistory} />;
      case 'qrcode': return <QRCodeProperties element={el} onUpdate={updateWithHistory} />;
      case 'chart': return <ChartProperties element={el} onUpdate={updateWithHistory} />;
      case 'table': return <TableProperties element={el} onUpdate={updateWithHistory} />;
      case 'crosstab': return <CrossTabProperties element={el} onUpdate={updateWithHistory} />;
      default: return null;
    }
  };

  const renderBandProperties = () => (
    <div className="prop-sections">
      <PropSection title="Band 管理">
        <div className="band-list">
          {report.bands.map((band, _idx) => (
            <div key={band.id} className="band-item">
              <div className="band-item-info">
                <span className="band-item-type">{BAND_TYPES.find(b => b.value === band.type)?.label || band.type}</span>
                <span className="band-item-height">{band.height}px</span>
              </div>
              <div className="band-item-actions">
                <input type="number" className="prop-input-sm" value={band.height}
                  onChange={e => updateBand(band.id, { height: Number(e.target.value) })} />
                <label className="prop-switch-sm">
                  <input type="checkbox" checked={band.visible}
                    onChange={e => updateBand(band.id, { visible: e.target.checked })} />
                  <span className="switch-slider-sm" />
                </label>
                {band.type !== 'data' && (
                  <button className="band-remove-btn" onClick={() => removeBand(band.id)}>×</button>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="band-add">
          <select className="prop-select" defaultValue="" onChange={e => {
            if (e.target.value) { addBand(e.target.value as BandType); e.target.value = ''; }
          }}>
            <option value="">添加 Band...</option>
            {BAND_TYPES.map(bt => (
              <option key={bt.value} value={bt.value}>{bt.label}</option>
            ))}
          </select>
        </div>
      </PropSection>
      {selectedBand && (
        <PropSection title="当前 Band">
          <PropRow label="高度">
            <input type="number" className="prop-input-sm" value={selectedBand.height}
              onChange={e => updateBand(selectedBand.id, { height: Number(e.target.value) })} />
          </PropRow>
          <PropRow label="背景色">
            <input type="color" className="prop-color" value={selectedBand.backgroundColor}
              onChange={e => updateBand(selectedBand.id, { backgroundColor: e.target.value })} />
          </PropRow>
          <PropRow label="分组表达式">
            <input type="text" className="prop-input" value={selectedBand.groupExpression || ''}
              onChange={e => updateBand(selectedBand.id, { groupExpression: e.target.value })}
              placeholder="例: {category}" />
          </PropRow>
          <PropRow label="新页前">
            <label className="prop-switch">
              <input type="checkbox" checked={selectedBand.newPageBefore || false}
                onChange={e => updateBand(selectedBand.id, { newPageBefore: e.target.checked })} />
              <span className="switch-slider" />
            </label>
          </PropRow>
          <PropRow label="新页后">
            <label className="prop-switch">
              <input type="checkbox" checked={selectedBand.newPageAfter || false}
                onChange={e => updateBand(selectedBand.id, { newPageAfter: e.target.checked })} />
              <span className="switch-slider" />
            </label>
          </PropRow>
          <PropRow label="每页重复">
            <label className="prop-switch">
              <input type="checkbox" checked={selectedBand.repeatOnEveryPage || false}
                onChange={e => updateBand(selectedBand.id, { repeatOnEveryPage: e.target.checked })} />
              <span className="switch-slider" />
            </label>
          </PropRow>
          {selectedBand.type === 'data' && (
            <PropRow label="数据源">
              <select className="prop-select" value={selectedBand.dataSourceId || ''}
                onChange={e => updateBand(selectedBand.id, { dataSourceId: e.target.value || undefined })}>
                <option value="">未绑定</option>
                {report.dataSources.map(ds => (
                  <option key={ds.id} value={ds.id}>{ds.name} ({ds.data?.length || 0}条)</option>
                ))}
              </select>
            </PropRow>
          )}
        </PropSection>
      )}
    </div>
  );

  const renderPageProperties = () => (
    <div className="prop-sections">
      <PropSection title="页面设置">
        <PropRow label="纸张方向">
          <div className="prop-toggle-group">
            <button className={`toggle-btn ${report.pageSettings.orientation === 'portrait' ? 'active' : ''}`}
              onClick={() => useDesignerStore.getState().updatePageSettings({ orientation: 'portrait' })}>纵向</button>
            <button className={`toggle-btn ${report.pageSettings.orientation === 'landscape' ? 'active' : ''}`}
              onClick={() => useDesignerStore.getState().updatePageSettings({ orientation: 'landscape' })}>横向</button>
          </div>
        </PropRow>
        <PropRow label="纸张宽度">
          <input type="number" className="prop-input-sm" value={report.pageSettings.width}
            onChange={e => useDesignerStore.getState().updatePageSettings({ width: Number(e.target.value) })} />
          <span className="prop-unit">px</span>
        </PropRow>
        <PropRow label="纸张高度">
          <input type="number" className="prop-input-sm" value={report.pageSettings.height}
            onChange={e => useDesignerStore.getState().updatePageSettings({ height: Number(e.target.value) })} />
          <span className="prop-unit">px</span>
        </PropRow>
        <div className="prop-divider" />
        <div className="prop-grid-4">
          <div className="prop-field">
            <label>上边距</label>
            <input type="number" className="prop-input-sm" value={report.pageSettings.marginTop}
              onChange={e => useDesignerStore.getState().updatePageSettings({ marginTop: Number(e.target.value) })} />
          </div>
          <div className="prop-field">
            <label>下边距</label>
            <input type="number" className="prop-input-sm" value={report.pageSettings.marginBottom}
              onChange={e => useDesignerStore.getState().updatePageSettings({ marginBottom: Number(e.target.value) })} />
          </div>
          <div className="prop-field">
            <label>左边距</label>
            <input type="number" className="prop-input-sm" value={report.pageSettings.marginLeft}
              onChange={e => useDesignerStore.getState().updatePageSettings({ marginLeft: Number(e.target.value) })} />
          </div>
          <div className="prop-field">
            <label>右边距</label>
            <input type="number" className="prop-input-sm" value={report.pageSettings.marginRight}
              onChange={e => useDesignerStore.getState().updatePageSettings({ marginRight: Number(e.target.value) })} />
          </div>
        </div>
        <PropRow label="分栏数">
          <input type="number" className="prop-input-sm" value={report.pageSettings.columns}
            min={1} onChange={e => useDesignerStore.getState().updatePageSettings({ columns: Number(e.target.value) })} />
        </PropRow>
        <PropRow label="栏间距">
          <input type="number" className="prop-input-sm" value={report.pageSettings.columnGap}
            onChange={e => useDesignerStore.getState().updatePageSettings({ columnGap: Number(e.target.value) })} />
          <span className="prop-unit">px</span>
        </PropRow>
      </PropSection>
      <PropSection title="预设纸张">
        <div className="preset-grid">
          {[
            { label: 'A4 纵向', w: 794, h: 1123 },
            { label: 'A4 横向', w: 1123, h: 794 },
            { label: 'A3 纵向', w: 1123, h: 1587 },
            { label: 'Letter', w: 816, h: 1056 },
            { label: '热敏 80mm', w: 302, h: 600 },
            { label: '热敏 58mm', w: 220, h: 600 },
          ].map((preset, i) => (
            <button key={i} className="preset-btn"
              onClick={() => useDesignerStore.getState().updatePageSettings({
                width: preset.w, height: preset.h,
                orientation: preset.w > preset.h ? 'landscape' : 'portrait',
              })}>
              {preset.label}
            </button>
          ))}
        </div>
      </PropSection>
    </div>
  );

  const renderDataProperties = () => (
    <DataSourcePanel />
  );

  return (
    <div className="property-panel">
      <div className="prop-tabs">
        {(['element', 'band', 'page', 'data'] as const).map(tab => (
          <button
            key={tab}
            className={`prop-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'element' ? '元素' : tab === 'band' ? 'Band' : tab === 'page' ? '页面' : '数据'}
          </button>
        ))}
      </div>
      <div className="prop-content">
        {activeTab === 'element' && renderElementProperties()}
        {activeTab === 'band' && renderBandProperties()}
        {activeTab === 'page' && renderPageProperties()}
        {activeTab === 'data' && renderDataProperties()}
      </div>
    </div>
  );
};

// Sub-components

const PropSection: React.FC<{ title: string; children: React.ReactNode; defaultOpen?: boolean }> = ({ title, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="prop-section">
      <div className="prop-section-header" onClick={() => setOpen(!open)}>
        <span className="prop-section-arrow">{open ? '▾' : '▸'}</span>
        {title}
      </div>
      {open && <div className="prop-section-body">{children}</div>}
    </div>
  );
};

const PropRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="prop-row">
    <label className="prop-label">{label}</label>
    <div className="prop-value">{children}</div>
  </div>
);

const TextProperties: React.FC<{ element: TextElement; onUpdate: (id: string, updates: Partial<ReportElement>) => void }> = ({ element, onUpdate }) => (
  <>
    <PropSection title="文本内容">
      <PropRow label="内容">
        <textarea className="prop-textarea" value={element.content}
          onChange={e => onUpdate(element.id, { content: e.target.value } as any)} rows={2} />
      </PropRow>
      <PropRow label="数据字段">
        <input type="text" className="prop-input" value={element.dataField || ''}
          onChange={e => onUpdate(element.id, { dataField: e.target.value } as any)}
          placeholder="{fieldName}" />
      </PropRow>
      <PropRow label="表达式">
        <input type="text" className="prop-input" value={element.expression || ''}
          onChange={e => onUpdate(element.id, { expression: e.target.value } as any)}
          placeholder="=Sum(field)" />
      </PropRow>
    </PropSection>
    <PropSection title="字体">
      <PropRow label="字体">
        <select className="prop-select" value={element.font.family}
          onChange={e => onUpdate(element.id, { font: { ...element.font, family: e.target.value } } as any)}>
          {FONT_FAMILIES.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
      </PropRow>
      <div className="prop-grid-4">
        <div className="prop-field">
          <label>大小</label>
          <input type="number" className="prop-input-sm" value={element.font.size}
            onChange={e => onUpdate(element.id, { font: { ...element.font, size: Number(e.target.value) } } as any)} />
        </div>
        <div className="prop-field">
          <label>颜色</label>
          <input type="color" className="prop-color" value={element.font.color}
            onChange={e => onUpdate(element.id, { font: { ...element.font, color: e.target.value } } as any)} />
        </div>
        <div className="prop-field">
          <label>背景</label>
          <input type="color" className="prop-color" value={element.backgroundColor === 'transparent' ? '#ffffff' : element.backgroundColor}
            onChange={e => onUpdate(element.id, { backgroundColor: e.target.value } as any)} />
        </div>
      </div>
      <div className="prop-btn-row">
        <button className={`prop-style-btn ${element.font.bold ? 'active' : ''}`}
          onClick={() => onUpdate(element.id, { font: { ...element.font, bold: !element.font.bold } } as any)}>
          <strong>B</strong>
        </button>
        <button className={`prop-style-btn ${element.font.italic ? 'active' : ''}`}
          onClick={() => onUpdate(element.id, { font: { ...element.font, italic: !element.font.italic } } as any)}>
          <em>I</em>
        </button>
        <button className={`prop-style-btn ${element.font.underline ? 'active' : ''}`}
          onClick={() => onUpdate(element.id, { font: { ...element.font, underline: !element.font.underline } } as any)}>
          <u>U</u>
        </button>
      </div>
      <PropRow label="水平对齐">
        <div className="prop-toggle-group">
          {(['left', 'center', 'right'] as const).map(a => (
            <button key={a} className={`toggle-btn ${element.horizontalAlign === a ? 'active' : ''}`}
              onClick={() => onUpdate(element.id, { horizontalAlign: a } as any)}>
              {a === 'left' ? '左' : a === 'center' ? '中' : '右'}
            </button>
          ))}
        </div>
      </PropRow>
      <PropRow label="垂直对齐">
        <div className="prop-toggle-group">
          {(['top', 'middle', 'bottom'] as const).map(a => (
            <button key={a} className={`toggle-btn ${element.verticalAlign === a ? 'active' : ''}`}
              onClick={() => onUpdate(element.id, { verticalAlign: a } as any)}>
              {a === 'top' ? '上' : a === 'middle' ? '中' : '下'}
            </button>
          ))}
        </div>
      </PropRow>
      <PropRow label="自动换行">
        <label className="prop-switch">
          <input type="checkbox" checked={element.wordWrap}
            onChange={e => onUpdate(element.id, { wordWrap: e.target.checked } as any)} />
          <span className="switch-slider" />
        </label>
      </PropRow>
    </PropSection>
    <PropSection title="边框">
      <PropRow label="上边框">
        <div className="border-config">
          <select className="prop-select-sm" value={element.borders.top?.style || 'none'}
            onChange={e => onUpdate(element.id, { borders: { ...element.borders, top: { ...element.borders.top, style: e.target.value as BorderStyle, width: 1, color: '#000000' } } } as any)}>
            <option value="none">无</option>
            <option value="solid">实线</option>
            <option value="dashed">虚线</option>
            <option value="dotted">点线</option>
          </select>
          <input type="color" className="prop-color-sm" value={element.borders.top?.color || '#000000'}
            onChange={e => onUpdate(element.id, { borders: { ...element.borders, top: { ...element.borders.top, color: e.target.value } } } as any)} />
        </div>
      </PropRow>
      <PropRow label="下边框">
        <div className="border-config">
          <select className="prop-select-sm" value={element.borders.bottom?.style || 'none'}
            onChange={e => onUpdate(element.id, { borders: { ...element.borders, bottom: { ...element.borders.bottom, style: e.target.value as BorderStyle, width: 1, color: '#000000' } } } as any)}>
            <option value="none">无</option>
            <option value="solid">实线</option>
            <option value="dashed">虚线</option>
            <option value="dotted">点线</option>
          </select>
          <input type="color" className="prop-color-sm" value={element.borders.bottom?.color || '#000000'}
            onChange={e => onUpdate(element.id, { borders: { ...element.borders, bottom: { ...element.borders.bottom, color: e.target.value } } } as any)} />
        </div>
      </PropRow>
      <PropRow label="左边框">
        <div className="border-config">
          <select className="prop-select-sm" value={element.borders.left?.style || 'none'}
            onChange={e => onUpdate(element.id, { borders: { ...element.borders, left: { ...element.borders.left, style: e.target.value as BorderStyle, width: 1, color: '#000000' } } } as any)}>
            <option value="none">无</option>
            <option value="solid">实线</option>
            <option value="dashed">虚线</option>
            <option value="dotted">点线</option>
          </select>
          <input type="color" className="prop-color-sm" value={element.borders.left?.color || '#000000'}
            onChange={e => onUpdate(element.id, { borders: { ...element.borders, left: { ...element.borders.left, color: e.target.value } } } as any)} />
        </div>
      </PropRow>
      <PropRow label="右边框">
        <div className="border-config">
          <select className="prop-select-sm" value={element.borders.right?.style || 'none'}
            onChange={e => onUpdate(element.id, { borders: { ...element.borders, right: { ...element.borders.right, style: e.target.value as BorderStyle, width: 1, color: '#000000' } } } as any)}>
            <option value="none">无</option>
            <option value="solid">实线</option>
            <option value="dashed">虚线</option>
            <option value="dotted">点线</option>
          </select>
          <input type="color" className="prop-color-sm" value={element.borders.right?.color || '#000000'}
            onChange={e => onUpdate(element.id, { borders: { ...element.borders, right: { ...element.borders.right, color: e.target.value } } } as any)} />
        </div>
      </PropRow>
    </PropSection>
    <PropSection title="内边距">
      <div className="prop-grid-4">
        <div className="prop-field">
          <label>上</label>
          <input type="number" className="prop-input-sm" value={element.padding?.top || 0}
            onChange={e => onUpdate(element.id, { padding: { ...element.padding, top: Number(e.target.value) } } as any)} />
        </div>
        <div className="prop-field">
          <label>右</label>
          <input type="number" className="prop-input-sm" value={element.padding?.right || 0}
            onChange={e => onUpdate(element.id, { padding: { ...element.padding, right: Number(e.target.value) } } as any)} />
        </div>
        <div className="prop-field">
          <label>下</label>
          <input type="number" className="prop-input-sm" value={element.padding?.bottom || 0}
            onChange={e => onUpdate(element.id, { padding: { ...element.padding, bottom: Number(e.target.value) } } as any)} />
        </div>
        <div className="prop-field">
          <label>左</label>
          <input type="number" className="prop-input-sm" value={element.padding?.left || 0}
            onChange={e => onUpdate(element.id, { padding: { ...element.padding, left: Number(e.target.value) } } as any)} />
        </div>
      </div>
    </PropSection>
  </>
);

const RectangleProperties: React.FC<{ element: RectangleElement; onUpdate: (id: string, updates: Partial<ReportElement>) => void }> = ({ element, onUpdate }) => (
  <PropSection title="矩形属性">
    <PropRow label="填充色">
      <input type="color" className="prop-color" value={element.fillColor}
        onChange={e => onUpdate(element.id, { fillColor: e.target.value } as any)} />
    </PropRow>
    <PropRow label="边框色">
      <input type="color" className="prop-color" value={element.borderColor}
        onChange={e => onUpdate(element.id, { borderColor: e.target.value } as any)} />
    </PropRow>
    <PropRow label="边框宽">
      <input type="number" className="prop-input-sm" value={element.borderWidth}
        onChange={e => onUpdate(element.id, { borderWidth: Number(e.target.value) } as any)} />
    </PropRow>
    <PropRow label="圆角">
      <input type="number" className="prop-input-sm" value={element.borderRadius}
        onChange={e => onUpdate(element.id, { borderRadius: Number(e.target.value) } as any)} />
    </PropRow>
  </PropSection>
);

const LineProperties: React.FC<{ element: LineElement; onUpdate: (id: string, updates: Partial<ReportElement>) => void }> = ({ element, onUpdate }) => (
  <PropSection title="线条属性">
    <PropRow label="方向">
      <div className="prop-toggle-group">
        {(['horizontal', 'vertical', 'diagonal'] as const).map(d => (
          <button key={d} className={`toggle-btn ${element.direction === d ? 'active' : ''}`}
            onClick={() => onUpdate(element.id, { direction: d } as any)}>
            {d === 'horizontal' ? '水平' : d === 'vertical' ? '垂直' : '对角'}
          </button>
        ))}
      </div>
    </PropRow>
    <PropRow label="颜色">
      <input type="color" className="prop-color" value={element.color}
        onChange={e => onUpdate(element.id, { color: e.target.value } as any)} />
    </PropRow>
    <PropRow label="样式">
      <select className="prop-select" value={element.style}
        onChange={e => onUpdate(element.id, { style: e.target.value as BorderStyle } as any)}>
        <option value="solid">实线</option>
        <option value="dashed">虚线</option>
        <option value="dotted">点线</option>
      </select>
    </PropRow>
  </PropSection>
);

const ImageProperties: React.FC<{ element: ImageElement; onUpdate: (id: string, updates: Partial<ReportElement>) => void }> = ({ element, onUpdate }) => (
  <PropSection title="图片属性">
    <PropRow label="图片地址">
      <input type="text" className="prop-input" value={element.src}
        onChange={e => onUpdate(element.id, { src: e.target.value } as any)}
        placeholder="URL 或 base64" />
    </PropRow>
    <PropRow label="适应方式">
      <select className="prop-select" value={element.objectFit}
        onChange={e => onUpdate(element.id, { objectFit: e.target.value as any } as any)}>
        <option value="contain">包含</option>
        <option value="cover">覆盖</option>
        <option value="fill">拉伸</option>
      </select>
    </PropRow>
    <PropRow label="数据字段">
      <input type="text" className="prop-input" value={element.dataField || ''}
        onChange={e => onUpdate(element.id, { dataField: e.target.value } as any)} />
    </PropRow>
  </PropSection>
);

const BarcodeProperties: React.FC<{ element: BarcodeElement; onUpdate: (id: string, updates: Partial<ReportElement>) => void }> = ({ element, onUpdate }) => (
  <PropSection title="条形码属性">
    <PropRow label="编码值">
      <input type="text" className="prop-input" value={element.value}
        onChange={e => onUpdate(element.id, { value: e.target.value } as any)} />
    </PropRow>
    <PropRow label="编码格式">
      <select className="prop-select" value={element.format}
        onChange={e => onUpdate(element.id, { format: e.target.value as any } as any)}>
        <option value="CODE128">CODE128</option>
        <option value="EAN13">EAN13</option>
        <option value="CODE39">CODE39</option>
      </select>
    </PropRow>
    <PropRow label="显示文本">
      <label className="prop-switch">
        <input type="checkbox" checked={element.showText}
          onChange={e => onUpdate(element.id, { showText: e.target.checked } as any)} />
        <span className="switch-slider" />
      </label>
    </PropRow>
  </PropSection>
);

const QRCodeProperties: React.FC<{ element: QRCodeElement; onUpdate: (id: string, updates: Partial<ReportElement>) => void }> = ({ element, onUpdate }) => (
  <PropSection title="二维码属性">
    <PropRow label="编码值">
      <input type="text" className="prop-input" value={element.value}
        onChange={e => onUpdate(element.id, { value: e.target.value } as any)} />
    </PropRow>
    <PropRow label="纠错等级">
      <select className="prop-select" value={element.errorLevel}
        onChange={e => onUpdate(element.id, { errorLevel: e.target.value as any } as any)}>
        <option value="L">L (7%)</option>
        <option value="M">M (15%)</option>
        <option value="Q">Q (25%)</option>
        <option value="H">H (30%)</option>
      </select>
    </PropRow>
  </PropSection>
);

const ChartProperties: React.FC<{ element: ChartElement; onUpdate: (id: string, updates: Partial<ReportElement>) => void }> = ({ element, onUpdate }) => (
  <PropSection title="图表属性">
    <PropRow label="图表类型">
      <select className="prop-select" value={element.chartData.chartType}
        onChange={e => onUpdate(element.id, {
          chartData: { ...element.chartData, chartType: e.target.value as any }
        } as any)}>
        <option value="bar">柱状图</option>
        <option value="line">折线图</option>
        <option value="pie">饼图</option>
        <option value="area">面积图</option>
      </select>
    </PropRow>
    <PropRow label="标题">
      <input type="text" className="prop-input" value={element.chartData.title || ''}
        onChange={e => onUpdate(element.id, {
          chartData: { ...element.chartData, title: e.target.value }
        } as any)} />
    </PropRow>
    <PropRow label="背景色">
      <input type="color" className="prop-color" value={element.backgroundColor}
        onChange={e => onUpdate(element.id, { backgroundColor: e.target.value } as any)} />
    </PropRow>
  </PropSection>
);

const TableProperties: React.FC<{ element: TableElement; onUpdate: (id: string, updates: Partial<ReportElement>) => void }> = ({ element, onUpdate }) => {
  const { selectedTableCell } = useDesignerStore();
  return (
    <>
      <PropSection title="表格属性">
        <PropRow label="重复表头">
          <label className="prop-switch">
            <input type="checkbox" checked={element.repeatHeader}
              onChange={e => onUpdate(element.id, { repeatHeader: e.target.checked } as any)} />
            <span className="switch-slider" />
          </label>
        </PropRow>
        <PropRow label="数据字段">
          <input type="text" className="prop-input" value={element.dataField || ''}
            onChange={e => onUpdate(element.id, { dataField: e.target.value } as any)} />
        </PropRow>
        <TableEditor element={element} onUpdate={onUpdate} />
      </PropSection>
      {selectedTableCell && selectedTableCell.elementId === element.id && (
        <CellProperties
          element={element}
          rowIndex={selectedTableCell.row}
          colIndex={selectedTableCell.col}
          onUpdate={onUpdate}
        />
      )}
    </>
  );
};

const CellProperties: React.FC<{
  element: TableElement;
  rowIndex: number;
  colIndex: number;
  onUpdate: (id: string, updates: Partial<ReportElement>) => void;
}> = ({ element, rowIndex, colIndex, onUpdate }) => {
  const cell = element.tableData.cells[rowIndex]?.[colIndex];
  if (!cell || cell.rowSpan <= 0 || cell.colSpan <= 0) return null;

  const updateCell = (cellUpdates: Partial<TableCell>) => {
    const newCells = element.tableData.cells.map(row => row.map(c => ({ ...c })));
    if (newCells[rowIndex]?.[colIndex]) {
      newCells[rowIndex][colIndex] = { ...newCells[rowIndex][colIndex], ...cellUpdates };
      onUpdate(element.id, { tableData: { ...element.tableData, cells: newCells } } as any);
    }
  };

  const updateCellFont = (fontUpdates: Partial<FontConfig>) => {
    updateCell({ font: { ...(cell.font || { family: 'Microsoft YaHei', size: 12, bold: false, italic: false, underline: false, color: '#333333' }), ...fontUpdates } });
  };

  const updateCellBorder = (side: 'top' | 'bottom' | 'left' | 'right', style: BorderStyle, color?: string) => {
    const borders: Borders = { ...(cell.borders || { top: { style: 'solid', width: 1, color: '#000' }, bottom: { style: 'solid', width: 1, color: '#000' }, left: { style: 'solid', width: 1, color: '#000' }, right: { style: 'solid', width: 1, color: '#000' } }) };
    borders[side] = { ...borders[side], style, width: 1, color: color ?? borders[side]?.color ?? '#000000' };
    updateCell({ borders });
  };

  const updateCellPadding = (side: 'top' | 'right' | 'bottom' | 'left', value: number) => {
    const padding: Padding = { ...(cell.padding || { top: 2, right: 4, bottom: 2, left: 4 }) };
    padding[side] = value;
    updateCell({ padding });
  };

  return (
    <>
      <PropSection title="单元格内容">
        <PropRow label="内容">
          <input type="text" className="prop-input" value={cell.content}
            onChange={e => updateCell({ content: e.target.value })} />
        </PropRow>
        <PropRow label="数据字段">
          <input type="text" className="prop-input" value={cell.dataField || ''}
            onChange={e => updateCell({ dataField: e.target.value })}
            placeholder="{fieldName}" />
        </PropRow>
        <PropRow label="表达式">
          <input type="text" className="prop-input" value={cell.expression || ''}
            onChange={e => updateCell({ expression: e.target.value })}
            placeholder="=Sum(field)" />
        </PropRow>
      </PropSection>

      <PropSection title="单元格字体">
        <PropRow label="字体">
          <select className="prop-select" value={cell.font?.family || 'Microsoft YaHei'}
            onChange={e => updateCellFont({ family: e.target.value })}>
            {FONT_FAMILIES.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </PropRow>
        <div className="prop-grid-4">
          <div className="prop-field">
            <label>大小</label>
            <input type="number" className="prop-input-sm" value={cell.font?.size || 12}
              onChange={e => updateCellFont({ size: Number(e.target.value) })} />
          </div>
          <div className="prop-field">
            <label>颜色</label>
            <input type="color" className="prop-color" value={cell.font?.color || '#333333'}
              onChange={e => updateCellFont({ color: e.target.value })} />
          </div>
          <div className="prop-field">
            <label>背景</label>
            <input type="color" className="prop-color" value={cell.backgroundColor || '#ffffff'}
              onChange={e => updateCell({ backgroundColor: e.target.value })} />
          </div>
        </div>
        <div className="prop-btn-row">
          <button className={`prop-style-btn ${cell.font?.bold ? 'active' : ''}`}
            onClick={() => updateCellFont({ bold: !cell.font?.bold })}>
            <strong>B</strong>
          </button>
          <button className={`prop-style-btn ${cell.font?.italic ? 'active' : ''}`}
            onClick={() => updateCellFont({ italic: !cell.font?.italic })}>
            <em>I</em>
          </button>
          <button className={`prop-style-btn ${cell.font?.underline ? 'active' : ''}`}
            onClick={() => updateCellFont({ underline: !cell.font?.underline })}>
            <u>U</u>
          </button>
        </div>
      </PropSection>

      <PropSection title="对齐">
        <PropRow label="水平对齐">
          <div className="prop-toggle-group">
            {(['left', 'center', 'right'] as const).map(a => (
              <button key={a} className={`toggle-btn ${cell.horizontalAlign === a ? 'active' : ''}`}
                onClick={() => updateCell({ horizontalAlign: a })}>
                {a === 'left' ? '左' : a === 'center' ? '中' : '右'}
              </button>
            ))}
          </div>
        </PropRow>
        <PropRow label="垂直对齐">
          <div className="prop-toggle-group">
            {(['top', 'middle', 'bottom'] as const).map(a => (
              <button key={a} className={`toggle-btn ${cell.verticalAlign === a ? 'active' : ''}`}
                onClick={() => updateCell({ verticalAlign: a })}>
                {a === 'top' ? '上' : a === 'middle' ? '中' : '下'}
              </button>
            ))}
          </div>
        </PropRow>
      </PropSection>

      <PropSection title="边框">
        {(['top', 'bottom', 'left', 'right'] as const).map(side => {
          const sideLabel = side === 'top' ? '上' : side === 'bottom' ? '下' : side === 'left' ? '左' : '右';
          const border = cell.borders?.[side];
          return (
            <PropRow key={side} label={`${sideLabel}边框`}>
              <div className="border-config">
                <select className="prop-select-sm" value={border?.style || 'none'}
                  onChange={e => updateCellBorder(side, e.target.value as BorderStyle)}>
                  <option value="none">无</option>
                  <option value="solid">实线</option>
                  <option value="dashed">虚线</option>
                  <option value="dotted">点线</option>
                </select>
                <input type="color" className="prop-color-sm" value={border?.color || '#000000'}
                  onChange={e => updateCellBorder(side, border?.style || 'solid', e.target.value)} />
              </div>
            </PropRow>
          );
        })}
      </PropSection>

      <PropSection title="内边距">
        <div className="prop-grid-4">
          {(['top', 'right', 'bottom', 'left'] as const).map(side => {
            const label = side === 'top' ? '上' : side === 'right' ? '右' : side === 'bottom' ? '下' : '左';
            return (
              <div key={side} className="prop-field">
                <label>{label}</label>
                <input type="number" className="prop-input-sm"
                  value={cell.padding?.[side] ?? (side === 'top' || side === 'bottom' ? 2 : 4)}
                  onChange={e => updateCellPadding(side, Number(e.target.value))} />
              </div>
            );
          })}
        </div>
      </PropSection>

      <PropSection title="高级">
        <PropRow label="自动换行">
          <label className="prop-switch">
            <input type="checkbox" checked={cell.wordWrap ?? false}
              onChange={e => updateCell({ wordWrap: e.target.checked })} />
            <span className="switch-slider" />
          </label>
        </PropRow>
        <PropRow label="自动增高">
          <label className="prop-switch">
            <input type="checkbox" checked={cell.autoGrow ?? false}
              onChange={e => updateCell({ autoGrow: e.target.checked })} />
            <span className="switch-slider" />
          </label>
        </PropRow>
        <PropRow label="显示掩码">
          <input type="text" className="prop-input" value={cell.mask || ''}
            onChange={e => updateCell({ mask: e.target.value })}
            placeholder="###-####-####" />
        </PropRow>
        <PropRow label="格式化">
          <input type="text" className="prop-input" value={cell.format || ''}
            onChange={e => updateCell({ format: e.target.value })}
            placeholder="#,##0.00 / yyyy-MM-dd" />
        </PropRow>
      </PropSection>
    </>
  );
};

const CrossTabProperties: React.FC<{ element: CrossTabElement; onUpdate: (id: string, updates: Partial<ReportElement>) => void }> = ({ element, onUpdate }) => (
  <PropSection title="交叉表属性">
    <PropRow label="行字段">
      <input type="text" className="prop-input" value={element.rowField}
        onChange={e => onUpdate(element.id, { rowField: e.target.value } as any)} />
    </PropRow>
    <PropRow label="列字段">
      <input type="text" className="prop-input" value={element.columnField}
        onChange={e => onUpdate(element.id, { columnField: e.target.value } as any)} />
    </PropRow>
    <PropRow label="值字段">
      <input type="text" className="prop-input" value={element.valueField}
        onChange={e => onUpdate(element.id, { valueField: e.target.value } as any)} />
    </PropRow>
    <PropRow label="汇总方式">
      <select className="prop-select" value={element.valueFunction}
        onChange={e => onUpdate(element.id, { valueFunction: e.target.value as any } as any)}>
        <option value="sum">求和</option>
        <option value="count">计数</option>
        <option value="avg">平均值</option>
        <option value="min">最小值</option>
        <option value="max">最大值</option>
      </select>
    </PropRow>
  </PropSection>
);

const DataSourcePanel: React.FC = () => {
  const { report, addDataSource, removeDataSource } = useDesignerStore();
  const [newDsName, setNewDsName] = useState('');
  const [newDsType, setNewDsType] = useState<'json' | 'api' | 'database'>('json');
  const [jsonInput, setJsonInput] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [apiMethod, setApiMethod] = useState<'GET' | 'POST'>('GET');
  const [dbConnStr, setDbConnStr] = useState('');
  const [dbQuery, setDbQuery] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleAddJsonSource = () => {
    if (!newDsName.trim()) return;
    let parsedData: any[] = [];
    try {
      const raw = JSON.parse(jsonInput);
      parsedData = Array.isArray(raw) ? raw : [raw];
    } catch {
      alert('JSON 格式不正确');
      return;
    }
    const fields = Object.keys(parsedData[0] || {}).map(key => ({
      name: key,
      type: typeof parsedData[0][key] === 'number' ? 'number' as const :
            typeof parsedData[0][key] === 'boolean' ? 'boolean' as const :
            'string' as const,
    }));
    addDataSource({
      id: crypto.randomUUID?.() || Date.now().toString(),
      name: newDsName,
      type: 'json',
      data: parsedData,
      fields,
    });
    setNewDsName('');
    setJsonInput('');
  };

  const handleAddApiSource = async () => {
    if (!newDsName.trim() || !apiUrl.trim()) return;
    const id = crypto.randomUUID?.() || Date.now().toString();
    addDataSource({
      id,
      name: newDsName,
      type: 'api',
      url: apiUrl,
      method: apiMethod,
      headers: { 'Content-Type': 'application/json' },
      fields: [],
    });

    // Try to auto-discover fields via backend
    try {
      const result = await discoverFields({ type: 'api', url: apiUrl, method: apiMethod });
      if (result.fields.length > 0) {
        const store = useDesignerStore.getState();
        const ds = store.report.dataSources.find(d => d.id === id);
        if (ds) {
          store.updateDataSource(id, {
            fields: result.fields.map(f => ({ name: f.name, type: f.type as any })),
            data: result.sampleData,
          });
        }
      }
    } catch {
      // Auto-discovery failed (backend not available), that's OK
    }

    setNewDsName('');
    setApiUrl('');
  };

  const handleAddDbSource = async () => {
    if (!newDsName.trim() || !dbConnStr.trim() || !dbQuery.trim()) return;
    const id = crypto.randomUUID?.() || Date.now().toString();
    addDataSource({
      id,
      name: newDsName,
      type: 'database',
      connectionString: dbConnStr,
      query: dbQuery,
      fields: [],
    });

    // Try to execute query and discover fields via backend
    try {
      const result = await discoverFields({ type: 'database', connectionString: dbConnStr, query: dbQuery });
      if (result.fields.length > 0) {
        const store = useDesignerStore.getState();
        store.updateDataSource(id, {
          fields: result.fields.map(f => ({ name: f.name, type: f.type as any })),
          data: result.sampleData,
        });
      }
    } catch {
      // Backend not available, fields will be empty
    }

    setNewDsName('');
    setDbConnStr('');
    setDbQuery('');
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      let result;
      if (newDsType === 'api') {
        result = await testConnection({ type: 'api', url: apiUrl, method: apiMethod });
      } else if (newDsType === 'database') {
        result = await testConnection({ type: 'database', connectionString: dbConnStr, query: dbQuery });
      } else {
        result = { success: true, message: 'JSON 数据源无需测试' };
      }
      setTestResult({ success: result.success, message: result.message });
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || '连接失败' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="prop-sections">
      <PropSection title="数据源">
        {report.dataSources.map(ds => (
          <div key={ds.id} className="data-source-item">
            <div className="ds-header">
              <span className="ds-name">{ds.name}</span>
              <span className="ds-type-badge">{ds.type}</span>
              <button className="ds-remove" onClick={() => removeDataSource(ds.id)}>×</button>
            </div>
            <div className="ds-fields">
              {ds.fields.map(f => (
                <span key={f.name} className="ds-field-tag" draggable onDragStart={e => {
                  e.dataTransfer.setData('text/plain', `{${f.name}}`);
                }}>
                  {f.name}
                </span>
              ))}
            </div>
            {ds.type === 'api' && ds.url && (
              <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                {ds.method || 'GET'} {ds.url}
              </div>
            )}
            {ds.type === 'database' && ds.connectionString && (
              <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                DB: {ds.connectionString.substring(0, 30)}...
              </div>
            )}
            {ds.data && ds.data.length > 0 && (
              <div className="ds-preview">
                <div className="ds-preview-label">预览 ({ds.data.length} 条)</div>
                <div className="ds-preview-table">
                  <table>
                    <thead>
                      <tr>{ds.fields.slice(0, 5).map(f => <th key={f.name}>{f.name}</th>)}</tr>
                    </thead>
                    <tbody>
                      {ds.data.slice(0, 3).map((row, i) => (
                        <tr key={i}>{ds.fields.slice(0, 5).map(f => <td key={f.name}>{String(row[f.name] ?? '')}</td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ))}
      </PropSection>
      <PropSection title="添加数据源">
        <PropRow label="名称">
          <input type="text" className="prop-input" value={newDsName}
            onChange={e => setNewDsName(e.target.value)} placeholder="数据源名称" />
        </PropRow>
        <PropRow label="类型">
          <div className="prop-toggle-group">
            {(['json', 'api', 'database'] as const).map(t => (
              <button key={t} className={`toggle-btn ${newDsType === t ? 'active' : ''}`}
                onClick={() => { setNewDsType(t); setTestResult(null); }}>
                {t === 'json' ? 'JSON' : t === 'api' ? 'API' : '数据库'}
              </button>
            ))}
          </div>
        </PropRow>

        {newDsType === 'json' && (
          <>
            <PropRow label="JSON 数据">
              <textarea className="prop-textarea" value={jsonInput}
                onChange={e => setJsonInput(e.target.value)} rows={5}
                placeholder='[{"name":"张三","age":25}]' />
            </PropRow>
            <button className="prop-btn primary" onClick={handleAddJsonSource}>添加 JSON 数据源</button>
          </>
        )}

        {newDsType === 'api' && (
          <>
            <PropRow label="URL">
              <input type="text" className="prop-input" value={apiUrl}
                onChange={e => setApiUrl(e.target.value)}
                placeholder="https://api.example.com/data" />
            </PropRow>
            <PropRow label="方法">
              <div className="prop-toggle-group">
                <button className={`toggle-btn ${apiMethod === 'GET' ? 'active' : ''}`}
                  onClick={() => setApiMethod('GET')}>GET</button>
                <button className={`toggle-btn ${apiMethod === 'POST' ? 'active' : ''}`}
                  onClick={() => setApiMethod('POST')}>POST</button>
              </div>
            </PropRow>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="prop-btn primary" style={{ flex: 1 }} onClick={handleAddApiSource}>添加</button>
              <button className="prop-btn" onClick={handleTestConnection} disabled={testing}>
                {testing ? '测试中...' : '测试连接'}
              </button>
            </div>
          </>
        )}

        {newDsType === 'database' && (
          <>
            <PropRow label="连接字符串">
              <input type="text" className="prop-input" value={dbConnStr}
                onChange={e => setDbConnStr(e.target.value)}
                placeholder="mysql://user:pass@host:3306/dbname" />
            </PropRow>
            <PropRow label="SQL 查询">
              <textarea className="prop-textarea" value={dbQuery}
                onChange={e => setDbQuery(e.target.value)} rows={3}
                placeholder="SELECT * FROM users WHERE age > :minAge" />
            </PropRow>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="prop-btn primary" style={{ flex: 1 }} onClick={handleAddDbSource}>添加</button>
              <button className="prop-btn" onClick={handleTestConnection} disabled={testing}>
                {testing ? '测试中...' : '测试连接'}
              </button>
            </div>
          </>
        )}

        {testResult && (
          <div style={{
            fontSize: 11, padding: '4px 8px', borderRadius: 3, marginTop: 4,
            background: testResult.success ? '#065f46' : '#7f1d1d',
            color: testResult.success ? '#6ee7b7' : '#fca5a5',
          }}>
            {testResult.success ? '✓' : '✗'} {testResult.message}
          </div>
        )}

        <button className="prop-btn" style={{ marginTop: 4 }} onClick={() => {
          const sampleData = [
            { name: '张三', department: '技术部', salary: 15000, age: 28, date: '2025-01-15' },
            { name: '李四', department: '市场部', salary: 12000, age: 32, date: '2025-02-20' },
            { name: '王五', department: '财务部', salary: 18000, age: 35, date: '2025-03-10' },
            { name: '赵六', department: '技术部', salary: 20000, age: 29, date: '2025-04-05' },
            { name: '钱七', department: '市场部', salary: 11000, age: 26, date: '2025-05-18' },
            { name: '孙八', department: '财务部', salary: 16000, age: 31, date: '2025-06-22' },
            { name: '周九', department: '技术部', salary: 22000, age: 27, date: '2025-07-14' },
            { name: '吴十', department: '市场部', salary: 13000, age: 34, date: '2025-08-03' },
          ];
          const fields = Object.keys(sampleData[0]).map(key => ({
            name: key,
            type: typeof (sampleData[0] as any)[key] === 'number' ? 'number' as const : 'string' as const,
          }));
          addDataSource({
            id: crypto.randomUUID?.() || Date.now().toString(),
            name: '员工数据',
            type: 'json',
            data: sampleData,
            fields,
          });
        }}>加载示例数据</button>
      </PropSection>
    </div>
  );
};

function getTypeLabel(type: string): string {
  const map: Record<string, string> = {
    text: '文本', rectangle: '矩形', line: '线条', image: '图片',
    barcode: '条形码', qrcode: '二维码', chart: '图表', table: '表格',
    subreport: '子报表', crosstab: '交叉表',
  };
  return map[type] || type;
}
