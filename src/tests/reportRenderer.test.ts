import { describe, test, expect } from "vitest";
import { renderReportPaginated } from "../utils/reportRenderer";
import type { Report, Band, ReportElement } from "../types";

describe("Layout Pagination VM", () => {
  // Helper to create a basic report template
  const createBaseReport = (options: {
    contentHeight: number;
    bands: Partial<Band>[];
    elements?: Record<string, ReportElement>;
  }): Report => {
    const elements: Record<string, ReportElement> = {
      ...(options.elements || {}),
    };
    const bands = options.bands.map((b, idx) => {
      const bid = b.id || `b_${idx}`;
      const eids = [...(b.elements || [])];

      // Ensure the band is not skipped due to empty elements (except page header/footer)
      if (
        b.type !== "data" &&
        b.type !== "pageHeader" &&
        b.type !== "pageFooter" &&
        eids.length === 0
      ) {
        const dummyId = `dummy_${bid}`;
        elements[dummyId] = {
          id: dummyId,
          type: "text",
          x: 0,
          y: 0,
          width: 10,
          height: 10,
        } as any;
        eids.push(dummyId);
      }

      return {
        id: bid,
        type: b.type || "data",
        height: b.height || 40,
        backgroundColor: b.backgroundColor || "transparent",
        visible: b.visible !== false,
        elements: eids,
        ...b,
      };
    });

    return {
      id: "r1",
      name: "Test Report",
      version: "1.0.0",
      pageSettings: {
        width: 800,
        height: options.contentHeight + 100, // Content height + top/bottom margins of 50 each
        orientation: "portrait",
        marginTop: 50,
        marginBottom: 50,
        marginLeft: 50,
        marginRight: 50,
        columns: 1,
        columnGap: 10,
      },
      bands,
      elements,
      dataSources: [
        {
          id: "ds1",
          name: "Inline Data",
          type: "json",
          data: [
            { category: "A", value: 10 },
            { category: "A", value: 20 },
            { category: "B", value: 30 },
          ],
          fields: [],
        },
      ],
      parameters: [],
      styles: [],
      variables: {},
    };
  };

  test("Page overflow and pagination", () => {
    const report = createBaseReport({
      contentHeight: 200, // Total printable height is 200
      bands: [
        { type: "pageHeader", height: 20 },
        { type: "pageFooter", height: 20 },
        { type: "data", height: 60 }, // Details height = 60. Usable content area = 200 - 20 (Header) - 20 (Footer) = 160.
      ],
    });

    const rendered = renderReportPaginated(report);
    // There are 3 data rows in 'ds1'.
    // Row 1 (height 60) fits in 160 (remaining: 100).
    // Row 2 (height 60) fits in 100 (remaining: 40).
    // Row 3 (height 60) exceeds 40, so it pushes to Page 2!
    // Page 1 should contain: PageHeader, Row 1, Row 2, PageFooter.
    // Page 2 should contain: PageHeader, Row 3, PageFooter.
    expect(rendered.pages.length).toBe(2);
    expect(rendered.pages[0].bands.map((b) => b.bandType)).toEqual([
      "pageHeader",
      "data",
      "data",
      "pageFooter",
    ]);
    expect(rendered.pages[1].bands.map((b) => b.bandType)).toEqual([
      "pageHeader",
      "data",
      "pageFooter",
    ]);
  });

  test("pageBreakBefore starts a new page", () => {
    const report = createBaseReport({
      contentHeight: 300,
      bands: [
        { type: "pageHeader", height: 20 },
        { type: "pageFooter", height: 20 },
        { type: "data", height: 40, newPageBefore: true }, // Every data row starts a new page!
      ],
    });

    const rendered = renderReportPaginated(report);
    // Since each data row demands a new page, there should be exactly 3 pages for the 3 rows.
    expect(rendered.pages.length).toBe(3);
    for (const page of rendered.pages) {
      expect(page.bands.map((b) => b.bandType)).toEqual([
        "pageHeader",
        "data",
        "pageFooter",
      ]);
    }
  });

  test("pageBreakAfter forces subsequent bands onto next page", () => {
    const report = createBaseReport({
      contentHeight: 300,
      bands: [
        { type: "pageHeader", height: 20 },
        { type: "pageFooter", height: 20 },
        { type: "title", height: 40, newPageAfter: true }, // Title should be alone on page 1
        { type: "data", height: 40 },
      ],
    });

    const rendered = renderReportPaginated(report);
    // Page 1 should contain Title + PageFooter (PageHeader isn't on first page before Title, or handles title cleanly).
    // Page 2 should contain PageHeader + data rows + PageFooter.
    expect(rendered.pages.length).toBe(2);
    expect(rendered.pages[0].bands.map((b) => b.bandType)).toContain("title");
    expect(rendered.pages[0].bands.map((b) => b.bandType)).not.toContain(
      "data",
    );
    expect(rendered.pages[1].bands.map((b) => b.bandType)).toContain("data");
  });

  test("repeatOnEveryPage duplicates group headers across page boundaries", () => {
    const report = createBaseReport({
      contentHeight: 180, // Usable area: 180 - 20 (Header) - 20 (Footer) = 140
      bands: [
        { type: "pageHeader", height: 20 },
        { type: "pageFooter", height: 20 },
        {
          type: "groupHeader",
          height: 30,
          groupExpression: "{category}",
          repeatOnEveryPage: true, // Repeated on each page
          elements: ["e1"], // Needs elements to satisfy render check
        },
        { type: "data", height: 50 },
      ],
      elements: {
        e1: {
          id: "e1",
          type: "text",
          x: 0,
          y: 0,
          width: 100,
          height: 10,
        } as any,
      },
    });

    const rendered = renderReportPaginated(report);
    // Dataset:
    // Row 1 (category A)
    // Row 2 (category A)
    // Row 3 (category B)
    // Primary Group: A has Row 1 & Row 2. Group B has Row 3.
    // Flow:
    // - Place groupHeader A (height 30). Space left: 110.
    // - Place data Row 1 (height 50). Space left: 60.
    // - data Row 2 (height 50) fits in 60. Space left: 10.
    // Wait, let's recalculate accurately!
    // Row 1: Space before = 140. GroupHeader A takes 30 (rem: 110). Row 1 takes 50 (rem: 60).
    // Row 2: Space before = 60. Row 2 takes 50 (rem: 10).
    // Row 3 (category B): GroupHeader B needs 30, exceeding 10. Pushed to page 2.
    // This is group boundary.
    // What if we force a group split to test repeatOnEveryPage? Let's check:
    // If usable area was 100:
    // Page 1: groupHeader A (30, rem: 70), Row 1 (50, rem: 20).
    // Row 2 does not fit in 20. Triggers startNewPage().
    // Page 2: repeats pageHeader, and because we are still within group A (Row 2), groupHeader A repeats at the top of Page 2!
    // Then Row 2 (50) is printed. Group A closes.
    // Let's configure contentHeight = 140. Usable area: 140 - 20 - 20 = 100.
    const customReport = createBaseReport({
      contentHeight: 140,
      bands: [
        { type: "pageHeader", height: 20 },
        { type: "pageFooter", height: 20 },
        {
          type: "groupHeader",
          height: 30,
          groupExpression: "{category}",
          repeatOnEveryPage: true,
          elements: ["e1"],
        },
        { type: "data", height: 50 },
      ],
      elements: {
        e1: {
          id: "e1",
          type: "text",
          x: 0,
          y: 0,
          width: 100,
          height: 10,
        } as any,
      },
    });

    const customRendered = renderReportPaginated(customReport);
    // Page 1: PageHeader (20), GroupHeader A (30), Row 1 (50), PageFooter (20) = Done.
    // Page 2: PageHeader (20), GroupHeader A (Repeated!) (30), Row 2 (50), GroupHeader B (30 - does it fit? No, Row 2 + repeat group header takes 80, leaving 20. GroupHeader B is pushed to Page 3!)
    expect(customRendered.pages.length).toBe(3);

    // Let's verify Page 2 has the repeated GroupHeader A!
    const p1BandTypes = customRendered.pages[0].bands.map((b) => b.bandType);
    const p2BandTypes = customRendered.pages[1].bands.map((b) => b.bandType);

    expect(p1BandTypes).toEqual([
      "pageHeader",
      "groupHeader",
      "data",
      "pageFooter",
    ]);
    expect(p2BandTypes).toEqual([
      "pageHeader",
      "groupHeader",
      "data",
      "pageFooter",
    ]);
  });

  test("keepTogether moves band if next does not fit", () => {
    const report = createBaseReport({
      contentHeight: 180, // Usable area: 180 - 20 - 20 = 140
      bands: [
        { type: "pageHeader", height: 20 },
        { type: "pageFooter", height: 20 },
        { type: "title", height: 60 }, // On Page 1, Title (60) is printed. Space left: 140 - 60 = 80.
        {
          type: "groupHeader",
          height: 40,
          groupExpression: "{category}",
          keepTogether: true, // Should stay with Row 1
          elements: ["e1"],
        },
        { type: "data", height: 90 }, // Each details row is 90. Combined = 130, which fits on a fresh page (140) but not in 80!
      ],
      elements: {
        e1: {
          id: "e1",
          type: "text",
          x: 0,
          y: 0,
          width: 100,
          height: 10,
        } as any,
      },
    });

    const rendered = renderReportPaginated(report);
    // First, Title (60) and groupHeader (40) are placed on page 1. Space left: 140 - 60 - 40 = 40.
    // Next data Row 1 (90) does not fit in 40!
    // Since groupHeader has keepTogether: true, it is popped from Page 1 and moved to Page 2 alongside Row 1.
    // Page 1 should contain: title, pageFooter.
    // Page 2 should contain: pageHeader, groupHeader, data, pageFooter.
    expect(rendered.pages.length).toBeGreaterThan(1);
    expect(rendered.pages[0].bands.map((b) => b.bandType)).toEqual([
      "title",
      "pageHeader",
      "pageFooter",
    ]);
    expect(rendered.pages[1].bands.map((b) => b.bandType)).toEqual([
      "pageHeader",
      "groupHeader",
      "data",
      "pageFooter",
    ]);
  });
});

describe("Report Renderer - Dynamic Height autoGrow & Push Down Cascade", () => {
  const customReport: Report = {
    id: "r_layout",
    name: "Layout Report",
    version: "1.0.0",
    pageSettings: {
      width: 800,
      height: 600,
      orientation: "portrait",
      marginTop: 50,
      marginBottom: 50,
      marginLeft: 50,
      marginRight: 50,
      columns: 1,
      columnGap: 0,
    },
    bands: [
      {
        id: "band_data",
        type: "data",
        height: 60,
        backgroundColor: "transparent",
        visible: true,
        elements: ["el_desc", "el_price"],
      },
    ],
    elements: {
      el_desc: {
        id: "el_desc",
        type: "text",
        x: 10,
        y: 10,
        width: 100,
        height: 20,
        name: "Description",
        content:
          "This is a very long description that word wraps and grows because autoSize is enabled.",
        font: {
          family: "helvetica",
          size: 10,
          bold: false,
          italic: false,
          underline: false,
          color: "#000",
        },
        backgroundColor: "transparent",
        borders: {},
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        horizontalAlign: "left",
        verticalAlign: "top",
        wordWrap: true,
        autoSize: true,
        zOrder: 1,
      } as any,
      el_price: {
        id: "el_price",
        type: "text",
        x: 10,
        y: 40, // Vertically under el_desc (bottom was 10 + 20 = 30)
        width: 100,
        height: 15,
        name: "Price",
        content: "$99.99",
        font: {
          family: "helvetica",
          size: 10,
          bold: true,
          italic: false,
          underline: false,
          color: "#000",
        },
        backgroundColor: "transparent",
        borders: {},
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        horizontalAlign: "left",
        verticalAlign: "top",
        wordWrap: false,
        autoSize: false,
        zOrder: 2,
      } as any,
    },
    dataSources: [
      {
        id: "ds",
        name: "ds",
        type: "json",
        data: [{}],
        fields: [],
      },
    ],
    parameters: [],
    styles: [],
    variables: {},
  };

  test("autoGrow and push-down shift elements accordingly", () => {
    const rendered = renderReportPaginated(customReport);
    expect(rendered.pages.length).toBe(1);

    const databand = rendered.pages[0].bands.find((b) => b.bandType === "data");
    expect(databand).toBeDefined();

    // The long description element should have grown in height (height > 20)
    const descEl = databand!.elements.find((e) => e.id === "el_desc");
    expect(descEl).toBeDefined();
    expect(descEl!.height).toBeGreaterThan(20);

    // The price element, which is vertically under description, must be pushed down
    const priceEl = databand!.elements.find((e) => e.id === "el_price");
    expect(priceEl).toBeDefined();
    // Shifted Y = original Y (40) + delta (descEl.height - 20)
    expect(priceEl!.y).toBe(40 + (descEl!.height - 20));

    // The band height should have increased to contain both elements
    expect(databand!.height).toBeGreaterThan(60);
    expect(databand!.height).toBe(priceEl!.y + priceEl!.height);
  });
});

describe("Report Renderer - Nesting Subreports Recursive Layout", () => {
  const customReport: Report = {
    id: "r_sub",
    name: "Parent Report",
    version: "1.0.0",
    pageSettings: {
      width: 800,
      height: 600,
      orientation: "portrait",
      marginTop: 50,
      marginBottom: 50,
      marginLeft: 50,
      marginRight: 50,
      columns: 1,
      columnGap: 0,
    },
    bands: [
      {
        id: "band_data",
        type: "data",
        height: 80,
        backgroundColor: "transparent",
        visible: true,
        elements: ["el_subreport", "el_footer"],
      },
    ],
    elements: {
      el_subreport: {
        id: "el_subreport",
        type: "subreport",
        x: 10,
        y: 10,
        width: 300,
        height: 20, // Initially small
        name: "NestedSubreport",
        reportId: "sub_test", // This triggers our mock subreport template
        parameters: {
          SubParam: "'ZURU Rockz'",
        },
        zOrder: 1,
      } as any,
      el_footer: {
        id: "el_footer",
        type: "text",
        x: 10,
        y: 40, // Vertically under subreport container
        width: 100,
        height: 15,
        name: "FooterLabel",
        content: "--- End of Section ---",
        font: {
          family: "helvetica",
          size: 10,
          bold: false,
          italic: false,
          underline: false,
          color: "#000",
        },
        backgroundColor: "transparent",
        borders: {},
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        horizontalAlign: "left",
        verticalAlign: "top",
        wordWrap: false,
        autoSize: false,
        zOrder: 2,
      } as any,
    },
    dataSources: [
      {
        id: "ds",
        name: "ds",
        type: "json",
        data: [{}],
        fields: [],
      },
    ],
    parameters: [],
    styles: [],
    variables: {},
  };

  test("recursively expands subreport bands, maps parameters and shifts sibling elements", () => {
    const rendered = renderReportPaginated(customReport);
    expect(rendered.pages.length).toBe(1);

    const databand = rendered.pages[0].bands.find((b) => b.bandType === "data");
    expect(databand).toBeDefined();

    // Check we have the original parent elements PLUS the nested child elements
    // The subreport has: reportHeader (height 25, title) and data (height 20, value)
    expect(databand!.elements.length).toBeGreaterThan(2);

    // Verify subreport value element processed mapped parent parameter
    const subValEl = databand!.elements.find((e) => e.name === "SubValue");
    expect(subValEl).toBeDefined();
    // The content was "Param: [SubParam]" which should evaluate to "Param: ZURU Rockz"
    expect(subValEl!.type).toBe("text");
    const subText = subValEl as TextElement;
    expect(subText.content).toContain("ZURU Rockz");

    // The subreport container height grew dynamically to 25 + 20 = 45
    const parentSubEl = databand!.elements.find((e) => e.id === "el_subreport");
    expect(parentSubEl).toBeDefined();
    expect(parentSubEl!.height).toBe(45);

    //Siblind push down is also triggered: el_footer should be pushed from 40 down to 40 + (45 - 20) = 65
    const footerEl = databand!.elements.find((e) => e.id === "el_footer");
    expect(footerEl).toBeDefined();
    expect(footerEl!.y).toBe(40 + (45 - 20));

    // Band height grew to accommodate all shifted elements without clipping!
    expect(databand!.height).toBe(80);
  });
});
