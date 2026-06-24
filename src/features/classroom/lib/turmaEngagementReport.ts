export interface TurmaEngagementSummary {
  registered_visitors: number;
  guest_visitors: number;
  total_visitors: number;
  sessions: number;
  completed_sessions: number;
  card_views: number;
  answers: number;
  correct_rate: number | null;
  last_activity_at: string | null;
}

export interface TurmaEngagementStudent {
  user_id: string;
  first_name: string;
  ape_id: string | null;
  sessions: number;
  card_views: number;
  answers: number;
  last_activity_at: string;
}

export interface TurmaEngagementList {
  list_id: string;
  title: string;
  sessions: number;
  unique_visitors: number;
  card_views: number;
  last_activity_at: string;
}

export interface TurmaEngagementCard {
  card_id: string;
  list_id: string;
  list_title: string;
  term: string;
  translation: string;
  views: number;
  answers: number;
  correct: number;
  incorrect: number;
  unique_visitors: number;
}

export interface TurmaEngagementDaily {
  activity_date: string;
  sessions: number;
  unique_visitors: number;
  card_views: number;
}

export interface TurmaEngagementReport {
  period_days: number;
  generated_at: string;
  summary: TurmaEngagementSummary;
  students: TurmaEngagementStudent[];
  top_lists: TurmaEngagementList[];
  top_cards: TurmaEngagementCard[];
  daily: TurmaEngagementDaily[];
}

export interface TurmaInterestSignal {
  level: "none" | "low" | "moderate" | "high";
  label: string;
  description: string;
}

const emptySummary = (): TurmaEngagementSummary => ({
  registered_visitors: 0,
  guest_visitors: 0,
  total_visitors: 0,
  sessions: 0,
  completed_sessions: 0,
  card_views: 0,
  answers: 0,
  correct_rate: null,
  last_activity_at: null,
});

export function emptyTurmaEngagementReport(days = 30): TurmaEngagementReport {
  return {
    period_days: days,
    generated_at: new Date(0).toISOString(),
    summary: emptySummary(),
    students: [],
    top_lists: [],
    top_cards: [],
    daily: [],
  };
}

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeTurmaEngagementReport(
  value: unknown,
  days = 30,
): TurmaEngagementReport {
  const fallback = emptyTurmaEngagementReport(days);
  if (!value || typeof value !== "object") return fallback;
  const row = value as Record<string, unknown>;
  const summary = row.summary && typeof row.summary === "object"
    ? row.summary as Record<string, unknown>
    : {};

  return {
    period_days: numberValue(row.period_days) || days,
    generated_at: typeof row.generated_at === "string" ? row.generated_at : new Date().toISOString(),
    summary: {
      registered_visitors: numberValue(summary.registered_visitors),
      guest_visitors: numberValue(summary.guest_visitors),
      total_visitors: numberValue(summary.total_visitors),
      sessions: numberValue(summary.sessions),
      completed_sessions: numberValue(summary.completed_sessions),
      card_views: numberValue(summary.card_views),
      answers: numberValue(summary.answers),
      correct_rate: summary.correct_rate === null || summary.correct_rate === undefined
        ? null
        : numberValue(summary.correct_rate),
      last_activity_at: typeof summary.last_activity_at === "string" ? summary.last_activity_at : null,
    },
    students: Array.isArray(row.students) ? row.students as TurmaEngagementStudent[] : [],
    top_lists: Array.isArray(row.top_lists) ? row.top_lists as TurmaEngagementList[] : [],
    top_cards: Array.isArray(row.top_cards) ? row.top_cards as TurmaEngagementCard[] : [],
    daily: Array.isArray(row.daily) ? row.daily as TurmaEngagementDaily[] : [],
  };
}

export function describeTurmaInterest(summary: TurmaEngagementSummary): TurmaInterestSignal {
  if (summary.total_visitors === 0 || summary.sessions === 0) {
    return {
      level: "none",
      label: "Ainda sem dados",
      description: "Nenhum acesso de estudo foi registrado neste período.",
    };
  }

  const sessionsPerVisitor = summary.sessions / Math.max(summary.total_visitors, 1);
  const cardsPerVisitor = summary.card_views / Math.max(summary.total_visitors, 1);
  const completionRate = summary.sessions > 0
    ? summary.completed_sessions / summary.sessions
    : 0;

  if (sessionsPerVisitor >= 2.5 && cardsPerVisitor >= 12) {
    return {
      level: "high",
      label: "Interesse alto",
      description: "As pessoas voltaram mais de uma vez e praticaram vários cards.",
    };
  }

  if (sessionsPerVisitor >= 1.4 || cardsPerVisitor >= 6 || completionRate >= 0.35) {
    return {
      level: "moderate",
      label: "Interesse moderado",
      description: "Há uso real, mas ainda existe espaço para mais recorrência e conclusão.",
    };
  }

  return {
    level: "low",
    label: "Interesse inicial",
    description: "Houve acessos, porém a prática ainda foi curta ou pouco recorrente.",
  };
}
