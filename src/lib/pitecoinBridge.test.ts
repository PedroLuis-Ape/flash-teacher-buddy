import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: mocks.rpc,
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle: mocks.maybeSingle })),
      })),
    })),
  },
}));

import {
  recordStudyAnswer,
  settleStudySession,
} from "./pitecoinBridge";

describe("PiteCOIN bridge", () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    mocks.maybeSingle.mockReset();
  });

  it("records the exact session and card result", async () => {
    mocks.rpc.mockResolvedValue({ data: { success: true }, error: null });

    const result = await recordStudyAnswer(
      "session-1",
      "card-1",
      true,
      false,
    );

    expect(result).toEqual({ success: true });
    expect(mocks.rpc).toHaveBeenCalledWith("ensure_piteco_profile", {
      p_session_id: "session-1",
      p_flashcard_id: "card-1",
      p_correct: true,
      p_skipped: false,
    });
  });

  it("normalizes the authoritative session reward", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        success: true,
        reward_amount: 35,
        new_balance: 120,
        breakdown: {
          pts_awarded: 45,
          xp_awarded: 45,
          first_list_completion: 15,
        },
      },
      error: null,
    });

    const result = await settleStudySession("session-1", true);

    expect(mocks.rpc).toHaveBeenCalledWith("ensure_piteco_profile", {
      p_session_id: "session-1",
      p_fill_missing: true,
    });
    expect(result).toMatchObject({
      success: true,
      pitecoinAwarded: 35,
      ptsAwarded: 45,
      xpAwarded: 45,
      newBalance: 120,
    });
  });

  it("returns a stable failure instead of inventing a reward", async () => {
    mocks.rpc.mockResolvedValue({
      data: { success: false, error: "SESSION_TOO_SHORT" },
      error: null,
    });

    await expect(settleStudySession("session-1")).resolves.toMatchObject({
      success: false,
      pitecoinAwarded: 0,
      error: "SESSION_TOO_SHORT",
    });
  });
});
