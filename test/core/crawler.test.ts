import { describe, it, expect, afterEach } from "vitest";
import { crawl } from "../../src/core/crawler.js";
import {
  startTestServer,
  type TestServer,
} from "../fixtures/test-server.js";

let server: TestServer;

afterEach(async () => {
  if (server) await server.close();
});

describe("crawl", () => {
  it("fetches a single page", async () => {
    server = await startTestServer({
      pages: [
        {
          path: "/",
          html: "<html><body><h1>Hello</h1></body></html>",
        },
      ],
    });

    const pages = await crawl(server.url, {
      requestAlternates: [],
    });

    expect(pages).toHaveLength(1);
    expect(pages[0].url).toBe(`${server.url}/`);
    expect(pages[0].status).toBe(200);
    expect(pages[0].html).toContain("<h1>Hello</h1>");
    expect(pages[0].textContent).toContain("Hello");
  });

  it("populates alternate representations", async () => {
    server = await startTestServer({
      pages: [
        {
          path: "/",
          html: "<html><body><h1>Hello</h1></body></html>",
          markdown: "# Hello",
        },
      ],
    });

    const pages = await crawl(server.url, {
      requestAlternates: ["text/markdown"],
    });

    expect(pages).toHaveLength(1);
    const alt = pages[0].alternateRepresentations.get("text/markdown");
    expect(alt).toBeDefined();
    expect(alt!.status).toBe(200);
    expect(alt!.body).toBe("# Hello");
    expect(alt!.contentType).toContain("text/markdown");
  });

  it("records non-2xx alternate status when markdown not supported", async () => {
    server = await startTestServer({
      pages: [
        {
          path: "/",
          html: "<html><body><h1>Hello</h1></body></html>",
          // no markdown
        },
      ],
    });

    const pages = await crawl(server.url, {
      requestAlternates: ["text/markdown"],
    });

    const alt = pages[0].alternateRepresentations.get("text/markdown");
    expect(alt).toBeDefined();
    expect(alt!.status).toBe(406);
  });

  it("follows same-origin links", async () => {
    server = await startTestServer({
      pages: [
        {
          path: "/",
          html: "<html><body><h1>Home</h1></body></html>",
          links: ["/about"],
        },
        {
          path: "/about",
          html: "<html><body><h1>About</h1></body></html>",
        },
      ],
    });

    const pages = await crawl(server.url, {
      requestAlternates: [],
    });

    expect(pages).toHaveLength(2);
    const urls = pages.map((p) => p.url);
    expect(urls).toContain(`${server.url}/`);
    expect(urls).toContain(`${server.url}/about`);
  });

  it("deduplicates URLs", async () => {
    server = await startTestServer({
      pages: [
        {
          path: "/",
          html: "<html><body><h1>Home</h1></body></html>",
          links: ["/about", "/about", "/about#section"],
        },
        {
          path: "/about",
          html: "<html><body><h1>About</h1></body></html>",
        },
      ],
    });

    const pages = await crawl(server.url, {
      requestAlternates: [],
    });

    expect(pages).toHaveLength(2);
  });

  it("respects maxPages limit", async () => {
    server = await startTestServer({
      pages: [
        {
          path: "/",
          html: "<html><body><h1>Home</h1></body></html>",
          links: ["/a", "/b", "/c"],
        },
        { path: "/a", html: "<html><body>A</body></html>" },
        { path: "/b", html: "<html><body>B</body></html>" },
        { path: "/c", html: "<html><body>C</body></html>" },
      ],
    });

    const pages = await crawl(server.url, {
      maxPages: 2,
      requestAlternates: [],
    });

    expect(pages).toHaveLength(2);
  });

  it("extracts links correctly", async () => {
    server = await startTestServer({
      pages: [
        {
          path: "/",
          html: `<html><body>
            <a href="/local">Local</a>
            <a href="https://external.com">External</a>
            <a href="/other">Other</a>
          </body></html>`,
        },
        { path: "/local", html: "<html><body>Local</body></html>" },
        { path: "/other", html: "<html><body>Other</body></html>" },
      ],
    });

    const pages = await crawl(server.url, {
      requestAlternates: [],
    });

    const root = pages.find((p) => p.url === `${server.url}/`);
    expect(root).toBeDefined();
    // Should only have same-origin links
    expect(root!.links).toContain(`${server.url}/local`);
    expect(root!.links).toContain(`${server.url}/other`);
    expect(root!.links).not.toContain("https://external.com");
  });
});
