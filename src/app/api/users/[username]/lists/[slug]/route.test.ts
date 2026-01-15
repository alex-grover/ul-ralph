import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// Mock data storage
let mockUsers: Array<{
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}> = [];

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

// Track query context for routing queries to correct mock data
let queryUsername: string | null = null;
let querySlug: string | null = null;

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

// Query call counter to distinguish between different queries in the same request
let queryCallCount = 0;

// Track the list found for category/item queries
let foundListId: string | null = null;

// Track which query type we're in
let currentQueryType: "user" | "list" | "session" | "categories" | "items" | null = null;

// Mock database
vi.mock("@/db", () => ({
  db: {
    select: vi.fn().mockImplementation(() => {
      queryCallCount++;
      const currentCallCount = queryCallCount;

      return {
        from: vi.fn().mockImplementation((table: unknown) => {
          // Detect table by examining the table object structure
          // Drizzle table objects have a Symbol.for('drizzle:Name') property
          const tableObj = table as Record<string | symbol, unknown>;
          const symbols = Object.getOwnPropertySymbols(tableObj);
          let tableName = "";
          for (const sym of symbols) {
            if (sym.toString().includes("Name")) {
              tableName = tableObj[sym] as string;
              break;
            }
          }

          // Fallback: try to detect by known properties
          if (!tableName) {
            if (tableObj && typeof tableObj === "object") {
              if ("username" in tableObj) tableName = "users";
              else if ("slug" in tableObj && "isPublic" in tableObj) tableName = "lists";
              else if ("listId" in tableObj && "position" in tableObj && !("weightAmount" in tableObj)) tableName = "categories";
              else if ("categoryId" in tableObj) tableName = "items";
              else if ("sessionToken" in tableObj && "userId" in tableObj) tableName = "sessions";
              else if ("sessionToken" in tableObj) tableName = "anonymous_sessions";
            }
          }

          // Set query type based on table or call count
          if (tableName === "users") {
            currentQueryType = "user";
          } else if (tableName === "lists") {
            currentQueryType = "list";
          } else if (tableName === "categories") {
            currentQueryType = "categories";
          } else if (tableName === "items") {
            currentQueryType = "items";
          } else if (tableName === "sessions" || tableName === "anonymous_sessions") {
            currentQueryType = "session";
          } else {
            // Fallback to call count based detection
            if (currentCallCount === 1) currentQueryType = "user";
            else if (currentCallCount === 2) currentQueryType = "list";
            else currentQueryType = "session";
          }

          return {
            where: vi.fn().mockImplementation(() => ({
              limit: vi.fn().mockImplementation(() => {
                if (currentQueryType === "user") {
                  const user = mockUsers.find(
                    (u) => u.username === queryUsername
                  );
                  if (user) {
                    return Promise.resolve([user]);
                  }
                  return Promise.resolve([]);
                }

                if (currentQueryType === "list") {
                  const user = mockUsers.find(
                    (u) => u.username === queryUsername
                  );
                  if (user) {
                    const list = mockLists.find(
                      (l) => l.userId === user.id && l.slug === querySlug
                    );
                    if (list) {
                      foundListId = list.id;
                      return Promise.resolve([list]);
                    }
                  }
                  return Promise.resolve([]);
                }

                // Session lookup
                const sessionToken = mockCookies.get("session_token");
                const anonToken = mockCookies.get("anonymous_session_token");

                if (sessionToken) {
                  const session = mockSessions.find(
                    (s) =>
                      s.sessionToken === sessionToken &&
                      s.expiresAt > new Date()
                  );
                  if (session) {
                    const user = mockUsers.find((u) => u.id === session.userId);
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
              orderBy: vi.fn().mockImplementation(() => {
                // Categories lookup - where().orderBy()
                if (currentQueryType === "categories" && foundListId) {
                  return Promise.resolve(
                    mockCategories
                      .filter((c) => c.listId === foundListId)
                      .sort((a, b) => a.position - b.position)
                  );
                }
                // Items lookup - where(inArray()).orderBy()
                if (currentQueryType === "items" && foundListId) {
                  const categoryIds = mockCategories
                    .filter((c) => c.listId === foundListId)
                    .map((c) => c.id);
                  return Promise.resolve(
                    mockItems
                      .filter((i) => categoryIds.includes(i.categoryId))
                      .sort((a, b) => a.position - b.position)
                  );
                }
                return Promise.resolve([]);
              }),
            })),
            innerJoin: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockImplementation(() => {
              // Items lookup - called directly from from().where().orderBy()
              if (currentQueryType === "items" && foundListId) {
                const categoryIds = mockCategories
                  .filter((c) => c.listId === foundListId)
                  .map((c) => c.id);
                return Promise.resolve(
                  mockItems
                    .filter((i) => categoryIds.includes(i.categoryId))
                    .sort((a, b) => a.position - b.position)
                );
              }
              return Promise.resolve([]);
            }),
          };
        }),
      };
    }),
  },
}));

// Import after mocking
import { GET } from "./route";

// Helper to create params and reset query count
const createParams = (username: string, slug: string) => {
  queryUsername = username;
  querySlug = slug;
  queryCallCount = 0;
  foundListId = null;
  return Promise.resolve({ username, slug });
};

describe("GET /api/users/[username]/lists/[slug]", () => {
  beforeEach(() => {
    mockUsers = [];
    mockLists = [];
    mockCategories = [];
    mockItems = [];
    mockAnonymousSessions = [];
    mockSessions = [];
    mockCookies.clear();
    queryUsername = null;
    querySlug = null;
    queryCallCount = 0;
    foundListId = null;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("user not found", () => {
    it("returns 404 when user does not exist", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/users/nonexistent/lists/my-list"
      );

      const response = await GET(request, {
        params: createParams("nonexistent", "my-list"),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("User not found");
    });
  });

  describe("list not found", () => {
    it("returns 404 when list does not exist for user", async () => {
      const userId = crypto.randomUUID();

      mockUsers.push({
        id: userId,
        username: "testuser",
        email: "test@example.com",
        passwordHash: "hash",
        createdAt: now,
        updatedAt: now,
      });

      const request = new NextRequest(
        "http://localhost:3000/api/users/testuser/lists/nonexistent"
      );

      const response = await GET(request, {
        params: createParams("testuser", "nonexistent"),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("List not found");
    });

    it("returns 404 when slug exists for different user", async () => {
      const userId1 = crypto.randomUUID();
      const userId2 = crypto.randomUUID();

      mockUsers.push({
        id: userId1,
        username: "user1",
        email: "user1@example.com",
        passwordHash: "hash",
        createdAt: now,
        updatedAt: now,
      });

      mockUsers.push({
        id: userId2,
        username: "user2",
        email: "user2@example.com",
        passwordHash: "hash",
        createdAt: now,
        updatedAt: now,
      });

      // List belongs to user2
      mockLists.push({
        id: crypto.randomUUID(),
        userId: userId2,
        anonymousSessionId: null,
        name: "Test List",
        slug: "test-list",
        description: null,
        isPublic: true,
        createdAt: now,
        updatedAt: now,
      });

      // Request for user1's list with same slug
      const request = new NextRequest(
        "http://localhost:3000/api/users/user1/lists/test-list"
      );

      const response = await GET(request, {
        params: createParams("user1", "test-list"),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("List not found");
    });
  });

  describe("access control", () => {
    it("returns 403 for private list when user is not authenticated", async () => {
      const userId = crypto.randomUUID();

      mockUsers.push({
        id: userId,
        username: "testuser",
        email: "test@example.com",
        passwordHash: "hash",
        createdAt: now,
        updatedAt: now,
      });

      mockLists.push({
        id: crypto.randomUUID(),
        userId,
        anonymousSessionId: null,
        name: "Private List",
        slug: "private-list",
        description: null,
        isPublic: false,
        createdAt: now,
        updatedAt: now,
      });

      const request = new NextRequest(
        "http://localhost:3000/api/users/testuser/lists/private-list"
      );

      const response = await GET(request, {
        params: createParams("testuser", "private-list"),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Forbidden");
    });

    it("returns 403 for private list when authenticated as different user", async () => {
      const ownerId = crypto.randomUUID();
      const viewerId = crypto.randomUUID();
      const sessionToken = "viewer-session-token";

      mockUsers.push({
        id: ownerId,
        username: "owner",
        email: "owner@example.com",
        passwordHash: "hash",
        createdAt: now,
        updatedAt: now,
      });

      mockUsers.push({
        id: viewerId,
        username: "viewer",
        email: "viewer@example.com",
        passwordHash: "hash",
        createdAt: now,
        updatedAt: now,
      });

      mockSessions.push({
        id: crypto.randomUUID(),
        userId: viewerId,
        sessionToken,
        expiresAt: futureDate,
      });

      mockLists.push({
        id: crypto.randomUUID(),
        userId: ownerId,
        anonymousSessionId: null,
        name: "Private List",
        slug: "private-list",
        description: null,
        isPublic: false,
        createdAt: now,
        updatedAt: now,
      });

      mockCookies.set("session_token", sessionToken);

      const request = new NextRequest(
        "http://localhost:3000/api/users/owner/lists/private-list"
      );

      const response = await GET(request, {
        params: createParams("owner", "private-list"),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Forbidden");
    });

    it("returns 403 for private list when only anonymous session exists", async () => {
      const userId = crypto.randomUUID();
      const anonSessionId = crypto.randomUUID();
      const anonToken = "anon-session-token";

      mockUsers.push({
        id: userId,
        username: "testuser",
        email: "test@example.com",
        passwordHash: "hash",
        createdAt: now,
        updatedAt: now,
      });

      mockAnonymousSessions.push({
        id: anonSessionId,
        sessionToken: anonToken,
        expiresAt: futureDate,
      });

      mockLists.push({
        id: crypto.randomUUID(),
        userId,
        anonymousSessionId: null,
        name: "Private List",
        slug: "private-list",
        description: null,
        isPublic: false,
        createdAt: now,
        updatedAt: now,
      });

      mockCookies.set("anonymous_session_token", anonToken);

      const request = new NextRequest(
        "http://localhost:3000/api/users/testuser/lists/private-list"
      );

      const response = await GET(request, {
        params: createParams("testuser", "private-list"),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Forbidden");
    });
  });

  describe("public list access", () => {
    it("returns public list for unauthenticated user", async () => {
      const userId = crypto.randomUUID();
      const listId = crypto.randomUUID();

      mockUsers.push({
        id: userId,
        username: "testuser",
        email: "test@example.com",
        passwordHash: "hash",
        createdAt: now,
        updatedAt: now,
      });

      mockLists.push({
        id: listId,
        userId,
        anonymousSessionId: null,
        name: "Public Pack",
        slug: "public-pack",
        description: "A public gear list",
        isPublic: true,
        createdAt: now,
        updatedAt: now,
      });

      const request = new NextRequest(
        "http://localhost:3000/api/users/testuser/lists/public-pack"
      );

      const response = await GET(request, {
        params: createParams("testuser", "public-pack"),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.list.name).toBe("Public Pack");
      expect(data.list.slug).toBe("public-pack");
      expect(data.list.description).toBe("A public gear list");
      expect(data.list.isPublic).toBe(true);
      expect(data.isOwner).toBe(false);
      expect(data.username).toBe("testuser");
      expect(data.categories).toEqual([]);
    });

    it("returns public list for authenticated non-owner", async () => {
      const ownerId = crypto.randomUUID();
      const viewerId = crypto.randomUUID();
      const listId = crypto.randomUUID();
      const sessionToken = "viewer-session-token";

      mockUsers.push({
        id: ownerId,
        username: "owner",
        email: "owner@example.com",
        passwordHash: "hash",
        createdAt: now,
        updatedAt: now,
      });

      mockUsers.push({
        id: viewerId,
        username: "viewer",
        email: "viewer@example.com",
        passwordHash: "hash",
        createdAt: now,
        updatedAt: now,
      });

      mockSessions.push({
        id: crypto.randomUUID(),
        userId: viewerId,
        sessionToken,
        expiresAt: futureDate,
      });

      mockLists.push({
        id: listId,
        userId: ownerId,
        anonymousSessionId: null,
        name: "Public Pack",
        slug: "public-pack",
        description: null,
        isPublic: true,
        createdAt: now,
        updatedAt: now,
      });

      mockCookies.set("session_token", sessionToken);

      const request = new NextRequest(
        "http://localhost:3000/api/users/owner/lists/public-pack"
      );

      const response = await GET(request, {
        params: createParams("owner", "public-pack"),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.list.name).toBe("Public Pack");
      expect(data.isOwner).toBe(false);
      expect(data.username).toBe("owner");
    });

    it("returns public list for anonymous user", async () => {
      const userId = crypto.randomUUID();
      const listId = crypto.randomUUID();
      const anonSessionId = crypto.randomUUID();
      const anonToken = "anon-session-token";

      mockUsers.push({
        id: userId,
        username: "testuser",
        email: "test@example.com",
        passwordHash: "hash",
        createdAt: now,
        updatedAt: now,
      });

      mockAnonymousSessions.push({
        id: anonSessionId,
        sessionToken: anonToken,
        expiresAt: futureDate,
      });

      mockLists.push({
        id: listId,
        userId,
        anonymousSessionId: null,
        name: "Public Pack",
        slug: "public-pack",
        description: null,
        isPublic: true,
        createdAt: now,
        updatedAt: now,
      });

      mockCookies.set("anonymous_session_token", anonToken);

      const request = new NextRequest(
        "http://localhost:3000/api/users/testuser/lists/public-pack"
      );

      const response = await GET(request, {
        params: createParams("testuser", "public-pack"),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.list.name).toBe("Public Pack");
      expect(data.isOwner).toBe(false);
    });
  });

  describe("owner access", () => {
    it("returns private list for authenticated owner", async () => {
      const userId = crypto.randomUUID();
      const listId = crypto.randomUUID();
      const sessionToken = "owner-session-token";

      mockUsers.push({
        id: userId,
        username: "testuser",
        email: "test@example.com",
        passwordHash: "hash",
        createdAt: now,
        updatedAt: now,
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
        name: "Private Pack",
        slug: "private-pack",
        description: "My private gear list",
        isPublic: false,
        createdAt: now,
        updatedAt: now,
      });

      mockCookies.set("session_token", sessionToken);

      const request = new NextRequest(
        "http://localhost:3000/api/users/testuser/lists/private-pack"
      );

      const response = await GET(request, {
        params: createParams("testuser", "private-pack"),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.list.name).toBe("Private Pack");
      expect(data.list.isPublic).toBe(false);
      expect(data.isOwner).toBe(true);
      expect(data.username).toBe("testuser");
    });

    it("returns public list with isOwner true for authenticated owner", async () => {
      const userId = crypto.randomUUID();
      const listId = crypto.randomUUID();
      const sessionToken = "owner-session-token";

      mockUsers.push({
        id: userId,
        username: "testuser",
        email: "test@example.com",
        passwordHash: "hash",
        createdAt: now,
        updatedAt: now,
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
        name: "Public Pack",
        slug: "public-pack",
        description: null,
        isPublic: true,
        createdAt: now,
        updatedAt: now,
      });

      mockCookies.set("session_token", sessionToken);

      const request = new NextRequest(
        "http://localhost:3000/api/users/testuser/lists/public-pack"
      );

      const response = await GET(request, {
        params: createParams("testuser", "public-pack"),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.isOwner).toBe(true);
    });
  });

  describe("response structure", () => {
    it("includes all required list fields", async () => {
      const userId = crypto.randomUUID();
      const listId = crypto.randomUUID();
      const createdAt = new Date("2024-01-01T00:00:00Z");
      const updatedAt = new Date("2024-01-02T00:00:00Z");

      mockUsers.push({
        id: userId,
        username: "testuser",
        email: "test@example.com",
        passwordHash: "hash",
        createdAt: now,
        updatedAt: now,
      });

      mockLists.push({
        id: listId,
        userId,
        anonymousSessionId: null,
        name: "Test Pack",
        slug: "test-pack",
        description: "A test description",
        isPublic: true,
        createdAt,
        updatedAt,
      });

      const request = new NextRequest(
        "http://localhost:3000/api/users/testuser/lists/test-pack"
      );

      const response = await GET(request, {
        params: createParams("testuser", "test-pack"),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.list).toHaveProperty("id", listId);
      expect(data.list).toHaveProperty("name", "Test Pack");
      expect(data.list).toHaveProperty("slug", "test-pack");
      expect(data.list).toHaveProperty("description", "A test description");
      expect(data.list).toHaveProperty("isPublic", true);
      expect(data.list).toHaveProperty("createdAt");
      expect(data.list).toHaveProperty("updatedAt");
      expect(data).toHaveProperty("categories");
      expect(data).toHaveProperty("isOwner");
      expect(data).toHaveProperty("username");
    });

    it("returns categories with items in correct order", async () => {
      const userId = crypto.randomUUID();
      const listId = crypto.randomUUID();
      const cat1Id = crypto.randomUUID();
      const cat2Id = crypto.randomUUID();
      const item1Id = crypto.randomUUID();
      const item2Id = crypto.randomUUID();
      const item3Id = crypto.randomUUID();

      mockUsers.push({
        id: userId,
        username: "testuser",
        email: "test@example.com",
        passwordHash: "hash",
        createdAt: now,
        updatedAt: now,
      });

      mockLists.push({
        id: listId,
        userId,
        anonymousSessionId: null,
        name: "Test Pack",
        slug: "test-pack",
        description: null,
        isPublic: true,
        createdAt: now,
        updatedAt: now,
      });

      mockCategories.push(
        {
          id: cat1Id,
          listId,
          name: "Shelter",
          description: null,
          position: 0,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: cat2Id,
          listId,
          name: "Sleep System",
          description: "Sleeping gear",
          position: 1,
          createdAt: now,
          updatedAt: now,
        }
      );

      mockItems.push(
        {
          id: item1Id,
          categoryId: cat1Id,
          name: "Tent",
          description: "Ultralight tent",
          url: "https://example.com/tent",
          weightAmount: 500,
          weightUnit: "g",
          label: "none",
          quantity: 1,
          position: 0,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: item2Id,
          categoryId: cat1Id,
          name: "Stakes",
          description: null,
          url: null,
          weightAmount: 30,
          weightUnit: "g",
          label: "none",
          quantity: 6,
          position: 1,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: item3Id,
          categoryId: cat2Id,
          name: "Sleeping Bag",
          description: null,
          url: null,
          weightAmount: 700,
          weightUnit: "g",
          label: "none",
          quantity: 1,
          position: 0,
          createdAt: now,
          updatedAt: now,
        }
      );

      const request = new NextRequest(
        "http://localhost:3000/api/users/testuser/lists/test-pack"
      );

      const response = await GET(request, {
        params: createParams("testuser", "test-pack"),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.categories).toHaveLength(2);

      // First category
      expect(data.categories[0].name).toBe("Shelter");
      expect(data.categories[0].position).toBe(0);
      expect(data.categories[0].items).toHaveLength(2);
      expect(data.categories[0].items[0].name).toBe("Tent");
      expect(data.categories[0].items[1].name).toBe("Stakes");

      // Second category
      expect(data.categories[1].name).toBe("Sleep System");
      expect(data.categories[1].position).toBe(1);
      expect(data.categories[1].items).toHaveLength(1);
      expect(data.categories[1].items[0].name).toBe("Sleeping Bag");
    });

    it("returns empty categories array when list has no categories", async () => {
      const userId = crypto.randomUUID();
      const listId = crypto.randomUUID();

      mockUsers.push({
        id: userId,
        username: "testuser",
        email: "test@example.com",
        passwordHash: "hash",
        createdAt: now,
        updatedAt: now,
      });

      mockLists.push({
        id: listId,
        userId,
        anonymousSessionId: null,
        name: "Empty Pack",
        slug: "empty-pack",
        description: null,
        isPublic: true,
        createdAt: now,
        updatedAt: now,
      });

      const request = new NextRequest(
        "http://localhost:3000/api/users/testuser/lists/empty-pack"
      );

      const response = await GET(request, {
        params: createParams("testuser", "empty-pack"),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.categories).toEqual([]);
    });

    it("returns category with empty items array when category has no items", async () => {
      const userId = crypto.randomUUID();
      const listId = crypto.randomUUID();
      const catId = crypto.randomUUID();

      mockUsers.push({
        id: userId,
        username: "testuser",
        email: "test@example.com",
        passwordHash: "hash",
        createdAt: now,
        updatedAt: now,
      });

      mockLists.push({
        id: listId,
        userId,
        anonymousSessionId: null,
        name: "Test Pack",
        slug: "test-pack",
        description: null,
        isPublic: true,
        createdAt: now,
        updatedAt: now,
      });

      mockCategories.push({
        id: catId,
        listId,
        name: "Empty Category",
        description: null,
        position: 0,
        createdAt: now,
        updatedAt: now,
      });

      const request = new NextRequest(
        "http://localhost:3000/api/users/testuser/lists/test-pack"
      );

      const response = await GET(request, {
        params: createParams("testuser", "test-pack"),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.categories).toHaveLength(1);
      expect(data.categories[0].name).toBe("Empty Category");
      expect(data.categories[0].items).toEqual([]);
    });
  });

  describe("edge cases", () => {
    it("handles null description correctly", async () => {
      const userId = crypto.randomUUID();
      const listId = crypto.randomUUID();

      mockUsers.push({
        id: userId,
        username: "testuser",
        email: "test@example.com",
        passwordHash: "hash",
        createdAt: now,
        updatedAt: now,
      });

      mockLists.push({
        id: listId,
        userId,
        anonymousSessionId: null,
        name: "Test Pack",
        slug: "test-pack",
        description: null,
        isPublic: true,
        createdAt: now,
        updatedAt: now,
      });

      const request = new NextRequest(
        "http://localhost:3000/api/users/testuser/lists/test-pack"
      );

      const response = await GET(request, {
        params: createParams("testuser", "test-pack"),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.list.description).toBeNull();
    });

    it("handles special characters in username", async () => {
      const userId = crypto.randomUUID();
      const listId = crypto.randomUUID();

      mockUsers.push({
        id: userId,
        username: "test_user123",
        email: "test@example.com",
        passwordHash: "hash",
        createdAt: now,
        updatedAt: now,
      });

      mockLists.push({
        id: listId,
        userId,
        anonymousSessionId: null,
        name: "Test Pack",
        slug: "test-pack",
        description: null,
        isPublic: true,
        createdAt: now,
        updatedAt: now,
      });

      const request = new NextRequest(
        "http://localhost:3000/api/users/test_user123/lists/test-pack"
      );

      const response = await GET(request, {
        params: createParams("test_user123", "test-pack"),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.username).toBe("test_user123");
    });

    it("handles special characters in slug", async () => {
      const userId = crypto.randomUUID();
      const listId = crypto.randomUUID();

      mockUsers.push({
        id: userId,
        username: "testuser",
        email: "test@example.com",
        passwordHash: "hash",
        createdAt: now,
        updatedAt: now,
      });

      mockLists.push({
        id: listId,
        userId,
        anonymousSessionId: null,
        name: "Test Pack 2024",
        slug: "test-pack-2024",
        description: null,
        isPublic: true,
        createdAt: now,
        updatedAt: now,
      });

      const request = new NextRequest(
        "http://localhost:3000/api/users/testuser/lists/test-pack-2024"
      );

      const response = await GET(request, {
        params: createParams("testuser", "test-pack-2024"),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.list.slug).toBe("test-pack-2024");
    });

    it("handles expired session token as unauthenticated", async () => {
      const userId = crypto.randomUUID();
      const listId = crypto.randomUUID();
      const sessionToken = "expired-session-token";
      const pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      mockUsers.push({
        id: userId,
        username: "testuser",
        email: "test@example.com",
        passwordHash: "hash",
        createdAt: now,
        updatedAt: now,
      });

      mockSessions.push({
        id: crypto.randomUUID(),
        userId,
        sessionToken,
        expiresAt: pastDate, // Expired
      });

      mockLists.push({
        id: listId,
        userId,
        anonymousSessionId: null,
        name: "Private Pack",
        slug: "private-pack",
        description: null,
        isPublic: false,
        createdAt: now,
        updatedAt: now,
      });

      mockCookies.set("session_token", sessionToken);

      const request = new NextRequest(
        "http://localhost:3000/api/users/testuser/lists/private-pack"
      );

      const response = await GET(request, {
        params: createParams("testuser", "private-pack"),
      });
      const data = await response.json();

      // Should be forbidden because expired session is treated as unauthenticated
      expect(response.status).toBe(403);
      expect(data.error).toBe("Forbidden");
    });
  });

  describe("item details", () => {
    it("includes all item fields in response", async () => {
      const userId = crypto.randomUUID();
      const listId = crypto.randomUUID();
      const catId = crypto.randomUUID();
      const itemId = crypto.randomUUID();

      mockUsers.push({
        id: userId,
        username: "testuser",
        email: "test@example.com",
        passwordHash: "hash",
        createdAt: now,
        updatedAt: now,
      });

      mockLists.push({
        id: listId,
        userId,
        anonymousSessionId: null,
        name: "Test Pack",
        slug: "test-pack",
        description: null,
        isPublic: true,
        createdAt: now,
        updatedAt: now,
      });

      mockCategories.push({
        id: catId,
        listId,
        name: "Gear",
        description: null,
        position: 0,
        createdAt: now,
        updatedAt: now,
      });

      mockItems.push({
        id: itemId,
        categoryId: catId,
        name: "Backpack",
        description: "Ultralight backpack",
        url: "https://example.com/backpack",
        weightAmount: 450,
        weightUnit: "g",
        label: "worn",
        quantity: 1,
        position: 0,
        createdAt: now,
        updatedAt: now,
      });

      const request = new NextRequest(
        "http://localhost:3000/api/users/testuser/lists/test-pack"
      );

      const response = await GET(request, {
        params: createParams("testuser", "test-pack"),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      const item = data.categories[0].items[0];
      expect(item).toHaveProperty("id", itemId);
      expect(item).toHaveProperty("name", "Backpack");
      expect(item).toHaveProperty("description", "Ultralight backpack");
      expect(item).toHaveProperty("url", "https://example.com/backpack");
      expect(item).toHaveProperty("weightAmount", 450);
      expect(item).toHaveProperty("weightUnit", "g");
      expect(item).toHaveProperty("label", "worn");
      expect(item).toHaveProperty("quantity", 1);
      expect(item).toHaveProperty("position", 0);
    });

    it("handles items with different labels correctly", async () => {
      const userId = crypto.randomUUID();
      const listId = crypto.randomUUID();
      const catId = crypto.randomUUID();

      mockUsers.push({
        id: userId,
        username: "testuser",
        email: "test@example.com",
        passwordHash: "hash",
        createdAt: now,
        updatedAt: now,
      });

      mockLists.push({
        id: listId,
        userId,
        anonymousSessionId: null,
        name: "Test Pack",
        slug: "test-pack",
        description: null,
        isPublic: true,
        createdAt: now,
        updatedAt: now,
      });

      mockCategories.push({
        id: catId,
        listId,
        name: "Items",
        description: null,
        position: 0,
        createdAt: now,
        updatedAt: now,
      });

      mockItems.push(
        {
          id: crypto.randomUUID(),
          categoryId: catId,
          name: "Base Item",
          description: null,
          url: null,
          weightAmount: 100,
          weightUnit: "g",
          label: "none",
          quantity: 1,
          position: 0,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: crypto.randomUUID(),
          categoryId: catId,
          name: "Worn Item",
          description: null,
          url: null,
          weightAmount: 200,
          weightUnit: "g",
          label: "worn",
          quantity: 1,
          position: 1,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: crypto.randomUUID(),
          categoryId: catId,
          name: "Consumable Item",
          description: null,
          url: null,
          weightAmount: 300,
          weightUnit: "g",
          label: "consumable",
          quantity: 2,
          position: 2,
          createdAt: now,
          updatedAt: now,
        }
      );

      const request = new NextRequest(
        "http://localhost:3000/api/users/testuser/lists/test-pack"
      );

      const response = await GET(request, {
        params: createParams("testuser", "test-pack"),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      const items = data.categories[0].items;
      expect(items).toHaveLength(3);
      expect(items[0].label).toBe("none");
      expect(items[1].label).toBe("worn");
      expect(items[2].label).toBe("consumable");
    });
  });
});
