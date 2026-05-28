import type { Report, Band, ReportElement, DataSource, TableElement } from '../types';

const uid = () => crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);

/* ─── Element factory helpers ─── */

const B = { style: 'solid' as const, width: 1, color: '#000000' };
const N = { style: 'none' as const, width: 1, color: '#000000' };

function txt(
  x: number, y: number, w: number, h: number,
  content: string,
  opts?: Partial<{
    fontSize: number; bold: boolean; color: string; align: 'left' | 'center' | 'right';
    dataField: string; underline: boolean;
    borders_top: { style: string; width: number; color: string };
    borders_bottom: { style: string; width: number; color: string };
    borders_left: { style: string; width: number; color: string };
    borders_right: { style: string; width: number; color: string };
  }>,
): ReportElement {
  return {
    id: uid(), type: 'text', x, y, width: w, height: h,
    rotation: 0, locked: false, visible: true, name: content.slice(0, 20), zOrder: Date.now() + Math.random(),
    content,
    dataField: opts?.dataField,
    font: {
      family: 'SimSun', size: opts?.fontSize ?? 10,
      bold: opts?.bold ?? false, italic: false, underline: opts?.underline ?? false,
      color: opts?.color ?? '#000000',
    },
    backgroundColor: 'transparent',
    borders: {
      top: (opts?.borders_top ?? N) as any,
      bottom: (opts?.borders_bottom ?? N) as any,
      left: (opts?.borders_left ?? N) as any,
      right: (opts?.borders_right ?? N) as any,
    },
    padding: { top: 2, right: 4, bottom: 2, left: 4 },
    horizontalAlign: opts?.align ?? 'left',
    verticalAlign: 'middle', wordWrap: false, autoSize: false,
  } as ReportElement;
}

function line(x: number, y: number, w: number, h: number, color = '#000000', lineWidth = 1): ReportElement {
  return {
    id: uid(), type: 'line', x, y, width: w, height: h,
    rotation: 0, locked: false, visible: true, name: 'line', zOrder: Date.now() + Math.random(),
    direction: 'horizontal', color, lineWidth, style: 'solid',
  } as ReportElement;
}

/** Create a data-only table (no header row) for the data band */
function createDataTable(contentW: number): TableElement {
  const colWidths = [40, 90, 180, 120, 44, 56, 76, 76];
  const colIds = colWidths.map(() => uid());
  const dataRowId = uid();

  const dataFields = ['{no}', '{code}', '{name}', '{spec}', '{unit}', '{qty}', '{price}', '{amount}'];
  const dataAligns: ('left' | 'center' | 'right')[] = ['center', 'center', 'left', 'center', 'center', 'right', 'right', 'right'];

  const cellBorder = {
    top: { style: 'solid' as const, width: 1, color: '#000000' },
    bottom: { style: 'solid' as const, width: 1, color: '#000000' },
    left: { style: 'solid' as const, width: 1, color: '#000000' },
    right: { style: 'solid' as const, width: 1, color: '#000000' },
  };

  const dataFont = { family: 'SimSun', size: 10, bold: false, italic: false, underline: false, color: '#000000' };

  const dataCells = colIds.map((_colId, i) => ({
    id: uid(), rowSpan: 1, colSpan: 1,
    content: dataFields[i],
    dataField: '',
    font: { ...dataFont }, backgroundColor: 'transparent',
    borders: cellBorder,
    padding: { top: 2, right: 4, bottom: 2, left: 4 },
    horizontalAlign: dataAligns[i], verticalAlign: 'middle' as const,
    diagonalLine: false,
    wordWrap: false, autoGrow: false, mask: '', format: '',
  }));

  return {
    id: uid(), type: 'table', x: 0, y: 0,
    width: contentW, height: 24,
    rotation: 0, locked: false, visible: true, name: '采购明细', zOrder: Date.now() + Math.random(),
    tableData: {
      columns: colIds.map((id, i) => ({ id, width: colWidths[i] })),
      rows: [
        { id: dataRowId, height: 24, isHeader: false },
      ],
      cells: [dataCells],
    },
    repeatHeader: true,
  };
}

/* ─── 采购单模板 ─── */

export function createPurchaseOrderTemplate(): Report {
  const pageW = 794;
  const pageH = 1123;
  const marginL = 56;
  const marginR = 56;
  const contentW = pageW - marginL - marginR; // 682

  // ─── 测试数据 ───
  const testItems = [
    { no: 1, code: 'ITM-001', name: '联想 ThinkPad X1 Carbon 笔记本电脑', spec: 'i7-1365U/16GB/512GB', unit: '台', qty: 10, price: 8999.00, amount: 89990.00 },
    { no: 2, code: 'ITM-002', name: '戴尔 U2723QE 4K显示器', spec: '27寸/4K/IPS', unit: '台', qty: 10, price: 3599.00, amount: 35990.00 },
    { no: 3, code: 'ITM-003', name: '罗技 MX Master 3S 无线鼠标', spec: '蓝牙/2.4G', unit: '个', qty: 20, price: 599.00, amount: 11980.00 },
    { no: 4, code: 'ITM-004', name: '罗技 K950 无线键盘', spec: '蓝牙/静音', unit: '个', qty: 20, price: 349.00, amount: 6980.00 },
    { no: 5, code: 'ITM-005', name: '得力 A4 复印纸', spec: '80g/500张', unit: '箱', qty: 50, price: 129.00, amount: 6450.00 },
    { no: 6, code: 'ITM-006', name: '爱普生 L3258 墨仓式打印机', spec: '彩色/无线', unit: '台', qty: 3, price: 1599.00, amount: 4797.00 },
    { no: 7, code: 'ITM-007', name: '绿联 100W USB-C 充电器', spec: 'GaN/4口', unit: '个', qty: 15, price: 199.00, amount: 2985.00 },
    { no: 8, code: 'ITM-008', name: '山特 C1KS UPS不间断电源', spec: '1KVA/在线式', unit: '台', qty: 2, price: 2899.00, amount: 5798.00 },
  ];

  const dataSource: DataSource = {
    id: uid(), name: '采购明细', type: 'json',
    data: testItems,
    fields: [
      { name: 'no', type: 'number' },
      { name: 'code', type: 'string' },
      { name: 'name', type: 'string' },
      { name: 'spec', type: 'string' },
      { name: 'unit', type: 'string' },
      { name: 'qty', type: 'number' },
      { name: 'price', type: 'number' },
      { name: 'amount', type: 'number' },
    ],
  };

  const elements: Record<string, ReportElement> = {};
  const addEl = (el: ReportElement) => { elements[el.id] = el; return el.id; };
  let zIdx = 1;

  // ═══════════════════════════════════════════════════════════════
  // TITLE BAND — 标题 + 订单信息
  // ═══════════════════════════════════════════════════════════════
  const titleBand: Band = { id: uid(), type: 'title', height: 70, backgroundColor: '#ffffff', visible: true, elements: [] };
  const tStart = Object.keys(elements).length;

  addEl({ ...txt(0, 2, contentW, 28, '采 购 订 单', { fontSize: 18, bold: true, align: 'center' }), zOrder: zIdx++ });

  // 左侧信息
  addEl({ ...txt(0, 32, 50, 16, '供应商：', { fontSize: 10, bold: true }), zOrder: zIdx++ });
  addEl({ ...txt(50, 32, 280, 16, '广州博远电子科技有限公司'), zOrder: zIdx++ });
  addEl({ ...txt(0, 48, 50, 16, '联系人：', { fontSize: 10, bold: true }), zOrder: zIdx++ });
  addEl({ ...txt(50, 48, 120, 16, '张明远'), zOrder: zIdx++ });

  // 右侧信息
  addEl({ ...txt(contentW - 260, 32, 70, 16, '单    号：', { fontSize: 10, bold: true, align: 'right' }), zOrder: zIdx++ });
  addEl({ ...txt(contentW - 190, 32, 190, 16, 'PO-2026-00518'), zOrder: zIdx++ });
  addEl({ ...txt(contentW - 260, 48, 70, 16, '日    期：', { fontSize: 10, bold: true, align: 'right' }), zOrder: zIdx++ });
  addEl({ ...txt(contentW - 190, 48, 190, 16, '2026-05-25'), zOrder: zIdx++ });

  titleBand.elements = Object.keys(elements).slice(tStart);

  // ═══════════════════════════════════════════════════════════════
  // PAGE HEADER BAND — 表头行（紧贴数据带，视觉一体）
  // ═══════════════════════════════════════════════════════════════
  const pageHeaderBand: Band = { id: uid(), type: 'pageHeader', height: 24, backgroundColor: '#ffffff', visible: true, elements: [], repeatOnEveryPage: true };
  const phStart = Object.keys(elements).length;

  const colDefs = [
    { text: '序号', x: 0, w: 40 },
    { text: '物料编码', x: 40, w: 90 },
    { text: '物料名称', x: 130, w: 180 },
    { text: '规格型号', x: 310, w: 120 },
    { text: '单位', x: 430, w: 44 },
    { text: '数量', x: 474, w: 56 },
    { text: '单价(元)', x: 530, w: 76 },
    { text: '金额(元)', x: 606, w: 76 },
  ];

  colDefs.forEach((c, i) => {
    addEl({ ...txt(c.x, 0, c.w, 24, c.text, {
      fontSize: 10, bold: true, align: 'center',
      borders_top: B,
      borders_bottom: B,
      borders_left: i === 0 ? B : N,
      borders_right: B,
    }), zOrder: zIdx++ });
  });

  pageHeaderBand.elements = Object.keys(elements).slice(phStart);

  // ═══════════════════════════════════════════════════════════════
  // DATA BAND — 明细数据（仅数据行的 Table 元素）
  // ═══════════════════════════════════════════════════════════════
  const dataBand: Band = { id: uid(), type: 'data', height: 24, backgroundColor: '#ffffff', visible: true, elements: [] };
  const dStart = Object.keys(elements).length;

  const detailTable = createDataTable(contentW);
  detailTable.zOrder = zIdx++;
  addEl(detailTable);

  dataBand.elements = Object.keys(elements).slice(dStart);

  // ═══════════════════════════════════════════════════════════════
  // GROUP FOOTER BAND — 合计
  // ═══════════════════════════════════════════════════════════════
  const groupFooterBand: Band = { id: uid(), type: 'groupFooter', height: 28, backgroundColor: '#ffffff', visible: true, elements: [] };
  const gfStart = Object.keys(elements).length;

  addEl({ ...txt(0, 0, 310, 24, '', {
    borders_top: B, borders_bottom: B, borders_left: B, borders_right: B,
  }), zOrder: zIdx++ });
  addEl({ ...txt(310, 0, 120, 24, '合    计', {
    bold: true, align: 'center',
    borders_top: B, borders_bottom: B, borders_left: N, borders_right: B,
  }), zOrder: zIdx++ });
  addEl({ ...txt(430, 0, 44, 24, '', {
    borders_top: B, borders_bottom: B, borders_left: N, borders_right: B,
  }), zOrder: zIdx++ });
  addEl({ ...txt(474, 0, 56, 24, '130', {
    bold: true, align: 'right',
    borders_top: B, borders_bottom: B, borders_left: N, borders_right: B,
  }), zOrder: zIdx++ });
  addEl({ ...txt(530, 0, 76, 24, '', {
    borders_top: B, borders_bottom: B, borders_left: N, borders_right: B,
  }), zOrder: zIdx++ });
  addEl({ ...txt(606, 0, 76, 24, '164,970.00', {
    bold: true, align: 'right',
    borders_top: B, borders_bottom: B, borders_left: N, borders_right: B,
  }), zOrder: zIdx++ });

  groupFooterBand.elements = Object.keys(elements).slice(gfStart);

  // ═══════════════════════════════════════════════════════════════
  // REPORT FOOTER BAND — 价税合计
  // ═══════════════════════════════════════════════════════════════
  const reportFooterBand: Band = { id: uid(), type: 'reportFooter', height: 56, backgroundColor: '#ffffff', visible: true, elements: [] };
  const rfStart = Object.keys(elements).length;

  addEl({ ...txt(0, 2, 200, 16, '税额(13%)：', { align: 'right' }), zOrder: zIdx++ });
  addEl({ ...txt(200, 2, 120, 16, '21,446.10', { align: 'right' }), zOrder: zIdx++ });
  addEl({ ...txt(0, 18, 200, 16, '运费：', { align: 'right' }), zOrder: zIdx++ });
  addEl({ ...txt(200, 18, 120, 16, '0.00', { align: 'right' }), zOrder: zIdx++ });

  addEl({ ...line(0, 34, contentW, 0, '#000000', 1), zOrder: zIdx++ });
  addEl({ ...txt(0, 36, 200, 16, '价税合计：', { bold: true, align: 'right', fontSize: 12 }), zOrder: zIdx++ });
  addEl({ ...txt(200, 36, 200, 16, '¥186,416.10', { bold: true, align: 'right', fontSize: 12 }), zOrder: zIdx++ });

  reportFooterBand.elements = Object.keys(elements).slice(rfStart);

  // ═══════════════════════════════════════════════════════════════
  // PAGE FOOTER BAND
  // ═══════════════════════════════════════════════════════════════
  const pageFooterBand: Band = { id: uid(), type: 'pageFooter', height: 80, backgroundColor: '#ffffff', visible: true, elements: [], repeatOnEveryPage: true };
  const pfStart = Object.keys(elements).length;

  addEl({ ...line(0, 0, contentW, 0, '#000000', 1), zOrder: zIdx++ });
  addEl({ ...txt(0, 4, 60, 14, '备注：', { fontSize: 9, bold: true }), zOrder: zIdx++ });
  addEl({ ...txt(50, 4, contentW - 60, 14, '1. 请按交货日期准时交货，逾期将按合同约定扣除违约金。', { fontSize: 9 }), zOrder: zIdx++ });
  addEl({ ...txt(50, 18, contentW - 60, 14, '2. 货物验收合格后15个工作日内付款。', { fontSize: 9 }), zOrder: zIdx++ });
  addEl({ ...txt(50, 32, contentW - 60, 14, '3. 所有产品须提供原厂保修，保修期不少于3年。', { fontSize: 9 }), zOrder: zIdx++ });

  addEl({ ...txt(0, 50, 220, 16, '采购方签章：__________________', { fontSize: 10 }), zOrder: zIdx++ });
  addEl({ ...txt(230, 50, 220, 16, '供应商签章：__________________', { fontSize: 10 }), zOrder: zIdx++ });
  addEl({ ...txt(460, 50, 220, 16, '审批人：__________________', { fontSize: 10 }), zOrder: zIdx++ });

  addEl({ ...txt(0, 68, contentW, 12, '— {PageNumber} / {TotalPages} —', { fontSize: 9, align: 'center' }), zOrder: zIdx++ });

  pageFooterBand.elements = Object.keys(elements).slice(pfStart);

  // ─── 组装报表 ───
  const report: Report = {
    id: uid(),
    name: '采购订单',
    version: '1.0.0',
    pageSettings: {
      width: pageW, height: pageH, orientation: 'portrait',
      marginTop: 40, marginBottom: 40, marginLeft: marginL, marginRight: marginR,
      columns: 1, columnGap: 0,
    },
    bands: [titleBand, pageHeaderBand, dataBand, groupFooterBand, reportFooterBand, pageFooterBand],
    elements,
    dataSources: [dataSource],
    parameters: [],
    styles: [],
    variables: {},
  };

  return report;
}

/* ─── 销售出库单模板（高精度高级分组模板） ─── */

export function createSalesInvoiceTemplate(): Report {
  const pageW = 794;
  const pageH = 1123;
  const marginL = 56;
  const marginR = 56;
  const contentW = pageW - marginL - marginR; // 682

  const testSalesItems = [
    { no: 1, category: "数码电子", code: "HW-MATE60", name: "华为 Mate60 Pro 智能手机", spec: "512GB 雅川青", unit: "部", qty: 2, price: 6999.00, amount: 13998.00 },
    { no: 2, category: "数码电子", code: "AP-IPH15", name: "苹果 iPhone 15 Pro Max 手机", spec: "256GB 原色钛金属", unit: "部", qty: 3, price: 9999.00, amount: 29997.00 },
    { no: 3, category: "数码电子", code: "HW-WATCH4", name: "华为 WATCH 4 Pro 智能手表", spec: "独立eSIM版", unit: "只", qty: 5, price: 3299.00, amount: 16495.00 },
    { no: 4, category: "办公设备", code: "HP-M403D", name: "惠普 LaserJet Pro 激光打印机", spec: "双面/自动双频", unit: "台", qty: 2, price: 2499.00, amount: 4998.00 },
    { no: 5, category: "办公设备", code: "XIAOMI-AIR", name: "小米空气净化器 4 Pro", spec: "除醛抗菌两层滤芯", unit: "台", qty: 4, price: 1299.00, amount: 5196.00 },
  ];

  const dataSource: DataSource = {
    id: uid(), name: "销售明细", type: "json",
    data: testSalesItems,
    fields: [
      { name: "no", type: "number" },
      { name: "category", type: "string" },
      { name: "code", type: "string" },
      { name: "name", type: "string" },
      { name: "spec", type: "string" },
      { name: "unit", type: "string" },
      { name: "qty", type: "number" },
      { name: "price", type: "number" },
      { name: "amount", type: "number" },
    ],
  };

  const elements: Record<string, ReportElement> = {};
  const addEl = (el: ReportElement) => { elements[el.id] = el; return el.id; };
  let zIdx = 1;
  const HB = { style: "solid" as const, width: 1, color: "#cbd5e1" };

  // ═══════════════════════════════════════════════════════════════
  // TITLE BAND
  // ═══════════════════════════════════════════════════════════════
  const titleBand: Band = { id: uid(), type: "title", height: 110, backgroundColor: "#ffffff", visible: true, elements: [] };
  const tStart = Object.keys(elements).length;

  // Premium Header Layout
  addEl({ ...txt(0, 0, contentW, 32, "深 圳 智 创 技 术 高 科 技 集 团", { fontSize: 11, bold: true, align: "center", color: "#64748b" }), zOrder: zIdx++ });
  addEl({ ...txt(0, 24, contentW, 28, "销 售 出 库 发 票", { fontSize: 20, bold: true, align: "center", color: "#1e3a8a" }), zOrder: zIdx++ });
  addEl({ ...line(0, 56, contentW, 0, "#1e3a8a", 2), zOrder: zIdx++ });

  // Columns Meta
  addEl({ ...txt(0, 64, 60, 16, "客户名称：", { fontSize: 9, bold: true, color: "#475569" }), zOrder: zIdx++ });
  addEl({ ...txt(60, 64, 250, 16, "北京博华科技股份有限公司", { fontSize: 9 }), zOrder: zIdx++ });
  addEl({ ...txt(0, 80, 60, 16, "发发地址：", { fontSize: 9, bold: true, color: "#475569" }), zOrder: zIdx++ });
  addEl({ ...txt(60, 80, 250, 16, "北京市海淀区中关村南大街科技大厦A座", { fontSize: 9 }), zOrder: zIdx++ });

  addEl({ ...txt(contentW - 310, 64, 180, 16, "出 库 单 号：", { fontSize: 9, bold: true, align: "right", color: "#475569" }), zOrder: zIdx++ });
  addEl({ ...txt(contentW - 130, 64, 130, 16, "INV-2026-00940", { fontSize: 9, bold: true, color: "#0f172a" }), zOrder: zIdx++ });
  addEl({ ...txt(contentW - 310, 80, 180, 16, "出 库 日 期：", { fontSize: 9, bold: true, align: "right", color: "#475569" }), zOrder: zIdx++ });
  addEl({ ...txt(contentW - 130, 80, 130, 16, "2026-05-27", { fontSize: 9, color: "#0f172a" }), zOrder: zIdx++ });

  addEl({
    id: uid(), type: "barcode", x: contentW - 130, y: 10, width: 130, height: 40,
    rotation: 0, locked: false, visible: true, name: "单号条码", zOrder: zIdx++,
    format: "CODE128", value: "INV-2026-00940", showText: false,
  } as any);

  titleBand.elements = Object.keys(elements).slice(tStart);

  // ═══════════════════════════════════════════════════════════════
  // PAGE HEADER BAND
  // ═══════════════════════════════════════════════════════════════
  const pageHeaderBand: Band = { id: uid(), type: "pageHeader", height: 26, backgroundColor: "#ffffff", visible: true, elements: [], repeatOnEveryPage: true };
  const phStart = Object.keys(elements).length;

  const colDefs = [
    { text: "序号", x: 0, w: 40 },
    { text: "商品编码", x: 40, w: 80 },
    { text: "商品名称", x: 120, w: 180 },
    { text: "规格描述", x: 300, w: 120 },
    { text: "单位", x: 420, w: 40 },
    { text: "数量", x: 460, w: 50 },
    { text: "单价(元)", x: 510, w: 80 },
    { text: "小计金额", x: 590, w: 92 },
  ];

  colDefs.forEach((c, i) => {
    addEl({ ...txt(c.x, 0, c.w, 26, c.text, {
      fontSize: 10, bold: true, align: "center", color: "#ffffff",
      borders_top: HB,
      borders_bottom: HB,
      borders_left: i === 0 ? HB : N,
      borders_right: HB,
    }), backgroundColor: "#1e3a8a", zOrder: zIdx++ } as any);
  });

  pageHeaderBand.elements = Object.keys(elements).slice(phStart);

  // ═══════════════════════════════════════════════════════════════
  // DATA BAND
  // ═══════════════════════════════════════════════════════════════
  const dataBand: Band = { id: uid(), type: "data", height: 24, backgroundColor: "#ffffff", visible: true, elements: [] };
  const dStart = Object.keys(elements).length;

  const detailTable = createSalesInvoiceTable(contentW);
  detailTable.zOrder = zIdx++;
  addEl(detailTable);

  dataBand.elements = Object.keys(elements).slice(dStart);

  // ═══════════════════════════════════════════════════════════════
  // GROUP FOOTER BAND
  // ═══════════════════════════════════════════════════════════════
  const groupFooterBand: Band = { id: uid(), type: "groupFooter", height: 28, backgroundColor: "#ffffff", visible: true, elements: [] };
  const gfStart = Object.keys(elements).length;

  addEl({ ...txt(0, 0, 420, 24, "", { borders_top: HB, borders_bottom: HB, borders_left: HB, borders_right: HB }), zOrder: zIdx++ });
  addEl({ ...txt(420, 0, 40, 24, "本页合计", { fontSize: 9, bold: true, align: "center", borders_top: HB, borders_bottom: HB, borders_left: N, borders_right: HB }), zOrder: zIdx++ });
  addEl({ ...txt(460, 0, 50, 24, "=Sum(\"qty\")", { bold: true, align: "right", borders_top: HB, borders_bottom: HB, borders_left: N, borders_right: HB }), zOrder: zIdx++ });
  addEl({ ...txt(510, 0, 80, 24, "", { borders_top: HB, borders_bottom: HB, borders_left: N, borders_right: HB }), zOrder: zIdx++ });
  addEl({ ...txt(590, 0, 92, 24, "=Sum(\"amount\")", { bold: true, align: "right", borders_top: HB, borders_bottom: HB, borders_left: N, borders_right: HB }), zOrder: zIdx++ });

  groupFooterBand.elements = Object.keys(elements).slice(gfStart);

  // ═══════════════════════════════════════════════════════════════
  // REPORT FOOTER BAND
  // ═══════════════════════════════════════════════════════════════
  const reportFooterBand: Band = { id: uid(), type: "reportFooter", height: 90, backgroundColor: "#ffffff", visible: true, elements: [] };
  const rfStart = Object.keys(elements).length;

  addEl({ ...line(0, 4, contentW, 0, "#1e3a8a", 1.5), zOrder: zIdx++ });

  // Tax calculations
  addEl({ ...txt(0, 12, 450, 16, "销售开票计算增值税额(13%)：", { align: "right", fontSize: 9, color: "#475569" }), zOrder: zIdx++ });
  addEl({ ...txt(450, 12, 130, 16, "=Sum(\"amount\") * 0.13", { align: "right", bold: true, fontSize: 9, color: "#1e293b" }), zOrder: zIdx++ });

  addEl({ ...txt(0, 28, 450, 16, "应付货物总金额(含税价)：", { align: "right", fontSize: 9, color: "#475569" }), zOrder: zIdx++ });
  addEl({ ...txt(450, 28, 130, 16, "=Sum(\"amount\")", { align: "right", bold: true, fontSize: 10, color: "#1e293b" }), zOrder: zIdx++ });

  addEl({ ...line(450, 48, 130, 0, "#cbd5e1", 1), zOrder: zIdx++ });

  addEl({ ...txt(0, 52, 450, 20, "价税统一总合计金额(大写人民币)：", { bold: true, align: "right", fontSize: 11, color: "#0f172a" }), zOrder: zIdx++ });
  addEl({ ...txt(450, 52, 130, 20, "¥60,883.00", { bold: true, align: "right", fontSize: 12, color: "#b91c1c" }), zOrder: zIdx++ });

  // QRCode verification
  addEl({
    id: uid(), type: "qrcode", x: 10, y: 10, width: 70, height: 70,
    rotation: 0, locked: false, visible: true, name: "真伪验证码", zOrder: zIdx++,
    errorLevel: "M", value: "https://verify.智创高科.com/invoice/INV-2026-00940", size: 70,
  } as any);
  addEl({ ...txt(90, 20, 180, 14, "扫码验证库单数字签名", { fontSize: 8, color: "#64748b" }), zOrder: zIdx++ });
  addEl({ ...txt(90, 32, 180, 14, "智创技术高科财务总公司专用", { fontSize: 8, color: "#64748b" }), zOrder: zIdx++ });

  reportFooterBand.elements = Object.keys(elements).slice(rfStart);

  // ═══════════════════════════════════════════════════════════════
  // PAGE FOOTER BAND
  // ═══════════════════════════════════════════════════════════════
  const pageFooterBand: Band = { id: uid(), type: "pageFooter", height: 75, backgroundColor: "#ffffff", visible: true, elements: [], repeatOnEveryPage: true };
  const pfStart = Object.keys(elements).length;

  addEl({ ...line(0, 0, contentW, 0, "#0f172a", 1), zOrder: zIdx++ });
  addEl({ ...txt(0, 4, 80, 14, "收货须知：", { fontSize: 8.5, bold: true, color: "#334155" }), zOrder: zIdx++ });
  addEl({ ...txt(60, 4, contentW - 60, 14, "1. 货品送达后请当面开箱清点数量、检查规格、确认完好无损。", { fontSize: 8 }), zOrder: zIdx++ });
  addEl({ ...txt(60, 16, contentW - 60, 14, "2. 如有缺件、破损等异常情况，请当场拍照存证并在三日内书面反馈。", { fontSize: 8 }), zOrder: zIdx++ });
  addEl({ ...txt(60, 28, contentW - 60, 14, "3. 本出库凭证一式三联：第一联财务记账，第二联收货留存，第三联随车回单。", { fontSize: 8 }), zOrder: zIdx++ });

  addEl({ ...txt(0, 46, 220, 16, "发货经手人：__________________", { fontSize: 9.5 }), zOrder: zIdx++ });
  addEl({ ...txt(230, 46, 220, 16, "收货复核人：__________________", { fontSize: 9.5 }), zOrder: zIdx++ });
  addEl({ ...txt(460, 46, 220, 16, "承运司机：__________________", { fontSize: 9.5 }), zOrder: zIdx++ });

  addEl({ ...txt(0, 62, contentW, 12, "— 第 {PageNumber} 页 / 共 {TotalPages} 页 —", { fontSize: 9, align: "center", color: "#475569" }), zOrder: zIdx++ });

  pageFooterBand.elements = Object.keys(elements).slice(pfStart);

  // Assemble sales invoice
  const report: Report = {
    id: uid(),
    name: "销售出库发票",
    version: "1.0.0",
    pageSettings: {
      width: pageW, height: pageH, orientation: "portrait",
      marginTop: 40, marginBottom: 40, marginLeft: marginL, marginRight: marginR,
      columns: 1, columnGap: 0,
    },
    bands: [titleBand, pageHeaderBand, dataBand, groupFooterBand, reportFooterBand, pageFooterBand],
    elements,
    dataSources: [dataSource],
    parameters: [],
    styles: [],
    variables: {},
  };

  return report;
}

// Separate helper for sales invoice table rendering
function createSalesInvoiceTable(contentW: number): TableElement {
  const colWidths = [40, 80, 180, 120, 40, 50, 80, 92];
  const colIds = colWidths.map(() => uid());
  const dataRowId = uid();

  const dataFields = ["{no}", "{code}", "{name}", "{spec}", "{unit}", "{qty}", "{price}", "{amount}"];
  const dataAligns: ("left" | "center" | "right")[] = ["center", "center", "left", "left", "center", "right", "right", "right"];

  const cellBorder = {
    top: { style: "solid" as const, width: 1, color: "#cbd5e1" },
    bottom: { style: "solid" as const, width: 1, color: "#cbd5e1" },
    left: { style: "solid" as const, width: 1, color: "#cbd5e1" },
    right: { style: "solid" as const, width: 1, color: "#cbd5e1" },
  };

  const dataFont = { family: "SimSun", size: 9.5, bold: false, italic: false, underline: false, color: "#1e293b" };

  const dataCells = colIds.map((_colId, i) => ({
    id: uid(), rowSpan: 1, colSpan: 1,
    content: dataFields[i],
    dataField: "",
    font: { ...dataFont }, backgroundColor: "transparent",
    borders: cellBorder,
    padding: { top: 3, right: 4, bottom: 3, left: 4 },
    horizontalAlign: dataAligns[i], verticalAlign: "middle" as const,
    diagonalLine: false,
    wordWrap: true, autoGrow: true, mask: "", format: i >= 6 ? "#,##0.00" : "",
  }));

  return {
    id: uid(), type: "table", x: 0, y: 0,
    width: contentW, height: 24,
    rotation: 0, locked: false, visible: true, name: "明细表格", zOrder: Date.now() + Math.random(),
    tableData: {
      columns: colIds.map((id, i) => ({ id, width: colWidths[i] })),
      rows: [
        { id: dataRowId, height: 24, isHeader: false },
      ],
      cells: [dataCells],
    },
    repeatHeader: true,
  };
}
