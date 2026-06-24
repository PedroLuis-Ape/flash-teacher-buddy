import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  describeTurmaInterest,
  normalizeTurmaEngagementReport,
} from "./lib/turmaEngagementReport";

const read = (path: string) => readFileSync(path, "utf8");

describe("turma engagement analytics", () => {
  it("normalizes the owner report returned by the RPC", () => {
    const report = normalizeTurmaEngagementReport({
      period_days: 30,
      generated_at: "2026-06-24T20:00:00.000Z",
      summary: {
        registered_visitors: "4",
        guest_visitors: 7,
        total_visitors: 11,
        sessions: 19,
        completed_sessions: 8,
        card_views: 240,
        answers: 80,
        correct_rate: 76.5,
      },
      students: [{ user_id: "student-1", sessions: 3 }],
      top_lists: [{ list_id: "list-1", title: "Verbos" }],
      top_cards: [{ card_id: "card-1", term: "depend" }],
      daily: [],
    });

    expect(report.summary).toMatchObject({
      registered_visitors: 4,
      guest_visitors: 7,
      total_visitors: 11,
      sessions: 19,
      card_views: 240,
      correct_rate: 76.5,
    });
    expect(report.students).toHaveLength(1);
    expect(report.top_cards).toHaveLength(1);
  });

  it("describes interest without pretending that one click is strong engagement", () => {
    expect(describeTurmaInterest({
      registered_visitors: 0,
      guest_visitors: 0,
      total_visitors: 0,
      sessions: 0,
      completed_sessions: 0,
      card_views: 0,
      answers: 0,
      correct_rate: null,
      last_activity_at: null,
    }).level).toBe("none");

    expect(describeTurmaInterest({
      registered_visitors: 1,
      guest_visitors: 9,
      total_visitors: 10,
      sessions: 10,
      completed_sessions: 1,
      card_views: 18,
      answers: 0,
      correct_rate: null,
      last_activity_at: null,
    }).level).toBe("low");

    expect(describeTurmaInterest({
      registered_visitors: 4,
      guest_visitors: 6,
      total_visitors: 10,
      sessions: 30,
      completed_sessions: 12,
      card_views: 180,
      answers: 40,
      correct_rate: 70,
      last_activity_at: null,
    }).level).toBe("high");
  });

  it("keeps guest identities private and connects study tracking to the panel", () => {
    const migration = read("supabase/migrations/20260624210000_turma_engagement_analytics_v1.sql");
    const tracker = read("src/features/classroom/hooks/useTurmaEngagementTracking.ts");
    const panel = read("src/features/classroom/components/TurmaEngagementPanel.tsx");

    expect(migration).toContain("digest(_visitor_token, 'sha256')");
    expect(migration).toContain("get_turma_engagement_report_v1");
    expect(migration).toContain("Only the classroom owner");
    expect(migration).not.toContain("ip_address");
    expect(tracker).toContain("record_turma_engagement_v1");
    expect(tracker).toContain("trackCardViewed");
    expect(panel).toContain("Cards mais praticados");
    expect(panel).toContain("acessos sem conta entram apenas nos totais");
  });
});
