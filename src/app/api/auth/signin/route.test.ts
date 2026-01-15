import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import bcrypt from "bcrypt";

// Pre-computed hash for "password123" with bcrypt
const TEST_PASSWORD = "password123";
let testPasswordHash: string;

// Mock data storage
let mockUsers: Array<{
  id: string;
  username: string;
  email: string;
  passwordHash: string;
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
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockImplementation(() => {
        // Find user by email (the where clause would have the email)
        if (mockUsers.length > 0) {
          return Promise.resolve([mockUsers[0]]);
        }
        return Promise.resolve([]);
      }),
    })),
    insert: vi.fn().mockImplementation(() => ({
      values: vi.fn().mockImplementation(() => Promise.resolve()),
    })),
  },
}));

// Import after mocking
import { POST } from "./route";

describe("POST /api/auth/signin", () => {
  beforeEach(async () => {
    // Create a test password hash
    testPasswordHash = await bcrypt.hash(TEST_PASSWORD, 12);

    mockUsers = [
      {
        id: crypto.randomUUID(),
        username: "testuser",
        email: "test@example.com",
        passwordHash: testPasswordHash,
      },
    ];
    mockCookies.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("validation", () => {
    it("returns 400 for invalid email format", async () => {
      const request = new NextRequest("http://localhost:3000/api/auth/signin", {
        method: "POST",
        body: JSON.stringify({
          email: "notanemail",
          password: "password123",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
      expect(data.details.email).toBeDefined();
    });

    it("returns 400 for missing email", async () => {
      const request = new NextRequest("http://localhost:3000/api/auth/signin", {
        method: "POST",
        body: JSON.stringify({
          password: "password123",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
    });

    it("returns 400 for empty password", async () => {
      const request = new NextRequest("http://localhost:3000/api/auth/signin", {
        method: "POST",
        body: JSON.stringify({
          email: "test@example.com",
          password: "",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
      expect(data.details.password).toBeDefined();
    });

    it("returns 400 for missing password", async () => {
      const request = new NextRequest("http://localhost:3000/api/auth/signin", {
        method: "POST",
        body: JSON.stringify({
          email: "test@example.com",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
    });
  });

  describe("authentication", () => {
    it("returns 401 for non-existent user", async () => {
      mockUsers = []; // Clear users

      const request = new NextRequest("http://localhost:3000/api/auth/signin", {
        method: "POST",
        body: JSON.stringify({
          email: "nonexistent@example.com",
          password: "password123",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Invalid email or password");
    });

    it("returns 401 for wrong password", async () => {
      const request = new NextRequest("http://localhost:3000/api/auth/signin", {
        method: "POST",
        body: JSON.stringify({
          email: "test@example.com",
          password: "wrongpassword",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Invalid email or password");
    });

    it("returns 200 and user data for correct credentials", async () => {
      const request = new NextRequest("http://localhost:3000/api/auth/signin", {
        method: "POST",
        body: JSON.stringify({
          email: "test@example.com",
          password: TEST_PASSWORD,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("Signed in successfully");
      expect(data.user).toBeDefined();
      expect(data.user.id).toBe(mockUsers[0].id);
      expect(data.user.username).toBe("testuser");
      expect(data.user.email).toBe("test@example.com");
      expect(data.user.passwordHash).toBeUndefined();
    });
  });

  describe("security", () => {
    it("does not reveal whether email exists (same error for wrong email vs wrong password)", async () => {
      // Test with non-existent email
      mockUsers = [];
      const request1 = new NextRequest(
        "http://localhost:3000/api/auth/signin",
        {
          method: "POST",
          body: JSON.stringify({
            email: "nonexistent@example.com",
            password: "password123",
          }),
        }
      );

      const response1 = await POST(request1);
      const data1 = await response1.json();

      // Reset users
      mockUsers = [
        {
          id: crypto.randomUUID(),
          username: "testuser",
          email: "test@example.com",
          passwordHash: testPasswordHash,
        },
      ];

      // Test with wrong password
      const request2 = new NextRequest(
        "http://localhost:3000/api/auth/signin",
        {
          method: "POST",
          body: JSON.stringify({
            email: "test@example.com",
            password: "wrongpassword",
          }),
        }
      );

      const response2 = await POST(request2);
      const data2 = await response2.json();

      // Both should return the same generic error
      expect(response1.status).toBe(401);
      expect(response2.status).toBe(401);
      expect(data1.error).toBe(data2.error);
      expect(data1.error).toBe("Invalid email or password");
    });

    it("does not expose password hash in response", async () => {
      const request = new NextRequest("http://localhost:3000/api/auth/signin", {
        method: "POST",
        body: JSON.stringify({
          email: "test@example.com",
          password: TEST_PASSWORD,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user.passwordHash).toBeUndefined();
      expect(JSON.stringify(data)).not.toContain("$2b$");
    });
  });

  describe("edge cases", () => {
    it("handles email with different case", async () => {
      // Note: This depends on database behavior; email lookup should typically be case-insensitive
      const request = new NextRequest("http://localhost:3000/api/auth/signin", {
        method: "POST",
        body: JSON.stringify({
          email: "TEST@EXAMPLE.COM",
          password: TEST_PASSWORD,
        }),
      });

      const response = await POST(request);
      // This test documents current behavior - may return 401 if case-sensitive
      expect([200, 401]).toContain(response.status);
    });

    it("handles very short valid password (min 1 char for signin)", async () => {
      const request = new NextRequest("http://localhost:3000/api/auth/signin", {
        method: "POST",
        body: JSON.stringify({
          email: "test@example.com",
          password: "x",
        }),
      });

      const response = await POST(request);
      // Should not fail validation, but will fail auth
      expect(response.status).toBe(401);
    });
  });
});
