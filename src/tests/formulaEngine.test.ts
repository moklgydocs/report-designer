import { describe, test, expect } from "vitest";
import { evaluateFormula } from "../utils/formulaEngine";

describe("Formula Engine - Deep Property Access & Null-safety", () => {
  const data = {
    user: {
      profile: { name: "Jackie", age: 30 },
      contacts: [{ phone: "123" }, { phone: "456" }],
    },
    nullVal: null,
    zeroVal: 0,
  };

  test("nested property", () => {
    expect(evaluateFormula("{user.profile.name}", data)).toBe("Jackie");
    expect(evaluateFormula("{user.profile.age}", data)).toBe(30);
    expect(evaluateFormula("{user.contacts[1].phone}", data)).toBe("456");
    expect(evaluateFormula("{nonexistent.path}", data)).toBe(
      "[nonexistent.path]",
    );
  });

  test("nullish coalescing", () => {
    expect(evaluateFormula('={nullVal} ?? "Default"', data)).toBe("Default");
    expect(evaluateFormula("={zeroVal} ?? 10", data)).toBe(0);
    expect(evaluateFormula('={user.profile.name} ?? "Anonymous"', data)).toBe(
      "Jackie",
    );
  });
});

describe("Formula Engine - Parameters System", () => {
  const data = {};
  const context = {
    parameters: {
      Company: "ZURU",
      Year: 2026,
      IsActive: true,
    },
  };

  test("pure parameters", () => {
    expect(evaluateFormula("[Company]", data, context)).toBe("ZURU");
    expect(evaluateFormula("[Year]", data, context)).toBe(2026);
    expect(evaluateFormula("[IsActive]", data, context)).toBe(true);
    expect(evaluateFormula("[Nonexistent]", data, context)).toBe(
      "[Nonexistent]",
    );
  });

  test("parameters in expressions", () => {
    expect(evaluateFormula("=[Company] + ' Ltd'", data, context)).toBe(
      "ZURU Ltd",
    );
    expect(evaluateFormula("=[Year] + 1", data, context)).toBe(2027);
    expect(
      evaluateFormula("=If([IsActive], 'Active', 'Inactive')", data, context),
    ).toBe("Active");
  });

  test("parameters in templates", () => {
    expect(evaluateFormula("Welcome to [Company]!", data, context)).toBe(
      "Welcome to ZURU!",
    );
    expect(evaluateFormula("Year [Year] dashboard", data, context)).toBe(
      "Year 2026 dashboard",
    );
  });
});

describe("Formula Engine - Mathematical & Logical Operators", () => {
  test("arithmetic", () => {
    expect(evaluateFormula("=2 + 3 * 4")).toBe(14);
    expect(evaluateFormula("=(2 + 3) * 4")).toBe(20);
    expect(evaluateFormula("=20 / (4 - 2)")).toBe(10);
    expect(evaluateFormula("=10 % 3")).toBe(1);
    expect(evaluateFormula("=-5 + 3")).toBe(-2);
  });

  test("relational and logical", () => {
    expect(evaluateFormula("=5 >= 3")).toBe(true);
    expect(evaluateFormula("=5 < 3")).toBe(false);
    expect(evaluateFormula('="a" == "a"')).toBe(true);
    expect(evaluateFormula("=true && false")).toBe(false);
    expect(evaluateFormula("=false || true")).toBe(true);
    expect(evaluateFormula("=!true")).toBe(false);
  });
});

describe("Formula Engine - Built-in functions & Nesting", () => {
  test("nested If statements", () => {
    expect(evaluateFormula('=If(5 > 3, "Yes", "No")')).toBe("Yes");
    expect(
      evaluateFormula(
        '=If(5 < 3, "Yes", If(2 == 2, "NestedTrue", "NestedFalse"))',
      ),
    ).toBe("NestedTrue");
  });

  test("aggregates & string library", () => {
    const records = [{ price: 10 }, { price: 20 }, { price: 30 }];
    expect(evaluateFormula('=Sum("price")', records)).toBe(60);
    expect(evaluateFormula('=Avg("price")', records)).toBe(20);
    expect(evaluateFormula("=Count()", records)).toBe(3);
    expect(evaluateFormula('=Min("price")', records)).toBe(10);
    expect(evaluateFormula('=Max("price")', records)).toBe(30);

    expect(evaluateFormula('=Concat("Hello ", "World")')).toBe("Hello World");
    expect(evaluateFormula('=Upper("hello")')).toBe("HELLO");
    expect(evaluateFormula('=Lower("WORLD")')).toBe("world");
    expect(evaluateFormula("=Round(3.14159, 2)")).toBe(3.14);
  });
});

describe("Formula Engine - Scoped Aggregates & Running Totals", () => {
  const records = [
    { name: "A", amt: 10, __rowIndex: 0 },
    { name: "B", amt: 20, __rowIndex: 1 },
    { name: "C", amt: 30, __rowIndex: 2 },
  ];

  const context = {
    allData: records,
    groupData: [records[1], records[2]], // sub-group (B & C correspond to indices 1 & 2)
  };

  test("scoped aggregations", () => {
    // default should use groupData if present
    expect(evaluateFormula('=Sum("amt")', records[1], context)).toBe(50);
    expect(evaluateFormula("=Count()", records[1], context)).toBe(2);

    // explicit scope report (entire dataset)
    expect(evaluateFormula('=Sum("amt", "report")', records[1], context)).toBe(
      60,
    );
    expect(evaluateFormula('=Count("report")', records[1], context)).toBe(3);

    // explicit scope group
    expect(evaluateFormula('=Sum("amt", "group")', records[1], context)).toBe(
      50,
    );
  });

  test("running totals & counts", () => {
    // running totals cumulatively sum up to the active row
    expect(evaluateFormula('=RunningSum("amt")', records[0], context)).toBe(10);
    expect(evaluateFormula('=RunningSum("amt")', records[1], context)).toBe(30);
    expect(evaluateFormula('=RunningSum("amt")', records[2], context)).toBe(60);

    expect(evaluateFormula("=RunningCount()", records[0], context)).toBe(1);
    expect(evaluateFormula("=RunningCount()", records[1], context)).toBe(2);
    expect(evaluateFormula("=RunningCount()", records[2], context)).toBe(3);
  });

  test("row index bindings", () => {
    expect(evaluateFormula("[RowIndex]", records[0], context)).toBe(0);
    expect(evaluateFormula("[RowIndex]", records[1], context)).toBe(1);
    expect(evaluateFormula("=rowindex", records[2], context)).toBe(2);
  });
});
