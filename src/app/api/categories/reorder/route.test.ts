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

// Track category IDs to reorder for response
let categoryIdsToReorder: string[] = [];

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

// Simpler mock factory for select queries
const createSelectMock = () => {
  queryCallCount++;
  const currentCallCount = queryCallCount;

  return {
    from: vi.fn().mockImplementation(() => ({
      where: vi.fn().mockImplementation(() => {
        const sessionToken = mockCookies.get("session_token");
        const anonToken = mockCookies.get("anonymous_session_token");
        const hasSessionCookie = sessionToken || anonToken;

        // Query sequence for reorder:
        // 1. Session lookup (getCurrentSession)
        // 2. List lookup (verify list exists)
        // 3. Categories lookup (first call - verify categories exist)
        // 4. Categories lookup (second call - verify all categories belong to list)
        // 5. Final categories lookup (returning updated categories)

        const isSessionLookup = hasSessionCookie && currentCallCount === 1;
        const isListLookup = hasSessionCookie ? currentCallCount === 2 : currentCallCount === 1;
        const isCategoriesLookup1 = hasSessionCookie ? currentCallCount === 3 : currentCallCount === 2;
        const isCategoriesLookup2 = hasSessionCookie ? currentCallCount === 4 : currentCallCount === 3;
        const isFinalCategoriesLookup = hasSessionCookie ? currentCallCount === 5 : currentCallCount === 4;

        if (isSessionLookup) {
          // Session lookup
          if (sessionToken) {
            const session = mockSessions.find(
              (s) => s.sessionToken === sessionToken && s.expiresAt > new Date()
            );
            if (session) {
              const user = mockAuthenticatedUsers.find((u) => u.id === session.userId);
              if (user) {
                return {
                  limit: vi.fn().mockResolvedValue([
                    { userId: session.userId, username: user.username, email: user.email },
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
              return { limit: vi.fn().mockResolvedValue([anonSession]) };
            }
          }

          return { limit: vi.fn().mockResolvedValue([]) };
        } else if (isListLookup) {
          // List lookup
          const list = mockLists.find((l) => l.id === currentListId);
          return { limit: vi.fn().mockResolvedValue(list ? [list] : []) };
        } else if (isCategoriesLookup1) {
          // Return categories that exist (for checking existence)
          const existingCategories = mockCategories.filter((c) =>
            categoryIdsToReorder.includes(c.id)
          );
          return Promise.resolve(existingCategories.map((c) => ({ id: c.id })));
        } else if (isCategoriesLookup2) {
          // Return categories in the list (for checking list membership)
          const categoriesInList = mockCategories.filter((c) => c.listId === currentListId);
          return Promise.resolve(categoriesInList.map((c) => ({ id: c.id })));
        } else if (isFinalCategoriesLookup) {
          // Return updated categories for final response
          const updatedCategories = mockCategories
            .filter((c) => c.listId === currentListId)
            .sort((a, b) => a.position - b.position);
          return {
            orderBy: vi.fn().mockResolvedValue(updatedCategories),
          };
        }

        // Default fallback
        return Promise.resolve([]);
      }),
      innerJoin: vi.fn().mockReturnThis(),
      limit: vi.fn().mockImplementation(() => {
        const sessionToken = mockCookies.get("session_token");
        const anonToken = mockCookies.get("anonymous_session_token");

        if (sessionToken) {
          const session = mockSessions.find(
            (s) => s.sessionToken === sessionToken && s.expiresAt > new Date()
          );
          if (session) {
            const user = mockAuthenticatedUsers.find((u) => u.id === session.userId);
            if (user) {
              return Promise.resolve([
                { userId: session.userId, username: user.username, email: user.email },
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
      orderBy: vi.fn().mockImplementation(() => {
        const updatedCategories = mockCategories
          .filter((c) => c.listId === currentListId)
          .sort((a, b) => a.position - b.position);
        return Promise.resolve(updatedCategories);
      }),
    })),
  };
};

// Mock database
vi.mock("@/db", () => ({
  db: {
    select: vi.fn().mockImplementation(() => createSelectMock()),
    transaction: vi.fn().mockImplementation(async (callback: (tx: unknown) => Promise<void>) => {
      // Execute the callback with a mock transaction
      const mockTx = {
        update: vi.fn().mockImplementation(() => ({
          set: vi.fn().mockImplementation((data: Record<string, unknown>) => ({
            where: vi.fn().mockImplementation(() => {
              // Find the category being updated and update its position
              for (let i = 0; i < categoryIdsToReorder.length; i++) {
                const categoryId = categoryIdsToReorder[i];
                const index = mockCategories.findIndex((c) => c.id === categoryId);
                if (index !== -1) {
                  mockCategories[index] = {
                    ...mockCategories[index],
                    position: i,
                    updatedAt: data.updatedAt as Date || new Date(),
                  };
                }
              }
              return Promise.resolve();
            }),
          })),
        })),
      };
      await callback(mockTx);
    }),
  },
}));

// Import after mocking
import { PATCH } from "./route";

// Helper to set up test and reset query count
const setupTest = (listId: string | null, categoryIds: string[] = []) => {
  currentListId = listId;
  categoryIdsToReorder = categoryIds;
  queryCallCount = 0;
};

describe("PATCH /api/categories/reorder", () => {
  beforeEach(() => {
    mockLists = [];
    mockCategories = [];
    mockAnonymousSessions = [];
    mockAuthenticatedUsers = [];
    mockSessions = [];
    mockCookies.clear();
    currentListId = null;
    categoryIdsToReorder = [];
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

      const request = new NextRequest(
        "http://localhost:3000/api/categories/reorder",
        {
          method: "PATCH",
          body: JSON.stringify({
            categoryIds: [crypto.randomUUID()],
          }),
        }
      );

      const response = await PATCH(request);
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

      const request = new NextRequest(
        "http://localhost:3000/api/categories/reorder",
        {
          method: "PATCH",
          body: JSON.stringify({
            listId: "not-a-uuid",
            categoryIds: [crypto.randomUUID()],
          }),
        }
      );

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
      expect(data.details.listId).toBeDefined();
    });

    it("returns 400 for missing categoryIds array", async () => {
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

      const request = new NextRequest(
        "http://localhost:3000/api/categories/reorder",
        {
          method: "PATCH",
          body: JSON.stringify({
            listId: crypto.randomUUID(),
          }),
        }
      );

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
      expect(data.details.categoryIds).toBeDefined();
    });

    it("returns 400 for empty categoryIds array", async () => {
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

      const request = new NextRequest(
        "http://localhost:3000/api/categories/reorder",
        {
          method: "PATCH",
          body: JSON.stringify({
            listId: crypto.randomUUID(),
            categoryIds: [],
          }),
        }
      );

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
      expect(data.details.categoryIds).toBeDefined();
    });

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
      setupTest(null);

      const request = new NextRequest(
        "http://localhost:3000/api/categories/reorder",
        {
          method: "PATCH",
          body: JSON.stringify({
            listId: crypto.randomUUID(),
            categoryIds: ["not-a-uuid"],
          }),
        }
      );

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
    });

    it("returns 400 for duplicate category IDs", async () => {
      const userId = crypto.randomUUID();
      const sessionToken = "test-session-token";
      const duplicateId = crypto.randomUUID();

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

      const request = new NextRequest(
        "http://localhost:3000/api/categories/reorder",
        {
          method: "PATCH",
          body: JSON.stringify({
            listId: crypto.randomUUID(),
            categoryIds: [duplicateId, duplicateId],
          }),
        }
      );

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
    });
  });

  describe("authentication", () => {
    it("returns 401 when not authenticated", async () => {
      setupTest(null);

      const request = new NextRequest(
        "http://localhost:3000/api/categories/reorder",
        {
          method: "PATCH",
          body: JSON.stringify({
            listId: crypto.randomUUID(),
            categoryIds: [crypto.randomUUID()],
          }),
        }
      );

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
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

      const request = new NextRequest(
        "http://localhost:3000/api/categories/reorder",
        {
          method: "PATCH",
          body: JSON.stringify({
            listId: nonExistentListId,
            categoryIds: [crypto.randomUUID()],
          }),
        }
      );

      const response = await PATCH(request);
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

      const request = new NextRequest(
        "http://localhost:3000/api/categories/reorder",
        {
          method: "PATCH",
          body: JSON.stringify({
            listId,
            categoryIds: [crypto.randomUUID()],
          }),
        }
      );

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Forbidden");
    });

    it("returns 403 when anonymous user tries to reorder another user's categories", async () => {
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

      const request = new NextRequest(
        "http://localhost:3000/api/categories/reorder",
        {
          method: "PATCH",
          body: JSON.stringify({
            listId,
            categoryIds: [crypto.randomUUID()],
          }),
        }
      );

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Forbidden");
    });

    it("returns 404 when some categories do not exist", async () => {
      const userId = crypto.randomUUID();
      const sessionToken = "test-session-token";
      const listId = crypto.randomUUID();
      const existingCategoryId = crypto.randomUUID();
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
        id: existingCategoryId,
        listId,
        name: "Shelter",
        description: null,
        position: 0,
        createdAt: now,
        updatedAt: now,
      });

      mockCookies.set("session_token", sessionToken);
      setupTest(listId, [existingCategoryId, nonExistentCategoryId]);

      const request = new NextRequest(
        "http://localhost:3000/api/categories/reorder",
        {
          method: "PATCH",
          body: JSON.stringify({
            listId,
            categoryIds: [existingCategoryId, nonExistentCategoryId],
          }),
        }
      );

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Some categories were not found");
      expect(data.details.missingIds).toContain(nonExistentCategoryId);
    });

    it("returns 400 when categories do not belong to the list", async () => {
      const userId = crypto.randomUUID();
      const sessionToken = "test-session-token";
      const listId = crypto.randomUUID();
      const otherListId = crypto.randomUUID();
      const categoryId = crypto.randomUUID();
      const otherCategoryId = crypto.randomUUID();

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

      mockLists.push({
        id: otherListId,
        userId,
        anonymousSessionId: null,
        name: "Other Pack",
        slug: "other-pack",
        description: null,
        isPublic: false,
        createdAt: now,
        updatedAt: now,
      });

      // Category belongs to the target list
      mockCategories.push({
        id: categoryId,
        listId,
        name: "Shelter",
        description: null,
        position: 0,
        createdAt: now,
        updatedAt: now,
      });

      // Category belongs to a different list
      mockCategories.push({
        id: otherCategoryId,
        listId: otherListId,
        name: "Other Category",
        description: null,
        position: 0,
        createdAt: now,
        updatedAt: now,
      });

      mockCookies.set("session_token", sessionToken);
      setupTest(listId, [categoryId, otherCategoryId]);

      const request = new NextRequest(
        "http://localhost:3000/api/categories/reorder",
        {
          method: "PATCH",
          body: JSON.stringify({
            listId,
            categoryIds: [categoryId, otherCategoryId],
          }),
        }
      );

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Some categories do not belong to this list");
      expect(data.details.invalidIds).toContain(otherCategoryId);
    });
  });

  describe("successful reordering", () => {
    it("reorders categories for authenticated user", async () => {
      const userId = crypto.randomUUID();
      const sessionToken = "test-session-token";
      const listId = crypto.randomUUID();
      const categoryId1 = crypto.randomUUID();
      const categoryId2 = crypto.randomUUID();
      const categoryId3 = crypto.randomUUID();

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

      // Initial order: 0, 1, 2
      mockCategories.push({
        id: categoryId1,
        listId,
        name: "Shelter",
        description: null,
        position: 0,
        createdAt: now,
        updatedAt: now,
      });

      mockCategories.push({
        id: categoryId2,
        listId,
        name: "Sleep System",
        description: null,
        position: 1,
        createdAt: now,
        updatedAt: now,
      });

      mockCategories.push({
        id: categoryId3,
        listId,
        name: "Cook Kit",
        description: null,
        position: 2,
        createdAt: now,
        updatedAt: now,
      });

      mockCookies.set("session_token", sessionToken);
      // New order: 2, 0, 1
      setupTest(listId, [categoryId3, categoryId1, categoryId2]);

      const request = new NextRequest(
        "http://localhost:3000/api/categories/reorder",
        {
          method: "PATCH",
          body: JSON.stringify({
            listId,
            categoryIds: [categoryId3, categoryId1, categoryId2],
          }),
        }
      );

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("Categories reordered successfully");
      expect(data.categories).toBeDefined();
      expect(Array.isArray(data.categories)).toBe(true);
    });

    it("reorders categories for anonymous user", async () => {
      const anonSessionId = crypto.randomUUID();
      const anonToken = "anon-session-token";
      const listId = crypto.randomUUID();
      const categoryId1 = crypto.randomUUID();
      const categoryId2 = crypto.randomUUID();

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
        id: categoryId1,
        listId,
        name: "Shelter",
        description: null,
        position: 0,
        createdAt: now,
        updatedAt: now,
      });

      mockCategories.push({
        id: categoryId2,
        listId,
        name: "Sleep System",
        description: null,
        position: 1,
        createdAt: now,
        updatedAt: now,
      });

      mockCookies.set("anonymous_session_token", anonToken);
      // Swap order
      setupTest(listId, [categoryId2, categoryId1]);

      const request = new NextRequest(
        "http://localhost:3000/api/categories/reorder",
        {
          method: "PATCH",
          body: JSON.stringify({
            listId,
            categoryIds: [categoryId2, categoryId1],
          }),
        }
      );

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("Categories reordered successfully");
    });

    it("handles single category reorder", async () => {
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
      setupTest(listId, [categoryId]);

      const request = new NextRequest(
        "http://localhost:3000/api/categories/reorder",
        {
          method: "PATCH",
          body: JSON.stringify({
            listId,
            categoryIds: [categoryId],
          }),
        }
      );

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("Categories reordered successfully");
    });
  });
});
