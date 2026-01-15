import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock data storage
let mockUsers: Array<{
  id: string;
  username: string;
  email: string;
}> = [];

let mockSessions: Array<{
  id: string;
  userId: string;
  sessionToken: string;
  expiresAt: Date;
}> = [];

let mockAnonymousSessions: Array<{
  id: string;
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

// Track database operations
let createdAnonymousSessions: Array<{
  sessionToken: string;
  expiresAt: Date;
}> = [];

// Mock database
vi.mock("@/db", () => ({
  db: {
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockImplementation(() => {
        // Check for authenticated session first
        const sessionToken = mockCookies.get("session_token");
        if (sessionToken) {
          const session = mockSessions.find(
            (s) => s.sessionToken === sessionToken && s.expiresAt > new Date()
          );
          if (session) {
            const user = mockUsers.find((u) => u.id === session.userId);
            if (user) {
              return Promise.resolve([
                {
                  userId: user.id,
                  username: user.username,
                  email: user.email,
                },
              ]);
            }
          }
        }

        // Check for anonymous session
        const anonToken = mockCookies.get("anonymous_session_token");
        if (anonToken) {
          const anonSession = mockAnonymousSessions.find(
            (s) => s.sessionToken === anonToken && s.expiresAt > new Date()
          );
          if (anonSession) {
            return Promise.resolve([anonSession]);
          }
        }

        return Promise.resolve([]);
      }),
    })),
    insert: vi.fn().mockImplementation(() => ({
      values: vi.fn().mockImplementation((data) => ({
        returning: vi.fn().mockImplementation(() => {
          const newSession = {
            id: crypto.randomUUID(),
            sessionToken: data.sessionToken,
            expiresAt: data.expiresAt,
          };
          mockAnonymousSessions.push(newSession);
          createdAnonymousSessions.push({
            sessionToken: data.sessionToken,
            expiresAt: data.expiresAt,
          });
          return Promise.resolve([{ id: newSession.id }]);
        }),
      })),
    })),
    delete: vi.fn().mockImplementation(() => ({
      where: vi.fn().mockImplementation(() => {
        // Delete anonymous session
        const anonToken = mockCookies.get("anonymous_session_token");
        if (anonToken) {
          mockAnonymousSessions = mockAnonymousSessions.filter(
            (s) => s.sessionToken !== anonToken
          );
        }
        return Promise.resolve();
      }),
    })),
  },
}));

// Import after mocking
import { POST, GET, DELETE } from "./route";

describe("Anonymous session endpoints", () => {
  beforeEach(() => {
    mockUsers = [];
    mockSessions = [];
    mockAnonymousSessions = [];
    mockCookies.clear();
    deletedCookies = [];
    createdAnonymousSessions = [];
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("POST /api/auth/anonymous", () => {
    it("creates new anonymous session when none exists", async () => {
      const response = await POST();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBeDefined();
      expect(data.message).toBe("Anonymous session created or retrieved");
    });

    it("retrieves existing anonymous session", async () => {
      // Set up existing anonymous session
      const existingSession = {
        id: crypto.randomUUID(),
        sessionToken: "existing-anon-token",
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };
      mockAnonymousSessions.push(existingSession);
      mockCookies.set("anonymous_session_token", existingSession.sessionToken);

      const response = await POST();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe(existingSession.id);
    });

    it("returns 400 when user is already authenticated", async () => {
      // Set up authenticated user
      const user = {
        id: crypto.randomUUID(),
        username: "testuser",
        email: "test@example.com",
      };
      mockUsers.push(user);

      const session = {
        id: crypto.randomUUID(),
        userId: user.id,
        sessionToken: "auth-session-token",
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };
      mockSessions.push(session);
      mockCookies.set("session_token", session.sessionToken);

      const response = await POST();
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe(
        "Already authenticated. Anonymous session not needed."
      );
    });
  });

  describe("GET /api/auth/anonymous", () => {
    it("returns authenticated type when user is signed in", async () => {
      // Set up authenticated user
      const user = {
        id: crypto.randomUUID(),
        username: "testuser",
        email: "test@example.com",
      };
      mockUsers.push(user);

      const session = {
        id: crypto.randomUUID(),
        userId: user.id,
        sessionToken: "auth-session-token",
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };
      mockSessions.push(session);
      mockCookies.set("session_token", session.sessionToken);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.type).toBe("authenticated");
      expect(data.userId).toBe(user.id);
      expect(data.username).toBe("testuser");
      expect(data.email).toBe("test@example.com");
    });

    it("returns anonymous type when anonymous session exists", async () => {
      const anonSession = {
        id: crypto.randomUUID(),
        sessionToken: "anon-token",
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };
      mockAnonymousSessions.push(anonSession);
      mockCookies.set("anonymous_session_token", anonSession.sessionToken);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.type).toBe("anonymous");
      expect(data.anonymousSessionId).toBe(anonSession.id);
    });

    it("returns none type when no session exists", async () => {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.type).toBe("none");
    });

    it("returns none type for expired anonymous session", async () => {
      const anonSession = {
        id: crypto.randomUUID(),
        sessionToken: "expired-anon-token",
        expiresAt: new Date(Date.now() - 1000), // Expired
      };
      mockAnonymousSessions.push(anonSession);
      mockCookies.set("anonymous_session_token", anonSession.sessionToken);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.type).toBe("none");
    });
  });

  describe("DELETE /api/auth/anonymous", () => {
    it("deletes anonymous session successfully", async () => {
      const anonSession = {
        id: crypto.randomUUID(),
        sessionToken: "anon-token-to-delete",
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };
      mockAnonymousSessions.push(anonSession);
      mockCookies.set("anonymous_session_token", anonSession.sessionToken);

      const response = await DELETE();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("Anonymous session deleted successfully");
    });

    it("deletes cookie when deleting session", async () => {
      const anonSession = {
        id: crypto.randomUUID(),
        sessionToken: "anon-token-to-delete",
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };
      mockAnonymousSessions.push(anonSession);
      mockCookies.set("anonymous_session_token", anonSession.sessionToken);

      await DELETE();

      expect(deletedCookies).toContain("anonymous_session_token");
    });

    it("handles deletion when no anonymous session exists", async () => {
      const response = await DELETE();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("Anonymous session deleted successfully");
    });
  });

  describe("session priority", () => {
    it("authenticated session takes priority over anonymous", async () => {
      // Set up both sessions
      const user = {
        id: crypto.randomUUID(),
        username: "testuser",
        email: "test@example.com",
      };
      mockUsers.push(user);

      const authSession = {
        id: crypto.randomUUID(),
        userId: user.id,
        sessionToken: "auth-session-token",
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };
      mockSessions.push(authSession);
      mockCookies.set("session_token", authSession.sessionToken);

      const anonSession = {
        id: crypto.randomUUID(),
        sessionToken: "anon-token",
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };
      mockAnonymousSessions.push(anonSession);
      mockCookies.set("anonymous_session_token", anonSession.sessionToken);

      const response = await GET();
      const data = await response.json();

      expect(data.type).toBe("authenticated");
    });
  });
});
