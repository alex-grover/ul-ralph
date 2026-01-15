import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// Mock data storage
let mockUsers: Array<{
  id: string;
  email: string;
}> = [];

let mockPasswordResetTokens: Array<{
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
}> = [];

let insertedTokens: Array<{
  userId: string;
  token: string;
  expiresAt: Date;
}> = [];

let emailsSent: Array<{
  email: string;
  token: string;
}> = [];

// Track database operations
let dbSelectCalls = 0;
let currentSelectTarget: "users" | "tokens" = "users";

// Mock email service
vi.mock("@/lib/email", () => ({
  sendPasswordResetEmail: vi.fn().mockImplementation((email, token) => {
    emailsSent.push({ email, token });
    return Promise.resolve({ success: true });
  }),
}));

// Mock database
vi.mock("@/db", () => ({
  db: {
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation((table) => {
        // Determine which select operation this is
        const selectIndex = dbSelectCalls++;
        return {
          where: vi.fn().mockImplementation(() => ({
            limit: vi.fn().mockImplementation(() => {
              // First select is for users, second is for existing tokens
              if (selectIndex % 2 === 0) {
                // User lookup
                return Promise.resolve(mockUsers.length > 0 ? [mockUsers[0]] : []);
              } else {
                // Token lookup
                const validTokens = mockPasswordResetTokens.filter(
                  (t) => t.expiresAt > new Date()
                );
                return Promise.resolve(validTokens.length > 0 ? [validTokens[0]] : []);
              }
            }),
          })),
        };
      }),
    })),
    insert: vi.fn().mockImplementation(() => ({
      values: vi.fn().mockImplementation((data) => {
        insertedTokens.push(data);
        mockPasswordResetTokens.push({
          id: crypto.randomUUID(),
          ...data,
        });
        return Promise.resolve();
      }),
    })),
    delete: vi.fn().mockImplementation(() => ({
      where: vi.fn().mockImplementation(() => {
        // Delete expired tokens for user
        mockPasswordResetTokens = mockPasswordResetTokens.filter(
          (t) => t.expiresAt > new Date()
        );
        return Promise.resolve();
      }),
    })),
  },
}));

// Import after mocking
import { POST } from "./route";

describe("POST /api/auth/forgot-password", () => {
  beforeEach(() => {
    mockUsers = [
      {
        id: crypto.randomUUID(),
        email: "test@example.com",
      },
    ];
    mockPasswordResetTokens = [];
    insertedTokens = [];
    emailsSent = [];
    dbSelectCalls = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("validation", () => {
    it("returns 400 for invalid email format", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/auth/forgot-password",
        {
          method: "POST",
          body: JSON.stringify({
            email: "notanemail",
          }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
      expect(data.details.email).toBeDefined();
    });

    it("returns 400 for missing email", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/auth/forgot-password",
        {
          method: "POST",
          body: JSON.stringify({}),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
    });
  });

  describe("security - email enumeration prevention", () => {
    it("returns same message for existing email", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/auth/forgot-password",
        {
          method: "POST",
          body: JSON.stringify({
            email: "test@example.com",
          }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe(
        "If an account with that email exists, a password reset link has been sent."
      );
    });

    it("returns same message for non-existent email", async () => {
      mockUsers = []; // No users

      const request = new NextRequest(
        "http://localhost:3000/api/auth/forgot-password",
        {
          method: "POST",
          body: JSON.stringify({
            email: "nonexistent@example.com",
          }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe(
        "If an account with that email exists, a password reset link has been sent."
      );
    });

    it("does not send email for non-existent user", async () => {
      mockUsers = []; // No users

      const request = new NextRequest(
        "http://localhost:3000/api/auth/forgot-password",
        {
          method: "POST",
          body: JSON.stringify({
            email: "nonexistent@example.com",
          }),
        }
      );

      await POST(request);

      expect(emailsSent.length).toBe(0);
    });
  });

  describe("rate limiting", () => {
    it("does not create new token if valid token exists", async () => {
      // Add an existing valid token
      mockPasswordResetTokens = [
        {
          id: crypto.randomUUID(),
          userId: mockUsers[0].id,
          token: "existing-token",
          expiresAt: new Date(Date.now() + 60 * 60 * 1000), // Valid for 1 hour
        },
      ];

      const request = new NextRequest(
        "http://localhost:3000/api/auth/forgot-password",
        {
          method: "POST",
          body: JSON.stringify({
            email: "test@example.com",
          }),
        }
      );

      await POST(request);

      // Should not insert a new token
      expect(insertedTokens.length).toBe(0);
    });

    it("returns same success message even when rate limited", async () => {
      mockPasswordResetTokens = [
        {
          id: crypto.randomUUID(),
          userId: mockUsers[0].id,
          token: "existing-token",
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      ];

      const request = new NextRequest(
        "http://localhost:3000/api/auth/forgot-password",
        {
          method: "POST",
          body: JSON.stringify({
            email: "test@example.com",
          }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe(
        "If an account with that email exists, a password reset link has been sent."
      );
    });
  });

  describe("token generation", () => {
    it("creates token with 1 hour expiration", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/auth/forgot-password",
        {
          method: "POST",
          body: JSON.stringify({
            email: "test@example.com",
          }),
        }
      );

      await POST(request);

      expect(insertedTokens.length).toBe(1);
      const token = insertedTokens[0];

      // Token should expire in approximately 1 hour
      const expiresIn = token.expiresAt.getTime() - Date.now();
      const oneHourMs = 60 * 60 * 1000;
      expect(expiresIn).toBeGreaterThan(oneHourMs - 5000); // Within 5 seconds
      expect(expiresIn).toBeLessThanOrEqual(oneHourMs);
    });

    it("generates 64-character hex token", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/auth/forgot-password",
        {
          method: "POST",
          body: JSON.stringify({
            email: "test@example.com",
          }),
        }
      );

      await POST(request);

      expect(insertedTokens.length).toBe(1);
      const token = insertedTokens[0].token;

      // 32 bytes = 64 hex characters
      expect(token.length).toBe(64);
      expect(token).toMatch(/^[a-f0-9]+$/);
    });
  });

  describe("email sending", () => {
    it("sends email to correct address", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/auth/forgot-password",
        {
          method: "POST",
          body: JSON.stringify({
            email: "test@example.com",
          }),
        }
      );

      await POST(request);

      expect(emailsSent.length).toBe(1);
      expect(emailsSent[0].email).toBe("test@example.com");
    });

    it("sends email with generated token", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/auth/forgot-password",
        {
          method: "POST",
          body: JSON.stringify({
            email: "test@example.com",
          }),
        }
      );

      await POST(request);

      expect(emailsSent.length).toBe(1);
      expect(emailsSent[0].token).toBe(insertedTokens[0].token);
    });
  });
});
