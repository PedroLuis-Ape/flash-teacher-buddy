/**
 * Local Performance Telemetry
 * Registra métricas de boot, navegação e início de jogo.
 * Sem servidor — apenas console e localStorage.
 */

interface PerfEntry {
  label: string;
  durationMs: number;
  timestamp: number;
}

const STORAGE_KEY = "ape_perf_log";
const MAX_ENTRIES = 50;

const bootStart = Date.now();

class PerfTelemetry {
  private marks = new Map<string, number>();

  /** Marca início de uma medição */
  mark(label: string) {
    this.marks.set(label, performance.now());
  }

  /** Finaliza medição e registra */
  measure(label: string): number {
    const start = this.marks.get(label);
    if (start == null) return 0;
    const duration = Math.round(performance.now() - start);
    this.marks.delete(label);
    this.log({ label, durationMs: duration, timestamp: Date.now() });
    return duration;
  }

  /** Registra tempo de boot (chamado no App mount) */
  logBoot() {
    const duration = Date.now() - bootStart;
    this.log({ label: "boot", durationMs: duration, timestamp: Date.now() });
    console.log(`[Perf] Boot: ${duration}ms`);
  }

  /** Registra navegação de página */
  logPageOpen(pageName: string, durationMs: number) {
    this.log({ label: `page:${pageName}`, durationMs, timestamp: Date.now() });
    console.log(`[Perf] Page "${pageName}": ${durationMs}ms`);
  }

  /** Registra início de jogo */
  logGameStart(mode: string, durationMs: number) {
    this.log({ label: `game:${mode}`, durationMs, timestamp: Date.now() });
    console.log(`[Perf] Game "${mode}" start: ${durationMs}ms`);
  }

  /** Retorna últimas entradas (para /debug) */
  getEntries(): PerfEntry[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /** Limpa log */
  clear() {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }

  private log(entry: PerfEntry) {
    try {
      const entries = this.getEntries();
      entries.push(entry);
      // Keep only last N entries
      const trimmed = entries.slice(-MAX_ENTRIES);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      // localStorage full or unavailable — silently ignore
    }
  }
}

export const perfTelemetry = new PerfTelemetry();
