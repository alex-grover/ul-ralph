import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "./auth";

describe("hashPassword", () => {
  it("returns a different hash than the original password", async () => {
    const password = "testpassword123";
    const hash = await hashPassword(password);

    expect(hash).not.toBe(password);
    expect(hash.length).toBeGreaterThan(password.length);
  });

  it("returns a bcrypt hash format", async () => {
    const password = "testpassword123";
    const hash = await hashPassword(password);

    // bcrypt hashes start with $2b$ or $2a$ and have a specific format
    expect(hash).toMatch(/^\$2[ab]\$\d{2}\$/);
  });

  it("generates different hashes for the same password", async () => {
    const password = "testpassword123";
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);

    // Due to salting, same password should produce different hashes
    expect(hash1).not.toBe(hash2);
  });

  it("handles empty password", async () => {
    const hash = await hashPassword("");
    expect(hash).toMatch(/^\$2[ab]\$\d{2}\$/);
  });

  it("handles very long passwords", async () => {
    const longPassword = "a".repeat(72); // bcrypt has a 72 byte limit
    const hash = await hashPassword(longPassword);
    expect(hash).toMatch(/^\$2[ab]\$\d{2}\$/);
  });

  it("handles special characters", async () => {
    const password = "P@ssw0rd!#$%^&*()_+-=[]{}|;':\",./<>?";
    const hash = await hashPassword(password);
    expect(hash).toMatch(/^\$2[ab]\$\d{2}\$/);
  });

  it("handles unicode characters", async () => {
    const password = "密码测试🔐";
    const hash = await hashPassword(password);
    expect(hash).toMatch(/^\$2[ab]\$\d{2}\$/);
  });
});

describe("verifyPassword", () => {
  it("returns true for correct password", async () => {
    const password = "testpassword123";
    const hash = await hashPassword(password);

    const isValid = await verifyPassword(password, hash);
    expect(isValid).toBe(true);
  });

  it("returns false for incorrect password", async () => {
    const password = "testpassword123";
    const wrongPassword = "wrongpassword";
    const hash = await hashPassword(password);

    const isValid = await verifyPassword(wrongPassword, hash);
    expect(isValid).toBe(false);
  });

  it("returns false for empty password when hash is not for empty", async () => {
    const password = "testpassword123";
    const hash = await hashPassword(password);

    const isValid = await verifyPassword("", hash);
    expect(isValid).toBe(false);
  });

  it("returns true for empty password when hash is for empty", async () => {
    const hash = await hashPassword("");

    const isValid = await verifyPassword("", hash);
    expect(isValid).toBe(true);
  });

  it("is case sensitive", async () => {
    const password = "TestPassword";
    const hash = await hashPassword(password);

    const isValidLower = await verifyPassword("testpassword", hash);
    const isValidUpper = await verifyPassword("TESTPASSWORD", hash);
    const isValidCorrect = await verifyPassword("TestPassword", hash);

    expect(isValidLower).toBe(false);
    expect(isValidUpper).toBe(false);
    expect(isValidCorrect).toBe(true);
  });

  it("handles special characters correctly", async () => {
    const password = "P@ssw0rd!#$%^&*()";
    const hash = await hashPassword(password);

    const isValid = await verifyPassword(password, hash);
    const isInvalid = await verifyPassword("P@ssw0rd!#$%^&*(", hash);

    expect(isValid).toBe(true);
    expect(isInvalid).toBe(false);
  });

  it("handles unicode characters correctly", async () => {
    const password = "密码测试🔐";
    const hash = await hashPassword(password);

    const isValid = await verifyPassword(password, hash);
    const isInvalid = await verifyPassword("密码测试", hash);

    expect(isValid).toBe(true);
    expect(isInvalid).toBe(false);
  });

  it("handles whitespace correctly", async () => {
    const password = " password with spaces ";
    const hash = await hashPassword(password);

    const isValidExact = await verifyPassword(" password with spaces ", hash);
    const isInvalidTrimmed = await verifyPassword(
      "password with spaces",
      hash
    );

    expect(isValidExact).toBe(true);
    expect(isInvalidTrimmed).toBe(false);
  });
});
