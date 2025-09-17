/**
 * @fileoverview Storage specifier
 * Get storage specifier from url or path.
 *
 * @example
 * From URL
 * ```typescript
 * const storage = storageSpecifierFromUrl();
 * console.log(storage);
 * ```
 *
 * @example
 * [GitHub](https://github.com/typst/templates/blob/main/charged-ieee/template/main.typ)
 * ```typescript
 * const storage = storageSpecifierFromPath("typst/templates/blob/main/charged-ieee/template/main.typ");
 * ```
 *
 * @example
 * [Forgejo](https://codeberg.org/typst/templates/src/unused/main/main.typ)
 * ```typescript
 * const storage = storageSpecifierFromPath("@any/codeberg.org/typst/templates/src/unused/main/main.typ");
 * ```
 */

export type StorageSpec = GitHubStorageSpec | ForgejoStorageSpec;

export interface GitHubStorageSpec {
  type: "github";
  domain: string;
  user: string;
  repo: string;
  kind: string;
  ref: string;
  rest: string[];
  slug: string;
}

export interface ForgejoStorageSpec {
  type: "forgejo";
  domain: string;
  user: string;
  repo: string;
  ref: string;
  rest: string[];
  slug: string;
}

// @ts-ignore
const isDev = false; // import.meta.env !== undefined;

const README: GitHubStorageSpec = {
  type: "github" as const,
  domain: "https://github.com",
  user: "Myriad-Dreamin",
  repo: "gistd",
  kind: "blob",
  ref: "main",
  rest: ["README.typ"],
  slug: "README.typ",
};

export function storageSpecFromUrl(): StorageSpec {
  const inputPath = window.location.pathname.slice(1) || "";
  return storageSpecFromPath(inputPath);
}

export function storageSpecFromPath(inputPath: string): StorageSpec {
  /// For development
  if (isDev) {
    console.log("isDev");
    const rest = ["charged-ieee", "template", "main.typ"];
    return {
      type: "github" as const,
      domain: "github.com",
      user: "typst",
      repo: "templates",
      kind: "blob",
      ref: "main",
      rest,
      slug: rest.join("/"),
    };
  }

  if (inputPath.startsWith("@any/")) {
    const [_any, domain, user, repo, src, _unused, ref, ...rest] =
      inputPath.split("/");

    if (!ref) {
      return README;
    }

    const base = { domain, user, repo, ref, rest, slug: rest.join("/") };
    // todo: why we need to check it?
    if (src == "src") {
      return { type: "forgejo", ...base };
    }
    // todo: simple URL
    return { type: "github", kind: "blob", ...base };
  } else {
    const [user, repo, kind, ref, ...rest] = inputPath.split("/");
    if (!ref) {
      return README;
    }
    return {
      type: "github",
      domain: "github.com",
      user,
      repo,
      kind,
      ref,
      rest,
      slug: rest.join("/"),
    };
  }
}
