import { describe, expect, it } from "vitest";
import { safeNextPath } from "./auth-redirect";

describe("safeNextPath", () => {
  it("keeps in-app paths", () => {
    expect(safeNextPath("/menu")).toBe("/menu");
    expect(safeNextPath("/orders/abc?tab=1")).toBe("/orders/abc?tab=1");
  });

  it("rejects anything that could leave the app", () => {
    expect(safeNextPath("https://evil.com")).toBeNull();
    expect(safeNextPath("//evil.com")).toBeNull();
    expect(safeNextPath("/\\evil.com")).toBeNull();
    expect(safeNextPath("menu")).toBeNull();
    expect(safeNextPath("/\nfoo")).toBeNull();
    expect(safeNextPath("")).toBeNull();
    expect(safeNextPath(null)).toBeNull();
  });
});
