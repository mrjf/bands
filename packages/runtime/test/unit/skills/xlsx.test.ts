/**
 * Integration tests for the XLSX skill band.
 *
 * Tests typical Excel operations: reading, writing, formulas, charts,
 * pivot tables, data analysis, etc.
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import {
  BandTestHarness,
  getWrappedSkillPath,
  assertSuccess,
} from "../runner";

describe("XLSX Skill Integration", () => {
  const harness = new BandTestHarness();

  beforeAll(async () => {
    await harness.init(getWrappedSkillPath("xlsx"));
  });

  afterAll(async () => {
    await harness.cleanup();
  });

  describe("Health Check", () => {
    it("should be ready after initialization", async () => {
      const health = await harness.health();
      expect(health.ready).toBe(true);
      expect(health.band).toBe("xlsx");
    });
  });

  describe("Reading Spreadsheets", () => {
    it("should accept a request to read a worksheet", async () => {
      const response = await harness.request({
        task: "read",
        file: "/path/to/spreadsheet.xlsx",
        sheet: "Sheet1",
      });
      assertSuccess(response);
    });

    it("should accept a request to read a specific range", async () => {
      const response = await harness.request({
        task: "read_range",
        file: "/path/to/spreadsheet.xlsx",
        sheet: "Sheet1",
        range: "A1:D10",
      });
      assertSuccess(response);
    });

    it("should accept a request to list all sheets", async () => {
      const response = await harness.request({
        task: "list_sheets",
        file: "/path/to/spreadsheet.xlsx",
      });
      assertSuccess(response);
    });

    it("should accept a request to read with headers", async () => {
      const response = await harness.request({
        task: "read",
        file: "/path/to/spreadsheet.xlsx",
        sheet: "Data",
        hasHeaders: true,
      });
      assertSuccess(response);
    });
  });

  describe("Writing Spreadsheets", () => {
    it("should accept a request to create a new spreadsheet", async () => {
      const response = await harness.request({
        task: "create",
        data: [
          ["Name", "Age", "City"],
          ["Alice", 30, "NYC"],
          ["Bob", 25, "LA"],
          ["Charlie", 35, "Chicago"],
        ],
        output: "/path/to/new.xlsx",
      });
      assertSuccess(response);
    });

    it("should accept a request to write to existing file", async () => {
      const response = await harness.request({
        task: "write",
        file: "/path/to/spreadsheet.xlsx",
        sheet: "Sheet1",
        data: [
          ["Updated", "Data"],
          [1, 2],
        ],
        startCell: "A1",
        output: "/path/to/updated.xlsx",
      });
      assertSuccess(response);
    });

    it("should accept a request to add a new sheet", async () => {
      const response = await harness.request({
        task: "add_sheet",
        file: "/path/to/spreadsheet.xlsx",
        sheetName: "NewSheet",
        data: [["Column1", "Column2"]],
        output: "/path/to/with-sheet.xlsx",
      });
      assertSuccess(response);
    });
  });

  describe("Formulas", () => {
    it("should accept a request to add formulas", async () => {
      const response = await harness.request({
        task: "add_formula",
        file: "/path/to/spreadsheet.xlsx",
        sheet: "Sheet1",
        cell: "D2",
        formula: "=SUM(A2:C2)",
        output: "/path/to/with-formula.xlsx",
      });
      assertSuccess(response);
    });

    it("should accept a request to fill formula down", async () => {
      const response = await harness.request({
        task: "fill_formula",
        file: "/path/to/spreadsheet.xlsx",
        sheet: "Sheet1",
        sourceCell: "D2",
        targetRange: "D3:D100",
        output: "/path/to/filled.xlsx",
      });
      assertSuccess(response);
    });

    it("should accept a request to calculate formulas", async () => {
      const response = await harness.request({
        task: "calculate",
        file: "/path/to/spreadsheet.xlsx",
      });
      assertSuccess(response);
    });
  });

  describe("Formatting", () => {
    it("should accept a request to format cells", async () => {
      const response = await harness.request({
        task: "format_cells",
        file: "/path/to/spreadsheet.xlsx",
        sheet: "Sheet1",
        range: "A1:D1",
        format: {
          bold: true,
          backgroundColor: "#4472C4",
          fontColor: "#FFFFFF",
        },
        output: "/path/to/formatted.xlsx",
      });
      assertSuccess(response);
    });

    it("should accept a request to set number format", async () => {
      const response = await harness.request({
        task: "set_number_format",
        file: "/path/to/spreadsheet.xlsx",
        sheet: "Sheet1",
        range: "B2:B100",
        format: "$#,##0.00",
        output: "/path/to/number-formatted.xlsx",
      });
      assertSuccess(response);
    });

    it("should accept a request to auto-fit columns", async () => {
      const response = await harness.request({
        task: "autofit_columns",
        file: "/path/to/spreadsheet.xlsx",
        sheet: "Sheet1",
        output: "/path/to/autofitted.xlsx",
      });
      assertSuccess(response);
    });

    it("should accept a request to add conditional formatting", async () => {
      const response = await harness.request({
        task: "conditional_format",
        file: "/path/to/spreadsheet.xlsx",
        sheet: "Sheet1",
        range: "C2:C100",
        rule: {
          type: "cellIs",
          operator: "greaterThan",
          value: 100,
          format: { backgroundColor: "#C6EFCE" },
        },
        output: "/path/to/conditional.xlsx",
      });
      assertSuccess(response);
    });
  });

  describe("Charts", () => {
    it("should accept a request to create a bar chart", async () => {
      const response = await harness.request({
        task: "create_chart",
        file: "/path/to/spreadsheet.xlsx",
        sheet: "Sheet1",
        chartType: "bar",
        dataRange: "A1:B10",
        title: "Sales by Region",
        output: "/path/to/with-chart.xlsx",
      });
      assertSuccess(response);
    });

    it("should accept a request to create a line chart", async () => {
      const response = await harness.request({
        task: "create_chart",
        file: "/path/to/spreadsheet.xlsx",
        sheet: "Sheet1",
        chartType: "line",
        dataRange: "A1:D12",
        title: "Monthly Trends",
        output: "/path/to/line-chart.xlsx",
      });
      assertSuccess(response);
    });

    it("should accept a request to create a pie chart", async () => {
      const response = await harness.request({
        task: "create_chart",
        file: "/path/to/spreadsheet.xlsx",
        sheet: "Sheet1",
        chartType: "pie",
        dataRange: "A1:B5",
        title: "Market Share",
        output: "/path/to/pie-chart.xlsx",
      });
      assertSuccess(response);
    });
  });

  describe("Data Analysis", () => {
    it("should accept a request to sort data", async () => {
      const response = await harness.request({
        task: "sort",
        file: "/path/to/spreadsheet.xlsx",
        sheet: "Sheet1",
        range: "A1:D100",
        sortBy: "B",
        order: "descending",
        hasHeaders: true,
        output: "/path/to/sorted.xlsx",
      });
      assertSuccess(response);
    });

    it("should accept a request to filter data", async () => {
      const response = await harness.request({
        task: "filter",
        file: "/path/to/spreadsheet.xlsx",
        sheet: "Sheet1",
        column: "C",
        condition: ">1000",
      });
      assertSuccess(response);
    });

    it("should accept a request to create a pivot table", async () => {
      const response = await harness.request({
        task: "create_pivot",
        file: "/path/to/spreadsheet.xlsx",
        sourceSheet: "Data",
        sourceRange: "A1:E1000",
        targetSheet: "Pivot",
        rows: ["Category"],
        columns: ["Month"],
        values: [{ field: "Sales", aggregation: "sum" }],
        output: "/path/to/with-pivot.xlsx",
      });
      assertSuccess(response);
    });

    it("should accept a request to remove duplicates", async () => {
      const response = await harness.request({
        task: "remove_duplicates",
        file: "/path/to/spreadsheet.xlsx",
        sheet: "Sheet1",
        columns: ["A", "B"],
        output: "/path/to/no-dupes.xlsx",
      });
      assertSuccess(response);
    });
  });

  describe("Conversion", () => {
    it("should accept a request to convert to CSV", async () => {
      const response = await harness.request({
        task: "export_csv",
        file: "/path/to/spreadsheet.xlsx",
        sheet: "Sheet1",
        output: "/path/to/data.csv",
      });
      assertSuccess(response);
    });

    it("should accept a request to convert from CSV", async () => {
      const response = await harness.request({
        task: "import_csv",
        file: "/path/to/data.csv",
        output: "/path/to/from-csv.xlsx",
        delimiter: ",",
        hasHeaders: true,
      });
      assertSuccess(response);
    });

    it("should accept a request to convert to JSON", async () => {
      const response = await harness.request({
        task: "export_json",
        file: "/path/to/spreadsheet.xlsx",
        sheet: "Sheet1",
        output: "/path/to/data.json",
      });
      assertSuccess(response);
    });
  });

  describe("Cell Operations", () => {
    it("should accept a request to merge cells", async () => {
      const response = await harness.request({
        task: "merge_cells",
        file: "/path/to/spreadsheet.xlsx",
        sheet: "Sheet1",
        range: "A1:D1",
        output: "/path/to/merged.xlsx",
      });
      assertSuccess(response);
    });

    it("should accept a request to insert rows", async () => {
      const response = await harness.request({
        task: "insert_rows",
        file: "/path/to/spreadsheet.xlsx",
        sheet: "Sheet1",
        position: 5,
        count: 3,
        output: "/path/to/with-rows.xlsx",
      });
      assertSuccess(response);
    });

    it("should accept a request to delete columns", async () => {
      const response = await harness.request({
        task: "delete_columns",
        file: "/path/to/spreadsheet.xlsx",
        sheet: "Sheet1",
        columns: ["C", "D"],
        output: "/path/to/fewer-columns.xlsx",
      });
      assertSuccess(response);
    });
  });

  describe("Data Validation", () => {
    it("should accept a request to add dropdown validation", async () => {
      const response = await harness.request({
        task: "add_validation",
        file: "/path/to/spreadsheet.xlsx",
        sheet: "Sheet1",
        range: "B2:B100",
        type: "list",
        values: ["Option A", "Option B", "Option C"],
        output: "/path/to/with-validation.xlsx",
      });
      assertSuccess(response);
    });

    it("should accept a request to add number validation", async () => {
      const response = await harness.request({
        task: "add_validation",
        file: "/path/to/spreadsheet.xlsx",
        sheet: "Sheet1",
        range: "C2:C100",
        type: "decimal",
        minimum: 0,
        maximum: 100,
        output: "/path/to/validated.xlsx",
      });
      assertSuccess(response);
    });
  });
});
