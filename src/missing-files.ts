export interface Diagnostic {
  path: string;
  range: string;
  message: string;
}

/**
 * Collects the project-absolute paths of files a compilation failed to load.
 *
 * Typst reports either `file not found (searched at /x.typ)`, or, for paths
 * the shadow file system doesn't have, `failed to load file (access denied)`
 * with a range (`line:col-line:col`, 0-based) covering the path literal in the
 * source, e.g. `"/lib.typ"` in `#import "/lib.typ"`.
 */
export function missingFilePaths(
  diagnostics: Diagnostic[],
  readSource: (path: string) => Uint8Array | undefined
): string[] {
  const paths: string[] = [];
  for (const { path, range, message } of diagnostics) {
    const searched = /file not found \(searched at ([^)]+)\)/.exec(message);
    if (searched) {
      paths.push(resolvePath("/", searched[1]));
      continue;
    }
    if (!/failed to load file|file not found/.test(message)) continue;

    const span = /^(\d+):(\d+)-(\d+):(\d+)$/.exec(range);
    const source = readSource(path);
    if (!span || !source) continue;
    const [startLine, startCol, endLine, endCol] = span.slice(1).map(Number);
    if (startLine !== endLine) continue;

    const line = new TextDecoder().decode(source).split("\n")[startLine];
    const literal = line?.slice(startCol, endCol).trim();
    const target = literal && /^"([^"]+)"$/.exec(literal)?.[1];
    if (target) {
      paths.push(resolvePath(path.slice(0, path.lastIndexOf("/") + 1), target));
    }
  }
  return paths;
}

/** Resolves `target` against the project-absolute directory `dir`. */
export function resolvePath(dir: string, target: string): string {
  const parts: string[] = [];
  const joined = target.startsWith("/") ? target : `${dir}/${target}`;
  for (const segment of joined.split("/")) {
    if (segment === "..") parts.pop();
    else if (segment && segment !== ".") parts.push(segment);
  }
  return "/" + parts.join("/");
}
