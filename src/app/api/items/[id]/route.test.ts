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
let currentItemId: string | null = null;
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
            // Second query is item lookup
            // Third query is category lookup
            // Fourth query is list lookup
            const isSessionLookup = hasSessionCookie && currentCallCount === 1;
            const isItemLookup = hasSessionCookie
              ? currentCallCount === 2
              : currentCallCount === 1;
            const isCategoryLookup = hasSessionCookie
              ? currentCallCount === 3
              : currentCallCount === 2;
            const isListLookup = hasSessionCookie
              ? currentCallCount === 4
              : currentCallCount === 3;

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
            } else if (isItemLookup) {
              // Item lookup
              const item = mockItems.find((i) => i.id === currentItemId);
              return {
                limit: vi.fn().mockResolvedValue(item ? [item] : []),
              };
            } else if (isCategoryLookup) {
              // Category lookup based on the item's category
              const item = mockItems.find((i) => i.id === currentItemId);
              if (item) {
                const category = mockCategories.find(
                  (c) => c.id === item.categoryId
                );
                return {
                  limit: vi.fn().mockResolvedValue(category ? [category] : []),
                };
              }
              return {
                limit: vi.fn().mockResolvedValue([]),
              };
            } else if (isListLookup) {
              // List lookup based on the category's list
              const item = mockItems.find((i) => i.id === currentItemId);
              if (item) {
                const category = mockCategories.find(
                  (c) => c.id === item.categoryId
                );
                if (category) {
                  const list = mockLists.find((l) => l.id === category.listId);
                  return {
                    limit: vi.fn().mockResolvedValue(list ? [list] : []),
                  };
                }
              }
              return {
                limit: vi.fn().mockResolvedValue([]),
              };
            }

            return {
              limit: vi.fn().mockResolvedValue([]),
            };
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
            const item = mockItems.find((i) => i.id === currentItemId);
            if (item) {
              const updatedItem = {
                ...item,
                name: (data.name as string) ?? item.name,
                description:
                  data.description !== undefined
                    ? (data.description as string | null)
                    : item.description,
                url:
                  data.url !== undefined
                    ? (data.url as string | null)
                    : item.url,
                weightAmount:
                  data.weightAmount !== undefined
                    ? (data.weightAmount as number)
                    : item.weightAmount,
                weightUnit:
                  data.weightUnit !== undefined
                    ? (data.weightUnit as string)
                    : item.weightUnit,
                label:
                  data.label !== undefined
                    ? (data.label as string)
                    : item.label,
                quantity:
                  data.quantity !== undefined
                    ? (data.quantity as number)
                    : item.quantity,
                updatedAt: data.updatedAt as Date,
              };
              // Update in mock array
              const index = mockItems.findIndex((i) => i.id === currentItemId);
              if (index !== -1) {
                mockItems[index] = updatedItem;
              }
              return Promise.resolve([updatedItem]);
            }
            return Promise.resolve([]);
          }),
        })),
      })),
    })),
    delete: vi.fn().mockImplementation(() => ({
      where: vi.fn().mockImplementation(() => {
        const index = mockItems.findIndex((i) => i.id === currentItemId);
        if (index !== -1) {
          mockItems.splice(index, 1);
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
  currentItemId = id;
  queryCallCount = 0;
  return Promise.resolve({ id });
};

describe("PATCH /api/items/[id]", () => {
  beforeEach(() => {
    mockLists = [];
    mockCategories = [];
    mockItems = [];
    mockAnonymousSessions = [];
    mockAuthenticatedUsers = [];
    mockSessions = [];
    mockCookies.clear();
    currentItemId = null;
    queryCallCount = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("validation", () => {
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

      const request = new NextRequest(
        "http://localhost:3000/api/items/not-a-uuid",
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
      expect(data.error).toBe("Invalid item ID");
    });

    it("returns 400 for empty name", async () => {
      const userId = crypto.randomUUID();
      const sessionToken = "test-session-token";
      const itemId = crypto.randomUUID();
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

      mockItems.push({
        id: itemId,
        categoryId,
        name: "Tent",
        description: null,
        url: null,
        weightAmount: 850,
        weightUnit: "g",
        label: "none",
        quantity: 1,
        position: 0,
        createdAt: now,
        updatedAt: now,
      });

      mockCookies.set("session_token", sessionToken);

      const request = new NextRequest(
        `http://localhost:3000/api/items/${itemId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ name: "" }),
        }
      );

      const response = await PATCH(request, {
        params: createParams(itemId),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
      expect(data.details.name).toBeDefined();
    });

    it("returns 400 for name exceeding max length", async () => {
      const userId = crypto.randomUUID();
      const sessionToken = "test-session-token";
      const itemId = crypto.randomUUID();

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
        `http://localhost:3000/api/items/${itemId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ name: "a".repeat(256) }),
        }
      );

      const response = await PATCH(request, {
        params: createParams(itemId),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
    });

    it("returns 400 for invalid URL format", async () => {
      const userId = crypto.randomUUID();
      const sessionToken = "test-session-token";
      const itemId = crypto.randomUUID();

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
        `http://localhost:3000/api/items/${itemId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ url: "not-a-valid-url" }),
        }
      );

      const response = await PATCH(request, {
        params: createParams(itemId),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
      expect(data.details.url).toBeDefined();
    });

    it("returns 400 for negative weight", async () => {
      const userId = crypto.randomUUID();
      const sessionToken = "test-session-token";
      const itemId = crypto.randomUUID();

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
        `http://localhost:3000/api/items/${itemId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ weightAmount: -5 }),
        }
      );

      const response = await PATCH(request, {
        params: createParams(itemId),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
      expect(data.details.weightAmount).toBeDefined();
    });

    it("returns 400 for invalid weight unit", async () => {
      const userId = crypto.randomUUID();
      const sessionToken = "test-session-token";
      const itemId = crypto.randomUUID();

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
        `http://localhost:3000/api/items/${itemId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ weightUnit: "invalid" }),
        }
      );

      const response = await PATCH(request, {
        params: createParams(itemId),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
      expect(data.details.weightUnit).toBeDefined();
    });

    it("returns 400 for invalid label", async () => {
      const userId = crypto.randomUUID();
      const sessionToken = "test-session-token";
      const itemId = crypto.randomUUID();

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
        `http://localhost:3000/api/items/${itemId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ label: "invalid" }),
        }
      );

      const response = await PATCH(request, {
        params: createParams(itemId),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
      expect(data.details.label).toBeDefined();
    });

    it("returns 400 for quantity less than 1", async () => {
      const userId = crypto.randomUUID();
      const sessionToken = "test-session-token";
      const itemId = crypto.randomUUID();

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
        `http://localhost:3000/api/items/${itemId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ quantity: 0 }),
        }
      );

      const response = await PATCH(request, {
        params: createParams(itemId),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
      expect(data.details.quantity).toBeDefined();
    });
  });

  describe("authentication", () => {
    it("returns 401 when not authenticated", async () => {
      const itemId = crypto.randomUUID();

      const request = new NextRequest(
        `http://localhost:3000/api/items/${itemId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ name: "Updated Name" }),
        }
      );

      const response = await PATCH(request, {
        params: createParams(itemId),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });
  });

  describe("item update", () => {
    it("updates item name for authenticated user", async () => {
      const userId = crypto.randomUUID();
      const sessionToken = "test-session-token";
      const listId = crypto.randomUUID();
      const categoryId = crypto.randomUUID();
      const itemId = crypto.randomUUID();

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

      mockItems.push({
        id: itemId,
        categoryId,
        name: "Tent",
        description: null,
        url: null,
        weightAmount: 850,
        weightUnit: "g",
        label: "none",
        quantity: 1,
        position: 0,
        createdAt: now,
        updatedAt: now,
      });

      mockCookies.set("session_token", sessionToken);

      const request = new NextRequest(
        `http://localhost:3000/api/items/${itemId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ name: "Updated Tent" }),
        }
      );

      const response = await PATCH(request, {
        params: createParams(itemId),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("Item updated successfully");
      expect(data.item.name).toBe("Updated Tent");
    });

    it("updates item description", async () => {
      const userId = crypto.randomUUID();
      const sessionToken = "test-session-token";
      const listId = crypto.randomUUID();
      const categoryId = crypto.randomUUID();
      const itemId = crypto.randomUUID();

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

      mockItems.push({
        id: itemId,
        categoryId,
        name: "Tent",
        description: null,
        url: null,
        weightAmount: 850,
        weightUnit: "g",
        label: "none",
        quantity: 1,
        position: 0,
        createdAt: now,
        updatedAt: now,
      });

      mockCookies.set("session_token", sessionToken);

      const request = new NextRequest(
        `http://localhost:3000/api/items/${itemId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ description: "Ultralight tent for 1 person" }),
        }
      );

      const response = await PATCH(request, {
        params: createParams(itemId),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.item.description).toBe("Ultralight tent for 1 person");
    });

    it("updates item URL", async () => {
      const userId = crypto.randomUUID();
      const sessionToken = "test-session-token";
      const listId = crypto.randomUUID();
      const categoryId = crypto.randomUUID();
      const itemId = crypto.randomUUID();

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

      mockItems.push({
        id: itemId,
        categoryId,
        name: "Tent",
        description: null,
        url: null,
        weightAmount: 850,
        weightUnit: "g",
        label: "none",
        quantity: 1,
        position: 0,
        createdAt: now,
        updatedAt: now,
      });

      mockCookies.set("session_token", sessionToken);

      const request = new NextRequest(
        `http://localhost:3000/api/items/${itemId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ url: "https://example.com/tent" }),
        }
      );

      const response = await PATCH(request, {
        params: createParams(itemId),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.item.url).toBe("https://example.com/tent");
    });

    it("updates item weight", async () => {
      const userId = crypto.randomUUID();
      const sessionToken = "test-session-token";
      const listId = crypto.randomUUID();
      const categoryId = crypto.randomUUID();
      const itemId = crypto.randomUUID();

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

      mockItems.push({
        id: itemId,
        categoryId,
        name: "Tent",
        description: null,
        url: null,
        weightAmount: 850,
        weightUnit: "g",
        label: "none",
        quantity: 1,
        position: 0,
        createdAt: now,
        updatedAt: now,
      });

      mockCookies.set("session_token", sessionToken);

      const request = new NextRequest(
        `http://localhost:3000/api/items/${itemId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ weightAmount: 750, weightUnit: "g" }),
        }
      );

      const response = await PATCH(request, {
        params: createParams(itemId),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.item.weightAmount).toBe(750);
      expect(data.item.weightUnit).toBe("g");
    });

    it("updates item label", async () => {
      const userId = crypto.randomUUID();
      const sessionToken = "test-session-token";
      const listId = crypto.randomUUID();
      const categoryId = crypto.randomUUID();
      const itemId = crypto.randomUUID();

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
        name: "Clothing",
        description: null,
        position: 0,
        createdAt: now,
        updatedAt: now,
      });

      mockItems.push({
        id: itemId,
        categoryId,
        name: "Rain Jacket",
        description: null,
        url: null,
        weightAmount: 200,
        weightUnit: "g",
        label: "none",
        quantity: 1,
        position: 0,
        createdAt: now,
        updatedAt: now,
      });

      mockCookies.set("session_token", sessionToken);

      const request = new NextRequest(
        `http://localhost:3000/api/items/${itemId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ label: "worn" }),
        }
      );

      const response = await PATCH(request, {
        params: createParams(itemId),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.item.label).toBe("worn");
    });

    it("updates item quantity", async () => {
      const userId = crypto.randomUUID();
      const sessionToken = "test-session-token";
      const listId = crypto.randomUUID();
      const categoryId = crypto.randomUUID();
      const itemId = crypto.randomUUID();

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
        name: "Accessories",
        description: null,
        position: 0,
        createdAt: now,
        updatedAt: now,
      });

      mockItems.push({
        id: itemId,
        categoryId,
        name: "Tent Stakes",
        description: null,
        url: null,
        weightAmount: 10,
        weightUnit: "g",
        label: "none",
        quantity: 6,
        position: 0,
        createdAt: now,
        updatedAt: now,
      });

      mockCookies.set("session_token", sessionToken);

      const request = new NextRequest(
        `http://localhost:3000/api/items/${itemId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ quantity: 8 }),
        }
      );

      const response = await PATCH(request, {
        params: createParams(itemId),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.item.quantity).toBe(8);
    });

    it("updates item for anonymous user", async () => {
      const anonSessionId = crypto.randomUUID();
      const anonToken = "anon-session-token";
      const listId = crypto.randomUUID();
      const categoryId = crypto.randomUUID();
      const itemId = crypto.randomUUID();

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

      mockItems.push({
        id: itemId,
        categoryId,
        name: "Sleeping Bag",
        description: null,
        url: null,
        weightAmount: 500,
        weightUnit: "g",
        label: "none",
        quantity: 1,
        position: 0,
        createdAt: now,
        updatedAt: now,
      });

      mockCookies.set("anonymous_session_token", anonToken);

      const request = new NextRequest(
        `http://localhost:3000/api/items/${itemId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ name: "UL Sleeping Bag" }),
        }
      );

      const response = await PATCH(request, {
        params: createParams(itemId),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.item.name).toBe("UL Sleeping Bag");
    });

    it("clears description when set to null", async () => {
      const userId = crypto.randomUUID();
      const sessionToken = "test-session-token";
      const listId = crypto.randomUUID();
      const categoryId = crypto.randomUUID();
      const itemId = crypto.randomUUID();

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

      mockItems.push({
        id: itemId,
        categoryId,
        name: "Tent",
        description: "Old description",
        url: null,
        weightAmount: 850,
        weightUnit: "g",
        label: "none",
        quantity: 1,
        position: 0,
        createdAt: now,
        updatedAt: now,
      });

      mockCookies.set("session_token", sessionToken);

      const request = new NextRequest(
        `http://localhost:3000/api/items/${itemId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ description: null }),
        }
      );

      const response = await PATCH(request, {
        params: createParams(itemId),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.item.description).toBeNull();
    });

    it("clears URL when set to null", async () => {
      const userId = crypto.randomUUID();
      const sessionToken = "test-session-token";
      const listId = crypto.randomUUID();
      const categoryId = crypto.randomUUID();
      const itemId = crypto.randomUUID();

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

      mockItems.push({
        id: itemId,
        categoryId,
        name: "Tent",
        description: null,
        url: "https://example.com/tent",
        weightAmount: 850,
        weightUnit: "g",
        label: "none",
        quantity: 1,
        position: 0,
        createdAt: now,
        updatedAt: now,
      });

      mockCookies.set("session_token", sessionToken);

      const request = new NextRequest(
        `http://localhost:3000/api/items/${itemId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ url: null }),
        }
      );

      const response = await PATCH(request, {
        params: createParams(itemId),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.item.url).toBeNull();
    });
  });

  describe("authorization", () => {
    it("returns 404 when item does not exist", async () => {
      const userId = crypto.randomUUID();
      const sessionToken = "test-session-token";
      const nonExistentItemId = crypto.randomUUID();

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
        `http://localhost:3000/api/items/${nonExistentItemId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ name: "Updated Name" }),
        }
      );

      const response = await PATCH(request, {
        params: createParams(nonExistentItemId),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Item not found");
    });

    it("returns 403 when user does not own the list", async () => {
      const userId = crypto.randomUUID();
      const otherUserId = crypto.randomUUID();
      const sessionToken = "test-session-token";
      const listId = crypto.randomUUID();
      const categoryId = crypto.randomUUID();
      const itemId = crypto.randomUUID();

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

      mockItems.push({
        id: itemId,
        categoryId,
        name: "Tent",
        description: null,
        url: null,
        weightAmount: 850,
        weightUnit: "g",
        label: "none",
        quantity: 1,
        position: 0,
        createdAt: now,
        updatedAt: now,
      });

      mockCookies.set("session_token", sessionToken);

      const request = new NextRequest(
        `http://localhost:3000/api/items/${itemId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ name: "Updated Name" }),
        }
      );

      const response = await PATCH(request, {
        params: createParams(itemId),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Forbidden");
    });
  });
});

describe("DELETE /api/items/[id]", () => {
  beforeEach(() => {
    mockLists = [];
    mockCategories = [];
    mockItems = [];
    mockAnonymousSessions = [];
    mockAuthenticatedUsers = [];
    mockSessions = [];
    mockCookies.clear();
    currentItemId = null;
    queryCallCount = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("validation", () => {
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

      const request = new NextRequest(
        "http://localhost:3000/api/items/not-a-uuid",
        {
          method: "DELETE",
        }
      );

      const response = await DELETE(request, {
        params: createParams("not-a-uuid"),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid item ID");
    });
  });

  describe("authentication", () => {
    it("returns 401 when not authenticated", async () => {
      const itemId = crypto.randomUUID();

      const request = new NextRequest(
        `http://localhost:3000/api/items/${itemId}`,
        {
          method: "DELETE",
        }
      );

      const response = await DELETE(request, {
        params: createParams(itemId),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });
  });

  describe("item deletion", () => {
    it("deletes item for authenticated user", async () => {
      const userId = crypto.randomUUID();
      const sessionToken = "test-session-token";
      const listId = crypto.randomUUID();
      const categoryId = crypto.randomUUID();
      const itemId = crypto.randomUUID();

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

      mockItems.push({
        id: itemId,
        categoryId,
        name: "Tent",
        description: null,
        url: null,
        weightAmount: 850,
        weightUnit: "g",
        label: "none",
        quantity: 1,
        position: 0,
        createdAt: now,
        updatedAt: now,
      });

      mockCookies.set("session_token", sessionToken);

      const request = new NextRequest(
        `http://localhost:3000/api/items/${itemId}`,
        {
          method: "DELETE",
        }
      );

      const response = await DELETE(request, {
        params: createParams(itemId),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("Item deleted successfully");
      expect(mockItems.length).toBe(0);
    });

    it("deletes item for anonymous user", async () => {
      const anonSessionId = crypto.randomUUID();
      const anonToken = "anon-session-token";
      const listId = crypto.randomUUID();
      const categoryId = crypto.randomUUID();
      const itemId = crypto.randomUUID();

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

      mockItems.push({
        id: itemId,
        categoryId,
        name: "Sleeping Bag",
        description: null,
        url: null,
        weightAmount: 500,
        weightUnit: "g",
        label: "none",
        quantity: 1,
        position: 0,
        createdAt: now,
        updatedAt: now,
      });

      mockCookies.set("anonymous_session_token", anonToken);

      const request = new NextRequest(
        `http://localhost:3000/api/items/${itemId}`,
        {
          method: "DELETE",
        }
      );

      const response = await DELETE(request, {
        params: createParams(itemId),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("Item deleted successfully");
    });
  });

  describe("authorization", () => {
    it("returns 404 when item does not exist", async () => {
      const userId = crypto.randomUUID();
      const sessionToken = "test-session-token";
      const nonExistentItemId = crypto.randomUUID();

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
        `http://localhost:3000/api/items/${nonExistentItemId}`,
        {
          method: "DELETE",
        }
      );

      const response = await DELETE(request, {
        params: createParams(nonExistentItemId),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Item not found");
    });

    it("returns 403 when user does not own the list", async () => {
      const userId = crypto.randomUUID();
      const otherUserId = crypto.randomUUID();
      const sessionToken = "test-session-token";
      const listId = crypto.randomUUID();
      const categoryId = crypto.randomUUID();
      const itemId = crypto.randomUUID();

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

      mockItems.push({
        id: itemId,
        categoryId,
        name: "Tent",
        description: null,
        url: null,
        weightAmount: 850,
        weightUnit: "g",
        label: "none",
        quantity: 1,
        position: 0,
        createdAt: now,
        updatedAt: now,
      });

      mockCookies.set("session_token", sessionToken);

      const request = new NextRequest(
        `http://localhost:3000/api/items/${itemId}`,
        {
          method: "DELETE",
        }
      );

      const response = await DELETE(request, {
        params: createParams(itemId),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Forbidden");
    });

    it("returns 403 when anonymous user tries to delete another user's item", async () => {
      const anonSessionId = crypto.randomUUID();
      const otherAnonSessionId = crypto.randomUUID();
      const anonToken = "anon-session-token";
      const listId = crypto.randomUUID();
      const categoryId = crypto.randomUUID();
      const itemId = crypto.randomUUID();

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

      mockItems.push({
        id: itemId,
        categoryId,
        name: "Tent",
        description: null,
        url: null,
        weightAmount: 850,
        weightUnit: "g",
        label: "none",
        quantity: 1,
        position: 0,
        createdAt: now,
        updatedAt: now,
      });

      mockCookies.set("anonymous_session_token", anonToken);

      const request = new NextRequest(
        `http://localhost:3000/api/items/${itemId}`,
        {
          method: "DELETE",
        }
      );

      const response = await DELETE(request, {
        params: createParams(itemId),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Forbidden");
    });
  });
});
