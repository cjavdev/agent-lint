import { describe, it, expect } from "vitest";
import { matchPath, isPathIgnored } from "../../src/core/path-matcher.js";

describe("matchPath", () => {
  it("matches exact paths", () => {
    expect(matchPath("/admin", "/admin")).toBe(true);
    expect(matchPath("/admin", "/other")).toBe(false);
  });

  it("matches single-segment wildcard *", () => {
    expect(matchPath("/admin/users", "/admin/*")).toBe(true);
    expect(matchPath("/admin/settings", "/admin/*")).toBe(true);
    expect(matchPath("/admin/users/123", "/admin/*")).toBe(false); // * doesn't cross /
  });

  it("matches multi-segment wildcard **", () => {
    expect(matchPath("/admin/users/123", "/admin/**")).toBe(true);
    expect(matchPath("/admin/a/b/c", "/admin/**")).toBe(true);
    expect(matchPath("/admin", "/admin/**")).toBe(false); // nothing after /admin/
  });

  it("matches ** in the middle of a pattern", () => {
    expect(matchPath("/docs/v2/api/users", "/docs/**/users")).toBe(true);
    expect(matchPath("/docs/users", "/docs/**/users")).toBe(true);
  });

  it("matches patterns without leading slash", () => {
    expect(matchPath("/blog/post", "blog/*")).toBe(true);
  });

  it("handles trailing slashes", () => {
    expect(matchPath("/admin/", "/admin/")).toBe(true);
    expect(matchPath("/admin/", "/admin/*")).toBe(true); // * matches empty segment? No, trailing slash makes segment ""
  });
});

describe("isPathIgnored", () => {
  it("returns false for undefined url", () => {
    expect(isPathIgnored(undefined, ["/admin/*"])).toBe(false);
  });

  it("returns false for empty patterns", () => {
    expect(isPathIgnored("https://example.com/admin/page", [])).toBe(false);
  });

  it("extracts pathname from full URL and matches", () => {
    expect(
      isPathIgnored("https://example.com/admin/page", ["/admin/*"])
    ).toBe(true);
  });

  it("returns false when no patterns match", () => {
    expect(
      isPathIgnored("https://example.com/public/page", ["/admin/*"])
    ).toBe(false);
  });

  it("matches any of multiple patterns", () => {
    expect(
      isPathIgnored("https://example.com/blog/post", ["/admin/*", "/blog/*"])
    ).toBe(true);
  });

  it("returns false for invalid URL", () => {
    expect(isPathIgnored("not-a-url", ["/admin/*"])).toBe(false);
  });
});
