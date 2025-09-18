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
 * [GitHub Origin](https://github.com/typst/templates/blob/main/charged-ieee/template/main.typ)
 * [GitHub Gistd](https://gistd.myriad-dreamin.com/typst/templates/blob/main/charged-ieee/template/main.typ)
 * ```typescript
 * const storage = storageSpecifierFromPath("typst/templates/blob/main/charged-ieee/template/main.typ");
 * ```
 *
 * @example
 * [Forgejo Origin](https://codeberg.org/typst/templates/src/unused/main/main.typ)
 * [Forgejo Gistd](https://gistd.myriad-dreamin.com/@any/codeberg.org/typst/templates/src/unused/main/main.typ)
 * ```typescript
 * const storage = storageSpecifierFromPath("@any/codeberg.org/typst/templates/src/unused/main/main.typ");
 * ```
 */

export type StorageSpec =
  | GitHubStorageSpec
  | ForgejoStorageSpec
  | HttpStorageSpec;

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

export interface HttpStorageSpec {
  type: "http";
  url: string;
  cors: boolean;
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
// const TEST_PATH = "typst/templates/blob/main/charged-ieee/template/main.typ";
// const TEST_PATH = "@any/github.com/Myriad-Dreamin/gistd/raw/main/README.typ";
const TEST_PATH = "@http/localhost:11449/localhost.typ";
const README: GitHubStorageSpec = {
  type: "github" as const,
  domain: "github.com",
  user: "Myriad-Dreamin",
  repo: "gistd",
  kind: "blob",
  ref: "main",
  rest: ["README.typ"],
  slug: "README.typ",
};

export function storageSpecFromUrl(): StorageSpecExt {
  const inputPath = window.location.pathname.slice(1) || "";

  const spec = storageSpecFromPath(
    isDev ? TEST_PATH : inputPath,
    window.location.search
  );

  switch (spec.type) {
    case "github":
      return new GitHubStorageSpecExt(spec);
    case "forgejo":
      return new ForgejoStorageSpecExt(spec);
    case "http":
      return new HttpStorageSpecExt(spec);
  }
}

export function storageSpecFromPath(
  inputPath: string,
  search?: string,
  helpSpec: StorageSpec = README
): StorageSpec {
  const [prefix, ...__] = inputPath.split("/");

  if (prefix === "@any" || prefix === "@http") {
    const [domain, ...segments] = inputPath.split("/").slice(1);

    if (domain === "github.com" && segments[2] !== "raw") {
      const [user, repo, kind, ref, ...rest] = segments;
      if (!ref) {
        return helpSpec;
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
      // todo: why we need to check segments[2]?
    } else if (domain === "codeberg.org" || segments[2] === "src") {
      const [user, repo, _src, _unused, ref, ...rest] = segments;
      if (!ref) {
        return helpSpec;
      }

      return {
        type: "forgejo",
        domain,
        user,
        repo,
        ref,
        rest,
        slug: rest.join("/"),
      };
    }

    const protocol = prefix === "@http" ? "http" : "https";
    const searchParams = new URLSearchParams(search || "");
    const cors =
      protocol == "https"
        ? searchParams.get("g-cors") !== "false"
        : searchParams.get("g-cors") === "true";
    searchParams.delete("g-cors");
    console.log(search, "cors", cors);

    const [_any2, ...rest2] = inputPath.split("/");
    const url = new URL(protocol + "://" + rest2.join("/"));
    url.search = search || "";

    return { type: "http", url: url.toString(), cors };
  } else {
    const [user, repo, kind, ref, ...rest] = inputPath.split("/");
    if (!ref) {
      return helpSpec;
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

export type StorageSpecExt =
  | GitHubStorageSpecExt
  | ForgejoStorageSpecExt
  | HttpStorageSpecExt;

export class GitHubStorageSpecExt {
  type = "github" as const;

  constructor(public spec: GitHubStorageSpec) {}

  mainFilePath() {
    return `/repo/${this.spec.slug}`;
  }

  originUrl() {
    return `${this.spec.domain}/${this.spec.user}/${this.spec.repo}/${this.spec.kind}/${this.spec.ref}/${this.spec.slug}`;
  }

  description() {
    return `GitHub: ${this.spec.user}/${this.spec.repo} ${this.fileName()}`;
  }

  fileName() {
    return this.spec.rest.length > 0
      ? this.spec.rest[this.spec.rest.length - 1]
      : "main.typ";
  }
}

export class ForgejoStorageSpecExt {
  type = "forgejo" as const;

  constructor(public spec: ForgejoStorageSpec) {}

  mainFilePath() {
    return `/repo/${this.spec.slug}`;
  }

  originUrl() {
    return `${this.spec.domain}/${this.spec.user}/${this.spec.repo}/src/${this.spec.ref}/${this.spec.slug}`;
  }

  description() {
    return `Forgejo: ${this.spec.user}/${this.spec.repo} ${this.fileName()}`;
  }

  fileName() {
    return this.spec.rest.length > 0
      ? this.spec.rest[this.spec.rest.length - 1]
      : "main.typ";
  }
}

export class HttpStorageSpecExt {
  type = "http" as const;

  constructor(public spec: HttpStorageSpec) {}

  mainFilePath() {
    return `/${this.fileName()}`;
  }

  originUrl() {
    return this.spec.url;
  }

  fetchUrl() {
    console.log("fetchUrl", this.spec.cors, this.spec.url);
    return this.spec.cors
      ? `https://underleaf.mgt.workers.dev/?${this.spec.url}`
      : this.spec.url;
  }

  description() {
    return `Http: ${new URL(this.spec.url).host} ${this.fileName()}`;
  }

  fileName() {
    return this.spec.url.split("/").pop() || "main.typ";
  }
}
