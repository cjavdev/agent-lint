/**
 * Glob matching for URL pathnames.
 * Supports `*` (single segment) and `**` (multi-segment).
 */

function globToRegex(pattern: string): RegExp {
  // Normalize: ensure leading slash
  if (!pattern.startsWith("/")) {
    pattern = "/" + pattern;
  }

  // Split the pattern into segments and build regex piece by piece
  const segments = pattern.split("/");
  const parts: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg === "**") {
      // ** matches zero or more path segments
      // Look ahead: if there are more segments after, ** can match empty
      if (i === segments.length - 1) {
        // trailing ** — matches one or more remaining path segments
        parts.push("/.*");
      } else {
        // middle ** — matches zero or more intermediate segments
        parts.push("(?:/.+)?");
      }
    } else {
      // Escape regex special chars, then replace * with single-segment wildcard
      const escaped = seg
        .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, "[^/]*");
      parts.push("/" + escaped);
    }
  }

  // Remove leading empty segment (from leading /)
  let regex = parts.join("");
  if (regex.startsWith("//")) {
    regex = regex.slice(1);
  }

  return new RegExp("^" + regex + "$");
}

export function matchPath(pathname: string, pattern: string): boolean {
  const re = globToRegex(pattern);
  return re.test(pathname);
}

export function isPathIgnored(
  url: string | undefined,
  patterns: string[]
): boolean {
  if (!url || patterns.length === 0) return false;

  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return false;
  }

  return patterns.some((p) => matchPath(pathname, p));
}
