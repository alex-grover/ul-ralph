import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// Mock data storage
let mockLists: Array<{
  id: string;
  userId: string | null;
  anonymousSessionId: string | null;
  name: string;
  slug: string;
  description: string | null;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}> = [];

let mockAnonymousSessions: Array<{
  id: string;
  sessionToken: string;
  expiresAt: Date;
}> = [];

let mockAuthenticatedUsers: Array<{
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

// Mock cookie store
const mockCookies = new Map<string, string>();

// Helper to create mock dates
const now = new Date();
const futureDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);

// Track query context
let isSlugQuery = false;
let _currentUserId: string | null = null;
let currentAnonSessionId: string | null = null;

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
        mockCookies.delete(name);
      },
    })
  ),
}));

// Mock database with context tracking
vi.mock("@/db", () => ({
  db: {
    select: vi.fn().mockImplementation((selectObj?: Record<string, unknown>) => {
      // Detect if this is a slug-only query
      if (selectObj && "slug" in selectObj && Object.keys(selectObj).length === 1) {
        isSlugQuery = true;
      } else {
        isSlugQuery = false;
      }

      return {
        from: vi.fn().mockImplementation(() => ({
          where: vi.fn().mockImplementation(() => {
            if (isSlugQuery) {
              // Return existing slugs for the current user/session
              const sessionToken = mockCookies.get("session_token");
              const anonToken = mockCookies.get("anonymous_session_token");

              let filterUserId: string | null = null;
              let filterAnonId: string | null = null;

              if (sessionToken) {
                const session = mockSessions.find(
                  (s) =>
                    s.sessionToken === sessionToken && s.expiresAt > new Date()
                );
                if (session) {
                  filterUserId = session.userId;
                }
              }

              if (!filterUserId && anonToken) {
                const anonSession = mockAnonymousSessions.find(
                  (s) =>
                    s.sessionToken === anonToken && s.expiresAt > new Date()
                );
                if (anonSession) {
                  filterAnonId = anonSession.id;
                }
              }

              // Also check for newly created anonymous session
              if (!filterUserId && !filterAnonId && currentAnonSessionId) {
                filterAnonId = currentAnonSessionId;
              }

              const userLists = mockLists.filter((l) =>
                filterUserId
                  ? l.userId === filterUserId
                  : l.anonymousSessionId === filterAnonId
              );
              return Promise.resolve(userLists.map((l) => ({ slug: l.slug })));
            }

            // Regular query chain
            return {
              orderBy: vi.fn().mockImplementation(() => {
                const sessionToken = mockCookies.get("session_token");
                const anonToken = mockCookies.get("anonymous_session_token");

                if (sessionToken) {
                  const session = mockSessions.find(
                    (s) =>
                      s.sessionToken === sessionToken &&
                      s.expiresAt > new Date()
                  );
                  if (session) {
                    return Promise.resolve(
                      mockLists.filter((l) => l.userId === session.userId)
                    );
                  }
                }

                if (anonToken) {
                  const anonSession = mockAnonymousSessions.find(
                    (s) =>
                      s.sessionToken === anonToken && s.expiresAt > new Date()
                  );
                  if (anonSession) {
                    return Promise.resolve(
                      mockLists.filter(
                        (l) => l.anonymousSessionId === anonSession.id
                      )
                    );
                  }
                }

                return Promise.resolve([]);
              }),
              limit: vi.fn().mockImplementation(() => {
                const sessionToken = mockCookies.get("session_token");
                const anonToken = mockCookies.get("anonymous_session_token");

                if (sessionToken) {
                  const session = mockSessions.find(
                    (s) =>
                      s.sessionToken === sessionToken &&
                      s.expiresAt > new Date()
                  );
                  if (session) {
                    const user = mockAuthenticatedUsers.find(
                      (u) => u.id === session.userId
                    );
                    if (user) {
                      return Promise.resolve([
                        {
                          userId: session.userId,
                          username: user.username,
                          email: user.email,
                        },
                      ]);
                    }
                  }
                }

                if (anonToken) {
                  const anonSession = mockAnonymousSessions.find(
                    (s) =>
                      s.sessionToken === anonToken && s.expiresAt > new Date()
                  );
                  if (anonSession) {
                    return Promise.resolve([anonSession]);
                  }
                }

                return Promise.resolve([]);
              }),
            };
          }),
          innerJoin: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockImplementation(() => {
            return Promise.resolve(mockLists);
          }),
        })),
      };
    }),
    insert: vi.fn().mockImplementation(() => ({
      values: vi.fn().mockImplementation((data: Record<string, unknown>) => ({
        returning: vi.fn().mockImplementation(() => {
          if ("sessionToken" in data) {
            // Anonymous session insert
            const newSession = {
              id: crypto.randomUUID(),
              sessionToken: data.sessionToken as string,
              expiresAt: data.expiresAt as Date,
            };
            mockAnonymousSessions.push(newSession);
            currentAnonSessionId = newSession.id;
            // Set the cookie so subsequent queries can find the session
            mockCookies.set(
              "anonymous_session_token",
              newSession.sessionToken
            );
            return Promise.resolve([{ id: newSession.id }]);
          }

          // List insert
          const newList = {
            id: crypto.randomUUID(),
            userId: data.userId as string | null,
            anonymousSessionId: data.anonymousSessionId as string | null,
            name: data.name as string,
            slug: data.slug as string,
            description: data.description as string | null,
            isPublic: data.isPublic as boolean,
            createdAt: now,
            updatedAt: now,
          };
          mockLists.push(newList);
          return Promise.resolve([
            {
              id: newList.id,
              name: newList.name,
              slug: newList.slug,
              description: newList.description,
              isPublic: newList.isPublic,
              createdAt: newList.createdAt,
              updatedAt: newList.updatedAt,
            },
          ]);
        }),
      })),
    })),
  },
}));

// Import after mocking
import { GET, POST } from "./route";

describe("GET /api/lists", () => {
  beforeEach(() => {
    mockLists = [];
    mockAnonymousSessions = [];
    mockAuthenticatedUsers = [];
    mockSessions = [];
    mockCookies.clear();
    isSlugQuery = false;
    _currentUserId = null;
    currentAnonSessionId = null;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty array when no session exists", async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.lists).toEqual([]);
  });

  it("returns empty array for authenticated user with no lists", async () => {
    const userId = crypto.randomUUID();
    const sessionToken = "test-session-token";

    mockAuthenticatedUsers.push({
      id: userId,
      username: "testuser",
      email: "test@example.com",
    });

    mockSessions.push({
      id: crypto.randomUUID(),
      userId,
      sessionToken,
      expiresAt: futureDate,
    });

    mockCookies.set("session_token", sessionToken);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.lists).toEqual([]);
  });

  it("returns lists for authenticated user", async () => {
    const userId = crypto.randomUUID();
    const sessionToken = "test-session-token";

    mockAuthenticatedUsers.push({
      id: userId,
      username: "testuser",
      email: "test@example.com",
    });

    mockSessions.push({
      id: crypto.randomUUID(),
      userId,
      sessionToken,
      expiresAt: futureDate,
    });

    mockLists.push({
      id: crypto.randomUUID(),
      userId,
      anonymousSessionId: null,
      name: "My Pack List",
      slug: "my-pack-list",
      description: "A test list",
      isPublic: false,
      createdAt: now,
      updatedAt: now,
    });

    mockCookies.set("session_token", sessionToken);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.lists).toHaveLength(1);
    expect(data.lists[0].name).toBe("My Pack List");
  });

  it("returns lists for anonymous user", async () => {
    const anonSessionId = crypto.randomUUID();
    const anonToken = "anon-session-token";

    mockAnonymousSessions.push({
      id: anonSessionId,
      sessionToken: anonToken,
      expiresAt: futureDate,
    });

    mockLists.push({
      id: crypto.randomUUID(),
      userId: null,
      anonymousSessionId: anonSessionId,
      name: "Anonymous Pack",
      slug: "anonymous-pack",
      description: null,
      isPublic: false,
      createdAt: now,
      updatedAt: now,
    });

    mockCookies.set("anonymous_session_token", anonToken);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.lists).toHaveLength(1);
    expect(data.lists[0].name).toBe("Anonymous Pack");
  });

  it("does not return lists from other users", async () => {
    const userId = crypto.randomUUID();
    const otherUserId = crypto.randomUUID();
    const sessionToken = "test-session-token";

    mockAuthenticatedUsers.push({
      id: userId,
      username: "testuser",
      email: "test@example.com",
    });

    mockSessions.push({
      id: crypto.randomUUID(),
      userId,
      sessionToken,
      expiresAt: futureDate,
    });

    // Add list for other user
    mockLists.push({
      id: crypto.randomUUID(),
      userId: otherUserId,
      anonymousSessionId: null,
      name: "Other User Pack",
      slug: "other-user-pack",
      description: null,
      isPublic: false,
      createdAt: now,
      updatedAt: now,
    });

    mockCookies.set("session_token", sessionToken);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.lists).toHaveLength(0);
  });

  it("returns empty array for expired session", async () => {
    const userId = crypto.randomUUID();
    const sessionToken = "expired-session-token";

    mockAuthenticatedUsers.push({
      id: userId,
      username: "testuser",
      email: "test@example.com",
    });

    mockSessions.push({
      id: crypto.randomUUID(),
      userId,
      sessionToken,
      expiresAt: new Date(now.getTime() - 1000), // Expired
    });

    mockLists.push({
      id: crypto.randomUUID(),
      userId,
      anonymousSessionId: null,
      name: "My Pack",
      slug: "my-pack",
      description: null,
      isPublic: false,
      createdAt: now,
      updatedAt: now,
    });

    mockCookies.set("session_token", sessionToken);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.lists).toEqual([]);
  });
});

describe("POST /api/lists", () => {
  beforeEach(() => {
    mockLists = [];
    mockAnonymousSessions = [];
    mockAuthenticatedUsers = [];
    mockSessions = [];
    mockCookies.clear();
    isSlugQuery = false;
    _currentUserId = null;
    currentAnonSessionId = null;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("validation", () => {
    it("returns 400 for missing name", async () => {
      const request = new NextRequest("http://localhost:3000/api/lists", {
        method: "POST",
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
      expect(data.details.name).toBeDefined();
    });

    it("returns 400 for empty name", async () => {
      const request = new NextRequest("http://localhost:3000/api/lists", {
        method: "POST",
        body: JSON.stringify({ name: "" }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
      expect(data.details.name).toBeDefined();
    });

    it("returns 400 for name exceeding max length", async () => {
      const request = new NextRequest("http://localhost:3000/api/lists", {
        method: "POST",
        body: JSON.stringify({ name: "a".repeat(256) }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
    });
  });

  describe("list creation", () => {
    it("creates list for authenticated user", async () => {
      const userId = crypto.randomUUID();
      const sessionToken = "test-session-token";

      mockAuthenticatedUsers.push({
        id: userId,
        username: "testuser",
        email: "test@example.com",
      });

      mockSessions.push({
        id: crypto.randomUUID(),
        userId,
        sessionToken,
        expiresAt: futureDate,
      });

      mockCookies.set("session_token", sessionToken);

      const request = new NextRequest("http://localhost:3000/api/lists", {
        method: "POST",
        body: JSON.stringify({
          name: "My Pack List",
          description: "A great pack list",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.message).toBe("List created successfully");
      expect(data.list).toBeDefined();
      expect(data.list.name).toBe("My Pack List");
      expect(data.list.slug).toBe("my-pack-list");
      expect(data.list.description).toBe("A great pack list");
      expect(data.list.isPublic).toBe(false);
    });

    it("creates anonymous session and list for unauthenticated user", async () => {
      const request = new NextRequest("http://localhost:3000/api/lists", {
        method: "POST",
        body: JSON.stringify({
          name: "Anonymous Pack",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.message).toBe("List created successfully");
      expect(data.list.name).toBe("Anonymous Pack");
      expect(data.list.slug).toBe("anonymous-pack");
      // Verify anonymous session was created
      expect(mockAnonymousSessions.length).toBe(1);
    });

    it("creates list with generated slug from name", async () => {
      const userId = crypto.randomUUID();
      const sessionToken = "test-session-token";

      mockAuthenticatedUsers.push({
        id: userId,
        username: "testuser",
        email: "test@example.com",
      });

      mockSessions.push({
        id: crypto.randomUUID(),
        userId,
        sessionToken,
        expiresAt: futureDate,
      });

      mockCookies.set("session_token", sessionToken);

      const request = new NextRequest("http://localhost:3000/api/lists", {
        method: "POST",
        body: JSON.stringify({
          name: "  PCT 2024 Gear!!!  ",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.list.slug).toBe("pct-2024-gear");
    });

    it("creates list with null description when not provided", async () => {
      const userId = crypto.randomUUID();
      const sessionToken = "test-session-token";

      mockAuthenticatedUsers.push({
        id: userId,
        username: "testuser",
        email: "test@example.com",
      });

      mockSessions.push({
        id: crypto.randomUUID(),
        userId,
        sessionToken,
        expiresAt: futureDate,
      });

      mockCookies.set("session_token", sessionToken);

      const request = new NextRequest("http://localhost:3000/api/lists", {
        method: "POST",
        body: JSON.stringify({
          name: "Simple Pack",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.list.description).toBeNull();
    });

    it("creates list for existing anonymous session", async () => {
      const anonSessionId = crypto.randomUUID();
      const anonToken = "anon-session-token";

      mockAnonymousSessions.push({
        id: anonSessionId,
        sessionToken: anonToken,
        expiresAt: futureDate,
      });

      mockCookies.set("anonymous_session_token", anonToken);

      const request = new NextRequest("http://localhost:3000/api/lists", {
        method: "POST",
        body: JSON.stringify({
          name: "Another Pack",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.list.name).toBe("Another Pack");
      // Should not create a new anonymous session
      expect(mockAnonymousSessions.length).toBe(1);
    });
  });

  describe("slug uniqueness", () => {
    it("generates unique slug when duplicate exists", async () => {
      const userId = crypto.randomUUID();
      const sessionToken = "test-session-token";

      mockAuthenticatedUsers.push({
        id: userId,
        username: "testuser",
        email: "test@example.com",
      });

      mockSessions.push({
        id: crypto.randomUUID(),
        userId,
        sessionToken,
        expiresAt: futureDate,
      });

      // Existing list with same slug
      mockLists.push({
        id: crypto.randomUUID(),
        userId,
        anonymousSessionId: null,
        name: "My Pack",
        slug: "my-pack",
        description: null,
        isPublic: false,
        createdAt: now,
        updatedAt: now,
      });

      mockCookies.set("session_token", sessionToken);

      const request = new NextRequest("http://localhost:3000/api/lists", {
        method: "POST",
        body: JSON.stringify({
          name: "My Pack",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.list.slug).toBe("my-pack-1");
    });
  });

  describe("response structure", () => {
    it("returns correct response structure on success", async () => {
      const userId = crypto.randomUUID();
      const sessionToken = "test-session-token";

      mockAuthenticatedUsers.push({
        id: userId,
        username: "testuser",
        email: "test@example.com",
      });

      mockSessions.push({
        id: crypto.randomUUID(),
        userId,
        sessionToken,
        expiresAt: futureDate,
      });

      mockCookies.set("session_token", sessionToken);

      const request = new NextRequest("http://localhost:3000/api/lists", {
        method: "POST",
        body: JSON.stringify({
          name: "Test Pack",
          description: "Test description",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toHaveProperty("message");
      expect(data).toHaveProperty("list");
      expect(data.list).toHaveProperty("id");
      expect(data.list).toHaveProperty("name");
      expect(data.list).toHaveProperty("slug");
      expect(data.list).toHaveProperty("description");
      expect(data.list).toHaveProperty("isPublic");
      expect(data.list).toHaveProperty("createdAt");
      expect(data.list).toHaveProperty("updatedAt");
    });
  });
});
