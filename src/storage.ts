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

type CorsOption = string | boolean;

export interface GitHubStorageSpec {
  type: "github";
  protocol: string;
  domain: string;
  user: string;
  repo: string;
  kind: string;
  ref: string;
  rest: string[];
  slug: string;
  cors: CorsOption;
}

export interface HttpStorageSpec {
  type: "http";
  url: string;
  cors: CorsOption;
}

export interface ForgejoStorageSpec {
  type: "forgejo";
  protocol: string;
  domain: string;
  user: string;
  repo: string;
  ref: string;
  rest: string[];
  slug: string;
  cors: CorsOption;
}

export const README: GitHubStorageSpec = {
  type: "github" as const,
  protocol: "https",
  domain: "github.com",
  user: "Myriad-Dreamin",
  repo: "gistd",
  kind: "blob",
  ref: "main",
  rest: ["README.typ"],
  slug: "README.typ",
  cors: true,
};

export const README_CN: GitHubStorageSpec = {
  type: "github" as const,
  protocol: "https",
  domain: "github.com",
  user: "Myriad-Dreamin",
  repo: "gistd",
  kind: "blob",
  ref: "main",
  rest: ["docs/README.zh-CN.typ"],
  slug: "docs/README.zh-CN.typ",
  cors: true,
};

export function createStorageSpecExt(spec: StorageSpec): StorageSpecExt {
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
  searchParams?: URLSearchParams,
  helpSpec: StorageSpec = README
): StorageSpec {
  const [prefix, ...__] = inputPath.split("/");
  const originCors = searchParams?.get?.("g-cors");
  const getCors = (protocol: string) => {
    if (originCors && originCors !== "false" && originCors !== "true") {
      return originCors;
    }

    return protocol == "https" ? originCors !== "false" : originCors === "true";
  };
  searchParams?.delete?.("g-cors");

  if (prefix === "@any" || prefix === "@http") {
    const [domain, ...segments] = inputPath.split("/").slice(1);
    const protocol =
      prefix === "@http"
        ? "http"
        : /^(?:(localhost|127\.\d+\.\d+\.\d+)(?:$|:))/.test(domain)
        ? "http"
        : "https";

    if (domain === "github.com" && segments[2] !== "raw") {
      const [user, repo, kind, ref, ...rest] = segments;
      if (!ref) {
        return helpSpec;
      }
      return {
        type: "github",
        protocol: "https",
        domain: "github.com",
        user,
        repo,
        kind,
        ref,
        rest,
        slug: rest.join("/"),
        cors: getCors("https"),
      };
      // todo: why we need to check segments[2]?
    } else if (domain === "codeberg.org" || segments[2] === "src") {
      const [user, repo, _src, _unused, ref, ...rest] = segments;
      if (!ref) {
        return helpSpec;
      }

      return {
        type: "forgejo",
        protocol,
        domain,
        user,
        repo,
        ref,
        rest,
        slug: rest.join("/"),
        cors: getCors(protocol),
      };
    }

    const [_any2, ...rest2] = inputPath.split("/");
    const url = new URL(protocol + "://" + rest2.join("/"));
    url.search = searchParams?.toString?.() || "";

    return { type: "http", url: url.toString(), cors: getCors(protocol) };
  } else {
    const [user, repo, kind, ref, ...rest] = inputPath.split("/");
    if (!ref) {
      return helpSpec;
    }
    return {
      type: "github",
      protocol: "https",
      domain: "github.com",
      user,
      repo,
      kind,
      ref,
      rest,
      slug: rest.join("/"),
      cors: getCors("https"),
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
    return `/${this.spec.slug}`;
  }

  originUrl() {
    return `${this.spec.protocol}://${this.spec.domain}/${this.spec.user}/${this.spec.repo}/${this.spec.kind}/${this.spec.ref}/${this.spec.slug}`;
  }

  remoteUrl() {
    return `${this.spec.protocol}://${this.spec.domain}/${this.spec.user}/${this.spec.repo}`;
  }

  corsUrl(url: string) {
    return corsUrl(url, this.spec.cors);
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
    return `/${this.spec.slug}`;
  }

  originUrl() {
    return `${this.spec.protocol}://${this.spec.domain}/${this.spec.user}/${this.spec.repo}/src/${this.spec.ref}/${this.spec.slug}`;
  }

  remoteUrl() {
    return `${this.spec.protocol}://${this.spec.domain}/${this.spec.user}/${this.spec.repo}`;
  }

  corsUrl(url: string) {
    return corsUrl(url, this.spec.cors);
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
    // console.log("fetchUrl", this.spec.cors, this.spec.url);
    return corsUrl(this.spec.url, this.spec.cors);
  }

  description() {
    return `Http: ${new URL(this.spec.url).host} ${this.fileName()}`;
  }

  fileName() {
    return this.spec.url.split("/").pop() || "main.typ";
  }
}

export function corsUrl(url: string, cors: CorsOption) {
  if (cors === true) {
    return `https://underleaf.mgt.workers.dev/?${url}`;
  } else if (cors === false) {
    return url;
  } else {
    // See: scripts/test-forgejo.yml
    return `${cors}/${url.replace(/^https?:\/\//, "")}`;
  }
}
