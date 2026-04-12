import { describe, it, expect } from "vitest";
import jwt from "jsonwebtoken";

const JWT_SECRET = "test-secret-for-testing";

function signAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: "15m" });
}

function verifyAccessToken(token: string): { sub: string } {
  return jwt.verify(token, JWT_SECRET) as { sub: string };
}

describe("JWT utilities", () => {
  it("signs and verifies a token", () => {
    const token = signAccessToken("user-123");
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe("user-123");
  });

  it("rejects expired token", () => {
    const token = jwt.sign({ sub: "user-123" }, JWT_SECRET, { expiresIn: "0s" });
    expect(() => verifyAccessToken(token)).toThrow();
  });

  it("rejects tampered token", () => {
    const token = signAccessToken("user-123");
    expect(() => verifyAccessToken(token + "x")).toThrow();
  });
});
