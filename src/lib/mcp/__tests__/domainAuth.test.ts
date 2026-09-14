import { describe, expect, it } from "vitest";
import { ToolContext } from "@lovable.dev/mcp-js";
import { createUserScopedClient, createUserScopedDb, requireAuthenticatedUser } from "../domain/client";
import { isMcpDomainError } from "../domain/errors";
import { USER_A } from "./fixtures";

const TOKEN = "unit-test-token-value";

function authenticatedContext(userId: string = USER_A): ToolContext {
  return new ToolContext({
    type: "oauth",
    principal: {
      claims: { sub: userId, aud: "authenticated" },
      issuer: "https://ymahldldyxvwjeruaxpr.supabase.co/auth/v1",
      resource: "https://ymahldldyxvwjeruaxpr.supabase.co/functions/v1/mcp",
      acceptedAudiences: ["authenticated"],
      scopes: [],
      sub: userId,
    },
    bearer: { token: TOKEN },
  } as unknown as ConstructorParameters<typeof ToolContext>[0]);
}

describe("MCP domain authentication gate", () => {
  it("rejects an unauthenticated tool context with a controlled error", () => {
    const context = new ToolContext(undefined);
    expect(context.isAuthenticated()).toBe(false);
    expect(() => requireAuthenticatedUser(context)).toThrowError(/autenticada/i);
    try {
      requireAuthenticatedUser(context);
    } catch (error) {
      expect(isMcpDomainError(error)).toBe(true);
      expect((error as { code: string }).code).toBe("unauthenticated");
    }
  });

  it("rejects an object without identity accessors", () => {
    expect(() => requireAuthenticatedUser({})).toThrowError(/autenticada/i);
    expect(() => requireAuthenticatedUser(undefined)).toThrowError(/autenticada/i);
  });

  it("takes the identity from the verified token claims", () => {
    const identity = requireAuthenticatedUser(authenticatedContext());
    expect(identity.userId).toBe(USER_A);
    expect(identity.token).toBe(TOKEN);
  });

  it("builds a scoped db that never exposes the bearer", () => {
    const db = createUserScopedDb(authenticatedContext());
    expect(db.userId).toBe(USER_A);
    expect(Object.keys(db).sort()).toEqual(["client", "userId"]);
    expect(typeof db.client.from).toBe("function");
    for (const property of Object.getOwnPropertyNames(db)) {
      expect(property).not.toMatch(/token|authorization/i);
    }
    expect(Object.values(db).some((value) => value === TOKEN)).toBe(false);
  });

  it("creates a user-scoped client without touching the network", () => {
    const client = createUserScopedClient(TOKEN);
    expect(typeof client.from).toBe("function");
    expect(typeof client.rpc).toBe("function");
  });
});
