import type { StudyDeckSource } from "./studyDeckLoader";

export type StudyDeckUnconfirmedReason =
  | "verification-unavailable"
  | "resource-unavailable"
  | "auth-or-access"
  | "network"
  | "invalid-deck"
  | "cards-present-but-unavailable"
  | "unknown";

export type StudyDeckAvailabilityProbe =
  | {
      status: "verified";
      resourceExists: boolean;
      rawCount: number;
      playableCount?: number;
    }
  | {
      status: "unconfirmed";
      reason: StudyDeckUnconfirmedReason;
    };

export type StudyDeckAvailability =
  | {
      status: "has-cards";
      rawCount: number;
      playableCount?: number;
      source: StudyDeckSource;
    }
  | {
      status: "confirmed-empty";
      rawCount: 0;
      playableCount: 0;
      source: StudyDeckSource;
    }
  | {
      status: "unconfirmed";
      reason: StudyDeckUnconfirmedReason;
      source: StudyDeckSource;
    };

interface VerifyStudyDeckAvailabilityOptions {
  source: StudyDeckSource;
  rawCount: number;
  playableCount?: number;
  probe?: () => Promise<StudyDeckAvailabilityProbe>;
}

function normalizeCount(value: number | undefined): number | undefined {
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : undefined;
}

/**
 * Converts transport evidence into a business-level availability decision.
 * An empty payload is never sufficient evidence by itself.
 */
export async function verifyStudyDeckAvailability(
  options: VerifyStudyDeckAvailabilityOptions,
): Promise<StudyDeckAvailability> {
  const rawCount = normalizeCount(options.rawCount);
  const playableCount = normalizeCount(options.playableCount);

  if (rawCount === undefined) {
    return { status: "unconfirmed", reason: "unknown", source: options.source };
  }

  if (rawCount > 0) {
    if (playableCount === 0) {
      return { status: "unconfirmed", reason: "invalid-deck", source: options.source };
    }
    return {
      status: "has-cards",
      rawCount,
      ...(playableCount === undefined ? {} : { playableCount }),
      source: options.source,
    };
  }

  if (!options.probe) {
    return {
      status: "unconfirmed",
      reason: "verification-unavailable",
      source: options.source,
    };
  }

  const probe = await options.probe();
  if (probe.status === "unconfirmed") {
    return { ...probe, source: options.source };
  }
  if (!probe.resourceExists) {
    return {
      status: "unconfirmed",
      reason: "resource-unavailable",
      source: options.source,
    };
  }

  const verifiedRawCount = normalizeCount(probe.rawCount);
  const verifiedPlayableCount = normalizeCount(probe.playableCount);
  if (verifiedRawCount === undefined) {
    return { status: "unconfirmed", reason: "unknown", source: options.source };
  }
  if (verifiedRawCount === 0) {
    if (verifiedPlayableCount !== undefined && verifiedPlayableCount !== 0) {
      return { status: "unconfirmed", reason: "unknown", source: options.source };
    }
    return {
      status: "confirmed-empty",
      rawCount: 0,
      playableCount: 0,
      source: options.source,
    };
  }
  if (verifiedPlayableCount === 0) {
    return { status: "unconfirmed", reason: "invalid-deck", source: options.source };
  }

  return {
    status: "has-cards",
    rawCount: verifiedRawCount,
    ...(verifiedPlayableCount === undefined ? {} : { playableCount: verifiedPlayableCount }),
    source: options.source,
  };
}

export function classifyStudyDeckVerificationError(
  error: unknown,
): StudyDeckUnconfirmedReason {
  const candidate = error && typeof error === "object"
    ? error as { code?: unknown; message?: unknown; status?: unknown }
    : null;
  const code = String(candidate?.code ?? "").toUpperCase();
  const message = String(candidate?.message ?? error ?? "").toLowerCase();
  const status = Number(candidate?.status);

  if (
    code === "PGRST202"
    || code === "42883"
    || message.includes("could not find the function")
    || message.includes("does not exist")
  ) {
    return "verification-unavailable";
  }
  if (
    status === 401
    || status === 403
    || code === "42501"
    || code.startsWith("PGRST3")
    || message.includes("permission denied")
    || message.includes("jwt")
  ) {
    return "auth-or-access";
  }
  if (
    message.includes("failed to fetch")
    || message.includes("network")
    || message.includes("timeout")
  ) {
    return "network";
  }
  return "unknown";
}
