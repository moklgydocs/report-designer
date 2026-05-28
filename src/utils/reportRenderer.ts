/**
 * Production-Grade Report Rendering Pipeline
 *
 * Transforms a report template + data into paginated, rendered output.
 *
 * Pipeline stages:
 *   1. Data Resolution  - async fetch from JSON/API/DB via dataRegistry
 *   2. Sort & Filter    - apply sortExpressions and filterExpression
 *   3. Group Compute    - partition data by groupExpression
 *   4. Band Expansion   - expand repeating bands (data rows, group headers/footers)
 *   5. Conditional Eval - evaluate printIf on each band
 *   6. Page Pagination  - split into pages with pageHeader/pageFooter repetition
 *   7. Variable Compute - compute variables with access to page context
 *   8. Conditional Format - apply element-level conditional formatting
 */

import type {
  Report,
  Band,
  ReportElement,
  RenderContext,
  TextElement,
  TableElement,
} from "../types";
import { evaluateExpression } from "./elementFactory";
import { getDataSourceData } from "./dataRegistry";
import {
  createPurchaseOrderTemplate,
  createSalesInvoiceTemplate,
} from "./templates";

// ─── Public Types ────────────────────────────────────────────────

export interface RenderedBand {
  bandId: string;
  bandType: string;
  height: number;
  backgroundColor: string;
  elements: ReportElement[];
  dataRow?: Record<string, any>;
  renderContext: RenderContext;
  dataIndex?: number;
  groupKey?: string;
  isGroupBoundary?: boolean;
  /** If true, this band starts a new page */
  pageBreakBefore?: boolean;
  /** If true, this band ends with a new page */
  pageBreakAfter?: boolean;
  /** If true, this group header repeats on every page */
  repeatOnEveryPage?: boolean;
  /** If true, this band should stay on the same page as the next band */
  keepTogether?: boolean;
  /** Column index for multi-column layout (0-based) */
  columnIndex?: number;
}

export interface RenderedPage {
  bands: RenderedBand[];
  pageNumber: number;
  totalContentHeight: number;
}

export interface RenderedReport {
  pages: RenderedPage[];
  totalPages: number;
}

export interface DataGroup {
  key: string;
  startIndex: number;
  endIndex: number;
  rows: Record<string, any>[];
}

export interface CrossTabResult {
  rowHeaders: string[];
  columnHeaders: string[];
  values: (number | string)[][];
  rowTotals: (number | string)[];
  columnTotals: (number | string)[];
  grandTotal: number | string;
}

/** Progress callback for async rendering */
export type RenderProgressCallback = (
  stage: string,
  current: number,
  total: number,
) => void;

// ─── Stage 1: Data Resolution ─────────────────────────────────────

/**
 * Resolve data for a band from its bound data source.
 * Sync version for JSON sources; for API/DB use resolveBandDataAsync.
 */
export function resolveBandData(
  band: Band,
  report: Report,
): Record<string, any>[] {
  if (
    band.type !== "data" &&
    band.type !== "groupHeader" &&
    band.type !== "groupFooter"
  ) {
    return [];
  }
  const ds = band.dataSourceId
    ? report.dataSources.find((d) => d.id === band.dataSourceId)
    : report.dataSources[0];
  return ds?.data || [];
}

/**
 * Async version: resolves data via the data registry (supports API/DB fetch).
 */
export async function resolveBandDataAsync(
  band: Band,
  report: Report,
): Promise<Record<string, any>[]> {
  if (
    band.type !== "data" &&
    band.type !== "groupHeader" &&
    band.type !== "groupFooter"
  ) {
    return [];
  }
  const ds = band.dataSourceId
    ? report.dataSources.find((d) => d.id === band.dataSourceId)
    : report.dataSources[0];
  if (!ds) return [];

  // JSON type: data is inline
  if (ds.type === "json") return ds.data || [];

  // API / DB: use registry with cache
  return getDataSourceData(ds.id);
}

// ─── Stage 2: Sort & Filter ──────────────────────────────────────

/**
 * Apply sort expressions and filter to data rows.
 */
export function sortAndFilterData(
  data: Record<string, any>[],
  sortExpressions?: string[],
  filterExpression?: string,
): Record<string, any>[] {
  let result = data;

  // Apply filter
  if (filterExpression && result.length > 0) {
    result = result.filter((row) => {
      try {
        return !!evaluateExpression(filterExpression, row);
      } catch {
        return true;
      }
    });
  }

  // Apply sort
  if (sortExpressions && sortExpressions.length > 0) {
    result = [...result];
    for (const expr of sortExpressions.reverse()) {
      const desc = expr.startsWith("-");
      const field = desc ? expr.slice(1) : expr;
      result.sort((a, b) => {
        const va = a[field];
        const vb = b[field];
        if (va == null && vb == null) return 0;
        if (va == null) return 1;
        if (vb == null) return -1;
        const cmp = va < vb ? -1 : va > vb ? 1 : 0;
        return desc ? -cmp : cmp;
      });
    }
  }

  return result;
}

// ─── Stage 3: Group Compute ──────────────────────────────────────

export function computeGroups(
  data: Record<string, any>[],
  groupExpression?: string,
): DataGroup[] {
  if (!groupExpression || data.length === 0) {
    return [
      {
        key: "__all__",
        startIndex: 0,
        endIndex: data.length - 1,
        rows: data,
      },
    ];
  }

  const sorted = [...data];
  const groupField = groupExpression.replace(/^\{|\}$/g, "");

  sorted.sort((a, b) => {
    const va = a[groupField];
    const vb = b[groupField];
    if (va < vb) return -1;
    if (va > vb) return 1;
    return 0;
  });

  const groups: DataGroup[] = [];
  let currentKey: string | null = null;
  let currentStart = 0;

  for (let i = 0; i < sorted.length; i++) {
    const val = String(sorted[i][groupField] ?? "");
    if (currentKey === null || val !== currentKey) {
      if (currentKey !== null) {
        groups.push({
          key: currentKey,
          startIndex: currentStart,
          endIndex: i - 1,
          rows: sorted.slice(currentStart, i),
        });
      }
      currentKey = val;
      currentStart = i;
    }
  }

  if (currentKey !== null) {
    groups.push({
      key: currentKey,
      startIndex: currentStart,
      endIndex: sorted.length - 1,
      rows: sorted.slice(currentStart),
    });
  }

  return groups;
}

// ─── Stage 4: Aggregate ──────────────────────────────────────────

export function computeAggregate(
  func: "sum" | "count" | "avg" | "min" | "max",
  data: Record<string, any>[],
  field?: string,
): number {
  if (data.length === 0) return 0;

  if (func === "count") return data.length;
  if (!field) return 0;

  // Clean field parameter from possible brackets used in expressions e.g. "{price}"
  const cleanField = field.replace(/^\{|\}$/g, "");

  // Fallback to formulaEngine nesting getter
  const grabVal = (row: any) => {
    if (row == null) return 0;
    const direct = row[cleanField];
    if (direct !== undefined) return Number(direct) || 0;
    // Attempt lookup via deep path parser from formulaEngine
    const parts = cleanField.split(".");
    let curr = row;
    for (const part of parts) {
      if (curr == null) return 0;
      curr = curr[part.replace(/\[(\w+)\]/g, ".$1").replace(/^\./, "")];
    }
    return Number(curr) || 0;
  };

  const values = data.map(grabVal);

  switch (func) {
    case "sum":
      return values.reduce((acc, val) => acc + val, 0);
    case "avg": {
      const sum = values.reduce((acc, val) => acc + val, 0);
      return sum / values.length;
    }
    case "min":
      return Math.min(...values);
    case "max":
      return Math.max(...values);
    default:
      return 0;
  }
}

// ─── Stage 5: Conditional Band Visibility ────────────────────────

function shouldPrintBand(band: Band, dataRow?: Record<string, any>): boolean {
  if (!band.printIf) return true;
  try {
    return !!evaluateExpression(band.printIf, dataRow);
  } catch {
    return true;
  }
}

// ─── Stage 6: Band Expansion ─────────────────────────────────────

/**
 * Expand template bands into a flat list of rendered bands,
 * repeating data rows, group headers/footers, etc.
 */
function expandBands(
  report: Report,
  _globalData: Record<string, any>[],
  totalPages: number,
): RenderedBand[] {
  const allBands: RenderedBand[] = [];

  // Find template bands by type
  const titleBand = report.bands.find((b) => b.type === "title");
  const reportHeaderBand = report.bands.find((b) => b.type === "reportHeader");
  const reportFooterBand = report.bands.find((b) => b.type === "reportFooter");
  const dataBand = report.bands.find((b) => b.type === "data");
  const groupHeaderBands = report.bands.filter((b) => b.type === "groupHeader");
  const groupFooterBands = report.bands.filter((b) => b.type === "groupFooter");

  // Resolve data rows
  const dataRows = dataBand
    ? sortAndFilterData(
        resolveBandData(dataBand, report),
        dataBand.sortExpressions,
        dataBand.filterExpression,
      )
    : [];

  const makeContext = (
    pn: number,
    extra?: Partial<RenderContext>,
  ): RenderContext => ({
    pageNumber: pn,
    totalPages,
    allData: dataRows,
    reportName: report.name,
    ...extra,
  });

  const resolveElements = (band: Band): ReportElement[] =>
    (band.elements || []).map((eid) => report.elements[eid]).filter(Boolean);

  const computeBandHeight = (band: Band): number => {
    const els = resolveElements(band);
    let maxBottom = 0;
    for (const el of els) {
      const bottom = el.y + el.height;
      if (bottom > maxBottom) maxBottom = bottom;
    }
    return Math.max(20, maxBottom);
  };

  // ── Title ──
  if (titleBand && titleBand.visible && shouldPrintBand(titleBand)) {
    const titleElements = resolveElements(titleBand);
    if (titleElements.length > 0) {
      allBands.push({
        bandId: titleBand.id,
        bandType: "title",
        height: titleBand.height,
        backgroundColor: titleBand.backgroundColor,
        elements: titleElements,
        renderContext: makeContext(1),
        pageBreakBefore: titleBand.newPageBefore,
        pageBreakAfter: titleBand.newPageAfter,
        keepTogether: titleBand.keepTogether,
      });
    }
  }

  // ── Report Header ──
  if (
    reportHeaderBand &&
    reportHeaderBand.visible &&
    shouldPrintBand(reportHeaderBand)
  ) {
    const rhElements = resolveElements(reportHeaderBand);
    if (rhElements.length > 0) {
      allBands.push({
        bandId: reportHeaderBand.id,
        bandType: "reportHeader",
        height: reportHeaderBand.height,
        backgroundColor: reportHeaderBand.backgroundColor,
        elements: rhElements,
        renderContext: makeContext(1),
        pageBreakBefore: reportHeaderBand.newPageBefore,
        pageBreakAfter: reportHeaderBand.newPageAfter,
        keepTogether: reportHeaderBand.keepTogether,
      });
    }
  }

  // ── Data Region (group headers + data rows + group footers) ──
  // Skip entire data region when there are no data rows
  if (dataRows.length > 0) {
    // Compute groups from all groupHeader bands
    // Use the first groupHeader's groupExpression as primary grouping
    const primaryGroupExpr = groupHeaderBands[0]?.groupExpression;
    const groups = primaryGroupExpr
      ? computeGroups(dataRows, primaryGroupExpr)
      : [
          {
            key: "__all__",
            startIndex: 0,
            endIndex: dataRows.length - 1,
            rows: dataRows,
          },
        ];

    for (const group of groups) {
      // Group headers
      for (const ghBand of groupHeaderBands) {
        if (!ghBand.visible || !shouldPrintBand(ghBand, group.rows[0]))
          continue;
        // Skip group headers with no elements
        const ghElements = resolveElements(ghBand);
        if (ghElements.length === 0) continue;

        // If this groupHeader has its own groupExpression, compute sub-groups
        if (
          ghBand.groupExpression &&
          ghBand.groupExpression !== primaryGroupExpr
        ) {
          const subGroups = computeGroups(group.rows, ghBand.groupExpression);
          for (const sg of subGroups) {
            allBands.push({
              bandId: ghBand.id,
              bandType: "groupHeader",
              height: ghBand.height,
              backgroundColor: ghBand.backgroundColor,
              elements: ghElements,
              dataRow: sg.rows[0],
              groupKey: sg.key,
              isGroupBoundary: true,
              renderContext: makeContext(1, {
                groupData: sg.rows,
                rowIndices: [sg.startIndex, sg.endIndex],
              }),
              pageBreakBefore: ghBand.newPageBefore,
              pageBreakAfter: ghBand.newPageAfter,
              repeatOnEveryPage: ghBand.repeatOnEveryPage,
              keepTogether: ghBand.keepTogether,
            });
          }
        } else {
          allBands.push({
            bandId: ghBand.id,
            bandType: "groupHeader",
            height: ghBand.height,
            backgroundColor: ghBand.backgroundColor,
            elements: ghElements,
            dataRow: group.rows[0],
            groupKey: group.key,
            isGroupBoundary: true,
            renderContext: makeContext(1, {
              groupData: group.rows,
              rowIndices: [group.startIndex, group.endIndex],
            }),
            pageBreakBefore: ghBand.newPageBefore,
            pageBreakAfter: ghBand.newPageAfter,
            repeatOnEveryPage: ghBand.repeatOnEveryPage,
            keepTogether: ghBand.keepTogether,
          });
        }
      }

      // Data rows
      if (dataBand && dataBand.visible) {
        for (let i = 0; i < group.rows.length; i++) {
          if (!shouldPrintBand(dataBand, group.rows[i])) continue;
          allBands.push({
            bandId: dataBand.id,
            bandType: "data",
            height: Math.max(dataBand.height, computeBandHeight(dataBand)),
            backgroundColor: dataBand.backgroundColor,
            elements: resolveElements(dataBand),
            dataRow: { ...group.rows[i], __rowIndex: group.startIndex + i },
            dataIndex: group.startIndex + i,
            renderContext: makeContext(1),
            pageBreakBefore: dataBand.newPageBefore,
            pageBreakAfter: dataBand.newPageAfter,
            keepTogether: dataBand.keepTogether,
          });
        }
      }

      // Group footers
      for (const gfBand of groupFooterBands) {
        if (
          !gfBand.visible ||
          !shouldPrintBand(gfBand, group.rows[group.rows.length - 1])
        )
          continue;
        // Skip group footers with no elements
        const gfElements = resolveElements(gfBand);
        if (gfElements.length === 0) continue;
        allBands.push({
          bandId: gfBand.id,
          bandType: "groupFooter",
          height: gfBand.height,
          backgroundColor: gfBand.backgroundColor,
          elements: gfElements,
          dataRow: group.rows[group.rows.length - 1],
          groupKey: group.key,
          isGroupBoundary: true,
          renderContext: makeContext(1, {
            groupData: group.rows,
            rowIndices: [group.startIndex, group.endIndex],
          }),
          pageBreakBefore: gfBand.newPageBefore,
          pageBreakAfter: gfBand.newPageAfter,
          keepTogether: gfBand.keepTogether,
        });
      }
    }
  }

  // ── Report Footer ──
  if (
    reportFooterBand &&
    reportFooterBand.visible &&
    shouldPrintBand(reportFooterBand)
  ) {
    const rfElements = resolveElements(reportFooterBand);
    if (rfElements.length > 0) {
      allBands.push({
        bandId: reportFooterBand.id,
        bandType: "reportFooter",
        height: reportFooterBand.height,
        backgroundColor: reportFooterBand.backgroundColor,
        elements: rfElements,
        dataRow:
          dataRows.length > 0 ? dataRows[dataRows.length - 1] : undefined,
        renderContext: makeContext(1, { allData: dataRows }),
        pageBreakBefore: reportFooterBand.newPageBefore,
        pageBreakAfter: reportFooterBand.newPageAfter,
        keepTogether: reportFooterBand.keepTogether,
      });
    }
  }

  const laidOutBands = allBands.map((rb) => {
    const layout = layoutBandElements(
      rb.elements,
      rb.dataRow,
      rb.renderContext,
    );
    return {
      ...rb,
      elements: layout.elements,
      height: Math.max(rb.height, layout.height),
    };
  });

  return laidOutBands;
}

// ─── Stage 7: Page Pagination ─────────────────────────────────────

/**
 * Paginate expanded bands into pages, inserting pageHeader/pageFooter
 * on each page, handling newPageBefore/After and keepTogether.
 */
function paginateBands(
  expandedBands: RenderedBand[],
  report: Report,
): RenderedPage[] {
  const { height, marginTop, marginBottom } = report.pageSettings;
  const contentHeight = height - marginTop - marginBottom;

  const pageHeaderBand = report.bands.find((b) => b.type === "pageHeader");
  const pageFooterBand = report.bands.find((b) => b.type === "pageFooter");

  const pageHeaderHeight =
    pageHeaderBand?.visible && shouldPrintBand(pageHeaderBand)
      ? pageHeaderBand.height
      : 0;
  const pageFooterHeight =
    pageFooterBand?.visible && shouldPrintBand(pageFooterBand)
      ? pageFooterBand.height
      : 0;

  const resolveElements = (band: Band): ReportElement[] =>
    (band.elements || []).map((eid) => report.elements[eid]).filter(Boolean);

  const makePageHeaderBand = (
    pn: number,
    totalPages: number,
  ): RenderedBand | null => {
    if (!pageHeaderBand?.visible || !shouldPrintBand(pageHeaderBand))
      return null;
    const resolved = resolveElements(pageHeaderBand);
    const ctx = {
      pageNumber: pn,
      totalPages,
      allData: [],
      reportName: report.name,
    };
    const layout = layoutBandElements(resolved, undefined, ctx);
    return {
      bandId: pageHeaderBand.id,
      bandType: "pageHeader",
      height: Math.max(pageHeaderBand.height, layout.height),
      backgroundColor: pageHeaderBand.backgroundColor,
      elements: layout.elements,
      renderContext: ctx,
    };
  };

  const makePageFooterBand = (
    pn: number,
    totalPages: number,
  ): RenderedBand | null => {
    if (!pageFooterBand?.visible || !shouldPrintBand(pageFooterBand))
      return null;
    const resolved = resolveElements(pageFooterBand);
    const ctx = {
      pageNumber: pn,
      totalPages,
      allData: [],
      reportName: report.name,
    };
    const layout = layoutBandElements(resolved, undefined, ctx);
    return {
      bandId: pageFooterBand.id,
      bandType: "pageFooter",
      height: Math.max(pageFooterBand.height, layout.height),
      backgroundColor: pageFooterBand.backgroundColor,
      elements: layout.elements,
      renderContext: ctx,
    };
  };

  const pages: RenderedPage[] = [];
  let currentPageBands: RenderedBand[] = [];
  let currentPageHeight = 0;
  let currentPageNum = 1;
  let activeGroupHeaders: RenderedBand[] = [];

  const startNewPage = (currentBand?: RenderedBand) => {
    if (currentPageBands.length > 0) {
      // Add page footer to current page
      const pf = makePageFooterBand(currentPageNum, 0);
      if (pf) {
        currentPageBands.push(pf);
        currentPageHeight += pf.height;
      }

      // Compute pageData rows for this page
      const pageDataRows = currentPageBands
        .filter((b) => b.bandType === "data" && b.dataRow)
        .map((b) => b.dataRow!);

      // Inject pageData into every band's renderContext on this page
      for (const b of currentPageBands) {
        (b.renderContext as any).pageData = pageDataRows;
      }

      pages.push({
        bands: currentPageBands,
        pageNumber: currentPageNum,
        totalContentHeight: currentPageHeight,
      });
    }
    currentPageNum++;
    currentPageBands = [];
    currentPageHeight = 0;

    // Add page header to new page
    const ph = makePageHeaderBand(currentPageNum, 0);
    if (ph) {
      currentPageBands.push(ph);
      currentPageHeight += ph.height;
    }

    // Repeat active group headers that have repeatOnEveryPage flag set (excluding the initiating band itself)
    for (const gh of activeGroupHeaders) {
      if (gh.repeatOnEveryPage && gh.bandId !== currentBand?.bandId) {
        const ghClone: RenderedBand = {
          ...gh,
          renderContext: {
            ...gh.renderContext,
            pageNumber: currentPageNum,
          },
        };
        currentPageBands.push(ghClone);
        currentPageHeight += ghClone.height;
      }
    }
  };

  // Initialize first page — do NOT add pageHeader upfront; title band should come first
  let firstPageHeaderAdded = false;

  const usableHeight = contentHeight - pageHeaderHeight - pageFooterHeight;

  for (let i = 0; i < expandedBands.length; i++) {
    const band = expandedBands[i];
    const bandHeight = band.height;

    // Manage activeGroupHeaders stack
    if (band.bandType === "groupHeader") {
      activeGroupHeaders = activeGroupHeaders.filter(
        (gh) => gh.bandId !== band.bandId,
      );
      activeGroupHeaders.push(band);
    } else if (band.bandType === "groupFooter") {
      activeGroupHeaders = activeGroupHeaders.filter(
        (gh) => gh.groupKey !== band.groupKey,
      );
    }

    // Handle pageBreakBefore
    if (band.pageBreakBefore && currentPageBands.length > 0) {
      startNewPage(band);
    }

    // Check if band fits on current page
    const effectiveHeaderH = firstPageHeaderAdded ? 0 : pageHeaderHeight;
    const remainingSpace =
      contentHeight - currentPageHeight - effectiveHeaderH - pageFooterHeight;

    if (bandHeight > remainingSpace && currentPageBands.length > 0) {
      startNewPage(band);
    }

    // On the first page, insert pageHeader after the title band
    if (!firstPageHeaderAdded && band.bandType === "title") {
      band.renderContext = {
        ...band.renderContext,
        pageNumber: currentPageNum,
      };
      currentPageBands.push(band);
      currentPageHeight += bandHeight;
      // Insert pageHeader after title
      const ph = makePageHeaderBand(currentPageNum, 0);
      if (ph) {
        currentPageBands.push(ph);
        currentPageHeight += ph.height;
      }
      firstPageHeaderAdded = true;
      if (band.pageBreakAfter && i + 1 < expandedBands.length) {
        startNewPage(band);
      }
      continue;
    }

    // If no title band on first page, add pageHeader before first content band
    if (!firstPageHeaderAdded) {
      const ph = makePageHeaderBand(currentPageNum, 0);
      if (ph) {
        currentPageBands.push(ph);
        currentPageHeight += ph.height;
      }
      firstPageHeaderAdded = true;
    }

    // Update render context with correct page number
    band.renderContext = {
      ...band.renderContext,
      pageNumber: currentPageNum,
    };

    currentPageBands.push(band);
    currentPageHeight += bandHeight;

    // Handle keepTogether: if this band and the next should stay together
    if (band.keepTogether && i + 1 < expandedBands.length) {
      const nextBand = expandedBands[i + 1];
      const nextFits =
        currentPageHeight - pageHeaderHeight + nextBand.height <= usableHeight;
      if (!nextFits) {
        // Move current band to next page so it stays with the next
        currentPageBands.pop();
        currentPageHeight -= bandHeight;
        startNewPage(band);
        band.renderContext.pageNumber = currentPageNum;
        currentPageBands.push(band);
        currentPageHeight += bandHeight;
      }
    }

    // Handle pageBreakAfter
    if (band.pageBreakAfter && i + 1 < expandedBands.length) {
      startNewPage(band);
    }
  }

  // Close last page
  if (currentPageBands.length > 0) {
    const pf = makePageFooterBand(currentPageNum, 0);
    if (pf) {
      currentPageBands.push(pf);
      currentPageHeight += pf.height;
    }

    const pageDataRows = currentPageBands
      .filter((b) => b.bandType === "data" && b.dataRow)
      .map((b) => b.dataRow!);

    for (const b of currentPageBands) {
      (b.renderContext as any).pageData = pageDataRows;
    }

    pages.push({
      bands: currentPageBands,
      pageNumber: currentPageNum,
      totalContentHeight: currentPageHeight,
    });
  }

  // Update totalPages in all render contexts
  const totalPages = pages.length;
  for (const page of pages) {
    for (const band of page.bands) {
      band.renderContext.totalPages = totalPages;
    }
  }

  return pages;
}

// ─── Stage 8: Variable Computation ────────────────────────────────

/**
 * Compute report variables for each page context.
 * Variables can reference =PageNumber, =TotalPages, =Now(), aggregates, etc.
 */
function computeVariables(report: Report, pages: RenderedPage[]): void {
  if (!report.variables || Object.keys(report.variables).length === 0) return;

  for (const page of pages) {
    for (const band of page.bands) {
      if (!band.dataRow) continue;
      for (const [key, expr] of Object.entries(report.variables)) {
        if (typeof expr === "string" && expr.startsWith("=")) {
          try {
            band.dataRow[key] = evaluateExpression(
              expr,
              band.dataRow,
              band.renderContext,
            );
          } catch {
            // keep original value
          }
        }
      }
    }
  }
}

// ─── Conditional Formatting ────────────────────────────────────────

export function applyConditionalFormatting(
  element: ReportElement,
  dataRow?: Record<string, any>,
  _allData?: Record<string, any>[],
): React.CSSProperties {
  if (!element.conditionalFormats || !dataRow) return {};

  const overrides: React.CSSProperties = {};

  for (const cf of element.conditionalFormats) {
    if (!cf.condition) continue;
    try {
      const result = evaluateExpression(cf.condition, dataRow, {
        pageNumber: 1,
        totalPages: 1,
      });
      if (result) {
        if (cf.backgroundColor) overrides.backgroundColor = cf.backgroundColor;
        if (cf.font?.color) overrides.color = cf.font.color;
        if (cf.font?.bold) overrides.fontWeight = "bold";
        if (cf.font?.italic) overrides.fontStyle = "italic";
        if (cf.font?.underline) overrides.textDecoration = "underline";
      }
    } catch {
      // skip
    }
  }

  return overrides;
}

// ─── CrossTab Computation ─────────────────────────────────────────

export function computeCrossTab(
  data: Record<string, any>[],
  rowField: string,
  columnField: string,
  valueField: string,
  valueFunction: "sum" | "count" | "avg" | "min" | "max",
): CrossTabResult {
  const rowSet = new Set<string>();
  const colSet = new Set<string>();

  for (const row of data) {
    rowSet.add(String(row[rowField] ?? ""));
    colSet.add(String(row[columnField] ?? ""));
  }

  const rowHeaders = Array.from(rowSet).sort();
  const columnHeaders = Array.from(colSet).sort();

  const cellMap = new Map<string, number[]>();
  for (const row of data) {
    const rv = String(row[rowField] ?? "");
    const cv = String(row[columnField] ?? "");
    const key = `${rv}|${cv}`;
    const val = Number(row[valueField]) || 0;
    if (!cellMap.has(key)) cellMap.set(key, []);
    cellMap.get(key)!.push(val);
  }

  const values: (number | string)[][] = [];
  const rowTotals: (number | string)[] = [];
  const columnTotals: (number | string)[] = [];
  let grandTotal = 0;

  for (const rh of rowHeaders) {
    const rowData: (number | string)[] = [];
    let rowTotal = 0;
    for (const ch of columnHeaders) {
      const key = `${rh}|${ch}`;
      const cellValues = cellMap.get(key) || [];
      const result = computeAggregate(
        valueFunction,
        cellValues.map((v) => ({ [valueField]: v })),
        valueField,
      );
      rowData.push(result);
      rowTotal += typeof result === "number" ? result : 0;
    }
    values.push(rowData);
    rowTotals.push(rowTotal);
    grandTotal += rowTotal;
  }

  for (let ci = 0; ci < columnHeaders.length; ci++) {
    let colTotal = 0;
    for (let ri = 0; ri < rowHeaders.length; ri++) {
      colTotal +=
        typeof values[ri][ci] === "number" ? (values[ri][ci] as number) : 0;
    }
    columnTotals.push(colTotal);
  }

  return {
    rowHeaders,
    columnHeaders,
    values,
    rowTotals,
    columnTotals,
    grandTotal,
  };
}

// ─── Main Pipeline Entry Points ───────────────────────────────────

/**
 * Synchronous render: JSON data sources only.
 * Returns expanded bands (no pagination). Used for inline preview.
 */
export function renderReport(report: Report): RenderedBand[] {
  const dataBand = report.bands.find((b) => b.type === "data");
  const globalData = dataBand
    ? sortAndFilterData(
        resolveBandData(dataBand, report),
        dataBand.sortExpressions,
        dataBand.filterExpression,
      )
    : report.dataSources[0]?.data || [];

  return expandBands(report, globalData, 1);
}

/**
 * Paginated sync render: returns full RenderedReport with pages.
 */
export function renderReportPaginated(report: Report): RenderedReport {
  const dataBand = report.bands.find((b) => b.type === "data");
  const globalData = dataBand
    ? sortAndFilterData(
        resolveBandData(dataBand, report),
        dataBand.sortExpressions,
        dataBand.filterExpression,
      )
    : report.dataSources[0]?.data || [];

  const expanded = expandBands(report, globalData, 1);
  const pages = paginateBands(expanded, report);
  computeVariables(report, pages);

  return { pages, totalPages: pages.length };
}

/**
 * Async pipeline: resolves data from API/DB sources, then renders.
 * Calls onProgress at each stage for UI feedback.
 */
export async function renderReportAsync(
  report: Report,
  onProgress?: RenderProgressCallback,
): Promise<RenderedReport> {
  const notify = (stage: string, current: number, total: number) =>
    onProgress?.(stage, current, total);

  // Stage 1: Resolve data
  notify("resolving", 0, report.dataSources.length);
  const resolvedSources: Record<string, Record<string, any>[]> = {};

  for (let i = 0; i < report.dataSources.length; i++) {
    const ds = report.dataSources[i];
    resolvedSources[ds.id] = await getDataSourceData(ds.id);
    // Patch the report's data source with resolved data for sync calls
    ds.data = resolvedSources[ds.id];
    notify("resolving", i + 1, report.dataSources.length);
  }

  // Stage 2-6: Sync render pipeline
  notify("rendering", 0, 1);
  const result = renderReportPaginated(report);
  notify("rendering", 1, 1);

  return result;
}

/**
 * Progressive (chunked) render for very large datasets.
 * Yields pages as they're computed so the UI can display incrementally.
 */
export async function* renderReportProgressive(
  report: Report,
  chunkSize: number = 100,
): AsyncGenerator<RenderedPage, void, unknown> {
  const dataBand = report.bands.find((b) => b.type === "data");
  if (!dataBand) return;

  // Resolve data
  const allData = sortAndFilterData(
    await resolveBandDataAsync(dataBand, report),
    dataBand.sortExpressions,
    dataBand.filterExpression,
  );

  if (allData.length === 0) return;

  // Process data in chunks
  const totalChunks = Math.ceil(allData.length / chunkSize);

  for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
    const start = chunkIdx * chunkSize;
    const end = Math.min(start + chunkSize, allData.length);
    const chunkData = allData.slice(start, end);

    // Create a partial report with just this chunk
    const partialReport: Report = {
      ...report,
      dataSources: report.dataSources.map((ds) =>
        ds.id === (dataBand.dataSourceId || report.dataSources[0]?.id)
          ? { ...ds, data: chunkData }
          : ds,
      ),
    };

    const partialResult = renderReportPaginated(partialReport);

    // Adjust page numbers to be global
    const pageOffset = chunkIdx * 1000; // rough estimate, will be refined
    for (const page of partialResult.pages) {
      page.pageNumber += pageOffset;
      for (const band of page.bands) {
        band.renderContext.pageNumber += pageOffset;
      }
      yield page;
    }
  }
}

export function measureTextHeight(
  text: string,
  width: number,
  fontSize: number,
  _fontFamily: string = "helvetica",
  _bold: boolean = false,
  wordWrap: boolean = true,
): number {
  if (!text) return fontSize * 1.3;
  if (!wordWrap) {
    return fontSize * 1.3;
  }

  let lineCount = 1;
  let currentLineWidth = 0;
  const padding = 6;
  const maxW = Math.max(10, width - padding);

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === "\n") {
      lineCount++;
      currentLineWidth = 0;
      continue;
    }

    const charWidth = char.charCodeAt(0) > 255 ? fontSize : fontSize * 0.55;

    if (currentLineWidth + charWidth > maxW) {
      lineCount++;
      currentLineWidth = charWidth;
    } else {
      currentLineWidth += charWidth;
    }
  }

  return Math.ceil(lineCount * fontSize * 1.35) + 4;
}

export function layoutBandElements(
  elements: ReportElement[],
  dataRow: Record<string, any> | undefined,
  renderContext: RenderContext,
): { elements: ReportElement[]; height: number } {
  const cloned = elements.map(
    (el) => JSON.parse(JSON.stringify(el)) as ReportElement,
  );

  const layoutItems = cloned.map((el) => ({
    el,
    originalY: el.y,
    originalHeight: el.height,
  }));

  layoutItems.sort((a, b) => a.originalY - b.originalY);

  for (let i = 0; i < layoutItems.length; i++) {
    const item = layoutItems[i];
    const { el } = item;

    if (el.type === "text") {
      const textEl = el as TextElement;
      const rawValue = evaluateExpression(
        textEl.expression || textEl.content || textEl.dataField || "",
        dataRow,
        renderContext,
      );
      const displayVal = String(
        rawValue !== undefined && rawValue !== null ? rawValue : "",
      );
      textEl.content = displayVal;

      if (textEl.autoSize) {
        const realH = measureTextHeight(
          displayVal,
          textEl.width,
          textEl.font?.size || 11,
          textEl.font?.family,
          textEl.font?.bold,
          textEl.wordWrap,
        );
        if (realH > item.originalHeight) {
          el.height = realH;
        }
      }
    } else if (el.type === "table") {
      const tableEl = el as TableElement;
      const { tableData } = tableEl;
      let totalHeightIncr = 0;

      for (let ri = 0; ri < tableData.rows.length; ri++) {
        const row = tableData.rows[ri];
        let maxRowGrewH = row.height;

        for (let ci = 0; ci < tableData.columns.length; ci++) {
          const cell = tableData.cells[ri]?.[ci];
          if (cell && cell.autoGrow) {
            const rawValue = evaluateExpression(
              cell.expression || cell.content || cell.dataField || "",
              dataRow,
              renderContext,
            );
            const displayVal = String(
              rawValue !== undefined && rawValue !== null ? rawValue : "",
            );
            const cellW = tableData.columns[ci]?.width || 120;
            const realH = measureTextHeight(
              displayVal,
              cellW,
              cell.font?.size || 11,
              cell.font?.family,
              cell.font?.bold,
              cell.wordWrap !== false,
            );
            if (realH > maxRowGrewH) {
              maxRowGrewH = realH;
            }
          }
        }

        if (maxRowGrewH > row.height) {
          totalHeightIncr += maxRowGrewH - row.height;
          row.height = maxRowGrewH;
        }
      }

      if (totalHeightIncr > 0) {
        el.height = item.originalHeight + totalHeightIncr;
      }
    } else if (el.type === "subreport") {
      const subEl = el as any;
      const subReportId = subEl.reportId;

      const subreportTemplate = getSubreportTemplate(subReportId);

      const subParams: Record<string, any> = {};
      if (subEl.parameters) {
        for (const [key, expr] of Object.entries(subEl.parameters)) {
          try {
            subParams[key] = evaluateExpression(
              expr as string,
              dataRow,
              renderContext,
            );
          } catch {
            subParams[key] = expr;
          }
        }
      }

      const subContext: RenderContext = {
        pageNumber: 1,
        totalPages: 1,
        allData: subreportTemplate.dataSources[0]?.data || [],
        parameters: subParams,
        reportName: subreportTemplate.name,
      };

      const subBands = expandBands(subreportTemplate, subContext.allData, 1);

      const subLaidOutBands = subBands.map((srb) => {
        srb.renderContext.parameters = subParams;
        const layout = layoutBandElements(
          srb.elements,
          srb.dataRow,
          srb.renderContext,
        );
        return {
          ...srb,
          elements: layout.elements,
          height: Math.max(srb.height, layout.height),
        };
      });

      let subYOffset = 0;
      const embeddedElements: ReportElement[] = [];

      for (const srb of subLaidOutBands) {
        for (const child of srb.elements) {
          const childClone = JSON.parse(JSON.stringify(child)) as ReportElement;
          childClone.x = el.x + childClone.x;
          childClone.y = el.y + subYOffset + childClone.y;
          childClone.id = `${el.id}_sub_${childClone.id}`;
          embeddedElements.push(childClone);
        }
        subYOffset += srb.height;
      }

      if (subYOffset > 0) {
        el.height = subYOffset;
      }

      (item as any).embedded = embeddedElements;
    }

    const delta = el.height - item.originalHeight;
    if (delta > 0) {
      const originalBottom = item.originalY + item.originalHeight;
      for (let j = 0; j < layoutItems.length; j++) {
        if (j === i) continue;
        const other = layoutItems[j];
        if (other.originalY >= originalBottom - 2) {
          other.el.y += delta;
          other.originalY += delta;
        }
      }
    }
  }

  let maxBottom = 0;
  for (const item of layoutItems) {
    const bottom = item.el.y + item.el.height;
    if (bottom > maxBottom) maxBottom = bottom;
  }

  const finalElements: ReportElement[] = [];
  for (const item of layoutItems) {
    finalElements.push(item.el);
    if ((item as any).embedded) {
      finalElements.push(...(item as any).embedded);
    }
  }

  return {
    elements: finalElements,
    height: Math.max(20, maxBottom),
  };
}

export function getSubreportTemplate(reportId: string | undefined): Report {
  if (reportId === "purchase_order") {
    return createPurchaseOrderTemplate();
  }
  if (reportId === "sales_invoice") {
    return createSalesInvoiceTemplate();
  }

  return {
    id: "sub_test",
    name: "Subreport",
    version: "1.0.0",
    pageSettings: {
      width: 500,
      height: 300,
      orientation: "portrait",
      marginTop: 20,
      marginBottom: 20,
      marginLeft: 20,
      marginRight: 20,
      columns: 1,
      columnGap: 0,
    },
    bands: [
      {
        id: "sub_header",
        type: "reportHeader",
        height: 25,
        backgroundColor: "transparent",
        visible: true,
        elements: ["sub_txt_title"],
      },
      {
        id: "sub_data",
        type: "data",
        height: 20,
        backgroundColor: "transparent",
        visible: true,
        elements: ["sub_txt_val"],
      },
    ],
    elements: {
      sub_txt_title: {
        id: "sub_txt_title",
        type: "text",
        x: 0,
        y: 0,
        width: 200,
        height: 18,
        name: "SubTitle",
        content: "--- Subreport Header ---",
        font: {
          family: "helvetica",
          size: 9,
          bold: true,
          italic: true,
          underline: false,
          color: "#1e3a8a",
        },
        backgroundColor: "transparent",
        borders: {},
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        horizontalAlign: "left",
        verticalAlign: "middle",
      } as any,
      sub_txt_val: {
        id: "sub_txt_val",
        type: "text",
        x: 10,
        y: 0,
        width: 200,
        height: 18,
        name: "SubValue",
        content: "Param: [SubParam]",
        font: {
          family: "helvetica",
          size: 9,
          bold: false,
          italic: false,
          underline: false,
          color: "#334155",
        },
        backgroundColor: "transparent",
        borders: {},
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        horizontalAlign: "left",
        verticalAlign: "middle",
      } as any,
    },
    dataSources: [
      {
        id: "sub_ds",
        name: "sub_ds",
        type: "json",
        data: [{}],
        fields: [],
      },
    ],
    parameters: [{ id: "p1", name: "SubParam", type: "string" }],
    styles: [],
    variables: {},
  };
}
