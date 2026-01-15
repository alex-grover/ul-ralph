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

let _mockSessions: Array<{
  id: string;
  userId: string;
  sessionToken: string;
  createdAt: Date;
  expiresAt: Date;
}> = [];

let _mockAnonymousSessions: Array<{
  id: string;
  sessionToken: string;
  createdAt: Date;
  expiresAt: Date;
}> = [];

let _mockLists: Array<{
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

// Mock database
vi.mock("@/db", () => ({
  db: {
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation((_table) => ({
        where: vi.fn().mockImplementation(() => ({
          limit: vi.fn().mockImplementation(() => {
            // This is for the existing user check
            return Promise.resolve([]);
          }),
        })),
      })),
    })),
    insert: vi.fn().mockImplementation(() => ({
      values: vi.fn().mockImplementation((data) => ({
        returning: vi.fn().mockImplementation(() => {
          // Match the actual returning() fields from the route
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
        }),
      })),
    })),
    update: vi.fn().mockImplementation(() => ({
      set: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockImplementation(() => ({
          returning: vi.fn().mockImplementation(() => Promise.resolve([])),
        })),
      })),
    })),
    delete: vi.fn().mockImplementation(() => ({
      where: vi.fn().mockImplementation(() => Promise.resolve()),
    })),
  },
}));

// Import after mocking
import { POST } from "./route";

describe("POST /api/auth/signup", () => {
  beforeEach(() => {
    mockUsers = [];
    _mockSessions = [];
    _mockAnonymousSessions = [];
    _mockLists = [];
    mockCookies.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("validation", () => {
    it("returns 400 for missing username", async () => {
      const request = new NextRequest("http://localhost:3000/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          email: "test@example.com",
          password: "password123",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
      expect(data.details.username).toBeDefined();
    });

    it("returns 400 for invalid username characters", async () => {
      const request = new NextRequest("http://localhost:3000/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          username: "user@name",
          email: "test@example.com",
          password: "password123",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
    });

    it("returns 400 for username too short", async () => {
      const request = new NextRequest("http://localhost:3000/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          username: "ab",
          email: "test@example.com",
          password: "password123",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
    });

    it("returns 400 for invalid email", async () => {
      const request = new NextRequest("http://localhost:3000/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          username: "validuser",
          email: "notanemail",
          password: "password123",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
    });

    it("returns 400 for password too short", async () => {
      const request = new NextRequest("http://localhost:3000/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          username: "validuser",
          email: "test@example.com",
          password: "short",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
      expect(data.details.password).toBeDefined();
    });

    it("returns 400 for missing email", async () => {
      const request = new NextRequest("http://localhost:3000/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          username: "validuser",
          password: "password123",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
    });

    it("returns 400 for missing password", async () => {
      const request = new NextRequest("http://localhost:3000/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          username: "validuser",
          email: "test@example.com",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
    });
  });

  describe("successful signup", () => {
    it("creates user and returns 201 with user data", async () => {
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
      expect(data.message).toBe("User created successfully");
      expect(data.user).toBeDefined();
      expect(data.user.username).toBe("newuser");
      expect(data.user.email).toBe("newuser@example.com");
      expect(data.user.passwordHash).toBeUndefined(); // Should not return password hash
    });

    it("returns migrated list count as 0 when no anonymous session", async () => {
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
      expect(data.migratedLists).toBe(0);
    });
  });

  describe("edge cases", () => {
    it("handles username with valid special characters", async () => {
      const request = new NextRequest("http://localhost:3000/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          username: "user_name-123",
          email: "test@example.com",
          password: "password123",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.user.username).toBe("user_name-123");
    });

    it("handles password at minimum length", async () => {
      const request = new NextRequest("http://localhost:3000/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          username: "validuser",
          email: "test@example.com",
          password: "12345678",
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
    });

    it("handles password at maximum length", async () => {
      const request = new NextRequest("http://localhost:3000/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          username: "validuser",
          email: "test@example.com",
          password: "a".repeat(100),
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
    });

    it("handles username at minimum length", async () => {
      const request = new NextRequest("http://localhost:3000/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          username: "abc",
          email: "test@example.com",
          password: "password123",
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
    });

    it("handles username at maximum length", async () => {
      const request = new NextRequest("http://localhost:3000/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          username: "a".repeat(30),
          email: "test@example.com",
          password: "password123",
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
    });
  });
});
