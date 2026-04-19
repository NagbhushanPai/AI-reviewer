import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyGithubSignature } from "../github/webhook.routes.js";

describe("verifyGithubSignature", () => {
  const SECRET = "super-secret";
  const BODY = JSON.stringify({ action: "opened" });

  function makeSignature(body: string, secret: string): string {
    return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  }

  it("returns true for a valid signature", () => {
    const sig = makeSignature(BODY, SECRET);
    expect(verifyGithubSignature(BODY, sig, SECRET)).toBe(true);
  });

  it("returns false for a wrong secret", () => {
    const sig = makeSignature(BODY, "wrong-secret");
    expect(verifyGithubSignature(BODY, sig, SECRET)).toBe(false);
  });

  it("returns false for a tampered body", () => {
    const sig = makeSignature(BODY, SECRET);
    const tamperedBody = JSON.stringify({ action: "deleted" });
    expect(verifyGithubSignature(tamperedBody, sig, SECRET)).toBe(false);
  });

  it("returns false for a malformed signature header", () => {
    expect(verifyGithubSignature(BODY, "not-a-real-sig", SECRET)).toBe(false);
  });

  it("returns false when signature lengths differ", () => {
    // Provide a shorter value to exercise the length-mismatch branch
    expect(verifyGithubSignature(BODY, "sha256=abc", SECRET)).toBe(false);
  });
});
