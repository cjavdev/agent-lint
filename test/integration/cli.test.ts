import { describe, it, expect, afterEach } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  startTestServer,
  type TestServer,
} from "../fixtures/test-server.js";

const execFileAsync = promisify(execFile);

let server: TestServer;

afterEach(async () => {
  if (server) await server.close();
});

async function runCLI(
  url: string,
  args: string[] = []
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const { stdout, stderr } = await execFileAsync(
      "npx",
      ["tsx", "src/cli.ts", url, ...args],
      {
        cwd: process.cwd(),
        env: { ...process.env, CI: "true" },
        timeout: 30000,
      }
    );
    return { stdout, stderr, exitCode: 0 };
  } catch (err: unknown) {
    const e = err as {
      stdout?: string;
      stderr?: string;
      code?: number;
    };
    return {
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? "",
      exitCode: e.code ?? 1,
    };
  }
}

describe("CLI integration", () => {
  it("exits 0 when site supports markdown", async () => {
    server = await startTestServer({
      pages: [
        {
          path: "/",
          html: '<html lang="en"><head><meta name="description" content="Home page"><script type="application/ld+json">{"@type":"WebSite"}</script></head><body><main><h1 id="home">Home</h1></main></body></html>',
          markdown: "# Home\n\nWelcome to the site.\n\n- Item 1\n- Item 2",
          links: ["/llms.txt", "/sitemap.xml", "/robots.txt"],
        },
        {
          path: "/llms.txt",
          html: '<html lang="en"><head><meta name="description" content="LLMs guide"></head><body><section># LLMs.txt\n\nAgent-friendly site.</section></body></html>',
          markdown: "# LLMs.txt\n\nAgent-friendly site.",
        },
        {
          path: "/sitemap.xml",
          html: '<html lang="en"><head><meta name="description" content="Sitemap"></head><body><section>Sitemap content</section></body></html>',
          markdown: "# Sitemap\n\n- [Home](/)\n- [LLMs](/llms.txt)",
        },
        {
          path: "/robots.txt",
          html: '<html lang="en"><head><meta name="description" content="Robots policy"></head><body><main>User-agent: *\nAllow: /</main></body></html>',
          markdown: "# Robots Policy\n\n- User-agent: *\n- Allow: /",
        },
      ],
    });

    // Score is 98: two info-level rules (openapi-detect, mcp-detect) each deduct 1 point
    const result = await runCLI(server.url, ["--max-pages", "5"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Score:");
    expect(result.stdout).toContain("98");
  });

  it("exits 1 when site does not support markdown", async () => {
    server = await startTestServer({
      pages: [
        {
          path: "/",
          html: "<html><body><h1>Home</h1></body></html>",
          // no markdown
        },
      ],
    });

    const result = await runCLI(server.url, ["--max-pages", "1"]);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("transport/accept-markdown");
  });

  it("supports --json flag", async () => {
    server = await startTestServer({
      pages: [
        {
          path: "/",
          html: '<html lang="en"><head><meta name="description" content="Home page"><script type="application/ld+json">{"@type":"WebSite"}</script></head><body><main><h1 id="home">Home</h1></main></body></html>',
          markdown: "# Home\n\n- Item 1",
          links: ["/llms.txt", "/sitemap.xml", "/robots.txt"],
        },
        {
          path: "/llms.txt",
          html: '<html lang="en"><head><meta name="description" content="LLMs guide"></head><body><section># LLMs.txt\n\nAgent-friendly site.</section></body></html>',
          markdown: "# LLMs.txt\n\nAgent-friendly site.",
        },
        {
          path: "/sitemap.xml",
          html: '<html lang="en"><head><meta name="description" content="Sitemap"></head><body><section>Sitemap content</section></body></html>',
          markdown: "# Sitemap\n\n- [Home](/)\n- [LLMs](/llms.txt)",
        },
        {
          path: "/robots.txt",
          html: '<html lang="en"><head><meta name="description" content="Robots policy"></head><body><main>User-agent: *\nAllow: /</main></body></html>',
          markdown: "# Robots Policy\n\n- User-agent: *\n- Allow: /",
        },
      ],
    });

    // Score is 98: two info-level rules (openapi-detect, mcp-detect) each deduct 1 point
    const result = await runCLI(server.url, ["--max-pages", "5", "--json"]);
    expect(result.exitCode).toBe(0);
    const json = JSON.parse(result.stdout);
    expect(json.targetUrl).toContain(server.url);
    expect(json.score.score).toBe(98);
  });
});
