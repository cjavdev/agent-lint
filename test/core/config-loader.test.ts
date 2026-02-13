import { describe, it, expect } from "vitest";
import { loadConfig } from "../../src/core/config-loader.js";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

async function withTempDir(
  fn: (dir: string) => Promise<void>
): Promise<void> {
  const dir = join(tmpdir(), `agentlint-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(dir, { recursive: true });
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe("loadConfig", () => {
  it("returns empty object when no config file exists", async () => {
    await withTempDir(async (dir) => {
      const config = await loadConfig(undefined, dir);
      expect(config).toEqual({});
    });
  });

  it("loads agentlint.config.json from cwd", async () => {
    await withTempDir(async (dir) => {
      await writeFile(
        join(dir, "agentlint.config.json"),
        JSON.stringify({ maxDepth: 5 })
      );
      const config = await loadConfig(undefined, dir);
      expect(config.maxDepth).toBe(5);
    });
  });

  it("loads .agentlintrc.json from cwd", async () => {
    await withTempDir(async (dir) => {
      await writeFile(
        join(dir, ".agentlintrc.json"),
        JSON.stringify({ maxPages: 10 })
      );
      const config = await loadConfig(undefined, dir);
      expect(config.maxPages).toBe(10);
    });
  });

  it("prefers agentlint.config.json over .agentlintrc.json", async () => {
    await withTempDir(async (dir) => {
      await writeFile(
        join(dir, "agentlint.config.json"),
        JSON.stringify({ maxDepth: 5 })
      );
      await writeFile(
        join(dir, ".agentlintrc.json"),
        JSON.stringify({ maxDepth: 10 })
      );
      const config = await loadConfig(undefined, dir);
      expect(config.maxDepth).toBe(5);
    });
  });

  it("loads from explicit path", async () => {
    await withTempDir(async (dir) => {
      const customPath = join(dir, "custom.json");
      await writeFile(customPath, JSON.stringify({ maxDepth: 7 }));
      const config = await loadConfig(customPath, dir);
      expect(config.maxDepth).toBe(7);
    });
  });

  it("throws on missing explicit path", async () => {
    await withTempDir(async (dir) => {
      await expect(
        loadConfig(join(dir, "nonexistent.json"), dir)
      ).rejects.toThrow("Config file not found");
    });
  });

  it("throws on invalid config shape", async () => {
    await withTempDir(async (dir) => {
      await writeFile(
        join(dir, "agentlint.config.json"),
        JSON.stringify({ unknownKey: true })
      );
      await expect(loadConfig(undefined, dir)).rejects.toThrow("Invalid config");
    });
  });

  it("loads config with rules and ignorePatterns", async () => {
    await withTempDir(async (dir) => {
      const config = {
        ignorePatterns: ["/admin/*"],
        rules: {
          "transport/accept-markdown": {
            ignorePaths: ["/api/*"],
            severity: "info",
          },
        },
      };
      await writeFile(
        join(dir, "agentlint.config.json"),
        JSON.stringify(config)
      );
      const loaded = await loadConfig(undefined, dir);
      expect(loaded.ignorePatterns).toEqual(["/admin/*"]);
      expect(loaded.rules?.["transport/accept-markdown"]?.ignorePaths).toEqual([
        "/api/*",
      ]);
    });
  });
});
