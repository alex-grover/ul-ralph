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

            // First query is session lookup
            // Second query is category lookup
            // Third query is list lookup
            // Fourth query is max position
            const isSessionLookup = hasSessionCookie && currentCallCount === 1;
            const isCategoryLookup = hasSessionCookie
              ? currentCallCount === 2
              : currentCallCount === 1;
            const isListLookup = hasSessionCookie
              ? currentCallCount === 3
              : currentCallCount === 2;

            if (isMaxPositionQuery) {
              // Return max position for items in the category
              const categoryItems = mockItems.filter(
                (i) => i.categoryId === currentCategoryId
              );
              const maxPosition =
                categoryItems.length > 0
                  ? Math.max(...categoryItems.map((i) => i.position))
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
            } else if (isCategoryLookup) {
              // Category lookup
              const category = mockCategories.find(
                (c) => c.id === currentCategoryId
              );
              return {
                limit: vi.fn().mockResolvedValue(category ? [category] : []),
              };
            } else if (isListLookup) {
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
    insert: vi.fn().mockImplementation(() => ({
      values: vi.fn().mockImplementation((data: Record<string, unknown>) => ({
        returning: vi.fn().mockImplementation(() => {
          const newItem = {
            id: crypto.randomUUID(),
            categoryId: data.categoryId as string,
            name: data.name as string,
            description: (data.description as string | null) ?? null,
            url: (data.url as string | null) ?? null,
            weightAmount: (data.weightAmount as number) ?? 0,
            weightUnit: (data.weightUnit as string) ?? "g",
            label: (data.label as string) ?? "none",
            quantity: (data.quantity as number) ?? 1,
            position: data.position as number,
            createdAt: now,
            updatedAt: now,
          };
          mockItems.push(newItem);
          return Promise.resolve([newItem]);
        }),
      })),
    })),
  },
}));

// Import after mocking
import { POST } from "./route";

// Helper to set up test and reset query count
const setupTest = (categoryId: string | null) => {
  currentCategoryId = categoryId;
  queryCallCount = 0;
};

describe("POST /api/items", () => {
  beforeEach(() => {
    mockLists = [];
    mockCategories = [];
    mockItems = [];
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
    it("returns 400 for missing categoryId", async () => {
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

      const request = new NextRequest("http://localhost:3000/api/items", {
        method: "POST",
        body: JSON.stringify({ name: "Test Item" }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
      expect(data.details.categoryId).toBeDefined();
    });

    it("returns 400 for invalid categoryId format", async () => {
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

      const request = new NextRequest("http://localhost:3000/api/items", {
        method: "POST",
        body: JSON.stringify({ categoryId: "not-a-uuid", name: "Test Item" }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
      expect(data.details.categoryId).toBeDefined();
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

      const request = new NextRequest("http://localhost:3000/api/items", {
        method: "POST",
        body: JSON.stringify({ categoryId: crypto.randomUUID() }),
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

      const request = new NextRequest("http://localhost:3000/api/items", {
        method: "POST",
        body: JSON.stringify({ categoryId: crypto.randomUUID(), name: "" }),
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

      const request = new NextRequest("http://localhost:3000/api/items", {
        method: "POST",
        body: JSON.stringify({
          categoryId: crypto.randomUUID(),
          name: "a".repeat(256),
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
    });

    it("returns 400 for invalid URL format", async () => {
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

      const request = new NextRequest("http://localhost:3000/api/items", {
        method: "POST",
        body: JSON.stringify({
          categoryId: crypto.randomUUID(),
          name: "Test Item",
          url: "not-a-valid-url",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
      expect(data.details.url).toBeDefined();
    });

    it("returns 400 for negative weight", async () => {
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

      const request = new NextRequest("http://localhost:3000/api/items", {
        method: "POST",
        body: JSON.stringify({
          categoryId: crypto.randomUUID(),
          name: "Test Item",
          weightAmount: -5,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
      expect(data.details.weightAmount).toBeDefined();
    });

    it("returns 400 for invalid weight unit", async () => {
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

      const request = new NextRequest("http://localhost:3000/api/items", {
        method: "POST",
        body: JSON.stringify({
          categoryId: crypto.randomUUID(),
          name: "Test Item",
          weightUnit: "invalid",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
      expect(data.details.weightUnit).toBeDefined();
    });

    it("returns 400 for invalid label", async () => {
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

      const request = new NextRequest("http://localhost:3000/api/items", {
        method: "POST",
        body: JSON.stringify({
          categoryId: crypto.randomUUID(),
          name: "Test Item",
          label: "invalid",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
      expect(data.details.label).toBeDefined();
    });

    it("returns 400 for quantity less than 1", async () => {
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

      const request = new NextRequest("http://localhost:3000/api/items", {
        method: "POST",
        body: JSON.stringify({
          categoryId: crypto.randomUUID(),
          name: "Test Item",
          quantity: 0,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
      expect(data.details.quantity).toBeDefined();
    });

    it("returns 400 for non-integer quantity", async () => {
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

      const request = new NextRequest("http://localhost:3000/api/items", {
        method: "POST",
        body: JSON.stringify({
          categoryId: crypto.randomUUID(),
          name: "Test Item",
          quantity: 1.5,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
      expect(data.details.quantity).toBeDefined();
    });
  });

  describe("authentication", () => {
    it("returns 401 when not authenticated", async () => {
      setupTest(null);

      const request = new NextRequest("http://localhost:3000/api/items", {
        method: "POST",
        body: JSON.stringify({
          categoryId: crypto.randomUUID(),
          name: "Test Item",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });
  });

  describe("item creation", () => {
    it("creates item for authenticated user's category", async () => {
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
        name: "My Pack List",
        slug: "my-pack-list",
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
      setupTest(categoryId);

      const request = new NextRequest("http://localhost:3000/api/items", {
        method: "POST",
        body: JSON.stringify({
          categoryId,
          name: "Tent",
          description: "UL tent for backpacking",
          weightAmount: 850,
          weightUnit: "g",
          label: "none",
          quantity: 1,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.message).toBe("Item created successfully");
      expect(data.item).toBeDefined();
      expect(data.item.name).toBe("Tent");
      expect(data.item.description).toBe("UL tent for backpacking");
      expect(data.item.weightAmount).toBe(850);
      expect(data.item.weightUnit).toBe("g");
      expect(data.item.label).toBe("none");
      expect(data.item.quantity).toBe(1);
      expect(data.item.categoryId).toBe(categoryId);
      expect(data.item.position).toBe(0);
    });

    it("creates item for anonymous user's category", async () => {
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
      setupTest(categoryId);

      const request = new NextRequest("http://localhost:3000/api/items", {
        method: "POST",
        body: JSON.stringify({
          categoryId,
          name: "Sleeping Bag",
          weightAmount: 500,
          weightUnit: "g",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.item.name).toBe("Sleeping Bag");
      expect(data.item.categoryId).toBe(categoryId);
    });

    it("creates item with null description when not provided", async () => {
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
        name: "Kitchen",
        description: null,
        position: 0,
        createdAt: now,
        updatedAt: now,
      });

      mockCookies.set("session_token", sessionToken);
      setupTest(categoryId);

      const request = new NextRequest("http://localhost:3000/api/items", {
        method: "POST",
        body: JSON.stringify({
          categoryId,
          name: "Stove",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.item.description).toBeNull();
    });

    it("creates item with URL", async () => {
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
        name: "Kitchen",
        description: null,
        position: 0,
        createdAt: now,
        updatedAt: now,
      });

      mockCookies.set("session_token", sessionToken);
      setupTest(categoryId);

      const request = new NextRequest("http://localhost:3000/api/items", {
        method: "POST",
        body: JSON.stringify({
          categoryId,
          name: "Stove",
          url: "https://example.com/stove",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.item.url).toBe("https://example.com/stove");
    });

    it("creates item with worn label", async () => {
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
        name: "Clothing",
        description: null,
        position: 0,
        createdAt: now,
        updatedAt: now,
      });

      mockCookies.set("session_token", sessionToken);
      setupTest(categoryId);

      const request = new NextRequest("http://localhost:3000/api/items", {
        method: "POST",
        body: JSON.stringify({
          categoryId,
          name: "Rain Jacket",
          label: "worn",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.item.label).toBe("worn");
    });

    it("creates item with consumable label", async () => {
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
        name: "Food",
        description: null,
        position: 0,
        createdAt: now,
        updatedAt: now,
      });

      mockCookies.set("session_token", sessionToken);
      setupTest(categoryId);

      const request = new NextRequest("http://localhost:3000/api/items", {
        method: "POST",
        body: JSON.stringify({
          categoryId,
          name: "Trail Mix",
          label: "consumable",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.item.label).toBe("consumable");
    });

    it("creates item with different weight units", async () => {
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
      setupTest(categoryId);

      const request = new NextRequest("http://localhost:3000/api/items", {
        method: "POST",
        body: JSON.stringify({
          categoryId,
          name: "Tent",
          weightAmount: 2,
          weightUnit: "lbs",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.item.weightUnit).toBe("lbs");
    });

    it("creates item with quantity greater than 1", async () => {
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
        name: "Accessories",
        description: null,
        position: 0,
        createdAt: now,
        updatedAt: now,
      });

      mockCookies.set("session_token", sessionToken);
      setupTest(categoryId);

      const request = new NextRequest("http://localhost:3000/api/items", {
        method: "POST",
        body: JSON.stringify({
          categoryId,
          name: "Tent Stakes",
          quantity: 8,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.item.quantity).toBe(8);
    });

    it("assigns correct position when category already has items", async () => {
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

      // Add existing items
      mockItems.push({
        id: crypto.randomUUID(),
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

      mockItems.push({
        id: crypto.randomUUID(),
        categoryId,
        name: "Groundsheet",
        description: null,
        url: null,
        weightAmount: 100,
        weightUnit: "g",
        label: "none",
        quantity: 1,
        position: 1,
        createdAt: now,
        updatedAt: now,
      });

      mockCookies.set("session_token", sessionToken);
      setupTest(categoryId);

      const request = new NextRequest("http://localhost:3000/api/items", {
        method: "POST",
        body: JSON.stringify({
          categoryId,
          name: "Tent Stakes",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.item.position).toBe(2);
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
      setupTest(nonExistentCategoryId);

      const request = new NextRequest("http://localhost:3000/api/items", {
        method: "POST",
        body: JSON.stringify({
          categoryId: nonExistentCategoryId,
          name: "Test Item",
        }),
      });

      const response = await POST(request);
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
      setupTest(categoryId);

      const request = new NextRequest("http://localhost:3000/api/items", {
        method: "POST",
        body: JSON.stringify({
          categoryId,
          name: "Test Item",
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
      setupTest(categoryId);

      const request = new NextRequest("http://localhost:3000/api/items", {
        method: "POST",
        body: JSON.stringify({
          categoryId,
          name: "Test Item",
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
      setupTest(categoryId);

      const request = new NextRequest("http://localhost:3000/api/items", {
        method: "POST",
        body: JSON.stringify({
          categoryId,
          name: "Test Item",
          description: "Test description",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toHaveProperty("message");
      expect(data).toHaveProperty("item");
      expect(data.item).toHaveProperty("id");
      expect(data.item).toHaveProperty("categoryId");
      expect(data.item).toHaveProperty("name");
      expect(data.item).toHaveProperty("description");
      expect(data.item).toHaveProperty("url");
      expect(data.item).toHaveProperty("weightAmount");
      expect(data.item).toHaveProperty("weightUnit");
      expect(data.item).toHaveProperty("label");
      expect(data.item).toHaveProperty("quantity");
      expect(data.item).toHaveProperty("position");
      expect(data.item).toHaveProperty("createdAt");
      expect(data.item).toHaveProperty("updatedAt");
    });
  });
});
