import { describe, it, expect } from "vitest";
import {
  signUpSchema,
  signInSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "./auth";

describe("signUpSchema", () => {
  describe("username validation", () => {
    it("accepts valid usernames", () => {
      const validUsernames = [
        "abc",
        "user123",
        "my_user",
        "my-user",
        "User_Name-123",
        "a".repeat(30),
      ];

      for (const username of validUsernames) {
        const result = signUpSchema.safeParse({
          username,
          email: "test@example.com",
          password: "password123",
        });
        expect(result.success, `Username "${username}" should be valid`).toBe(
          true
        );
      }
    });

    it("rejects usernames shorter than 3 characters", () => {
      const result = signUpSchema.safeParse({
        username: "ab",
        email: "test@example.com",
        password: "password123",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.username).toContain(
          "Username must be at least 3 characters"
        );
      }
    });

    it("rejects usernames longer than 30 characters", () => {
      const result = signUpSchema.safeParse({
        username: "a".repeat(31),
        email: "test@example.com",
        password: "password123",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.username).toContain(
          "Username must be at most 30 characters"
        );
      }
    });

    it("rejects usernames with invalid characters", () => {
      const invalidUsernames = [
        "user name",
        "user@name",
        "user.name",
        "user!name",
        "user#name",
      ];

      for (const username of invalidUsernames) {
        const result = signUpSchema.safeParse({
          username,
          email: "test@example.com",
          password: "password123",
        });
        expect(
          result.success,
          `Username "${username}" should be invalid`
        ).toBe(false);
        if (!result.success) {
          expect(result.error.flatten().fieldErrors.username).toContain(
            "Username can only contain letters, numbers, underscores, and hyphens"
          );
        }
      }
    });
  });

  describe("email validation", () => {
    it("accepts valid email addresses", () => {
      const validEmails = [
        "test@example.com",
        "user.name@domain.org",
        "user+tag@example.co.uk",
      ];

      for (const email of validEmails) {
        const result = signUpSchema.safeParse({
          username: "validuser",
          email,
          password: "password123",
        });
        expect(result.success, `Email "${email}" should be valid`).toBe(true);
      }
    });

    it("rejects invalid email addresses", () => {
      const invalidEmails = [
        "notanemail",
        "missing@domain",
        "@nodomain.com",
        "spaces in@email.com",
      ];

      for (const email of invalidEmails) {
        const result = signUpSchema.safeParse({
          username: "validuser",
          email,
          password: "password123",
        });
        expect(result.success, `Email "${email}" should be invalid`).toBe(
          false
        );
      }
    });
  });

  describe("password validation", () => {
    it("accepts valid passwords", () => {
      const validPasswords = [
        "12345678",
        "a".repeat(100),
        "P@ssw0rd!123",
        "simple password with spaces",
      ];

      for (const password of validPasswords) {
        const result = signUpSchema.safeParse({
          username: "validuser",
          email: "test@example.com",
          password,
        });
        expect(
          result.success,
          `Password of length ${password.length} should be valid`
        ).toBe(true);
      }
    });

    it("rejects passwords shorter than 8 characters", () => {
      const result = signUpSchema.safeParse({
        username: "validuser",
        email: "test@example.com",
        password: "1234567",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.password).toContain(
          "Password must be at least 8 characters"
        );
      }
    });

    it("rejects passwords longer than 100 characters", () => {
      const result = signUpSchema.safeParse({
        username: "validuser",
        email: "test@example.com",
        password: "a".repeat(101),
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.password).toContain(
          "Password must be at most 100 characters"
        );
      }
    });
  });
});

describe("signInSchema", () => {
  it("accepts valid sign in data", () => {
    const result = signInSchema.safeParse({
      email: "test@example.com",
      password: "password123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = signInSchema.safeParse({
      email: "notanemail",
      password: "password123",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.email).toContain(
        "Invalid email address"
      );
    }
  });

  it("rejects empty password", () => {
    const result = signInSchema.safeParse({
      email: "test@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.password).toContain(
        "Password is required"
      );
    }
  });

  it("accepts any non-empty password (no min length for sign in)", () => {
    const result = signInSchema.safeParse({
      email: "test@example.com",
      password: "a",
    });
    expect(result.success).toBe(true);
  });
});

describe("forgotPasswordSchema", () => {
  it("accepts valid email", () => {
    const result = forgotPasswordSchema.safeParse({
      email: "test@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = forgotPasswordSchema.safeParse({
      email: "notanemail",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.email).toContain(
        "Invalid email address"
      );
    }
  });
});

describe("resetPasswordSchema", () => {
  it("accepts valid reset data", () => {
    const result = resetPasswordSchema.safeParse({
      token: "valid-token",
      password: "newpassword123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty token", () => {
    const result = resetPasswordSchema.safeParse({
      token: "",
      password: "newpassword123",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.token).toContain(
        "Reset token is required"
      );
    }
  });

  it("rejects password shorter than 8 characters", () => {
    const result = resetPasswordSchema.safeParse({
      token: "valid-token",
      password: "short",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.password).toContain(
        "Password must be at least 8 characters"
      );
    }
  });

  it("rejects password longer than 100 characters", () => {
    const result = resetPasswordSchema.safeParse({
      token: "valid-token",
      password: "a".repeat(101),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.password).toContain(
        "Password must be at most 100 characters"
      );
    }
  });
});
