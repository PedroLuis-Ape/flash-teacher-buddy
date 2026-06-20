import { describe, expect, it } from "vitest";
import {
  describeBundleReport,
  formatBundleBytes,
  parseBundleReport,
  type BundleReport,
} from "./bundleHealth";

const report: BundleReport = {
  schemaVersion: 1,
  generatedAt: "2026-06-20T00:00:00.000Z",
  status: "within-budget",
  javascript: {
    totalRawBytes: 1_000_000,
    totalGzipBytes: 320_000,
    largest: {
      file: "assets/index.js",
      rawBytes: 500_000,
      gzipBytes: 160_000,
    },
  },
  css: {
    totalRawBytes: 120_000,
    totalGzipBytes: 30_000,
    largest: {
      file: "assets/index.css",
      rawBytes: 120_000,
      gzipBytes: 30_000,
    },
  },
};

describe("bundleHealth", () => {
  it("aceita o formato seguro do relatório gerado pelo build", () => {
    expect(parseBundleReport(report)).toEqual(report);
  });

  it("rejeita versões desconhecidas e campos inválidos", () => {
    expect(parseBundleReport({ ...report, schemaVersion: 2 })).toBeNull();
    expect(parseBundleReport({ ...report, status: "unknown" })).toBeNull();
    expect(parseBundleReport({
      ...report,
      javascript: { ...report.javascript, totalGzipBytes: -1 },
    })).toBeNull();
  });

  it("formata bytes para leitura humana", () => {
    expect(formatBundleBytes(512)).toBe("512 B");
    expect(formatBundleBytes(2048)).toBe("2.0 KiB");
    expect(formatBundleBytes(2 * 1024 * 1024)).toBe("2.00 MiB");
  });

  it("resume os principais custos comprimidos", () => {
    expect(describeBundleReport(report)).toContain("JS total: 312.5 KiB");
    expect(describeBundleReport(report)).toContain("CSS total: 29.3 KiB");
    expect(describeBundleReport(report)).toContain("Maior JS: 156.3 KiB");
  });
});
