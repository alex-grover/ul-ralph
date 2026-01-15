import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// Mock data storage
let mockUsers: Array<{
  id: string;
  email: string;
  passwordHash: string;
}> = [];

let mockPasswordResetTokens: Array<{
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
}> = [];

let mockSessions: Array<{
  id: string;
  userId: string;
  sessionToken: string;
}> = [];

// Track database operations
let updatedUsers: Array<{ userId: string; passwordHash: string }> = [];
let deletedTokenIds: string[] = [];
let deletedSessionUserIds: string[] = [];

// Mock database
vi.mock("@/db", () => ({
  db: {
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockImplementation(() => {
        // Find valid token
        const validToken = mockPasswordResetTokens.find(
          (t) => t.expiresAt > new Date()
        );
        return Promise.resolve(validToken ? [validToken] : []);
      }),
    })),
    update: vi.fn().mockImplementation(() => ({
      set: vi.fn().mockImplementation((data) => ({
        where: vi.fn().mockImplementation(() => {
          // Track password update
          if (data.passwordHash) {
            const token = mockPasswordResetTokens.find(
              (t) => t.expiresAt > new Date()
            );
            if (token) {
              updatedUsers.push({
                userId: token.userId,
                passwordHash: data.passwordHash,
              });
            }
          }
          return Promise.resolve();
        }),
      })),
    })),
    delete: vi.fn().mockImplementation(() => ({
      where: vi.fn().mockImplementation(() => {
        // Track deletions - could be token or sessions
        const validToken = mockPasswordResetTokens.find(
          (t) => t.expiresAt > new Date()
        );
        if (validToken) {
          deletedTokenIds.push(validToken.id);
          deletedSessionUserIds.push(validToken.userId);
        }
        return Promise.resolve();
      }),
    })),
  },
}));

// Import after mocking
import { POST } from "./route";

describe("POST /api/auth/reset-password", () => {
  beforeEach(() => {
    const userId = crypto.randomUUID();
    mockUsers = [
      {
        id: userId,
        email: "test@example.com",
        passwordHash: "$2b$12$existinghash",
      },
    ];
    mockPasswordResetTokens = [
      {
        id: crypto.randomUUID(),
        userId: userId,
        token: "valid-reset-token-64-chars-hex-format-1234567890abcdef12345678",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // Valid for 1 hour
      },
    ];
    mockSessions = [
      {
        id: crypto.randomUUID(),
        userId: userId,
        sessionToken: "existing-session",
      },
    ];
    updatedUsers = [];
    deletedTokenIds = [];
    deletedSessionUserIds = [];
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("validation", () => {
    it("returns 400 for missing token", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/auth/reset-password",
        {
          method: "POST",
          body: JSON.stringify({
            password: "newpassword123",
          }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
      expect(data.details.token).toBeDefined();
    });

    it("returns 400 for empty token", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/auth/reset-password",
        {
          method: "POST",
          body: JSON.stringify({
            token: "",
            password: "newpassword123",
          }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
    });

    it("returns 400 for password too short", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/auth/reset-password",
        {
          method: "POST",
          body: JSON.stringify({
            token: "valid-token",
            password: "short",
          }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
      expect(data.details.password).toBeDefined();
    });

    it("returns 400 for password too long", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/auth/reset-password",
        {
          method: "POST",
          body: JSON.stringify({
            token: "valid-token",
            password: "a".repeat(101),
          }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
    });

    it("returns 400 for missing password", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/auth/reset-password",
        {
          method: "POST",
          body: JSON.stringify({
            token: "valid-token",
          }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
    });
  });

  describe("token validation", () => {
    it("returns 400 for invalid token", async () => {
      mockPasswordResetTokens = []; // No valid tokens

      const request = new NextRequest(
        "http://localhost:3000/api/auth/reset-password",
        {
          method: "POST",
          body: JSON.stringify({
            token: "invalid-token",
            password: "newpassword123",
          }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid or expired reset token");
    });

    it("returns 400 for expired token", async () => {
      mockPasswordResetTokens = [
        {
          id: crypto.randomUUID(),
          userId: mockUsers[0].id,
          token: "expired-token",
          expiresAt: new Date(Date.now() - 1000), // Expired
        },
      ];

      const request = new NextRequest(
        "http://localhost:3000/api/auth/reset-password",
        {
          method: "POST",
          body: JSON.stringify({
            token: "expired-token",
            password: "newpassword123",
          }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid or expired reset token");
    });
  });

  describe("successful password reset", () => {
    it("returns success message", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/auth/reset-password",
        {
          method: "POST",
          body: JSON.stringify({
            token: mockPasswordResetTokens[0].token,
            password: "newpassword123",
          }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe(
        "Password reset successfully. Please sign in with your new password."
      );
    });

    it("updates user password with hashed value", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/auth/reset-password",
        {
          method: "POST",
          body: JSON.stringify({
            token: mockPasswordResetTokens[0].token,
            password: "newpassword123",
          }),
        }
      );

      await POST(request);

      expect(updatedUsers.length).toBe(1);
      expect(updatedUsers[0].userId).toBe(mockUsers[0].id);
      // Password should be hashed (bcrypt format)
      expect(updatedUsers[0].passwordHash).toMatch(/^\$2[ab]\$\d{2}\$/);
    });

    it("deletes the used reset token", async () => {
      const tokenId = mockPasswordResetTokens[0].id;

      const request = new NextRequest(
        "http://localhost:3000/api/auth/reset-password",
        {
          method: "POST",
          body: JSON.stringify({
            token: mockPasswordResetTokens[0].token,
            password: "newpassword123",
          }),
        }
      );

      await POST(request);

      expect(deletedTokenIds).toContain(tokenId);
    });

    it("invalidates all user sessions for security", async () => {
      const userId = mockUsers[0].id;

      const request = new NextRequest(
        "http://localhost:3000/api/auth/reset-password",
        {
          method: "POST",
          body: JSON.stringify({
            token: mockPasswordResetTokens[0].token,
            password: "newpassword123",
          }),
        }
      );

      await POST(request);

      expect(deletedSessionUserIds).toContain(userId);
    });
  });

  describe("edge cases", () => {
    it("handles password at minimum length (8 chars)", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/auth/reset-password",
        {
          method: "POST",
          body: JSON.stringify({
            token: mockPasswordResetTokens[0].token,
            password: "12345678",
          }),
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it("handles password at maximum length (100 chars)", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/auth/reset-password",
        {
          method: "POST",
          body: JSON.stringify({
            token: mockPasswordResetTokens[0].token,
            password: "a".repeat(100),
          }),
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it("handles password with special characters", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/auth/reset-password",
        {
          method: "POST",
          body: JSON.stringify({
            token: mockPasswordResetTokens[0].token,
            password: "P@ssw0rd!#$%^&*()",
          }),
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });
});
