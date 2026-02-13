import http from "node:http";

export interface PageConfig {
  path: string;
  html: string;
  markdown?: string;
  links?: string[];
}

export interface TestServerOptions {
  pages: PageConfig[];
}

export interface TestServer {
  url: string;
  close(): Promise<void>;
}

export async function startTestServer(
  options: TestServerOptions
): Promise<TestServer> {
  const pageMap = new Map<string, PageConfig>();
  for (const page of options.pages) {
    pageMap.set(page.path, page);
  }

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost`);
    const page = pageMap.get(url.pathname);

    if (!page) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
      return;
    }

    const accept = req.headers.accept ?? "";

    if (accept.includes("text/markdown")) {
      if (page.markdown !== undefined) {
        res.writeHead(200, { "Content-Type": "text/markdown; charset=utf-8" });
        res.end(page.markdown);
      } else {
        res.writeHead(406, { "Content-Type": "text/plain" });
        res.end("Not Acceptable");
      }
      return;
    }

    // Build HTML with links
    let html = page.html;
    if (page.links && page.links.length > 0) {
      const linkHtml = page.links
        .map((l) => `<a href="${l}">Link to ${l}</a>`)
        .join("\n");
      html = html.replace("</body>", `${linkHtml}\n</body>`);
    }

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") throw new Error("No address");
      const url = `http://127.0.0.1:${addr.port}`;
      resolve({
        url,
        close: () =>
          new Promise<void>((res, rej) =>
            server.close((err) => (err ? rej(err) : res()))
          ),
      });
    });
  });
}
