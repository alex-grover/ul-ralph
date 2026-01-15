import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock data storage
let mockSessions: Array<{
  id: string;
  userId: string;
  sessionToken: string;
  expiresAt: Date;
}> = [];

// Mock cookie store
const mockCookies = new Map<string, string>();
let deletedCookies: string[] = [];

// Mock next/headers
vi.mock("next/headers", () => ({
  cookies: vi.fn(() =>
    Promise.resolve({
      get: (name: string) => {
        const value = mockCookies.get(name);
        return value ? { value } : undefined;
      },
      set: (name: string, value: string) => {
        mockCookies.set(name, value);
      },
      delete: (name: string) => {
        deletedCookies.push(name);
        mockCookies.delete(name);
      },
    })
  ),
}));

// Track which sessions were deleted
let deletedSessionTokens: string[] = [];

// Mock database
vi.mock("@/db", () => ({
  db: {
    delete: vi.fn().mockImplementation(() => ({
      where: vi.fn().mockImplementation(() => {
        // Track deleted sessions
        const sessionToken = mockCookies.get("session_token");
        if (sessionToken) {
          deletedSessionTokens.push(sessionToken);
          mockSessions = mockSessions.filter(
            (s) => s.sessionToken !== sessionToken
          );
        }
        return Promise.resolve();
      }),
    })),
  },
}));

// Import after mocking
import { POST } from "./route";

describe("POST /api/auth/signout", () => {
  beforeEach(() => {
    mockSessions = [];
    mockCookies.clear();
    deletedCookies = [];
    deletedSessionTokens = [];
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("successful signout", () => {
    it("returns 200 with success message", async () => {
      // Set up an existing session
      const sessionToken = "test-session-token";
      mockCookies.set("session_token", sessionToken);
      mockSessions.push({
        id: crypto.randomUUID(),
        userId: crypto.randomUUID(),
        sessionToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      const response = await POST();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("Signed out successfully");
    });

    it("deletes session cookie", async () => {
      const sessionToken = "test-session-token";
      mockCookies.set("session_token", sessionToken);

      await POST();

      expect(deletedCookies).toContain("session_token");
    });

    it("handles signout when no session exists", async () => {
      // No session cookie set
      const response = await POST();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("Signed out successfully");
    });
  });

  describe("edge cases", () => {
    it("handles expired session token gracefully", async () => {
      // Set up an expired session cookie
      const sessionToken = "expired-session-token";
      mockCookies.set("session_token", sessionToken);
      // Session exists but is expired
      mockSessions.push({
        id: crypto.randomUUID(),
        userId: crypto.randomUUID(),
        sessionToken,
        expiresAt: new Date(Date.now() - 1000), // Expired
      });

      const response = await POST();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("Signed out successfully");
    });

    it("handles invalid session token gracefully", async () => {
      // Set up a session cookie with invalid token
      mockCookies.set("session_token", "invalid-token-not-in-db");

      const response = await POST();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("Signed out successfully");
    });
  });
});
