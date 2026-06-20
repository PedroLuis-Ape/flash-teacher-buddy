export type BundleBudgetStatus = "within-budget" | "over-budget";

export interface BundleAssetSummary {
  file: string;
  rawBytes: number;
  gzipBytes: number;
}

export interface BundleReport {
  schemaVersion: 1;
  generatedAt: string;
  status: BundleBudgetStatus;
  javascript: {
    totalRawBytes: number;
    totalGzipBytes: number;
    largest: BundleAssetSummary | null;
  };
  css: {
    totalRawBytes: number;
    totalGzipBytes: number;
    largest: BundleAssetSummary | null;
  };
}

const isNonNegativeNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

export function parseBundleReport(value: unknown): BundleReport | null {
  if (!value || typeof value !== "object") return null;

  const report = value as Partial<BundleReport>;
  if (report.schemaVersion !== 1) return null;
  if (report.status !== "within-budget" && report.status !== "over-budget") return null;
  if (typeof report.generatedAt !== "string") return null;
  if (!report.javascript || !report.css) return null;
  if (!isNonNegativeNumber(report.javascript.totalRawBytes)) return null;
  if (!isNonNegativeNumber(report.javascript.totalGzipBytes)) return null;
  if (!isNonNegativeNumber(report.css.totalRawBytes)) return null;
  if (!isNonNegativeNumber(report.css.totalGzipBytes)) return null;

  return report as BundleReport;
}

export function formatBundleBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

export function describeBundleReport(report: BundleReport): string {
  const largest = report.javascript.largest
    ? `Maior JS: ${formatBundleBytes(report.javascript.largest.gzipBytes)}.`
    : "Nenhum arquivo JavaScript encontrado.";

  return `JS total: ${formatBundleBytes(report.javascript.totalGzipBytes)}. CSS total: ${formatBundleBytes(report.css.totalGzipBytes)}. ${largest}`;
}
