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

// Track current query target and call count
let currentListId: string | null = null;
let queryCallCount = 0;

// Track items to reorder for response
let itemsToReorder: Array<{ id: string; categoryId: string; position: number }> = [];

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
        // 3. Categories lookup (first call - verify categories belong to list)
        // 4. Items lookup (verify items exist)
        // 5. Categories lookup (second call - verify all items belong to list)
        // 6. Final items lookup (returning updated items)

        const isSessionLookup = hasSessionCookie && currentCallCount === 1;
        const isListLookup = hasSessionCookie ? currentCallCount === 2 : currentCallCount === 1;
        const isCategoriesLookup1 = hasSessionCookie ? currentCallCount === 3 : currentCallCount === 2;
        const isItemsLookup = hasSessionCookie ? currentCallCount === 4 : currentCallCount === 3;
        const isCategoriesLookup2 = hasSessionCookie ? currentCallCount === 5 : currentCallCount === 4;
        const isFinalItemsLookup = hasSessionCookie ? currentCallCount === 6 : currentCallCount === 5;

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
        } else if (isCategoriesLookup1 || isCategoriesLookup2) {
          // Return categories in the list
          const categoriesInList = mockCategories.filter((c) => c.listId === currentListId);
          return Promise.resolve(categoriesInList.map((c) => ({ id: c.id })));
        } else if (isItemsLookup) {
          // Return items that exist
          const itemIds = itemsToReorder.map((i) => i.id);
          const existingItems = mockItems.filter((i) => itemIds.includes(i.id));
          return Promise.resolve(existingItems.map((i) => ({ id: i.id, categoryId: i.categoryId })));
        } else if (isFinalItemsLookup) {
          // Return updated items for final response
          const itemIds = itemsToReorder.map((i) => i.id);
          const updatedItems = mockItems.filter((i) => itemIds.includes(i.id));
          return {
            orderBy: vi.fn().mockResolvedValue(updatedItems),
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
        const itemIds = itemsToReorder.map((i) => i.id);
        const updatedItems = mockItems.filter((i) => itemIds.includes(i.id));
        return Promise.resolve(updatedItems);
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
              // Find the item being updated
              for (const item of itemsToReorder) {
                const index = mockItems.findIndex((i) => i.id === item.id);
                if (index !== -1) {
                  mockItems[index] = {
                    ...mockItems[index],
                    categoryId: item.categoryId,
                    position: item.position,
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
const setupTest = (listId: string | null, items: Array<{ id: string; categoryId: string; position: number }> = []) => {
  currentListId = listId;
  itemsToReorder = items;
  queryCallCount = 0;
};

describe("PATCH /api/items/reorder", () => {
  beforeEach(() => {
    mockLists = [];
    mockCategories = [];
    mockItems = [];
    mockAnonymousSessions = [];
    mockAuthenticatedUsers = [];
    mockSessions = [];
    mockCookies.clear();
    currentListId = null;
    itemsToReorder = [];
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
        "http://localhost:3000/api/items/reorder",
        {
          method: "PATCH",
          body: JSON.stringify({
            items: [
              { id: crypto.randomUUID(), categoryId: crypto.randomUUID(), position: 0 },
            ],
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
        "http://localhost:3000/api/items/reorder",
        {
          method: "PATCH",
          body: JSON.stringify({
            listId: "not-a-uuid",
            items: [
              { id: crypto.randomUUID(), categoryId: crypto.randomUUID(), position: 0 },
            ],
          }),
        }
      );

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
      expect(data.details.listId).toBeDefined();
    });

    it("returns 400 for missing items array", async () => {
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
        "http://localhost:3000/api/items/reorder",
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
      expect(data.details.items).toBeDefined();
    });

    it("returns 400 for empty items array", async () => {
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
        "http://localhost:3000/api/items/reorder",
        {
          method: "PATCH",
          body: JSON.stringify({
            listId: crypto.randomUUID(),
            items: [],
          }),
        }
      );

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
      expect(data.details.items).toBeDefined();
    });

    it("returns 400 for invalid item ID format", async () => {
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
        "http://localhost:3000/api/items/reorder",
        {
          method: "PATCH",
          body: JSON.stringify({
            listId: crypto.randomUUID(),
            items: [{ id: "not-a-uuid", categoryId: crypto.randomUUID(), position: 0 }],
          }),
        }
      );

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
    });

    it("returns 400 for invalid categoryId format in items", async () => {
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
        "http://localhost:3000/api/items/reorder",
        {
          method: "PATCH",
          body: JSON.stringify({
            listId: crypto.randomUUID(),
            items: [{ id: crypto.randomUUID(), categoryId: "not-a-uuid", position: 0 }],
          }),
        }
      );

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
    });

    it("returns 400 for negative position", async () => {
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
        "http://localhost:3000/api/items/reorder",
        {
          method: "PATCH",
          body: JSON.stringify({
            listId: crypto.randomUUID(),
            items: [{ id: crypto.randomUUID(), categoryId: crypto.randomUUID(), position: -1 }],
          }),
        }
      );

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
    });

    it("returns 400 for duplicate item IDs", async () => {
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
        "http://localhost:3000/api/items/reorder",
        {
          method: "PATCH",
          body: JSON.stringify({
            listId: crypto.randomUUID(),
            items: [
              { id: duplicateId, categoryId: crypto.randomUUID(), position: 0 },
              { id: duplicateId, categoryId: crypto.randomUUID(), position: 1 },
            ],
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
        "http://localhost:3000/api/items/reorder",
        {
          method: "PATCH",
          body: JSON.stringify({
            listId: crypto.randomUUID(),
            items: [
              { id: crypto.randomUUID(), categoryId: crypto.randomUUID(), position: 0 },
            ],
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
        "http://localhost:3000/api/items/reorder",
        {
          method: "PATCH",
          body: JSON.stringify({
            listId: nonExistentListId,
            items: [
              { id: crypto.randomUUID(), categoryId: crypto.randomUUID(), position: 0 },
            ],
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
        "http://localhost:3000/api/items/reorder",
        {
          method: "PATCH",
          body: JSON.stringify({
            listId,
            items: [
              { id: crypto.randomUUID(), categoryId: crypto.randomUUID(), position: 0 },
            ],
          }),
        }
      );

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Forbidden");
    });

    it("returns 403 when anonymous user tries to reorder another user's items", async () => {
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
        "http://localhost:3000/api/items/reorder",
        {
          method: "PATCH",
          body: JSON.stringify({
            listId,
            items: [
              { id: crypto.randomUUID(), categoryId: crypto.randomUUID(), position: 0 },
            ],
          }),
        }
      );

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Forbidden");
    });
  });
});
