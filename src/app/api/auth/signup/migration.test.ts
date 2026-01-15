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

// Mock cookie store
const mockCookies = new Map<string, string>();
let deletedCookies: string[] = [];

// Track database operations
let createdSessions: Array<{
  userId: string;
}> = [];

let deletedAnonymousSessions: boolean = false;
let updatedLists: Array<{
  id: string;
  userId: string;
  anonymousSessionId: null;
}> = [];

// Current anonymous session state (for mocking getAnonymousSession)
let currentAnonymousSession: { id: string; sessionToken: string } | null = null;

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

// Mock session functions
vi.mock("@/lib/session", () => ({
  getAnonymousSession: vi.fn().mockImplementation(() => {
    return Promise.resolve(currentAnonymousSession);
  }),
  deleteAnonymousSession: vi.fn().mockImplementation(() => {
    deletedAnonymousSessions = true;
    deletedCookies.push("anonymous_session_token");
    currentAnonymousSession = null;
    return Promise.resolve();
  }),
  createSession: vi.fn().mockImplementation((userId: string) => {
    createdSessions.push({ userId });
    mockCookies.set("session_token", "mock-session-token");
    return Promise.resolve("mock-session-token");
  }),
}));

// Mock database
vi.mock("@/db", () => ({
  db: {
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockImplementation(() => ({
          limit: vi.fn().mockImplementation(() => {
            // Check for existing user - always return empty for tests
            return Promise.resolve([]);
          }),
        })),
      })),
    })),
    insert: vi.fn().mockImplementation(() => ({
      values: vi.fn().mockImplementation((data) => ({
        returning: vi.fn().mockImplementation(() => {
          // Handle user creation
          if (data.username && data.email && data.passwordHash) {
            const newUser = {
              id: crypto.randomUUID(),
              username: data.username,
              email: data.email,
              createdAt: new Date(),
            };
            mockUsers.push({
              ...newUser,
              passwordHash: data.passwordHash,
              updatedAt: new Date(),
            });
            return Promise.resolve([newUser]);
          }
          return Promise.resolve([]);
        }),
      })),
    })),
    update: vi.fn().mockImplementation(() => ({
      set: vi.fn().mockImplementation((setData) => ({
        where: vi.fn().mockImplementation(() => ({
          returning: vi.fn().mockImplementation(() => {
            // Find lists belonging to the anonymous session
            if (currentAnonymousSession && setData.userId && setData.anonymousSessionId === null) {
              const listsToMigrate = mockLists.filter(
                (l) => l.anonymousSessionId === currentAnonymousSession!.id
              );

              // Update the lists
              const migratedIds: Array<{ id: string }> = [];
              for (const list of listsToMigrate) {
                list.userId = setData.userId;
                list.anonymousSessionId = null;
                list.updatedAt = new Date();
                migratedIds.push({ id: list.id });
                updatedLists.push({
                  id: list.id,
                  userId: setData.userId,
                  anonymousSessionId: null,
                });
              }
              return Promise.resolve(migratedIds);
            }
            return Promise.resolve([]);
          }),
        })),
      })),
    })),
  },
}));

// Import after mocking
import { POST } from "./route";

describe("Anonymous to authenticated user data migration", () => {
  beforeEach(() => {
    mockUsers = [];
    mockLists = [];
    mockCookies.clear();
    deletedCookies = [];
    createdSessions = [];
    deletedAnonymousSessions = false;
    updatedLists = [];
    currentAnonymousSession = null;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("list migration", () => {
    it("migrates a single list from anonymous session to new user", async () => {
      // Set up anonymous session
      const anonSessionId = crypto.randomUUID();
      currentAnonymousSession = {
        id: anonSessionId,
        sessionToken: "anon-token-123",
      };

      // Set up a list belonging to the anonymous session
      const anonList = {
        id: crypto.randomUUID(),
        userId: null,
        anonymousSessionId: anonSessionId,
        name: "My Backpacking Gear",
        slug: "my-backpacking-gear",
        description: "Essential ultralight gear",
        isPublic: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockLists.push(anonList);

      const request = new NextRequest("http://localhost:3000/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          username: "hiker123",
          email: "hiker@example.com",
          password: "password123",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.migratedLists).toBe(1);

      // Verify the list was updated
      expect(updatedLists).toHaveLength(1);
      expect(updatedLists[0].id).toBe(anonList.id);
      expect(updatedLists[0].anonymousSessionId).toBeNull();
    });

    it("migrates multiple lists from anonymous session to new user", async () => {
      // Set up anonymous session
      const anonSessionId = crypto.randomUUID();
      currentAnonymousSession = {
        id: anonSessionId,
        sessionToken: "anon-token-456",
      };

      // Set up multiple lists belonging to the anonymous session
      const list1 = {
        id: crypto.randomUUID(),
        userId: null,
        anonymousSessionId: anonSessionId,
        name: "Summer Trip",
        slug: "summer-trip",
        description: "Gear for summer backpacking",
        isPublic: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const list2 = {
        id: crypto.randomUUID(),
        userId: null,
        anonymousSessionId: anonSessionId,
        name: "Winter Trip",
        slug: "winter-trip",
        description: "Gear for winter backpacking",
        isPublic: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const list3 = {
        id: crypto.randomUUID(),
        userId: null,
        anonymousSessionId: anonSessionId,
        name: "Day Hike",
        slug: "day-hike",
        description: null,
        isPublic: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockLists.push(list1, list2, list3);

      const request = new NextRequest("http://localhost:3000/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          username: "adventurer",
          email: "adventurer@example.com",
          password: "securepass123",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.migratedLists).toBe(3);

      // Verify all lists were updated
      expect(updatedLists).toHaveLength(3);
    });

    it("preserves list properties during migration", async () => {
      // Set up anonymous session
      const anonSessionId = crypto.randomUUID();
      currentAnonymousSession = {
        id: anonSessionId,
        sessionToken: "anon-token-preserve",
      };

      // Set up a list with all properties
      const originalCreatedAt = new Date("2024-01-15T10:00:00Z");
      const anonList = {
        id: crypto.randomUUID(),
        userId: null,
        anonymousSessionId: anonSessionId,
        name: "Ultralight Setup",
        slug: "ultralight-setup",
        description: "My sub-10lb base weight kit",
        isPublic: true,
        createdAt: originalCreatedAt,
        updatedAt: originalCreatedAt,
      };
      mockLists.push(anonList);

      const request = new NextRequest("http://localhost:3000/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          username: "ultralighter",
          email: "ultralighter@example.com",
          password: "lighterpack123",
        }),
      });

      await POST(request);

      // Find the migrated list in mockLists
      const migratedList = mockLists.find((l) => l.id === anonList.id);
      expect(migratedList).toBeDefined();
      expect(migratedList!.name).toBe("Ultralight Setup");
      expect(migratedList!.slug).toBe("ultralight-setup");
      expect(migratedList!.description).toBe("My sub-10lb base weight kit");
      expect(migratedList!.isPublic).toBe(true);
      expect(migratedList!.createdAt).toEqual(originalCreatedAt);
      expect(migratedList!.anonymousSessionId).toBeNull();
      expect(migratedList!.userId).not.toBeNull();
    });

    it("does not migrate lists from other anonymous sessions", async () => {
      // Set up current anonymous session
      const currentAnonSessionId = crypto.randomUUID();
      const otherAnonSessionId = crypto.randomUUID();

      currentAnonymousSession = {
        id: currentAnonSessionId,
        sessionToken: "current-anon-token",
      };

      // Set up lists for both sessions
      const currentUserList = {
        id: crypto.randomUUID(),
        userId: null,
        anonymousSessionId: currentAnonSessionId,
        name: "My List",
        slug: "my-list",
        description: null,
        isPublic: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const otherUserList = {
        id: crypto.randomUUID(),
        userId: null,
        anonymousSessionId: otherAnonSessionId,
        name: "Other User List",
        slug: "other-user-list",
        description: null,
        isPublic: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockLists.push(currentUserList, otherUserList);

      const request = new NextRequest("http://localhost:3000/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          username: "newuser",
          email: "newuser@example.com",
          password: "password123",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.migratedLists).toBe(1);

      // Verify only the current user's list was migrated
      expect(updatedLists).toHaveLength(1);
      expect(updatedLists[0].id).toBe(currentUserList.id);

      // Verify other user's list was not affected
      const otherList = mockLists.find((l) => l.id === otherUserList.id);
      expect(otherList!.anonymousSessionId).toBe(otherAnonSessionId);
      expect(otherList!.userId).toBeNull();
    });

    it("returns 0 migrated lists when anonymous session has no lists", async () => {
      // Set up anonymous session without any lists
      currentAnonymousSession = {
        id: crypto.randomUUID(),
        sessionToken: "empty-anon-token",
      };

      const request = new NextRequest("http://localhost:3000/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          username: "emptyuser",
          email: "emptyuser@example.com",
          password: "password123",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.migratedLists).toBe(0);
      expect(updatedLists).toHaveLength(0);
    });
  });

  describe("session management during migration", () => {
    it("deletes anonymous session after successful migration", async () => {
      // Set up anonymous session with a list
      const anonSessionId = crypto.randomUUID();
      currentAnonymousSession = {
        id: anonSessionId,
        sessionToken: "delete-me-token",
      };

      const anonList = {
        id: crypto.randomUUID(),
        userId: null,
        anonymousSessionId: anonSessionId,
        name: "Test List",
        slug: "test-list",
        description: null,
        isPublic: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockLists.push(anonList);

      const request = new NextRequest("http://localhost:3000/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          username: "newuser",
          email: "newuser@example.com",
          password: "password123",
        }),
      });

      await POST(request);

      // Verify anonymous session was deleted
      expect(deletedAnonymousSessions).toBe(true);
    });

    it("deletes anonymous session cookie after migration", async () => {
      // Set up anonymous session with a list
      const anonSessionId = crypto.randomUUID();
      currentAnonymousSession = {
        id: anonSessionId,
        sessionToken: "cookie-delete-token",
      };

      const anonList = {
        id: crypto.randomUUID(),
        userId: null,
        anonymousSessionId: anonSessionId,
        name: "Test List",
        slug: "test-list",
        description: null,
        isPublic: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockLists.push(anonList);

      const request = new NextRequest("http://localhost:3000/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          username: "newuser",
          email: "newuser@example.com",
          password: "password123",
        }),
      });

      await POST(request);

      // Verify anonymous session cookie was deleted
      expect(deletedCookies).toContain("anonymous_session_token");
    });

    it("creates authenticated session for new user", async () => {
      // Set up anonymous session
      currentAnonymousSession = {
        id: crypto.randomUUID(),
        sessionToken: "anon-session-token",
      };

      const request = new NextRequest("http://localhost:3000/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          username: "newuser",
          email: "newuser@example.com",
          password: "password123",
        }),
      });

      await POST(request);

      // Verify authenticated session was created
      expect(createdSessions).toHaveLength(1);
      expect(createdSessions[0].userId).toBeDefined();
    });

    it("sets authenticated session cookie", async () => {
      // Set up anonymous session
      currentAnonymousSession = {
        id: crypto.randomUUID(),
        sessionToken: "anon-session-token",
      };

      const request = new NextRequest("http://localhost:3000/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          username: "newuser",
          email: "newuser@example.com",
          password: "password123",
        }),
      });

      await POST(request);

      // Verify session cookie was set
      expect(mockCookies.has("session_token")).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("handles signup without any anonymous session", async () => {
      // No anonymous session set up (currentAnonymousSession is null)

      const request = new NextRequest("http://localhost:3000/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          username: "freshuser",
          email: "freshuser@example.com",
          password: "password123",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.migratedLists).toBe(0);
      expect(deletedAnonymousSessions).toBe(false);
    });

    it("handles lists with null description", async () => {
      // Set up anonymous session
      const anonSessionId = crypto.randomUUID();
      currentAnonymousSession = {
        id: anonSessionId,
        sessionToken: "null-desc-token",
      };

      // Set up a list with null description
      const anonList = {
        id: crypto.randomUUID(),
        userId: null,
        anonymousSessionId: anonSessionId,
        name: "No Description List",
        slug: "no-description-list",
        description: null,
        isPublic: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockLists.push(anonList);

      const request = new NextRequest("http://localhost:3000/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          username: "nulldescuser",
          email: "nulldesc@example.com",
          password: "password123",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.migratedLists).toBe(1);

      // Verify list description remains null
      const migratedList = mockLists.find((l) => l.id === anonList.id);
      expect(migratedList!.description).toBeNull();
    });

    it("handles lists with public visibility", async () => {
      // Set up anonymous session
      const anonSessionId = crypto.randomUUID();
      currentAnonymousSession = {
        id: anonSessionId,
        sessionToken: "public-list-token",
      };

      // Set up a public list
      const publicList = {
        id: crypto.randomUUID(),
        userId: null,
        anonymousSessionId: anonSessionId,
        name: "Public Gear List",
        slug: "public-gear-list",
        description: "Share with everyone",
        isPublic: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockLists.push(publicList);

      const request = new NextRequest("http://localhost:3000/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          username: "publicuser",
          email: "public@example.com",
          password: "password123",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.migratedLists).toBe(1);

      // Verify list public status is preserved
      const migratedList = mockLists.find((l) => l.id === publicList.id);
      expect(migratedList!.isPublic).toBe(true);
    });
  });

  describe("response structure", () => {
    it("includes migratedLists count in successful response", async () => {
      // Set up anonymous session with lists
      const anonSessionId = crypto.randomUUID();
      currentAnonymousSession = {
        id: anonSessionId,
        sessionToken: "response-token",
      };

      mockLists.push(
        {
          id: crypto.randomUUID(),
          userId: null,
          anonymousSessionId: anonSessionId,
          name: "List 1",
          slug: "list-1",
          description: null,
          isPublic: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: crypto.randomUUID(),
          userId: null,
          anonymousSessionId: anonSessionId,
          name: "List 2",
          slug: "list-2",
          description: null,
          isPublic: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      );

      const request = new NextRequest("http://localhost:3000/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          username: "responseuser",
          email: "response@example.com",
          password: "password123",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.message).toBe("User created successfully");
      expect(data.user).toBeDefined();
      expect(data.migratedLists).toBe(2);
    });

    it("returns user data without password hash", async () => {
      const request = new NextRequest("http://localhost:3000/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          username: "secureuser",
          email: "secure@example.com",
          password: "password123",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.user.username).toBe("secureuser");
      expect(data.user.email).toBe("secure@example.com");
      expect(data.user.passwordHash).toBeUndefined();
      expect(data.user.password).toBeUndefined();
    });
  });
});
