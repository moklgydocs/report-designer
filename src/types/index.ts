export type ElementType =
  | "text"
  | "rectangle"
  | "line"
  | "image"
  | "barcode"
  | "qrcode"
  | "chart"
  | "table"
  | "subreport"
  | "crosstab";

export type BandType =
  | "reportHeader"
  | "reportFooter"
  | "pageHeader"
  | "pageFooter"
  | "groupHeader"
  | "groupFooter"
  | "data"
  | "title";

export type HorizontalAlign = "left" | "center" | "right";
export type VerticalAlign = "top" | "middle" | "bottom";
export type BorderStyle = "solid" | "dashed" | "dotted" | "none";
export type ChartType = "bar" | "line" | "pie" | "area";
export type BarcodeFormat = "CODE128" | "EAN13" | "CODE39" | "QR";

export interface BorderConfig {
  style: BorderStyle;
  width: number;
  color: string;
}

export interface Borders {
  top?: BorderConfig;
  right?: BorderConfig;
  bottom?: BorderConfig;
  left?: BorderConfig;
}

export interface FontConfig {
  family: string;
  size: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  color: string;
}

export interface Padding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ConditionalFormat {
  id: string;
  condition: string;
  font?: Partial<FontConfig>;
  backgroundColor?: string;
  borders?: Borders;
}

export interface TableCell {
  id: string;
  rowSpan: number;
  colSpan: number;
  content: string;
  dataField?: string;
  expression?: string;
  font?: FontConfig;
  backgroundColor?: string;
  borders?: Borders;
  padding?: Padding;
  horizontalAlign?: HorizontalAlign;
  verticalAlign?: VerticalAlign;
  diagonalLine?: boolean;
  diagonalText?: string;
  mergeId?: string;
  wordWrap?: boolean;
  autoGrow?: boolean;
  mask?: string;
  format?: string;
}

export interface TableColumn {
  id: string;
  width: number;
}

export interface TableRow {
  id: string;
  height: number;
  isHeader: boolean;
}

export interface TableData {
  columns: TableColumn[];
  rows: TableRow[];
  cells: TableCell[][];
}

export interface ChartData {
  chartType: ChartType;
  title?: string;
  categories: string[];
  series: { name: string; data: number[] }[];
}

export interface BaseElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  locked: boolean;
  visible: boolean;
  name: string;
  printOn?: BandType[];
  conditionalFormats?: ConditionalFormat[];
  zOrder: number;
}

export interface TextElement extends BaseElement {
  type: "text";
  content: string;
  dataField?: string;
  expression?: string;
  font: FontConfig;
  backgroundColor: string;
  borders: Borders;
  padding: Padding;
  horizontalAlign: HorizontalAlign;
  verticalAlign: VerticalAlign;
  wordWrap: boolean;
  autoSize: boolean;
}

export interface RectangleElement extends BaseElement {
  type: "rectangle";
  fillColor: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  borders: Borders;
}

export interface LineElement extends BaseElement {
  type: "line";
  direction: "horizontal" | "vertical" | "diagonal";
  color: string;
  lineWidth: number;
  style: BorderStyle;
}

export interface ImageElement extends BaseElement {
  type: "image";
  src: string;
  dataField?: string;
  objectFit: "contain" | "cover" | "fill";
}

export interface BarcodeElement extends BaseElement {
  type: "barcode";
  format: BarcodeFormat;
  value: string;
  dataField?: string;
  showText: boolean;
}

export interface QRCodeElement extends BaseElement {
  type: "qrcode";
  value: string;
  dataField?: string;
  errorLevel: "L" | "M" | "Q" | "H";
  size: number;
}

export interface ChartElement extends BaseElement {
  type: "chart";
  chartData: ChartData;
  backgroundColor: string;
}

export interface TableElement extends BaseElement {
  type: "table";
  tableData: TableData;
  dataField?: string;
  repeatHeader: boolean;
}

export interface SubreportElement extends BaseElement {
  type: "subreport";
  reportId?: string;
  reportPath?: string;
  parameters?: Record<string, string>;
}

export interface CrossTabElement extends BaseElement {
  type: "crosstab";
  rowField: string;
  columnField: string;
  valueField: string;
  valueFunction: "sum" | "count" | "avg" | "min" | "max";
}

export type ReportElement =
  | TextElement
  | RectangleElement
  | LineElement
  | ImageElement
  | BarcodeElement
  | QRCodeElement
  | ChartElement
  | TableElement
  | SubreportElement
  | CrossTabElement;

export interface Band {
  id: string;
  type: BandType;
  height: number;
  backgroundColor: string;
  visible: boolean;
  elements: string[];
  groupExpression?: string;
  newPageBefore?: boolean;
  newPageAfter?: boolean;
  repeatOnEveryPage?: boolean;
  printIf?: string;
  dataSourceId?: string;
  sortExpressions?: string[];
  filterExpression?: string;
  keepTogether?: boolean;
}

export interface RenderContext {
  pageNumber: number;
  totalPages: number;
  allData: Record<string, any>[];
  groupData?: Record<string, any>[];
  rowIndices?: number[];
  reportName?: string;
  parameters?: Record<string, any>;
}

export interface DataSource {
  id: string;
  name: string;
  type: "json" | "api" | "database";
  data?: any[];
  url?: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  connectionString?: string;
  query?: string;
  fields: DataField[];
}

export interface DataField {
  name: string;
  type: "string" | "number" | "boolean" | "date" | "object";
  path?: string;
}

export interface Parameter {
  id: string;
  name: string;
  type: "string" | "number" | "boolean" | "date";
  defaultValue?: any;
  options?: any[];
  prompt?: string;
  required?: boolean;
}

export interface PageSettings {
  width: number;
  height: number;
  orientation: "portrait" | "landscape";
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  columns: number;
  columnGap: number;
}

export interface Report {
  id: string;
  name: string;
  version: string;
  pageSettings: PageSettings;
  bands: Band[];
  elements: Record<string, ReportElement>;
  dataSources: DataSource[];
  parameters: Parameter[];
  styles: ReportStyle[];
  variables: Record<string, any>;
  overlay?: OverlaySettings;
}

export interface OverlaySettings {
  enabled: boolean;
  src: string;
  opacity: number;
  printOnly: boolean;
}

export interface ReportStyle {
  id: string;
  name: string;
  font?: FontConfig;
  backgroundColor?: string;
  borders?: Borders;
  padding?: Padding;
  horizontalAlign?: HorizontalAlign;
  verticalAlign?: VerticalAlign;
}

export interface SnapGuide {
  type: "vertical" | "horizontal";
  position: number;
}

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
