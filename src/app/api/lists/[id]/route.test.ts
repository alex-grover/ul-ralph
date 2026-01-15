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

let mockCategories: Array<{
  id: string;
  listId: string;
  name: string;
  description: string | null;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}> = [];

let mockItems: Array<{
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  url: string | null;
  weightAmount: number;
  weightUnit: string;
  label: string;
  quantity: number;
  position: number;
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
let queryListId: string | null = null;

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

// Mock cache revalidation
vi.mock("@/lib/cache", () => ({
  revalidateListCache: vi.fn(),
}));

// Helper to get current session
function _getCurrentSessionFromMock(): {
  type: "authenticated" | "anonymous";
  userId?: string;
  anonymousSessionId?: string;
} | null {
  const sessionToken = mockCookies.get("session_token");
  const anonToken = mockCookies.get("anonymous_session_token");

  if (sessionToken) {
    const session = mockSessions.find(
      (s) => s.sessionToken === sessionToken && s.expiresAt > new Date()
    );
    if (session) {
      const user = mockAuthenticatedUsers.find((u) => u.id === session.userId);
      if (user) {
        return { type: "authenticated", userId: session.userId };
      }
    }
  }

  if (anonToken) {
    const anonSession = mockAnonymousSessions.find(
      (s) => s.sessionToken === anonToken && s.expiresAt > new Date()
    );
    if (anonSession) {
      return { type: "anonymous", anonymousSessionId: anonSession.id };
    }
  }

  return null;
}

// Query call counter to distinguish between different queries in the same request
let queryCallCount = 0;

// Mock database - simplified approach focusing on key flows
vi.mock("@/db", () => ({
  db: {
    select: vi.fn().mockImplementation(() => {
      queryCallCount++;
      const currentCallCount = queryCallCount;

      return {
        from: vi.fn().mockImplementation(() => ({
          where: vi.fn().mockImplementation(() => ({
            limit: vi.fn().mockImplementation(() => {
              // Determine query type by checking if we have session cookies
              const sessionToken = mockCookies.get("session_token");
              const anonToken = mockCookies.get("anonymous_session_token");
              const hasSessionCookie = sessionToken || anonToken;

              // If no session cookie, every query is a list lookup
              // If has session cookie:
              //   - First query is session lookup
              //   - Second+ queries are list lookups
              const isSessionLookup = hasSessionCookie && currentCallCount === 1;

              if (isSessionLookup) {
                // Session lookup
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
              } else {
                // List lookup
                if (queryListId) {
                  const list = mockLists.find((l) => l.id === queryListId);
                  if (list) {
                    return Promise.resolve([list]);
                  }
                }
                return Promise.resolve([]);
              }
            }),
            orderBy: vi.fn().mockImplementation(() => {
              // For categories lookup
              if (queryListId) {
                return Promise.resolve(
                  mockCategories
                    .filter((c) => c.listId === queryListId)
                    .sort((a, b) => a.position - b.position)
                );
              }
              return Promise.resolve([]);
            }),
          })),
          innerJoin: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockImplementation(() => {
            // For items lookup
            return Promise.resolve(
              mockItems.sort((a, b) => a.position - b.position)
            );
          }),
        })),
      };
    }),
    update: vi.fn().mockImplementation(() => ({
      set: vi.fn().mockImplementation((updateData: Record<string, unknown>) => ({
        where: vi.fn().mockImplementation(() => ({
          returning: vi.fn().mockImplementation(() => {
            if (!queryListId) return Promise.resolve([]);
            const listIndex = mockLists.findIndex((l) => l.id === queryListId);
            if (listIndex === -1) return Promise.resolve([]);

            const updatedList = {
              ...mockLists[listIndex],
              ...updateData,
            };
            mockLists[listIndex] = updatedList;

            return Promise.resolve([
              {
                id: updatedList.id,
                name: updatedList.name,
                slug: updatedList.slug,
                description: updatedList.description,
                isPublic: updatedList.isPublic,
                createdAt: updatedList.createdAt,
                updatedAt: updatedList.updatedAt,
              },
            ]);
          }),
        })),
      })),
    })),
    delete: vi.fn().mockImplementation(() => ({
      where: vi.fn().mockImplementation(() => {
        if (queryListId) {
          const listIndex = mockLists.findIndex((l) => l.id === queryListId);
          if (listIndex !== -1) {
            mockLists.splice(listIndex, 1);
          }
        }
        return Promise.resolve();
      }),
    })),
  },
}));

// Import after mocking
import { GET, PATCH, DELETE } from "./route";

// Helper to create params and reset query count
const createParams = (id: string) => {
  queryListId = id;
  queryCallCount = 0;
  return Promise.resolve({ id });
};

describe("GET /api/lists/[id]", () => {
  beforeEach(() => {
    mockLists = [];
    mockCategories = [];
    mockItems = [];
    mockAnonymousSessions = [];
    mockAuthenticatedUsers = [];
    mockSessions = [];
    mockCookies.clear();
    queryListId = null;
    queryCallCount = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("validation", () => {
    it("returns 400 for invalid UUID format", async () => {
      const request = new NextRequest("http://localhost:3000/api/lists/invalid");

      const response = await GET(request, { params: createParams("invalid") });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid list ID");
    });

    it("returns 400 for malformed UUID", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/lists/12345678-1234-1234-1234"
      );

      const response = await GET(request, {
        params: createParams("12345678-1234-1234-1234"),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid list ID");
    });
  });

  describe("access control", () => {
    it("returns 404 for non-existent list", async () => {
      const listId = crypto.randomUUID();

      const request = new NextRequest(
        `http://localhost:3000/api/lists/${listId}`
      );

      const response = await GET(request, { params: createParams(listId) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("List not found");
    });

    it("returns public list for unauthenticated user", async () => {
      const listId = crypto.randomUUID();
      const otherUserId = crypto.randomUUID();

      mockLists.push({
        id: listId,
        userId: otherUserId,
        anonymousSessionId: null,
        name: "Public Pack",
        slug: "public-pack",
        description: "A public list",
        isPublic: true,
        createdAt: now,
        updatedAt: now,
      });

      const request = new NextRequest(
        `http://localhost:3000/api/lists/${listId}`
      );

      const response = await GET(request, { params: createParams(listId) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.list.name).toBe("Public Pack");
      expect(data.isOwner).toBe(false);
    });

    it("returns private list for authenticated owner", async () => {
      const userId = crypto.randomUUID();
      const listId = crypto.randomUUID();
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
        id: listId,
        userId,
        anonymousSessionId: null,
        name: "My Private Pack",
        slug: "my-private-pack",
        description: null,
        isPublic: false,
        createdAt: now,
        updatedAt: now,
      });

      mockCookies.set("session_token", sessionToken);

      const request = new NextRequest(
        `http://localhost:3000/api/lists/${listId}`
      );

      const response = await GET(request, { params: createParams(listId) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.list.name).toBe("My Private Pack");
      expect(data.isOwner).toBe(true);
      expect(data.isAuthenticated).toBe(true);
    });
  });
});

describe("PATCH /api/lists/[id]", () => {
  beforeEach(() => {
    mockLists = [];
    mockCategories = [];
    mockItems = [];
    mockAnonymousSessions = [];
    mockAuthenticatedUsers = [];
    mockSessions = [];
    mockCookies.clear();
    queryListId = null;
    queryCallCount = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("validation", () => {
    it("returns 400 for invalid UUID format", async () => {
      const request = new NextRequest("http://localhost:3000/api/lists/invalid", {
        method: "PATCH",
        body: JSON.stringify({ name: "New Name" }),
      });

      const response = await PATCH(request, { params: createParams("invalid") });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid list ID");
    });
  });

  describe("authentication", () => {
    it("returns 401 for unauthenticated user", async () => {
      const listId = crypto.randomUUID();

      const request = new NextRequest(
        `http://localhost:3000/api/lists/${listId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ name: "New Name" }),
        }
      );

      const response = await PATCH(request, { params: createParams(listId) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("returns 404 for non-existent list", async () => {
      const userId = crypto.randomUUID();
      const listId = crypto.randomUUID();
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

      const request = new NextRequest(
        `http://localhost:3000/api/lists/${listId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ name: "New Name" }),
        }
      );

      const response = await PATCH(request, { params: createParams(listId) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("List not found");
    });

    it("returns 403 for non-owner", async () => {
      const userId = crypto.randomUUID();
      const otherUserId = crypto.randomUUID();
      const listId = crypto.randomUUID();
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
        id: listId,
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

      const request = new NextRequest(
        `http://localhost:3000/api/lists/${listId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ name: "Stolen Pack" }),
        }
      );

      const response = await PATCH(request, { params: createParams(listId) });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Forbidden");
    });
  });

  describe("update operations", () => {
    it("updates list description successfully for owner", async () => {
      const userId = crypto.randomUUID();
      const listId = crypto.randomUUID();
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
        id: listId,
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

      const request = new NextRequest(
        `http://localhost:3000/api/lists/${listId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ description: "A new description" }),
        }
      );

      const response = await PATCH(request, { params: createParams(listId) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("List updated successfully");
      expect(data.list.description).toBe("A new description");
    });

    it("allows authenticated user to make list public", async () => {
      const userId = crypto.randomUUID();
      const listId = crypto.randomUUID();
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
        id: listId,
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

      const request = new NextRequest(
        `http://localhost:3000/api/lists/${listId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ isPublic: true }),
        }
      );

      const response = await PATCH(request, { params: createParams(listId) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.list.isPublic).toBe(true);
    });
  });
});

describe("DELETE /api/lists/[id]", () => {
  beforeEach(() => {
    mockLists = [];
    mockCategories = [];
    mockItems = [];
    mockAnonymousSessions = [];
    mockAuthenticatedUsers = [];
    mockSessions = [];
    mockCookies.clear();
    queryListId = null;
    queryCallCount = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("validation", () => {
    it("returns 400 for invalid UUID format", async () => {
      const request = new NextRequest("http://localhost:3000/api/lists/invalid", {
        method: "DELETE",
      });

      const response = await DELETE(request, { params: createParams("invalid") });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid list ID");
    });
  });

  describe("authentication", () => {
    it("returns 401 for unauthenticated user", async () => {
      const listId = crypto.randomUUID();

      const request = new NextRequest(
        `http://localhost:3000/api/lists/${listId}`,
        {
          method: "DELETE",
        }
      );

      const response = await DELETE(request, { params: createParams(listId) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("returns 404 for non-existent list", async () => {
      const userId = crypto.randomUUID();
      const listId = crypto.randomUUID();
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

      const request = new NextRequest(
        `http://localhost:3000/api/lists/${listId}`,
        {
          method: "DELETE",
        }
      );

      const response = await DELETE(request, { params: createParams(listId) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("List not found");
    });

    it("returns 403 for non-owner", async () => {
      const userId = crypto.randomUUID();
      const otherUserId = crypto.randomUUID();
      const listId = crypto.randomUUID();
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
        id: listId,
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

      const request = new NextRequest(
        `http://localhost:3000/api/lists/${listId}`,
        {
          method: "DELETE",
        }
      );

      const response = await DELETE(request, { params: createParams(listId) });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Forbidden");
    });
  });

  describe("delete operations", () => {
    it("deletes list successfully for authenticated owner", async () => {
      const userId = crypto.randomUUID();
      const listId = crypto.randomUUID();
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
        id: listId,
        userId,
        anonymousSessionId: null,
        name: "To Be Deleted",
        slug: "to-be-deleted",
        description: null,
        isPublic: false,
        createdAt: now,
        updatedAt: now,
      });

      mockCookies.set("session_token", sessionToken);

      const request = new NextRequest(
        `http://localhost:3000/api/lists/${listId}`,
        {
          method: "DELETE",
        }
      );

      const response = await DELETE(request, { params: createParams(listId) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("List deleted successfully");
      expect(mockLists.length).toBe(0);
    });
  });
});
