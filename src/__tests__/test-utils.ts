import { vi } from "vitest";

// Mock cookie storage
export class MockCookieStore {
  private cookies: Map<string, { value: string; options?: object }> = new Map();

  get(name: string) {
    const cookie = this.cookies.get(name);
    return cookie ? { value: cookie.value } : undefined;
  }

  set(name: string, value: string, options?: object) {
    this.cookies.set(name, { value, options });
  }

  delete(name: string) {
    this.cookies.delete(name);
  }

  getAll() {
    return Array.from(this.cookies.entries()).map(([name, { value }]) => ({
      name,
      value,
    }));
  }

  has(name: string) {
    return this.cookies.has(name);
  }

  clear() {
    this.cookies.clear();
  }
}

// Create a global mock cookie store that can be shared across tests
export const mockCookieStore = new MockCookieStore();

// Mock next/headers cookies function
export const mockCookies = vi.fn(() => Promise.resolve(mockCookieStore));

// In-memory database storage for tests
interface TestUser {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

interface TestSession {
  id: string;
  userId: string;
  sessionToken: string;
  createdAt: Date;
  expiresAt: Date;
}

interface TestAnonymousSession {
  id: string;
  sessionToken: string;
  createdAt: Date;
  expiresAt: Date;
}

interface TestPasswordResetToken {
  id: string;
  userId: string;
  token: string;
  createdAt: Date;
  expiresAt: Date;
}

interface TestList {
  id: string;
  userId: string | null;
  anonymousSessionId: string | null;
  name: string;
  slug: string;
  description: string | null;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestDatabase {
  users: TestUser[];
  sessions: TestSession[];
  anonymousSessions: TestAnonymousSession[];
  passwordResetTokens: TestPasswordResetToken[];
  lists: TestList[];
}

export function createTestDatabase(): TestDatabase {
  return {
    users: [],
    sessions: [],
    anonymousSessions: [],
    passwordResetTokens: [],
    lists: [],
  };
}

// Helper to generate UUIDs for tests
export function generateTestId(): string {
  return crypto.randomUUID();
}

// Helper to create mock request
export function createMockRequest(options: {
  method?: string;
  body?: object;
  headers?: Record<string, string>;
}): Request {
  const { method = "POST", body, headers = {} } = options;

  return new Request("http://localhost:3000/api/test", {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// Reset all mocks between tests
export function resetMocks() {
  mockCookieStore.clear();
  vi.clearAllMocks();
}
