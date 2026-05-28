import React, { useMemo } from 'react';
import { useDesignerStore } from '../../store/designerStore';
import type { ReportElement, ElementType, CrossTabElement, TextElement, BarcodeElement, QRCodeElement, ChartElement, TableElement, LineElement, RectangleElement, ImageElement } from '../../types';
import './OptionsBar.css';

const ELEMENT_LABELS: Record<ElementType, string> = {
  text: '文本', rectangle: '矩形', line: '线条', image: '图片',
  barcode: '条形码', qrcode: '二维码', chart: '图表',
  table: '表格', subreport: '子报表', crosstab: '交叉表',
};

export const OptionsBar: React.FC = () => {
  const { selectedElementIds, report, zoom, setZoom, undo, redo,
    snapEnabled, setSnapEnabled, showGrid, setShowGrid,
    copySelected, pasteElements, deleteElement, duplicateElement,
    alignElements, bringToFront, sendToBack } = useDesignerStore();

  const selectedElement = useMemo<ReportElement | null>(() => {
    if (selectedElementIds.length !== 1) return null;
    return report.elements[selectedElementIds[0]] ?? null;
  }, [selectedElementIds, report.elements]);

  const multiSelect = selectedElementIds.length > 1;
  const hasSelection = selectedElementIds.length > 0;
  const el = selectedElement;

  return (
    <div className="options-bar">
      {/* 操作: 撤销/重做 */}
      <div className="options-group">
        <span className="options-section-label">操作</span>
        <button className="opt-btn" onClick={undo} title="撤销 (Ctrl+Z)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 10h10a5 5 0 0 1 0 10H9" /><path d="M3 10l4-4" /><path d="M3 10l4 4" /></svg>
        </button>
        <button className="opt-btn" onClick={redo} title="重做 (Ctrl+Y)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10H11a5 5 0 0 0 0 10h4" /><path d="M21 10l-4-4" /><path d="M21 10l-4 4" /></svg>
        </button>
      </div>

      <div className="options-bar-sep" />

      {/* 视图: 缩放/网格/吸附 */}
      <div className="options-group">
        <span className="options-section-label">视图</span>
        <button className="opt-btn" onClick={() => setZoom(zoom - 0.1)} title="缩小">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /><path d="M8 11h6" /></svg>
        </button>
        <span className="zoom-text">{Math.round(zoom * 100)}%</span>
        <button className="opt-btn" onClick={() => setZoom(zoom + 0.1)} title="放大">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /><path d="M8 11h6" /><path d="M11 8v6" /></svg>
        </button>
        <button className={`opt-btn toggle${showGrid ? ' active' : ''}`} onClick={() => setShowGrid(!showGrid)} title="网格">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" /><path d="M3 9h18" /><path d="M3 15h18" /><path d="M9 3v18" /><path d="M15 3v18" /></svg>
        </button>
        <button className={`opt-btn toggle${snapEnabled ? ' active' : ''}`} onClick={() => setSnapEnabled(!snapEnabled)} title="吸附">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></svg>
        </button>
      </div>

      <div className="options-bar-sep" />

      {/* 编辑: 复制/粘贴/删除/复制元素 (选中时显示) */}
      {hasSelection && (
        <>
          <div className="options-group">
            <span className="options-section-label">编辑</span>
            <button className="opt-btn" onClick={() => copySelected()} title="复制 (Ctrl+C)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
            </button>
            <button className="opt-btn" onClick={() => pasteElements()} title="粘贴 (Ctrl+V)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" /></svg>
            </button>
            <button className="opt-btn" onClick={() => selectedElementIds.forEach(id => duplicateElement(id))} title="复制元素">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></svg>
            </button>
            <button className="opt-btn danger" onClick={() => selectedElementIds.forEach(id => deleteElement(id))} title="删除 (Del)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
            </button>
          </div>
          <div className="options-bar-sep" />
        </>
      )}

      {/* 对齐 (多选时显示) */}
      {multiSelect && (
        <>
          <div className="options-group">
            <span className="options-section-label">对齐</span>
            <button className="opt-btn" onClick={() => alignElements('left')} title="左对齐">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4v16" /><rect x="7" y="4" width="13" height="4" rx="1" /><rect x="7" y="12" width="9" height="4" rx="1" /></svg>
            </button>
            <button className="opt-btn" onClick={() => alignElements('centerH')} title="水平居中">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v18" /><rect x="5" y="5" width="14" height="4" rx="1" /><rect x="7" y="13" width="10" height="4" rx="1" /></svg>
            </button>
            <button className="opt-btn" onClick={() => alignElements('right')} title="右对齐">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 4v16" /><rect x="4" y="4" width="13" height="4" rx="1" /><rect x="8" y="12" width="9" height="4" rx="1" /></svg>
            </button>
            <button className="opt-btn" onClick={() => alignElements('top')} title="顶部对齐">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16" /><rect x="4" y="7" width="4" height="13" rx="1" /><rect x="12" y="7" width="4" height="9" rx="1" /></svg>
            </button>
            <button className="opt-btn" onClick={() => alignElements('bottom')} title="底部对齐">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 20h16" /><rect x="4" y="4" width="4" height="13" rx="1" /><rect x="12" y="8" width="4" height="9" rx="1" /></svg>
            </button>
            <button className="opt-btn" onClick={() => alignElements('distributeH')} title="水平均匀分布">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12h20" /><rect x="3" y="8" width="4" height="8" rx="1" /><rect x="10" y="8" width="4" height="8" rx="1" /><rect x="17" y="8" width="4" height="8" rx="1" /></svg>
            </button>
            <button className="opt-btn" onClick={() => alignElements('distributeV')} title="垂直均匀分布">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20" /><rect x="8" y="3" width="8" height="4" rx="1" /><rect x="8" y="10" width="8" height="4" rx="1" /><rect x="8" y="17" width="8" height="4" rx="1" /></svg>
            </button>
          </div>
          <div className="options-bar-sep" />
        </>
      )}

      {/* 层级 (选中时显示) */}
      {hasSelection && (
        <>
          <div className="options-group">
            <span className="options-section-label">层级</span>
            <button className="opt-btn" onClick={() => selectedElementIds.forEach(id => bringToFront(id))} title="置顶">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="14" height="14" rx="2" /><rect x="8" y="8" width="14" height="14" rx="2" /></svg>
            </button>
            <button className="opt-btn" onClick={() => selectedElementIds.forEach(id => sendToBack(id))} title="置底">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="8" y="2" width="14" height="14" rx="2" /><rect x="2" y="8" width="14" height="14" rx="2" /></svg>
            </button>
          </div>
          <div className="options-bar-sep" />
        </>
      )}

      {/* 上下文属性区: 选中元素类型对应的快捷设置 */}
      {el && (
        <>
          <div className="options-group">
            <span className="options-section-label type-label">{ELEMENT_LABELS[el.type]}</span>
            {el.type === 'crosstab' && <CrossTabOptions element={el as CrossTabElement} />}
            {el.type === 'text' && <TextOptions element={el as TextElement} />}
            {el.type === 'barcode' && <BarcodeOptions element={el as BarcodeElement} />}
            {el.type === 'qrcode' && <QRCodeOptions element={el as QRCodeElement} />}
            {el.type === 'chart' && <ChartOptions element={el as ChartElement} />}
            {el.type === 'table' && <TableOptions element={el as TableElement} />}
            {el.type === 'line' && <LineOptions element={el as LineElement} />}
            {el.type === 'rectangle' && <RectangleOptions element={el as RectangleElement} />}
            {el.type === 'image' && <ImageOptions element={el as ImageElement} />}
            {el.type === 'subreport' && <SubreportOptions />}
          </div>
        </>
      )}

      <div className="options-bar-spacer" />
    </div>
  );
};

/* ─── CrossTab ─── */
const CrossTabOptions: React.FC<{ element: CrossTabElement }> = ({ element }) => {
  const { updateElement, report } = useDesignerStore();
  const dsFields = report.dataSources.flatMap(ds => ds.fields.map(f => f.name));
  const fieldOptions = dsFields.length > 0 ? dsFields : ['(请先添加数据源)'];

  return (
    <>
      <span className="options-label">行字段</span>
      <select className="opt-select" value={element.rowField} onChange={e => updateElement(element.id, { rowField: e.target.value } as Partial<CrossTabElement>)}>
        <option value="">--</option>
        {fieldOptions.map(f => <option key={f} value={f}>{f}</option>)}
      </select>
      <span className="options-label">列字段</span>
      <select className="opt-select" value={element.columnField} onChange={e => updateElement(element.id, { columnField: e.target.value } as Partial<CrossTabElement>)}>
        <option value="">--</option>
        {fieldOptions.map(f => <option key={f} value={f}>{f}</option>)}
      </select>
      <span className="options-label">值字段</span>
      <select className="opt-select" value={element.valueField} onChange={e => updateElement(element.id, { valueField: e.target.value } as Partial<CrossTabElement>)}>
        <option value="">--</option>
        {fieldOptions.map(f => <option key={f} value={f}>{f}</option>)}
      </select>
      <span className="options-label">聚合</span>
      <select className="opt-select narrow" value={element.valueFunction} onChange={e => updateElement(element.id, { valueFunction: e.target.value as CrossTabElement['valueFunction'] } as Partial<CrossTabElement>)}>
        <option value="sum">求和</option>
        <option value="count">计数</option>
        <option value="avg">平均</option>
        <option value="min">最小</option>
        <option value="max">最大</option>
      </select>
    </>
  );
};

/* ─── Text ─── */
const TextOptions: React.FC<{ element: TextElement }> = ({ element }) => {
  const { updateElement } = useDesignerStore();
  const upd = (patch: Partial<TextElement>) => updateElement(element.id, patch);

  return (
    <>
      <span className="options-label">字体</span>
      <select className="opt-select" value={element.font.family} onChange={e => upd({ font: { ...element.font, family: e.target.value } })}>
        {['Microsoft YaHei', 'SimSun', 'SimHei', 'KaiTi', 'Arial', 'Times New Roman', 'Courier New'].map(f =>
          <option key={f} value={f}>{f}</option>
        )}
      </select>
      <span className="options-label">大小</span>
      <input className="opt-input narrow" type="number" value={element.font.size} min={6} max={72}
        onChange={e => upd({ font: { ...element.font, size: Number(e.target.value) || 12 } })} />
      <button className={`opt-btn toggle${element.font.bold ? ' active' : ''}`} onClick={() => upd({ font: { ...element.font, bold: !element.font.bold } })} title="粗体"><b>B</b></button>
      <button className={`opt-btn toggle${element.font.italic ? ' active' : ''}`} onClick={() => upd({ font: { ...element.font, italic: !element.font.italic } })} title="斜体"><i>I</i></button>
      <button className={`opt-btn toggle${element.font.underline ? ' active' : ''}`} onClick={() => upd({ font: { ...element.font, underline: !element.font.underline } })} title="下划线"><u>U</u></button>
      <span className="options-label">颜色</span>
      <input className="opt-color" type="color" value={element.font.color} onChange={e => upd({ font: { ...element.font, color: e.target.value } })} />
      <span className="options-label">对齐</span>
      <button className={`opt-btn toggle${element.horizontalAlign === 'left' ? ' active' : ''}`} onClick={() => upd({ horizontalAlign: 'left' })} title="左对齐">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 10H3M21 6H3M21 14H3M17 18H3" /></svg>
      </button>
      <button className={`opt-btn toggle${element.horizontalAlign === 'center' ? ' active' : ''}`} onClick={() => upd({ horizontalAlign: 'center' })} title="居中">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 10H6M21 6H3M21 14H3M18 18H6" /></svg>
      </button>
      <button className={`opt-btn toggle${element.horizontalAlign === 'right' ? ' active' : ''}`} onClick={() => upd({ horizontalAlign: 'right' })} title="右对齐">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10H7M21 6H3M21 14H3M21 18H7" /></svg>
      </button>
    </>
  );
};

/* ─── Barcode ─── */
const BarcodeOptions: React.FC<{ element: BarcodeElement }> = ({ element }) => {
  const { updateElement } = useDesignerStore();
  const upd = (patch: Partial<BarcodeElement>) => updateElement(element.id, patch);
  return (
    <>
      <span className="options-label">格式</span>
      <select className="opt-select narrow" value={element.format} onChange={e => upd({ format: e.target.value as BarcodeElement['format'] })}>
        <option value="CODE128">CODE128</option>
        <option value="EAN13">EAN13</option>
        <option value="CODE39">CODE39</option>
      </select>
      <span className="options-label">值</span>
      <input className="opt-input" value={element.value} onChange={e => upd({ value: e.target.value })} placeholder="条形码值" />
      <button className={`opt-btn toggle${element.showText ? ' active' : ''}`} onClick={() => upd({ showText: !element.showText })} title="显示文字">Aa</button>
    </>
  );
};

/* ─── QR Code ─── */
const QRCodeOptions: React.FC<{ element: QRCodeElement }> = ({ element }) => {
  const { updateElement } = useDesignerStore();
  const upd = (patch: Partial<QRCodeElement>) => updateElement(element.id, patch);
  return (
    <>
      <span className="options-label">容错</span>
      <select className="opt-select narrow" value={element.errorLevel} onChange={e => upd({ errorLevel: e.target.value as QRCodeElement['errorLevel'] })}>
        <option value="L">L (7%)</option>
        <option value="M">M (15%)</option>
        <option value="Q">Q (25%)</option>
        <option value="H">H (30%)</option>
      </select>
      <span className="options-label">值</span>
      <input className="opt-input" value={element.value} onChange={e => upd({ value: e.target.value })} placeholder="二维码内容" />
    </>
  );
};

/* ─── Chart ─── */
const ChartOptions: React.FC<{ element: ChartElement }> = ({ element }) => {
  const { updateElement } = useDesignerStore();
  const upd = (patch: Partial<ChartElement>) => updateElement(element.id, patch);
  return (
    <>
      <span className="options-label">类型</span>
      <select className="opt-select narrow" value={element.chartData.chartType} onChange={e => upd({ chartData: { ...element.chartData, chartType: e.target.value as ChartElement['chartData']['chartType'] } })}>
        <option value="bar">柱状图</option>
        <option value="line">折线图</option>
        <option value="pie">饼图</option>
        <option value="area">面积图</option>
      </select>
      <span className="options-label">标题</span>
      <input className="opt-input" value={element.chartData.title ?? ''} onChange={e => upd({ chartData: { ...element.chartData, title: e.target.value } })} placeholder="图表标题" />
      <span className="options-label">背景</span>
      <input className="opt-color" type="color" value={element.backgroundColor} onChange={e => upd({ backgroundColor: e.target.value })} />
    </>
  );
};

/* ─── Table ─── */
const TableOptions: React.FC<{ element: TableElement }> = ({ element }) => {
  const { updateElement } = useDesignerStore();
  const upd = (patch: Partial<TableElement>) => updateElement(element.id, patch);
  const colCount = element.tableData.columns.length;
  const rowCount = element.tableData.rows.length;
  return (
    <>
      <span className="options-label">列</span>
      <input className="opt-input narrow" type="number" min={1} max={20} value={colCount}
        onChange={e => {
          const n = Math.max(1, Number(e.target.value) || 1);
          const cols = [...element.tableData.columns];
          while (cols.length < n) cols.push({ id: crypto.randomUUID?.() ?? Date.now().toString(), width: 80 });
          if (cols.length > n) cols.length = n;
          upd({ tableData: { ...element.tableData, columns: cols } });
        }} />
      <span className="options-label">行</span>
      <input className="opt-input narrow" type="number" min={1} max={100} value={rowCount}
        onChange={e => {
          const n = Math.max(1, Number(e.target.value) || 1);
          const rows = [...element.tableData.rows];
          while (rows.length < n) rows.push({ id: crypto.randomUUID?.() ?? Date.now().toString(), height: 30, isHeader: false });
          if (rows.length > n) rows.length = n;
          upd({ tableData: { ...element.tableData, rows } });
        }} />
      <button className={`opt-btn toggle${element.repeatHeader ? ' active' : ''}`} onClick={() => upd({ repeatHeader: !element.repeatHeader })} title="重复表头">重复表头</button>
    </>
  );
};

/* ─── Line ─── */
const LineOptions: React.FC<{ element: LineElement }> = ({ element }) => {
  const { updateElement } = useDesignerStore();
  const upd = (patch: Partial<LineElement>) => updateElement(element.id, patch);
  return (
    <>
      <span className="options-label">方向</span>
      <select className="opt-select narrow" value={element.direction} onChange={e => upd({ direction: e.target.value as LineElement['direction'] })}>
        <option value="horizontal">水平</option>
        <option value="vertical">垂直</option>
        <option value="diagonal">对角线</option>
      </select>
      <span className="options-label">线宽</span>
      <input className="opt-input narrow" type="number" min={1} max={10} value={element.lineWidth} onChange={e => upd({ lineWidth: Number(e.target.value) || 1 })} />
      <span className="options-label">颜色</span>
      <input className="opt-color" type="color" value={element.color} onChange={e => upd({ color: e.target.value })} />
      <span className="options-label">样式</span>
      <select className="opt-select narrow" value={element.style} onChange={e => upd({ style: e.target.value as LineElement['style'] })}>
        <option value="solid">实线</option>
        <option value="dashed">虚线</option>
        <option value="dotted">点线</option>
      </select>
    </>
  );
};

/* ─── Rectangle ─── */
const RectangleOptions: React.FC<{ element: RectangleElement }> = ({ element }) => {
  const { updateElement } = useDesignerStore();
  const upd = (patch: Partial<RectangleElement>) => updateElement(element.id, patch);
  return (
    <>
      <span className="options-label">填充</span>
      <input className="opt-color" type="color" value={element.fillColor} onChange={e => upd({ fillColor: e.target.value })} />
      <span className="options-label">边框</span>
      <input className="opt-color" type="color" value={element.borderColor} onChange={e => upd({ borderColor: e.target.value })} />
      <span className="options-label">线宽</span>
      <input className="opt-input narrow" type="number" min={0} max={10} value={element.borderWidth} onChange={e => upd({ borderWidth: Number(e.target.value) || 0 })} />
      <span className="options-label">圆角</span>
      <input className="opt-input narrow" type="number" min={0} max={100} value={element.borderRadius} onChange={e => upd({ borderRadius: Number(e.target.value) || 0 })} />
    </>
  );
};

/* ─── Image ─── */
const ImageOptions: React.FC<{ element: ImageElement }> = ({ element }) => {
  const { updateElement } = useDesignerStore();
  const upd = (patch: Partial<ImageElement>) => updateElement(element.id, patch);
  return (
    <>
      <span className="options-label">适应</span>
      <select className="opt-select narrow" value={element.objectFit} onChange={e => upd({ objectFit: e.target.value as ImageElement['objectFit'] })}>
        <option value="contain">包含</option>
        <option value="cover">覆盖</option>
        <option value="fill">拉伸</option>
      </select>
    </>
  );
};

/* ─── Subreport ─── */
const SubreportOptions: React.FC = () => {
  return <span className="options-hint">子报表参数请在属性面板中配置</span>;
};
