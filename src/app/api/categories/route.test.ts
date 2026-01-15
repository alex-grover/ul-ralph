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

// Track current query target and call count
let currentListId: string | null = null;
let queryCallCount = 0;

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

// Mock database with query count tracking
vi.mock("@/db", () => ({
  db: {
    select: vi.fn().mockImplementation((selectObj?: Record<string, unknown>) => {
      queryCallCount++;
      const currentCallCount = queryCallCount;
      const isMaxPositionQuery = selectObj && "maxPosition" in selectObj;

      return {
        from: vi.fn().mockImplementation(() => ({
          where: vi.fn().mockImplementation(() => {
            // Determine query type by checking session cookies and call count
            const sessionToken = mockCookies.get("session_token");
            const anonToken = mockCookies.get("anonymous_session_token");
            const hasSessionCookie = sessionToken || anonToken;

            // First query is session lookup, subsequent are other lookups
            const isSessionLookup = hasSessionCookie && currentCallCount === 1;

            if (isMaxPositionQuery) {
              // Return max position for categories in the list
              const listCategories = mockCategories.filter(
                (c) => c.listId === currentListId
              );
              const maxPosition = listCategories.length > 0
                ? Math.max(...listCategories.map((c) => c.position))
                : -1;
              return Promise.resolve([{ maxPosition }]);
            }

            if (isSessionLookup) {
              // Session lookup
              if (sessionToken) {
                const session = mockSessions.find(
                  (s) =>
                    s.sessionToken === sessionToken && s.expiresAt > new Date()
                );
                if (session) {
                  const user = mockAuthenticatedUsers.find(
                    (u) => u.id === session.userId
                  );
                  if (user) {
                    return {
                      limit: vi.fn().mockResolvedValue([
                        {
                          userId: session.userId,
                          username: user.username,
                          email: user.email,
                        },
                      ]),
                    };
                  }
                }
              }

              if (anonToken) {
                const anonSession = mockAnonymousSessions.find(
                  (s) => s.sessionToken === anonToken && s.expiresAt > new Date()
                );
                if (anonSession) {
                  return {
                    limit: vi.fn().mockResolvedValue([anonSession]),
                  };
                }
              }

              return {
                limit: vi.fn().mockResolvedValue([]),
              };
            } else {
              // List lookup (second query after session lookup)
              if (currentListId) {
                const list = mockLists.find((l) => l.id === currentListId);
                if (list) {
                  return {
                    limit: vi.fn().mockResolvedValue([list]),
                  };
                }
              }
              return {
                limit: vi.fn().mockResolvedValue([]),
              };
            }
          }),
          innerJoin: vi.fn().mockReturnThis(),
          limit: vi.fn().mockImplementation(() => {
            const sessionToken = mockCookies.get("session_token");
            const anonToken = mockCookies.get("anonymous_session_token");

            if (sessionToken) {
              const session = mockSessions.find(
                (s) =>
                  s.sessionToken === sessionToken && s.expiresAt > new Date()
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
                (s) => s.sessionToken === anonToken && s.expiresAt > new Date()
              );
              if (anonSession) {
                return Promise.resolve([anonSession]);
              }
            }

            return Promise.resolve([]);
          }),
        })),
      };
    }),
    insert: vi.fn().mockImplementation(() => ({
      values: vi.fn().mockImplementation((data: Record<string, unknown>) => ({
        returning: vi.fn().mockImplementation(() => {
          const newCategory = {
            id: crypto.randomUUID(),
            listId: data.listId as string,
            name: data.name as string,
            description: data.description as string | null,
            position: data.position as number,
            createdAt: now,
            updatedAt: now,
          };
          mockCategories.push(newCategory);
          return Promise.resolve([newCategory]);
        }),
      })),
    })),
  },
}));

// Import after mocking
import { POST } from "./route";

// Helper to set up test and reset query count
const setupTest = (listId: string | null) => {
  currentListId = listId;
  queryCallCount = 0;
};

describe("POST /api/categories", () => {
  beforeEach(() => {
    mockLists = [];
    mockCategories = [];
    mockAnonymousSessions = [];
    mockAuthenticatedUsers = [];
    mockSessions = [];
    mockCookies.clear();
    currentListId = null;
    queryCallCount = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("validation", () => {
    it("returns 400 for missing listId", async () => {
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
      setupTest(null);

      const request = new NextRequest("http://localhost:3000/api/categories", {
        method: "POST",
        body: JSON.stringify({ name: "Test Category" }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
      expect(data.details.listId).toBeDefined();
    });

    it("returns 400 for invalid listId format", async () => {
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
      setupTest(null);

      const request = new NextRequest("http://localhost:3000/api/categories", {
        method: "POST",
        body: JSON.stringify({ listId: "not-a-uuid", name: "Test Category" }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
      expect(data.details.listId).toBeDefined();
    });

    it("returns 400 for missing name", async () => {
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
      setupTest(null);

      const request = new NextRequest("http://localhost:3000/api/categories", {
        method: "POST",
        body: JSON.stringify({ listId: crypto.randomUUID() }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
      expect(data.details.name).toBeDefined();
    });

    it("returns 400 for empty name", async () => {
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
      setupTest(null);

      const request = new NextRequest("http://localhost:3000/api/categories", {
        method: "POST",
        body: JSON.stringify({ listId: crypto.randomUUID(), name: "" }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
      expect(data.details.name).toBeDefined();
    });

    it("returns 400 for name exceeding max length", async () => {
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
      setupTest(null);

      const request = new NextRequest("http://localhost:3000/api/categories", {
        method: "POST",
        body: JSON.stringify({
          listId: crypto.randomUUID(),
          name: "a".repeat(256),
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
    });
  });

  describe("authentication", () => {
    it("returns 401 when not authenticated", async () => {
      setupTest(null);

      const request = new NextRequest("http://localhost:3000/api/categories", {
        method: "POST",
        body: JSON.stringify({
          listId: crypto.randomUUID(),
          name: "Test Category",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });
  });

  describe("category creation", () => {
    it("creates category for authenticated user's list", async () => {
      const userId = crypto.randomUUID();
      const sessionToken = "test-session-token";
      const listId = crypto.randomUUID();

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
        name: "My Pack List",
        slug: "my-pack-list",
        description: null,
        isPublic: false,
        createdAt: now,
        updatedAt: now,
      });

      mockCookies.set("session_token", sessionToken);
      setupTest(listId);

      const request = new NextRequest("http://localhost:3000/api/categories", {
        method: "POST",
        body: JSON.stringify({
          listId,
          name: "Shelter",
          description: "Tent and tarp items",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.message).toBe("Category created successfully");
      expect(data.category).toBeDefined();
      expect(data.category.name).toBe("Shelter");
      expect(data.category.description).toBe("Tent and tarp items");
      expect(data.category.listId).toBe(listId);
      expect(data.category.position).toBe(0);
    });

    it("creates category for anonymous user's list", async () => {
      const anonSessionId = crypto.randomUUID();
      const anonToken = "anon-session-token";
      const listId = crypto.randomUUID();

      mockAnonymousSessions.push({
        id: anonSessionId,
        sessionToken: anonToken,
        expiresAt: futureDate,
      });

      mockLists.push({
        id: listId,
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
      setupTest(listId);

      const request = new NextRequest("http://localhost:3000/api/categories", {
        method: "POST",
        body: JSON.stringify({
          listId,
          name: "Sleep System",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.category.name).toBe("Sleep System");
      expect(data.category.listId).toBe(listId);
    });

    it("creates category with null description when not provided", async () => {
      const userId = crypto.randomUUID();
      const sessionToken = "test-session-token";
      const listId = crypto.randomUUID();

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
      setupTest(listId);

      const request = new NextRequest("http://localhost:3000/api/categories", {
        method: "POST",
        body: JSON.stringify({
          listId,
          name: "Kitchen",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.category.description).toBeNull();
    });

    it("assigns correct position when list already has categories", async () => {
      const userId = crypto.randomUUID();
      const sessionToken = "test-session-token";
      const listId = crypto.randomUUID();

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

      // Add existing categories
      mockCategories.push({
        id: crypto.randomUUID(),
        listId,
        name: "Shelter",
        description: null,
        position: 0,
        createdAt: now,
        updatedAt: now,
      });

      mockCategories.push({
        id: crypto.randomUUID(),
        listId,
        name: "Sleep",
        description: null,
        position: 1,
        createdAt: now,
        updatedAt: now,
      });

      mockCookies.set("session_token", sessionToken);
      setupTest(listId);

      const request = new NextRequest("http://localhost:3000/api/categories", {
        method: "POST",
        body: JSON.stringify({
          listId,
          name: "Kitchen",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.category.position).toBe(2);
    });
  });

  describe("authorization", () => {
    it("returns 404 when list does not exist", async () => {
      const userId = crypto.randomUUID();
      const sessionToken = "test-session-token";
      const nonExistentListId = crypto.randomUUID();

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
      setupTest(nonExistentListId);

      const request = new NextRequest("http://localhost:3000/api/categories", {
        method: "POST",
        body: JSON.stringify({
          listId: nonExistentListId,
          name: "Test Category",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("List not found");
    });

    it("returns 403 when user does not own the list", async () => {
      const userId = crypto.randomUUID();
      const otherUserId = crypto.randomUUID();
      const sessionToken = "test-session-token";
      const listId = crypto.randomUUID();

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

      // List belongs to other user
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
      setupTest(listId);

      const request = new NextRequest("http://localhost:3000/api/categories", {
        method: "POST",
        body: JSON.stringify({
          listId,
          name: "Test Category",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Forbidden");
    });

    it("returns 403 when anonymous user tries to add to another user's list", async () => {
      const anonSessionId = crypto.randomUUID();
      const otherAnonSessionId = crypto.randomUUID();
      const anonToken = "anon-session-token";
      const listId = crypto.randomUUID();

      mockAnonymousSessions.push({
        id: anonSessionId,
        sessionToken: anonToken,
        expiresAt: futureDate,
      });

      // List belongs to different anonymous session
      mockLists.push({
        id: listId,
        userId: null,
        anonymousSessionId: otherAnonSessionId,
        name: "Other Anon Pack",
        slug: "other-anon-pack",
        description: null,
        isPublic: false,
        createdAt: now,
        updatedAt: now,
      });

      mockCookies.set("anonymous_session_token", anonToken);
      setupTest(listId);

      const request = new NextRequest("http://localhost:3000/api/categories", {
        method: "POST",
        body: JSON.stringify({
          listId,
          name: "Test Category",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Forbidden");
    });
  });

  describe("response structure", () => {
    it("returns correct response structure on success", async () => {
      const userId = crypto.randomUUID();
      const sessionToken = "test-session-token";
      const listId = crypto.randomUUID();

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
      setupTest(listId);

      const request = new NextRequest("http://localhost:3000/api/categories", {
        method: "POST",
        body: JSON.stringify({
          listId,
          name: "Test Category",
          description: "Test description",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toHaveProperty("message");
      expect(data).toHaveProperty("category");
      expect(data.category).toHaveProperty("id");
      expect(data.category).toHaveProperty("listId");
      expect(data.category).toHaveProperty("name");
      expect(data.category).toHaveProperty("description");
      expect(data.category).toHaveProperty("position");
      expect(data.category).toHaveProperty("createdAt");
      expect(data.category).toHaveProperty("updatedAt");
    });
  });
});
