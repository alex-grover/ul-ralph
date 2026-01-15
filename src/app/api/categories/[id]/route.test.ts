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
let currentCategoryId: string | null = null;
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
    select: vi.fn().mockImplementation(() => {
      queryCallCount++;
      const currentCallCount = queryCallCount;

      return {
        from: vi.fn().mockImplementation(() => ({
          where: vi.fn().mockImplementation(() => {
            // Determine query type by checking session cookies and call count
            const sessionToken = mockCookies.get("session_token");
            const anonToken = mockCookies.get("anonymous_session_token");
            const hasSessionCookie = sessionToken || anonToken;

            // First query is session lookup
            // Second query is category lookup
            // Third query is list lookup (for ownership verification)
            const isSessionLookup = hasSessionCookie && currentCallCount === 1;
            const isCategoryLookup = hasSessionCookie ? currentCallCount === 2 : currentCallCount === 1;

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
            } else if (isCategoryLookup) {
              // Category lookup
              const category = mockCategories.find(
                (c) => c.id === currentCategoryId
              );
              return {
                limit: vi.fn().mockResolvedValue(category ? [category] : []),
              };
            } else {
              // List lookup
              const category = mockCategories.find(
                (c) => c.id === currentCategoryId
              );
              if (category) {
                const list = mockLists.find((l) => l.id === category.listId);
                return {
                  limit: vi.fn().mockResolvedValue(list ? [list] : []),
                };
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
    update: vi.fn().mockImplementation(() => ({
      set: vi.fn().mockImplementation((data: Record<string, unknown>) => ({
        where: vi.fn().mockImplementation(() => ({
          returning: vi.fn().mockImplementation(() => {
            const category = mockCategories.find(
              (c) => c.id === currentCategoryId
            );
            if (category) {
              const updatedCategory = {
                ...category,
                name: (data.name as string) ?? category.name,
                description: data.description !== undefined
                  ? (data.description as string | null)
                  : category.description,
                updatedAt: data.updatedAt as Date,
              };
              // Update in mock array
              const index = mockCategories.findIndex(
                (c) => c.id === currentCategoryId
              );
              if (index !== -1) {
                mockCategories[index] = updatedCategory;
              }
              return Promise.resolve([updatedCategory]);
            }
            return Promise.resolve([]);
          }),
        })),
      })),
    })),
    delete: vi.fn().mockImplementation(() => ({
      where: vi.fn().mockImplementation(() => {
        const index = mockCategories.findIndex(
          (c) => c.id === currentCategoryId
        );
        if (index !== -1) {
          mockCategories.splice(index, 1);
        }
        return Promise.resolve();
      }),
    })),
  },
}));

// Import after mocking
import { PATCH, DELETE } from "./route";

// Helper to set up test and reset query count
const createParams = (id: string) => {
  currentCategoryId = id;
  queryCallCount = 0;
  return Promise.resolve({ id });
};

describe("PATCH /api/categories/[id]", () => {
  beforeEach(() => {
    mockLists = [];
    mockCategories = [];
    mockAnonymousSessions = [];
    mockAuthenticatedUsers = [];
    mockSessions = [];
    mockCookies.clear();
    currentCategoryId = null;
    queryCallCount = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("validation", () => {
    it("returns 400 for invalid category ID format", async () => {
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

      const request = new NextRequest(
        "http://localhost:3000/api/categories/not-a-uuid",
        {
          method: "PATCH",
          body: JSON.stringify({ name: "Updated Name" }),
        }
      );

      const response = await PATCH(request, {
        params: createParams("not-a-uuid"),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid category ID");
    });

    it("returns 400 for empty name", async () => {
      const userId = crypto.randomUUID();
      const sessionToken = "test-session-token";
      const categoryId = crypto.randomUUID();
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

      mockCategories.push({
        id: categoryId,
        listId,
        name: "Shelter",
        description: null,
        position: 0,
        createdAt: now,
        updatedAt: now,
      });

      mockCookies.set("session_token", sessionToken);

      const request = new NextRequest(
        `http://localhost:3000/api/categories/${categoryId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ name: "" }),
        }
      );

      const response = await PATCH(request, {
        params: createParams(categoryId),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
      expect(data.details.name).toBeDefined();
    });

    it("returns 400 for name exceeding max length", async () => {
      const userId = crypto.randomUUID();
      const sessionToken = "test-session-token";
      const categoryId = crypto.randomUUID();
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

      mockCategories.push({
        id: categoryId,
        listId,
        name: "Shelter",
        description: null,
        position: 0,
        createdAt: now,
        updatedAt: now,
      });

      mockCookies.set("session_token", sessionToken);

      const request = new NextRequest(
        `http://localhost:3000/api/categories/${categoryId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ name: "a".repeat(256) }),
        }
      );

      const response = await PATCH(request, {
        params: createParams(categoryId),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
    });
  });

  describe("authentication", () => {
    it("returns 401 when not authenticated", async () => {
      const categoryId = crypto.randomUUID();

      const request = new NextRequest(
        `http://localhost:3000/api/categories/${categoryId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ name: "Updated Name" }),
        }
      );

      const response = await PATCH(request, {
        params: createParams(categoryId),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });
  });

  describe("category update", () => {
    it("updates category name for authenticated user", async () => {
      const userId = crypto.randomUUID();
      const sessionToken = "test-session-token";
      const listId = crypto.randomUUID();
      const categoryId = crypto.randomUUID();

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

      mockCategories.push({
        id: categoryId,
        listId,
        name: "Shelter",
        description: null,
        position: 0,
        createdAt: now,
        updatedAt: now,
      });

      mockCookies.set("session_token", sessionToken);

      const request = new NextRequest(
        `http://localhost:3000/api/categories/${categoryId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ name: "Updated Shelter" }),
        }
      );

      const response = await PATCH(request, {
        params: createParams(categoryId),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("Category updated successfully");
      expect(data.category.name).toBe("Updated Shelter");
    });

    it("updates category description", async () => {
      const userId = crypto.randomUUID();
      const sessionToken = "test-session-token";
      const listId = crypto.randomUUID();
      const categoryId = crypto.randomUUID();

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

      mockCategories.push({
        id: categoryId,
        listId,
        name: "Shelter",
        description: null,
        position: 0,
        createdAt: now,
        updatedAt: now,
      });

      mockCookies.set("session_token", sessionToken);

      const request = new NextRequest(
        `http://localhost:3000/api/categories/${categoryId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ description: "All shelter-related items" }),
        }
      );

      const response = await PATCH(request, {
        params: createParams(categoryId),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.category.description).toBe("All shelter-related items");
    });

    it("updates category for anonymous user", async () => {
      const anonSessionId = crypto.randomUUID();
      const anonToken = "anon-session-token";
      const listId = crypto.randomUUID();
      const categoryId = crypto.randomUUID();

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

      mockCategories.push({
        id: categoryId,
        listId,
        name: "Sleep System",
        description: null,
        position: 0,
        createdAt: now,
        updatedAt: now,
      });

      mockCookies.set("anonymous_session_token", anonToken);

      const request = new NextRequest(
        `http://localhost:3000/api/categories/${categoryId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ name: "Sleep Gear" }),
        }
      );

      const response = await PATCH(request, {
        params: createParams(categoryId),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.category.name).toBe("Sleep Gear");
    });

    it("clears description when set to null", async () => {
      const userId = crypto.randomUUID();
      const sessionToken = "test-session-token";
      const listId = crypto.randomUUID();
      const categoryId = crypto.randomUUID();

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

      mockCategories.push({
        id: categoryId,
        listId,
        name: "Shelter",
        description: "Some description",
        position: 0,
        createdAt: now,
        updatedAt: now,
      });

      mockCookies.set("session_token", sessionToken);

      const request = new NextRequest(
        `http://localhost:3000/api/categories/${categoryId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ description: null }),
        }
      );

      const response = await PATCH(request, {
        params: createParams(categoryId),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.category.description).toBeNull();
    });
  });

  describe("authorization", () => {
    it("returns 404 when category does not exist", async () => {
      const userId = crypto.randomUUID();
      const sessionToken = "test-session-token";
      const nonExistentCategoryId = crypto.randomUUID();

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
        `http://localhost:3000/api/categories/${nonExistentCategoryId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ name: "Updated Name" }),
        }
      );

      const response = await PATCH(request, {
        params: createParams(nonExistentCategoryId),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Category not found");
    });

    it("returns 403 when user does not own the list", async () => {
      const userId = crypto.randomUUID();
      const otherUserId = crypto.randomUUID();
      const sessionToken = "test-session-token";
      const listId = crypto.randomUUID();
      const categoryId = crypto.randomUUID();

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

      mockCategories.push({
        id: categoryId,
        listId,
        name: "Shelter",
        description: null,
        position: 0,
        createdAt: now,
        updatedAt: now,
      });

      mockCookies.set("session_token", sessionToken);

      const request = new NextRequest(
        `http://localhost:3000/api/categories/${categoryId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ name: "Updated Name" }),
        }
      );

      const response = await PATCH(request, {
        params: createParams(categoryId),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Forbidden");
    });
  });
});

describe("DELETE /api/categories/[id]", () => {
  beforeEach(() => {
    mockLists = [];
    mockCategories = [];
    mockAnonymousSessions = [];
    mockAuthenticatedUsers = [];
    mockSessions = [];
    mockCookies.clear();
    currentCategoryId = null;
    queryCallCount = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("validation", () => {
    it("returns 400 for invalid category ID format", async () => {
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

      const request = new NextRequest(
        "http://localhost:3000/api/categories/not-a-uuid",
        {
          method: "DELETE",
        }
      );

      const response = await DELETE(request, {
        params: createParams("not-a-uuid"),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid category ID");
    });
  });

  describe("authentication", () => {
    it("returns 401 when not authenticated", async () => {
      const categoryId = crypto.randomUUID();

      const request = new NextRequest(
        `http://localhost:3000/api/categories/${categoryId}`,
        {
          method: "DELETE",
        }
      );

      const response = await DELETE(request, {
        params: createParams(categoryId),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });
  });

  describe("category deletion", () => {
    it("deletes category for authenticated user", async () => {
      const userId = crypto.randomUUID();
      const sessionToken = "test-session-token";
      const listId = crypto.randomUUID();
      const categoryId = crypto.randomUUID();

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

      mockCategories.push({
        id: categoryId,
        listId,
        name: "Shelter",
        description: null,
        position: 0,
        createdAt: now,
        updatedAt: now,
      });

      mockCookies.set("session_token", sessionToken);

      const request = new NextRequest(
        `http://localhost:3000/api/categories/${categoryId}`,
        {
          method: "DELETE",
        }
      );

      const response = await DELETE(request, {
        params: createParams(categoryId),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("Category deleted successfully");
      expect(mockCategories.length).toBe(0);
    });

    it("deletes category for anonymous user", async () => {
      const anonSessionId = crypto.randomUUID();
      const anonToken = "anon-session-token";
      const listId = crypto.randomUUID();
      const categoryId = crypto.randomUUID();

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

      mockCategories.push({
        id: categoryId,
        listId,
        name: "Sleep System",
        description: null,
        position: 0,
        createdAt: now,
        updatedAt: now,
      });

      mockCookies.set("anonymous_session_token", anonToken);

      const request = new NextRequest(
        `http://localhost:3000/api/categories/${categoryId}`,
        {
          method: "DELETE",
        }
      );

      const response = await DELETE(request, {
        params: createParams(categoryId),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("Category deleted successfully");
    });
  });

  describe("authorization", () => {
    it("returns 404 when category does not exist", async () => {
      const userId = crypto.randomUUID();
      const sessionToken = "test-session-token";
      const nonExistentCategoryId = crypto.randomUUID();

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
        `http://localhost:3000/api/categories/${nonExistentCategoryId}`,
        {
          method: "DELETE",
        }
      );

      const response = await DELETE(request, {
        params: createParams(nonExistentCategoryId),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Category not found");
    });

    it("returns 403 when user does not own the list", async () => {
      const userId = crypto.randomUUID();
      const otherUserId = crypto.randomUUID();
      const sessionToken = "test-session-token";
      const listId = crypto.randomUUID();
      const categoryId = crypto.randomUUID();

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

      mockCategories.push({
        id: categoryId,
        listId,
        name: "Shelter",
        description: null,
        position: 0,
        createdAt: now,
        updatedAt: now,
      });

      mockCookies.set("session_token", sessionToken);

      const request = new NextRequest(
        `http://localhost:3000/api/categories/${categoryId}`,
        {
          method: "DELETE",
        }
      );

      const response = await DELETE(request, {
        params: createParams(categoryId),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Forbidden");
    });

    it("returns 403 when anonymous user tries to delete another user's category", async () => {
      const anonSessionId = crypto.randomUUID();
      const otherAnonSessionId = crypto.randomUUID();
      const anonToken = "anon-session-token";
      const listId = crypto.randomUUID();
      const categoryId = crypto.randomUUID();

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

      mockCategories.push({
        id: categoryId,
        listId,
        name: "Shelter",
        description: null,
        position: 0,
        createdAt: now,
        updatedAt: now,
      });

      mockCookies.set("anonymous_session_token", anonToken);

      const request = new NextRequest(
        `http://localhost:3000/api/categories/${categoryId}`,
        {
          method: "DELETE",
        }
      );

      const response = await DELETE(request, {
        params: createParams(categoryId),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Forbidden");
    });
  });
});
