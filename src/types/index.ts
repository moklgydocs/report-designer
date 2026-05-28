/**
 * @fileoverview Core type definitions for the Report Designer.
 *
 * This module defines the complete type system for a band-based visual report designer
 * (similar to FastReport / Jasper Reports). It covers:
 *
 * - Element types: the building blocks placed on report bands (text, shapes, images, etc.)
 * - Band types: the logical sections of a report (headers, footers, data bands, etc.)
 * - Style primitives: borders, fonts, padding, and alignment
 * - Element interfaces: typed data structures for each element kind
 * - Report structure: bands, data sources, parameters, page settings, and the root Report type
 * - Rendering support: context passed during report generation, snap guides, and selection rects
 */

// ============================================================================
// Element Types
// ============================================================================

/** Supported element types that can be placed on a report band. */
export type ElementType =
  | "text" // Static or data-bound text label
  | "rectangle" // Rectangle shape with fill and borders
  | "line" // Horizontal, vertical, or diagonal line
  | "image" // Static or data-bound image
  | "barcode" // 1D barcode (CODE128, EAN13, CODE39)
  | "qrcode" // 2D QR code
  | "chart" // Data-driven chart (bar, line, pie, area)
  | "table" // Grid of rows/columns with cells
  | "subreport" // Embedded child report
  | "crosstab"; // Pivot/cross-tabulation summary table

// ============================================================================
// Band Types
// ============================================================================

/**
 * Band types defining the logical sections of a report.
 *
 * Report structure follows the classic band model:
 *   reportHeader → pageHeader → [groupHeader → data → groupFooter]* → pageFooter → reportFooter
 */
export type BandType =
  | "reportHeader" // Printed once at the start of the entire report
  | "reportFooter" // Printed once at the end of the entire report
  | "pageHeader" // Repeated at the top of every page
  | "pageFooter" // Repeated at the bottom of every page
  | "groupHeader" // Printed before each group of data rows
  | "groupFooter" // Printed after each group of data rows
  | "data" // Repeated for each row in the data source
  | "title"; // Title band (printed once, typically on the first page)

// ============================================================================
// Alignment & Style Primitives
// ============================================================================

/** Horizontal text/content alignment within an element. */
export type HorizontalAlign = "left" | "center" | "right";
/** Vertical text/content alignment within an element. */
export type VerticalAlign = "top" | "middle" | "bottom";
/** Line style for borders and lines. */
export type BorderStyle = "solid" | "dashed" | "dotted" | "none";
/** Supported chart visualization types. */
export type ChartType = "bar" | "line" | "pie" | "area";
/** Supported 1D barcode encoding formats (QR is handled separately via QRCodeElement). */
export type BarcodeFormat = "CODE128" | "EAN13" | "CODE39" | "QR";

// ============================================================================
// Border & Font Configuration
// ============================================================================

/** Configuration for a single border edge (style, thickness, and color). */
export interface BorderConfig {
  style: BorderStyle;
  width: number; // Border thickness in pixels
  color: string; // CSS color value
}

/** Per-edge border configuration. Each edge is optional; omitted edges have no border. */
export interface Borders {
  top?: BorderConfig;
  right?: BorderConfig;
  bottom?: BorderConfig;
  left?: BorderConfig;
}

/** Full font specification for text rendering. */
export interface FontConfig {
  family: string; // Font family name (e.g. "Arial", "SimSun")
  size: number; // Font size in points
  bold: boolean;
  italic: boolean;
  underline: boolean;
  color: string; // CSS color value
}

/** Inner spacing between an element's border and its content. */
export interface Padding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// ============================================================================
// Conditional Formatting
// ============================================================================

/**
 * A conditional formatting rule that applies style overrides when its condition evaluates to true.
 * Conditions are expressed as string expressions evaluated at render time.
 */
export interface ConditionalFormat {
  id: string;
  condition: string; // Expression string (e.g. "value > 100"), evaluated at render time
  font?: Partial<FontConfig>; // Font overrides applied when condition is true
  backgroundColor?: string;
  borders?: Borders;
}

// ============================================================================
// Table Structures
// ============================================================================

/**
 * A single cell within a table element.
 * Supports merging (rowSpan/colSpan), data binding, and per-cell styling.
 */
export interface TableCell {
  id: string;
  rowSpan: number; // Number of rows this cell spans (1 = no vertical merge)
  colSpan: number; // Number of columns this cell spans (1 = no horizontal merge)
  content: string; // Static text content
  dataField?: string; // Binds cell value to a field from the data source
  expression?: string; // Expression evaluated at render time (overrides dataField)
  font?: FontConfig;
  backgroundColor?: string;
  borders?: Borders;
  padding?: Padding;
  horizontalAlign?: HorizontalAlign;
  verticalAlign?: VerticalAlign;
  diagonalLine?: boolean; // Draw a diagonal line across the cell (for split-header cells)
  diagonalText?: string; // Text rendered alongside the diagonal line
  mergeId?: string; // Groups cells that are part of the same merge region
  wordWrap?: boolean; // Whether long text wraps within the cell
  autoGrow?: boolean; // Whether the row height expands to fit content
  mask?: string; // Input/display mask pattern (e.g. "###-####")
  format?: string; // Value format string (e.g. "0.00", "yyyy-MM-dd")
}

/** Defines a column's width within a table. */
export interface TableColumn {
  id: string;
  width: number; // Column width in pixels
}

/** Defines a row's height and whether it is a header row. */
export interface TableRow {
  id: string;
  height: number; // Row height in pixels
  isHeader: boolean; // Header rows repeat on each page when repeatHeader is enabled
}

/** Complete table data structure: columns, rows, and a 2D grid of cells. */
export interface TableData {
  columns: TableColumn[];
  rows: TableRow[];
  cells: TableCell[][]; // cells[rowIndex][colIndex]
}

// ============================================================================
// Chart Data
// ============================================================================

/** Data model for chart elements, including series and categories. */
export interface ChartData {
  chartType: ChartType;
  title?: string; // Chart title displayed above the chart
  categories: string[]; // Labels on the category axis (x-axis for bar/line, slice labels for pie)
  series: { name: string; data: number[] }[]; // Each series has a name and data points
}

// ============================================================================
// Report Element Interfaces
// ============================================================================

/**
 * Base properties shared by all report elements.
 * Every element has a position (x, y), size (width, height), and metadata like name and zOrder.
 */
export interface BaseElement {
  id: string;
  type: ElementType;
  x: number; // Horizontal position relative to the band's left edge (in pixels or report units)
  y: number; // Vertical position relative to the band's top edge
  width: number;
  height: number;
  rotation: number; // Rotation angle in degrees
  locked: boolean; // When true, the element cannot be moved or resized in the designer
  visible: boolean; // When false, the element is hidden (not rendered)
  name: string; // Descriptive name for identification in the designer
  printOn?: BandType[]; // Restricts rendering to only the specified band types
  conditionalFormats?: ConditionalFormat[]; // Style overrides applied based on runtime conditions
  zOrder: number; // Stacking order; higher values are rendered on top
}

/** Text element for static labels or data-bound text fields. */
export interface TextElement extends BaseElement {
  type: "text";
  content: string; // Static text or template with placeholders
  dataField?: string; // Binds text to a field from the data source
  expression?: string; // Expression evaluated at render time (overrides content/dataField)
  font: FontConfig;
  backgroundColor: string;
  borders: Borders;
  padding: Padding;
  horizontalAlign: HorizontalAlign;
  verticalAlign: VerticalAlign;
  wordWrap: boolean; // Whether long text wraps within the element bounds
  autoSize: boolean; // When true, element height adjusts to fit content
}

/** Rectangle shape element with fill color, border, and rounded corners. */
export interface RectangleElement extends BaseElement {
  type: "rectangle";
  fillColor: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number; // Corner radius in pixels
  borders: Borders; // Per-edge border overrides (takes precedence over borderColor/borderWidth)
}

/** Line element that can be horizontal, vertical, or diagonal. */
export interface LineElement extends BaseElement {
  type: "line";
  direction: "horizontal" | "vertical" | "diagonal";
  color: string;
  lineWidth: number;
  style: BorderStyle;
}

/** Image element for static or data-bound images. */
export interface ImageElement extends BaseElement {
  type: "image";
  src: string; // URL or base64 data URI of the image
  dataField?: string; // Binds image source to a field from the data source
  objectFit: "contain" | "cover" | "fill"; // How the image scales within the element bounds
}

/** 1D barcode element supporting multiple encoding formats. */
export interface BarcodeElement extends BaseElement {
  type: "barcode";
  format: BarcodeFormat;
  value: string; // Static barcode value
  dataField?: string; // Binds barcode value to a field from the data source
  showText: boolean; // Whether to display the encoded value as text below the barcode
}

/** 2D QR code element with configurable error correction level. */
export interface QRCodeElement extends BaseElement {
  type: "qrcode";
  value: string; // Static QR code value
  dataField?: string; // Binds QR code value to a field from the data source
  errorLevel: "L" | "M" | "Q" | "H"; // Error correction level (L=7%, M=15%, Q=25%, H=30% recovery)
  size: number; // Module size (size of each QR code square in pixels)
}

/** Chart element that visualizes data using bar, line, pie, or area charts. */
export interface ChartElement extends BaseElement {
  type: "chart";
  chartData: ChartData;
  backgroundColor: string;
}

/** Table element for displaying data in a grid with rows, columns, and styled cells. */
export interface TableElement extends BaseElement {
  type: "table";
  tableData: TableData;
  dataField?: string; // Binds the entire table to a data source
  repeatHeader: boolean; // Whether header rows repeat on each page
}

/** Subreport element that embeds another report within the current report. */
export interface SubreportElement extends BaseElement {
  type: "subreport";
  reportId?: string; // Reference to a report by its ID
  reportPath?: string; // Reference to a report by its file path
  parameters?: Record<string, string>; // Key-value pairs passed to the subreport as parameters
}

/**
 * Cross-tabulation (pivot table) element that summarizes data by row and column fields.
 * Aggregates values using the specified function (sum, count, avg, min, max).
 */
export interface CrossTabElement extends BaseElement {
  type: "crosstab";
  rowField: string; // Data field used for row grouping
  columnField: string; // Data field used for column grouping
  valueField: string; // Data field whose values are aggregated
  valueFunction: "sum" | "count" | "avg" | "min" | "max"; // Aggregation function applied to valueField
}

/** Union type of all report element interfaces, discriminated by the `type` field. */
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

// ============================================================================
// Band Definition
// ============================================================================

/**
 * A band is a horizontal section of the report that controls when and how its elements are rendered.
 * Bands are rendered in order (reportHeader → pageHeader → groupHeader → data → groupFooter → pageFooter → reportFooter).
 * Each band contains element IDs and optional grouping/pagination/filtering rules.
 */
export interface Band {
  id: string;
  type: BandType;
  height: number; // Band height in pixels or report units
  backgroundColor: string;
  visible: boolean;
  elements: string[]; // Ordered list of element IDs contained in this band
  groupExpression?: string; // Expression that defines group breaks (only for groupHeader/groupFooter bands)
  newPageBefore?: boolean; // Force a page break before rendering this band
  newPageAfter?: boolean; // Force a page break after rendering this band
  repeatOnEveryPage?: boolean; // Repeat this band on every page (commonly used for group headers)
  printIf?: string; // Conditional expression; band is only rendered when it evaluates to true
  dataSourceId?: string; // ID of the data source that feeds this band (for data/group bands)
  sortExpressions?: string[]; // Sort criteria applied to the data before rendering
  filterExpression?: string; // Filter expression applied to the data rows
  keepTogether?: boolean; // When true, the band will not be split across pages
}

// ============================================================================
// Render Context
// ============================================================================

/**
 * Context object passed to elements during report rendering.
 * Provides access to the current page, data, and report parameters.
 */
export interface RenderContext {
  pageNumber: number; // Current page number (1-based)
  totalPages: number; // Total number of pages in the rendered report
  allData: Record<string, any>[]; // Complete dataset for the current data source
  groupData?: Record<string, any>[]; // Subset of data for the current group
  rowIndices?: number[]; // Indices of rows being rendered in the current data band iteration
  reportName?: string; // Name of the report being rendered
  parameters?: Record<string, any>; // User-supplied report parameters
}

// ============================================================================
// Data Source & Field Definitions
// ============================================================================

/**
 * A data source that feeds data into the report.
 * Supports three backend types: inline JSON, REST API, or database query.
 */
export interface DataSource {
  id: string;
  name: string;
  type: "json" | "api" | "database";
  data?: any[]; // Inline JSON data (used when type is "json")
  url?: string; // API endpoint URL (used when type is "api")
  method?: "GET" | "POST"; // HTTP method for API data sources
  headers?: Record<string, string>; // HTTP headers for API requests
  body?: string; // Request body for POST API calls
  connectionString?: string; // Database connection string (used when type is "database")
  query?: string; // SQL query string (used when type is "database")
  fields: DataField[]; // Schema describing the available fields from this data source
}

/** Describes a single field (column) available in a data source. */
export interface DataField {
  name: string;
  type: "string" | "number" | "boolean" | "date" | "object";
  path?: string; // Dot-notation path for accessing nested fields in JSON data (e.g. "address.city")
}

// ============================================================================
// Report Parameters
// ============================================================================

/**
 * A user-configurable parameter that can be supplied at render time.
 * Parameters can be used in expressions, data binding, and conditional formatting.
 */
export interface Parameter {
  id: string;
  name: string;
  type: "string" | "number" | "boolean" | "date";
  defaultValue?: any; // Default value used when no value is provided
  options?: any[]; // Available choices for dropdown-style parameter prompts
  prompt?: string; // Display label shown to the user when requesting parameter input
  required?: boolean; // Whether the parameter must be provided before rendering
}

// ============================================================================
// Page Settings
// ============================================================================

/** Page dimensions, orientation, margins, and multi-column layout configuration. */
export interface PageSettings {
  width: number; // Page width in pixels or report units
  height: number; // Page height in pixels or report units
  orientation: "portrait" | "landscape";
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  columns: number; // Number of columns on the page (for multi-column layouts like mailing labels)
  columnGap: number; // Spacing between columns
}

// ============================================================================
// Root Report Definition
// ============================================================================

/**
 * The root report definition. Contains all bands, elements, data sources,
 * parameters, styles, and configuration needed to design and render a report.
 */
export interface Report {
  id: string;
  name: string;
  version: string; // Report schema version for compatibility tracking
  pageSettings: PageSettings;
  bands: Band[]; // Ordered list of bands in the report
  elements: Record<string, ReportElement>; // All elements keyed by their ID
  dataSources: DataSource[]; // Available data sources for the report
  parameters: Parameter[]; // User-configurable parameters
  styles: ReportStyle[]; // Reusable named styles
  variables: Record<string, any>; // Report-level variables (runtime state, computed values)
  overlay?: OverlaySettings; // Optional background overlay (e.g. pre-printed form image)
}

/** Configuration for a background overlay image (e.g. pre-printed form). */
export interface OverlaySettings {
  enabled: boolean;
  src: string; // URL or data URI of the overlay image
  opacity: number; // Overlay opacity (0 = transparent, 1 = fully opaque)
  printOnly: boolean; // When true, overlay is shown only in the printed output, not in the designer
}

/** A reusable named style that can be applied to elements. */
export interface ReportStyle {
  id: string;
  name: string; // Display name shown in the style picker
  font?: FontConfig;
  backgroundColor?: string;
  borders?: Borders;
  padding?: Padding;
  horizontalAlign?: HorizontalAlign;
  verticalAlign?: VerticalAlign;
}

// ============================================================================
// Designer Support Types
// ============================================================================

/** A snap guide line used by the designer canvas for alignment assistance. */
export interface SnapGuide {
  type: "vertical" | "horizontal";
  position: number; // Position in pixels relative to the canvas origin
}

/** Axis-aligned rectangle used to represent element selections or drag regions in the designer. */
export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
