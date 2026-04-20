import { describe, test, expect } from "bun:test";
import {
  parseBytes,
  formatBytes,
  parseDuration,
  formatDuration,
  parseCost,
  formatCost,
} from "../src/units";

describe("parseBytes", () => {
  test("number passthrough", () => {
    expect(parseBytes(0)).toBe(0);
    expect(parseBytes(1)).toBe(1);
    expect(parseBytes(1024)).toBe(1024);
    expect(parseBytes(999999)).toBe(999999);
    expect(parseBytes(-5)).toBe(-5);
    expect(parseBytes(3.7)).toBe(3.7);
  });

  test("bare number string (no unit)", () => {
    expect(parseBytes("0")).toBe(0);
    expect(parseBytes("1")).toBe(1);
    expect(parseBytes("512")).toBe(512);
    expect(parseBytes("1023")).toBe(1023);
    expect(parseBytes("1024")).toBe(1024);
  });

  test("kilobytes", () => {
    expect(parseBytes("1k")).toBe(1024);
    expect(parseBytes("2k")).toBe(2048);
    expect(parseBytes("10k")).toBe(10240);
    expect(parseBytes("0k")).toBe(0);
  });

  test("megabytes", () => {
    expect(parseBytes("1m")).toBe(1024 * 1024);
    expect(parseBytes("2m")).toBe(2 * 1024 * 1024);
    expect(parseBytes("512m")).toBe(512 * 1024 * 1024);
  });

  test("gigabytes", () => {
    expect(parseBytes("1g")).toBe(1024 * 1024 * 1024);
    expect(parseBytes("4g")).toBe(4 * 1024 * 1024 * 1024);
  });

  test("terabytes", () => {
    expect(parseBytes("1t")).toBe(1024 * 1024 * 1024 * 1024);
    expect(parseBytes("2t")).toBe(2 * 1024 * 1024 * 1024 * 1024);
  });

  test("decimal values", () => {
    expect(parseBytes("1.5k")).toBe(Math.round(1.5 * 1024));
    expect(parseBytes("2.5m")).toBe(Math.round(2.5 * 1024 * 1024));
    expect(parseBytes("0.5g")).toBe(Math.round(0.5 * 1024 * 1024 * 1024));
    expect(parseBytes("1.25t")).toBe(Math.round(1.25 * 1024 * 1024 * 1024 * 1024));
    expect(parseBytes("0.1")).toBe(0); // Math.round(0.1 * 1)
  });

  test("case insensitivity", () => {
    expect(parseBytes("1K")).toBe(1024);
    expect(parseBytes("1M")).toBe(1024 * 1024);
    expect(parseBytes("1G")).toBe(1024 * 1024 * 1024);
    expect(parseBytes("1T")).toBe(1024 * 1024 * 1024 * 1024);
  });

  test("whitespace handling", () => {
    expect(parseBytes("  1k  ")).toBe(1024);
    expect(parseBytes("  512  ")).toBe(512);
    expect(parseBytes("\t1m\t")).toBe(1024 * 1024);
  });

  test("whitespace between number and unit", () => {
    // The regex allows optional whitespace between number and unit
    expect(parseBytes("1 k")).toBe(1024);
    expect(parseBytes("2  m")).toBe(2 * 1024 * 1024);
  });

  test("invalid inputs return null", () => {
    expect(parseBytes("")).toBe(null);
    expect(parseBytes("abc")).toBe(null);
    expect(parseBytes("k")).toBe(null);
    expect(parseBytes("1x")).toBe(null);
    expect(parseBytes("1kb")).toBe(null);
    expect(parseBytes("1mb")).toBe(null);
    expect(parseBytes("1gb")).toBe(null);
    expect(parseBytes("-1k")).toBe(null);
    expect(parseBytes("1.2.3k")).toBe(null);
    expect(parseBytes("hello world")).toBe(null);
    expect(parseBytes("$100")).toBe(null);
  });
});

describe("formatBytes", () => {
  test("string passthrough", () => {
    expect(formatBytes("already formatted")).toBe("already formatted");
    expect(formatBytes("1k")).toBe("1k");
    expect(formatBytes("512m")).toBe("512m");
    expect(formatBytes("")).toBe("");
  });

  test("values below 1024 (bytes)", () => {
    expect(formatBytes(0)).toBe("0");
    expect(formatBytes(1)).toBe("1");
    expect(formatBytes(512)).toBe("512");
    expect(formatBytes(1023)).toBe("1023");
  });

  test("kilobyte range", () => {
    expect(formatBytes(1024)).toBe("1k");
    expect(formatBytes(2048)).toBe("2k");
    expect(formatBytes(10240)).toBe("10k");
    expect(formatBytes(1024 * 1024 - 1)).toBe("1024k"); // just below 1m
  });

  test("megabyte range", () => {
    expect(formatBytes(1024 * 1024)).toBe("1m");
    expect(formatBytes(512 * 1024 * 1024)).toBe("512m");
    expect(formatBytes(1024 * 1024 * 1024 - 1)).toBe("1024m"); // just below 1g
  });

  test("gigabyte range", () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe("1g");
    expect(formatBytes(4 * 1024 * 1024 * 1024)).toBe("4g");
    expect(formatBytes(1024 * 1024 * 1024 * 1024 - 1)).toBe("1024g"); // just below 1t
  });

  test("terabyte range", () => {
    expect(formatBytes(1024 * 1024 * 1024 * 1024)).toBe("1t");
    expect(formatBytes(2 * 1024 * 1024 * 1024 * 1024)).toBe("2t");
  });

  test("rounding", () => {
    // 1.5k = 1536 bytes -> Math.round(1536 / 1024) = Math.round(1.5) = 2
    expect(formatBytes(1536)).toBe("2k");
    // 1.4k = 1433.6 bytes -> Math.round(1433.6 / 1024) = Math.round(1.4) = 1
    expect(formatBytes(1434)).toBe("1k");
  });
});

describe("parseDuration", () => {
  test("number passthrough", () => {
    expect(parseDuration(0)).toBe(0);
    expect(parseDuration(1)).toBe(1);
    expect(parseDuration(1000)).toBe(1000);
    expect(parseDuration(-100)).toBe(-100);
    expect(parseDuration(3.5)).toBe(3.5);
  });

  test("milliseconds", () => {
    expect(parseDuration("100ms")).toBe(100);
    expect(parseDuration("0ms")).toBe(0);
    expect(parseDuration("500ms")).toBe(500);
    expect(parseDuration("1ms")).toBe(1);
  });

  test("bare number defaults to milliseconds", () => {
    expect(parseDuration("100")).toBe(100);
    expect(parseDuration("0")).toBe(0);
    expect(parseDuration("1")).toBe(1);
    expect(parseDuration("999")).toBe(999);
  });

  test("seconds", () => {
    expect(parseDuration("1s")).toBe(1000);
    expect(parseDuration("2s")).toBe(2000);
    expect(parseDuration("30s")).toBe(30000);
    expect(parseDuration("0s")).toBe(0);
  });

  test("minutes", () => {
    expect(parseDuration("1m")).toBe(60000);
    expect(parseDuration("5m")).toBe(300000);
    expect(parseDuration("0m")).toBe(0);
  });

  test("hours", () => {
    expect(parseDuration("1h")).toBe(3600000);
    expect(parseDuration("2h")).toBe(7200000);
    expect(parseDuration("0h")).toBe(0);
  });

  test("decimal values", () => {
    expect(parseDuration("1.5s")).toBe(1500);
    expect(parseDuration("0.5m")).toBe(30000);
    expect(parseDuration("2.5h")).toBe(Math.round(2.5 * 3600000));
    expect(parseDuration("100.5ms")).toBe(Math.round(100.5));
    expect(parseDuration("0.001s")).toBe(Math.round(0.001 * 1000));
  });

  test("case insensitivity", () => {
    expect(parseDuration("1S")).toBe(1000);
    expect(parseDuration("1M")).toBe(60000);
    expect(parseDuration("1H")).toBe(3600000);
    expect(parseDuration("100MS")).toBe(100);
    expect(parseDuration("1Ms")).toBe(1);
  });

  test("whitespace handling", () => {
    expect(parseDuration("  1s  ")).toBe(1000);
    expect(parseDuration("\t5m\t")).toBe(300000);
    expect(parseDuration("  100  ")).toBe(100);
  });

  test("whitespace between number and unit", () => {
    expect(parseDuration("1 s")).toBe(1000);
    expect(parseDuration("5 m")).toBe(300000);
  });

  test("invalid inputs return null", () => {
    expect(parseDuration("")).toBe(null);
    expect(parseDuration("abc")).toBe(null);
    expect(parseDuration("s")).toBe(null);
    expect(parseDuration("1x")).toBe(null);
    expect(parseDuration("1d")).toBe(null);
    expect(parseDuration("1w")).toBe(null);
    expect(parseDuration("-1s")).toBe(null);
    expect(parseDuration("1.2.3s")).toBe(null);
    expect(parseDuration("hello")).toBe(null);
  });
});

describe("formatDuration", () => {
  test("string passthrough", () => {
    expect(formatDuration("already formatted")).toBe("already formatted");
    expect(formatDuration("5s")).toBe("5s");
    expect(formatDuration("")).toBe("");
  });

  test("millisecond range", () => {
    expect(formatDuration(0)).toBe("0ms");
    expect(formatDuration(1)).toBe("1ms");
    expect(formatDuration(500)).toBe("500ms");
    expect(formatDuration(999)).toBe("999ms");
  });

  test("second range", () => {
    expect(formatDuration(1000)).toBe("1s");
    expect(formatDuration(2000)).toBe("2s");
    expect(formatDuration(30000)).toBe("30s");
    expect(formatDuration(59000)).toBe("59s");
  });

  test("minute range", () => {
    expect(formatDuration(60000)).toBe("1m");
    expect(formatDuration(300000)).toBe("5m");
    expect(formatDuration(3599000)).toBe("60m");
  });

  test("hour range", () => {
    expect(formatDuration(3600000)).toBe("1h");
    expect(formatDuration(7200000)).toBe("2h");
    expect(formatDuration(36000000)).toBe("10h");
  });

  test("rounding", () => {
    // 1500ms -> Math.round(1500 / 1000) = Math.round(1.5) = 2
    expect(formatDuration(1500)).toBe("2s");
    // 1400ms -> Math.round(1400 / 1000) = Math.round(1.4) = 1
    expect(formatDuration(1400)).toBe("1s");
    // 90000ms = 1.5m -> Math.round(1.5) = 2
    expect(formatDuration(90000)).toBe("2m");
  });

  test("boundary at exactly 1000", () => {
    expect(formatDuration(999)).toBe("999ms");
    expect(formatDuration(1000)).toBe("1s");
  });

  test("boundary at exactly 60000", () => {
    expect(formatDuration(59999)).toBe("60s");
    expect(formatDuration(60000)).toBe("1m");
  });

  test("boundary at exactly 3600000", () => {
    expect(formatDuration(3599999)).toBe("60m");
    expect(formatDuration(3600000)).toBe("1h");
  });
});

describe("parseCost", () => {
  test("number passthrough", () => {
    expect(parseCost(0)).toBe(0);
    expect(parseCost(1)).toBe(1);
    expect(parseCost(1.5)).toBe(1.5);
    expect(parseCost(99.99)).toBe(99.99);
    expect(parseCost(-5)).toBe(-5);
  });

  test("plain number string", () => {
    expect(parseCost("0")).toBe(0);
    expect(parseCost("1")).toBe(1);
    expect(parseCost("99.99")).toBe(99.99);
    expect(parseCost("0.01")).toBe(0.01);
    expect(parseCost("1000")).toBe(1000);
  });

  test("dollar sign prefix", () => {
    expect(parseCost("$0")).toBe(0);
    expect(parseCost("$1")).toBe(1);
    expect(parseCost("$99.99")).toBe(99.99);
    expect(parseCost("$0.01")).toBe(0.01);
    expect(parseCost("$1000")).toBe(1000);
  });

  test("whitespace handling", () => {
    expect(parseCost("  1.50  ")).toBe(1.5);
    expect(parseCost("  $5.00  ")).toBe(5);
    expect(parseCost("\t$10\t")).toBe(10);
  });

  test("negative values with dollar sign", () => {
    // After stripping $, parseFloat handles negative
    expect(parseCost("$-5")).toBe(-5);
  });

  test("invalid inputs return null", () => {
    expect(parseCost("")).toBe(null);
    expect(parseCost("abc")).toBe(null);
    expect(parseCost("$abc")).toBe(null);
    expect(parseCost("$$5")).toBe(null);
    expect(parseCost("hello")).toBe(null);
  });
});

describe("formatCost", () => {
  test("number formatting with two decimal places", () => {
    expect(formatCost(0)).toBe("$0.00");
    expect(formatCost(1)).toBe("$1.00");
    expect(formatCost(1.5)).toBe("$1.50");
    expect(formatCost(99.99)).toBe("$99.99");
    expect(formatCost(0.01)).toBe("$0.01");
    expect(formatCost(1000)).toBe("$1000.00");
  });

  test("rounding to two decimals", () => {
    expect(formatCost(1.999)).toBe("$2.00");
    expect(formatCost(1.001)).toBe("$1.00");
    expect(formatCost(1.005)).toBe("$1.00"); // toFixed uses banker's rounding; 1.005 is stored as 1.00499...
    expect(formatCost(0.1 + 0.2)).toBe("$0.30");
  });

  test("negative numbers", () => {
    expect(formatCost(-5)).toBe("$-5.00");
    expect(formatCost(-0.01)).toBe("$-0.01");
  });

  test("string passthrough with dollar sign", () => {
    expect(formatCost("$5.00")).toBe("$5.00");
    expect(formatCost("$99.99")).toBe("$99.99");
    expect(formatCost("$0")).toBe("$0");
  });

  test("string without dollar sign gets prefixed", () => {
    expect(formatCost("5.00")).toBe("$5.00");
    expect(formatCost("99.99")).toBe("$99.99");
    expect(formatCost("0")).toBe("$0");
    expect(formatCost("free")).toBe("$free");
  });

  test("empty string passthrough", () => {
    expect(formatCost("")).toBe("$");
  });
});

describe("round-trip: parseBytes <-> formatBytes", () => {
  test("parse then format for exact units", () => {
    expect(formatBytes(parseBytes("1k")!)).toBe("1k");
    expect(formatBytes(parseBytes("1m")!)).toBe("1m");
    expect(formatBytes(parseBytes("1g")!)).toBe("1g");
    expect(formatBytes(parseBytes("1t")!)).toBe("1t");
    expect(formatBytes(parseBytes("512")!)).toBe("512");
  });

  test("format then parse", () => {
    expect(parseBytes(formatBytes(1024))).toBe(1024);
    expect(parseBytes(formatBytes(1024 * 1024))).toBe(1024 * 1024);
    expect(parseBytes(formatBytes(1024 * 1024 * 1024))).toBe(1024 * 1024 * 1024);
    expect(parseBytes(formatBytes(1024 * 1024 * 1024 * 1024))).toBe(1024 * 1024 * 1024 * 1024);
    expect(parseBytes(formatBytes(512))).toBe(512);
  });
});

describe("round-trip: parseDuration <-> formatDuration", () => {
  test("parse then format for exact units", () => {
    expect(formatDuration(parseDuration("500ms")!)).toBe("500ms");
    expect(formatDuration(parseDuration("1s")!)).toBe("1s");
    expect(formatDuration(parseDuration("5m")!)).toBe("5m");
    expect(formatDuration(parseDuration("1h")!)).toBe("1h");
  });

  test("format then parse", () => {
    expect(parseDuration(formatDuration(500))).toBe(500);
    expect(parseDuration(formatDuration(1000))).toBe(1000);
    expect(parseDuration(formatDuration(60000))).toBe(60000);
    expect(parseDuration(formatDuration(3600000))).toBe(3600000);
  });
});

describe("round-trip: parseCost <-> formatCost", () => {
  test("parse then format", () => {
    expect(formatCost(parseCost("$1.50")!)).toBe("$1.50");
    expect(formatCost(parseCost("$0.01")!)).toBe("$0.01");
    expect(formatCost(parseCost("99.99")!)).toBe("$99.99");
  });

  test("format then parse", () => {
    expect(parseCost(formatCost(1.5))).toBe(1.5);
    expect(parseCost(formatCost(99.99))).toBe(99.99);
    expect(parseCost(formatCost(0))).toBe(0);
  });
});
