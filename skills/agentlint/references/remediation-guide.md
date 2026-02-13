# AgentLint Remediation Guide

Detailed fix instructions for every AgentLint rule, organized by category. Each entry explains what the rule checks, why it matters for AI agents, and how to fix violations across common platforms.

---

## Transport Rules

### `transport/accept-markdown` (error, -10 pts)

**What it checks:** When an AI agent sends `Accept: text/markdown`, does the server return actual markdown instead of HTML?

**Why it matters:** Markdown is far more token-efficient than HTML. An AI agent consuming your docs in markdown uses ~70% fewer tokens, reducing cost and improving comprehension. This is the single highest-impact optimization for agent-friendliness.

**How to fix:**

**Option A: Cloudflare Worker (recommended for static sites)**
```js
export default {
  async fetch(request, env) {
    const accept = request.headers.get('Accept') || '';
    if (accept.includes('text/markdown')) {
      const url = new URL(request.url);
      // Serve pre-rendered .md files from a /markdown/ prefix
      const mdUrl = new URL(`/markdown${url.pathname}.md`, url.origin);
      const mdResponse = await fetch(mdUrl);
      if (mdResponse.ok) {
        return new Response(mdResponse.body, {
          headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
        });
      }
    }
    return fetch(request);
  },
};
```

**Option B: Next.js middleware**
```ts
// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const accept = request.headers.get('accept') || '';
  if (accept.includes('text/markdown')) {
    const url = request.nextUrl.clone();
    url.pathname = `/api/markdown${url.pathname}`;
    return NextResponse.rewrite(url);
  }
}
```

**Option C: Express middleware**
```ts
app.use((req, res, next) => {
  if (req.accepts('text/markdown')) {
    const mdPath = path.join(__dirname, 'markdown', req.path + '.md');
    if (fs.existsSync(mdPath)) {
      res.type('text/markdown').sendFile(mdPath);
      return;
    }
  }
  next();
});
```

**Option D: Nginx content negotiation**
```nginx
map $http_accept $markdown_suffix {
    default "";
    "~text/markdown" ".md";
}

location /docs/ {
    try_files $uri$markdown_suffix $uri $uri/ =404;
}
```

**Option E: Rails**
```ruby
# config/application.rb — register the MIME type
Mime::Type.register "text/markdown", :md

# app/controllers/application_controller.rb
class ApplicationController < ActionController::Base
  before_action :serve_markdown, if: -> { request.format.md? }

  private

  def serve_markdown
    md_path = Rails.root.join("markdown", "#{request.path}.md")
    if File.exist?(md_path)
      render plain: File.read(md_path), content_type: "text/markdown; charset=utf-8"
    end
  end
end
```

Or use `respond_to` in individual controllers:
```ruby
# app/controllers/docs_controller.rb
def show
  @doc = Doc.find_by!(slug: params[:slug])
  respond_to do |format|
    format.html
    format.md { render plain: @doc.markdown_body, content_type: "text/markdown; charset=utf-8" }
  end
end
```

**Verification:**
```bash
curl -H "Accept: text/markdown" https://yoursite.com/docs/getting-started
# Should return markdown content, not HTML
```

---

### `transport/content-type-valid` (warn, -4 pts)

**What it checks:** Every response should have a valid `Content-Type` header. Flags missing headers or `application/octet-stream` on pages that should be `text/html`.

**Why it matters:** AI agents rely on Content-Type to decide how to parse responses. Missing or wrong types cause parsing failures.

**How to fix:**

Most web servers and frameworks set this automatically. If you see this violation:

1. Check if a CDN or proxy is stripping headers
2. Ensure static file servers have MIME type mappings configured
3. For custom endpoints, set the header explicitly:

```ts
// Express
res.set('Content-Type', 'text/html; charset=utf-8');

// Next.js API route
return new Response(html, {
  headers: { 'Content-Type': 'text/html; charset=utf-8' },
});
```

**Rails:**
```ruby
# app/controllers/pages_controller.rb
def show
  response.content_type = "text/html; charset=utf-8"
  render :show
end
```

**Nginx:** Ensure `include mime.types;` is in your `http` block.

**Verification:**
```bash
curl -I https://yoursite.com/page | grep -i content-type
# Should show: content-type: text/html; charset=utf-8
```

---

### `transport/robots-txt` (warn/info, -4/-1 pts)

**What it checks:**
- `/robots.txt` exists (warn if missing)
- Flags full-site blocks (`Disallow: /`) for known AI agents: GPTBot, ClaudeBot, Google-Extended, CCBot, anthropic-ai, ChatGPT-User, Bytespider, cohere-ai (info)
- Also flags wildcard `User-agent: *` with `Disallow: /` (info)

**Why it matters:** Many sites block AI crawlers without realizing it prevents agents from accessing their content. A missing robots.txt is also a signal of incomplete site configuration.

**How to fix:**

Create or update `/robots.txt` at your site root:

```
User-agent: *
Allow: /

# Allow AI agents to access your content
User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Google-Extended
Allow: /

# Block only what's truly private
User-agent: *
Disallow: /admin/
Disallow: /api/internal/
```

**Rails:** Place `robots.txt` in your `public/` directory — Rails serves static files from `public/` by default with no additional configuration needed.

If you intentionally block AI agents, AgentLint reports it as `info` (not an error) — it's your choice, but it reduces agent-friendliness.

**Verification:**
```bash
curl https://yoursite.com/robots.txt
```

---

## Structure Rules

### `structure/heading-hierarchy` (warn, -4 pts)

**What it checks:**
- Page has headings but no `<h1>` element
- Heading levels skip (e.g., `<h1>` followed by `<h3>` with no `<h2>`)

**Why it matters:** AI agents use heading hierarchy to understand document structure, build tables of contents, and extract sections. Broken hierarchy confuses content parsing.

**How to fix:**

1. Ensure every page has exactly one `<h1>` (usually the page title)
2. Don't skip levels — after `<h1>`, use `<h2>`, then `<h3>`, etc.

```html
<!-- Bad -->
<h1>API Reference</h1>
<h3>Authentication</h3>  <!-- Skipped h2! -->
<h4>API Keys</h4>

<!-- Good -->
<h1>API Reference</h1>
<h2>Authentication</h2>
<h3>API Keys</h3>
```

**Rails ERB:**
```erb
<!-- app/views/docs/show.html.erb -->
<h1><%= @doc.title %></h1>

<% @doc.sections.each do |section| %>
  <h2><%= section.title %></h2>
  <% section.subsections.each do |sub| %>
    <h3><%= sub.title %></h3>
    <%= sub.content %>
  <% end %>
<% end %>
```

For component-based frameworks (React, Vue), ensure components don't assume a heading level. Use a prop or context to set the right level.

**Verification:** View page source and check heading tags are sequential.

---

### `structure/anchor-ids` (warn, -4 pts)

**What it checks:** Headings should have anchor IDs for deep linking. Accepts three patterns:
- `<h2 id="auth">` — direct ID attribute
- `<h2><a name="auth">` — child anchor with name
- `<h2><a id="auth">` — child anchor with ID

Reports the percentage of headings missing anchors.

**Why it matters:** AI agents use anchor IDs to link to specific sections, enabling precise references like "see the [Authentication section](/docs/api#auth)". Without anchors, agents can only link to full pages.

**How to fix:**

**Static HTML:** Add `id` attributes to all headings:
```html
<h2 id="authentication">Authentication</h2>
<h3 id="api-keys">API Keys</h3>
```

**Markdown processors:** Most already generate IDs. Ensure your processor has this enabled:
- **rehype-slug** (unified/remark ecosystem): `npm install rehype-slug`
- **markdown-it-anchor**: `npm install markdown-it-anchor`
- **Hugo:** Built-in, enabled by default
- **Jekyll/kramdown:** Built-in with `auto_ids: true`

**Next.js with MDX:**
```js
// next.config.js or mdx config
import rehypeSlug from 'rehype-slug';
const mdxOptions = { rehypePlugins: [rehypeSlug] };
```

**Rails helper:**
```ruby
# app/helpers/heading_helper.rb
module HeadingHelper
  def heading_with_anchor(tag, text, id: nil)
    id ||= text.parameterize
    content_tag(tag, text, id: id)
  end
end
```
```erb
<!-- Usage in views -->
<%= heading_with_anchor(:h2, "Authentication") %>
<!-- Renders: <h2 id="authentication">Authentication</h2> -->
```

**Verification:**
```bash
curl -s https://yoursite.com/docs | grep -oP '<h[2-6][^>]*id="[^"]*"'
```

---

### `structure/semantic-html` (info, -1 pt)

**What it checks:** Pages use at least one semantic HTML element: `<main>`, `<article>`, or `<section>`.

**Why it matters:** Semantic elements help AI agents identify the primary content area vs. navigation, sidebars, and footers. This dramatically improves content extraction quality.

**How to fix:**

Wrap your primary content in semantic elements:

```html
<body>
  <header><!-- nav, logo --></header>
  <main>
    <article>
      <h1>Page Title</h1>
      <section>
        <h2>First Section</h2>
        <p>Content...</p>
      </section>
    </article>
  </main>
  <footer><!-- links, copyright --></footer>
</body>
```

**Rails layout:**
```erb
<!-- app/views/layouts/application.html.erb -->
<body>
  <header><%= render "shared/nav" %></header>
  <main>
    <article>
      <%= yield %>
    </article>
  </main>
  <footer><%= render "shared/footer" %></footer>
</body>
```

At minimum, add a `<main>` element around your primary content. Most frameworks already do this.

---

### `structure/meta-description` (info, -1 pt)

**What it checks:** Pages have a `<meta name="description" content="...">` tag with non-empty content.

**Why it matters:** AI agents use meta descriptions as concise page summaries for deciding whether to fetch the full page. Missing descriptions force agents to download and parse the entire page to understand its purpose.

**How to fix:**

Add to every page's `<head>`:
```html
<meta name="description" content="Learn how to authenticate with the Acme API using API keys, OAuth tokens, or service accounts.">
```

For frameworks:
- **Next.js:** Use the `metadata` export in `layout.tsx` or `page.tsx`
- **Hugo:** Set `description` in front matter
- **Astro:** Pass to `<BaseHead>` component

**Rails:**
```erb
<!-- app/views/layouts/application.html.erb -->
<head>
  <meta name="description" content="<%= yield(:meta_description) || 'Default site description' %>">
</head>
```
```erb
<!-- app/views/docs/show.html.erb -->
<% content_for :meta_description, @doc.summary.truncate(160) %>
```

Keep descriptions under 160 characters, focused on what the page covers.

---

### `structure/lang-attribute` (info, -1 pt)

**What it checks:** The `<html>` element has a `lang` attribute (e.g., `<html lang="en">`).

**Why it matters:** AI agents use the language attribute to select the right language model behavior and avoid mistranslation.

**How to fix:**

```html
<html lang="en">
```

This is typically set once in your base template/layout. All major frameworks support it:
- **Next.js:** Set in `app/layout.tsx` on the `<html>` tag
- **Astro:** Set in your layout component
- **Hugo:** `{{ .Site.LanguageCode }}` in baseof template
- **Rails:** Use `I18n.locale` in your layout:
```erb
<!-- app/views/layouts/application.html.erb -->
<html lang="<%= I18n.locale %>">
```

---

## Token Rules

### `tokens/page-token-count` (warn, -4 pts)

**What it checks:** Each page's text content is estimated in tokens (`text.length / 4`). Flags pages exceeding the threshold (default: 4,000 tokens, configurable via `tokenThreshold`).

**Why it matters:** Long pages consume more of an AI agent's context window, increase costs, and reduce comprehension. Shorter, focused pages are more agent-friendly.

**How to fix:**

1. **Split long pages** into focused sub-pages (e.g., split a monolithic API reference into per-endpoint pages)
2. **Remove redundant content** — boilerplate, repeated examples, verbose explanations
3. **Use progressive disclosure** — summary on the main page, details on sub-pages
4. **Configure the threshold** if your content legitimately needs more tokens:

```json
// agent-lint.config.json
{
  "tokenThreshold": 8000
}
```

5. **Exclude specific pages** from this rule:
```json
{
  "rules": {
    "tokens/page-token-count": {
      "ignorePaths": ["/docs/changelog", "/docs/full-reference"]
    }
  }
}
```

---

### `tokens/boilerplate-duplication` (warn, -4 pts)

**What it checks:** Extracts text from `<nav>`, `<header>`, and `<footer>` elements. Calculates the ratio of boilerplate to total content. Flags when the average across pages AND individual pages exceed 30%.

**Why it matters:** Repeated navigation, headers, and footers waste tokens when an AI agent crawls multiple pages. An agent consuming 10 pages with 40% boilerplate is effectively paying for 4 pages of navigation menus.

**How to fix:**

1. **Minimize navigation content** — use concise link text, reduce mega-menu depth
2. **Implement markdown alternate representations** (fixes `transport/accept-markdown` too) — markdown versions can omit nav/footer entirely
3. **Use `<main>` tags** so agents can identify and extract just the content area
4. **Reduce footer content** — move legal text and link farms to dedicated pages

```html
<!-- Before: Heavy nav on every page -->
<nav>
  <ul><!-- 50 links with descriptions --></ul>
</nav>

<!-- After: Minimal nav -->
<nav>
  <ul>
    <li><a href="/docs">Docs</a></li>
    <li><a href="/api">API</a></li>
    <li><a href="/guides">Guides</a></li>
  </ul>
</nav>
```

**Rails:** Use partials and conditionally omit boilerplate for markdown responses:
```erb
<!-- app/views/layouts/application.html.erb -->
<body>
  <%= render "shared/nav" unless content_for?(:skip_chrome) %>
  <main><%= yield %></main>
  <%= render "shared/footer" unless content_for?(:skip_chrome) %>
</body>
```
```ruby
# app/controllers/application_controller.rb — strip nav/footer for markdown
before_action :strip_chrome_for_markdown, if: -> { request.format.md? }

private

def strip_chrome_for_markdown
  @skip_chrome = true
end
```

---

### `tokens/nav-ratio` (info, -1 pt)

**What it checks:** Calculates the percentage of tokens inside `<nav>` elements vs. total page tokens. Flags pages where nav content exceeds 20%.

**Why it matters:** Similar to boilerplate duplication, but focused specifically on navigation. High nav ratios indicate pages where the actual content is drowned out by menus.

**How to fix:**

Same strategies as `tokens/boilerplate-duplication`:
- Simplify navigation menus
- Move secondary nav items to a sitemap page
- Use progressive disclosure (collapsed menus)
- Provide markdown alternates without navigation

---

## Agent Rules

### `agent/mcp-detect` (info, -1 pt)

**What it checks:** Looks for `/.well-known/mcp.json` — a Model Context Protocol manifest that tells AI agents what tools/capabilities the site offers.

**Why it matters:** MCP enables AI agents to not just read your site, but interact with it — executing API calls, filling forms, running queries. Publishing an MCP manifest is the next level of agent-friendliness.

**How to fix:**

Create `/.well-known/mcp.json` describing your site's capabilities:

```json
{
  "schema_version": "1.0",
  "name": "Acme API",
  "description": "Acme's public API for managing widgets",
  "tools": [
    {
      "name": "list_widgets",
      "description": "List all widgets with optional filtering",
      "endpoint": "/api/v1/widgets",
      "method": "GET"
    }
  ]
}
```

This is an emerging standard — even a basic manifest signals agent-readiness. See the [MCP specification](https://modelcontextprotocol.io/) for the full schema.

**Rails:**
```ruby
# config/routes.rb
get ".well-known/mcp.json", to: "mcp#show"

# app/controllers/mcp_controller.rb
class McpController < ApplicationController
  def show
    render json: {
      schema_version: "1.0",
      name: "Acme API",
      description: "Acme's public API for managing widgets",
      tools: [
        {
          name: "list_widgets",
          description: "List all widgets with optional filtering",
          endpoint: "/api/v1/widgets",
          method: "GET"
        }
      ]
    }
  end
end
```

**Verification:**
```bash
curl https://yoursite.com/.well-known/mcp.json
```

---

### `agent/agent-usage-guide` (warn, -4 pts)

**What it checks:** Searches all page text for keywords indicating agent/AI guidance: "ai agent", "llm", "large language model", "machine-readable", "api access", "programmatic access", "bot policy", "automation", "mcp", "model context protocol".

**Why it matters:** Sites that explicitly document how AI agents should consume their content get better agent behavior — fewer errors, more appropriate usage, respect for rate limits.

**How to fix:**

Add a dedicated page or section for AI/agent consumers. Common approaches:

**Option A: Dedicated page (recommended)**
Create `/docs/ai-agents` or `/docs/for-bots`:
```markdown
# For AI Agents

## Recommended Access Patterns
- Use `Accept: text/markdown` for efficient content retrieval
- Respect rate limits: max 10 requests/second
- Start with `/llms.txt` for a content overview

## API Access
Our REST API is available at `/api/v1/`. See the [OpenAPI spec](/openapi.json).

## Machine-Readable Formats
- Markdown: Send `Accept: text/markdown` header
- JSON API: All endpoints return JSON
- Sitemap: `/sitemap.xml`
```

**Option B: Section in existing docs**
Add an "AI/Agent Access" section to your API docs or developer guide.

**Rails:** Add a route and controller for a dedicated agent guide:
```ruby
# config/routes.rb
get "docs/ai-agents", to: "docs#ai_agents"

# app/controllers/docs_controller.rb
def ai_agents
  render "docs/ai_agents"
end
```

**Verification:**
```bash
curl -s https://yoursite.com/docs/ai-agents | grep -i "ai agent"
```

---

## Discoverability Rules

### `discoverability/llms-txt` (error, -10 pts)

**What it checks:** Does `/llms.txt` exist? Checks crawled pages first, then falls back to a HEAD request to `{origin}/llms.txt`.

**Why it matters:** `llms.txt` is the emerging standard for AI agents to discover site content — like `robots.txt` but for LLMs. It provides a structured overview of what content is available and how to access it. Missing this file is the #1 agent-friendliness gap.

**How to fix:**

Create `/llms.txt` at your site root following the [llms.txt specification](https://llmstxt.org/):

```
# Acme Docs

> Acme helps developers build better widgets.

## Getting Started
- [Quickstart](/docs/quickstart): Set up your first widget in 5 minutes
- [Authentication](/docs/auth): API keys and OAuth setup

## API Reference
- [Widgets API](/docs/api/widgets): CRUD operations for widgets
- [Events API](/docs/api/events): Webhook event reference

## Guides
- [Best Practices](/docs/guides/best-practices): Production deployment tips
- [Migration Guide](/docs/guides/migration): Upgrading from v1 to v2
```

**Tips:**
- Start with a brief site description
- Organize links by category
- Use descriptive link text with brief summaries
- Keep it under 100 entries for optimal consumption
- Update it when you add/remove significant content

**For static site generators:** Add `llms.txt` to your `public/` or `static/` directory.

**Rails:** Place the file at `public/llms.txt` — Rails serves static files from `public/` automatically, no route needed.

**Verification:**
```bash
curl https://yoursite.com/llms.txt
```

---

### `discoverability/sitemap` (info, -1 pt)

**What it checks:** Does `/sitemap.xml` exist? Checks crawled pages first, then falls back to a HEAD request.

**Why it matters:** Sitemaps help AI agents discover all pages without deep crawling, saving time and reducing load on your server.

**How to fix:**

Most frameworks generate sitemaps automatically:
- **Next.js:** Use `app/sitemap.ts` or `next-sitemap` package
- **Hugo:** Built-in with `[sitemap]` config
- **Astro:** `@astrojs/sitemap` integration
- **WordPress:** Yoast SEO or built-in (WP 5.5+)
- **Rails:** Use the `sitemap_generator` gem:
```ruby
# Gemfile
gem "sitemap_generator"

# config/sitemap.rb
SitemapGenerator::Sitemap.default_host = "https://yoursite.com"
SitemapGenerator::Sitemap.create do
  Doc.find_each do |doc|
    add doc_path(doc), lastmod: doc.updated_at
  end
end
```
```bash
rails sitemap:refresh
```

For static sites, use a sitemap generator:
```bash
npx sitemap-generator-cli https://yoursite.com --output public/sitemap.xml
```

Minimal valid sitemap:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://yoursite.com/</loc></url>
  <url><loc>https://yoursite.com/docs</loc></url>
</urlset>
```

**Verification:**
```bash
curl https://yoursite.com/sitemap.xml
```

---

### `discoverability/openapi-detect` (info, -1 pt)

**What it checks:** Probes common OpenAPI spec paths in order: `/openapi.json`, `/openapi.yaml`, `/swagger.json`, `/api-docs`, `/.well-known/openapi.json`. Stops on first success.

**Why it matters:** An OpenAPI spec lets AI agents understand your API structure, generate client code, and make correctly-formed requests without trial and error.

**How to fix:**

If you have an API, publish an OpenAPI spec at one of the standard paths. The most common is `/openapi.json`:

```json
{
  "openapi": "3.1.0",
  "info": {
    "title": "Acme API",
    "version": "1.0.0"
  },
  "paths": {
    "/api/widgets": {
      "get": {
        "summary": "List widgets",
        "responses": {
          "200": { "description": "Success" }
        }
      }
    }
  }
}
```

**Rails:** Use the `rswag` gem to generate an OpenAPI spec from your API tests:
```ruby
# Gemfile
gem "rswag-api"
gem "rswag-ui"
gem "rswag-specs"
```
```bash
rails generate rswag:install
# Write specs in spec/requests/, then generate:
rails rswag:specs:swaggerize
# Serves the spec at /api-docs by default
```

**If you don't have an API:** This rule is `info` severity — it won't significantly impact your score. No action needed.

**Verification:**
```bash
curl -I https://yoursite.com/openapi.json
# Should return 200 OK
```

---

### `discoverability/structured-data` (info, -1 pt)

**What it checks:** At least one page contains a `<script type="application/ld+json">` block (JSON-LD structured data).

**Why it matters:** JSON-LD helps AI agents understand what your content represents — is it an article? A product? An FAQ? This structured understanding improves how agents cite and reference your content.

**How to fix:**

Add JSON-LD to your pages. The most common types:

**For articles/docs:**
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "TechArticle",
  "headline": "Authentication Guide",
  "description": "How to authenticate with the Acme API",
  "datePublished": "2025-01-15",
  "author": { "@type": "Organization", "name": "Acme" }
}
</script>
```

**For software/APIs:**
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Acme API",
  "applicationCategory": "DeveloperApplication",
  "offers": { "@type": "Offer", "price": "0" }
}
</script>
```

**For FAQs:**
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [{
    "@type": "Question",
    "name": "How do I get an API key?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Sign up at dashboard.acme.com to get your API key."
    }
  }]
}
</script>
```

**Rails helper:**
```ruby
# app/helpers/structured_data_helper.rb
module StructuredDataHelper
  def json_ld(data)
    content_tag(:script, data.to_json.html_safe, type: "application/ld+json")
  end
end
```
```erb
<!-- app/views/layouts/application.html.erb -->
<head>
  <%= yield(:structured_data) %>
</head>

<!-- app/views/docs/show.html.erb -->
<% content_for :structured_data do %>
  <%= json_ld({
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "headline": @doc.title,
    "description": @doc.summary,
    "datePublished": @doc.published_at.iso8601
  }) %>
<% end %>
```

**Verification:**
```bash
curl -s https://yoursite.com/ | grep 'application/ld+json'
```

---

## Configuration Reference

All rules can be configured via `agent-lint.config.json` or `.agentlintrc.json`:

```json
{
  "maxDepth": 3,
  "maxPages": 30,
  "tokenThreshold": 4000,
  "ignorePatterns": ["/blog/*", "/changelog"],
  "rules": {
    "tokens/page-token-count": {
      "severity": "info",
      "ignorePaths": ["/docs/full-reference"]
    },
    "transport/accept-markdown": {
      "enabled": false
    }
  }
}
```

### Per-Rule Options
- `severity` — Override: `"error"`, `"warn"`, or `"info"`
- `enabled` — Disable a rule: `false`
- `ignorePaths` — Glob patterns for paths to skip: `["/blog/*", "/api/**"]`
