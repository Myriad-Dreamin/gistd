export interface FontCondition {
  t: "Sha256";
  v: string;
}

export interface FontVariantInfo {
  style: string;
  weight: number;
  stretch: number;
}

export interface FontFaceInfo {
  family: string;
  variant: FontVariantInfo;
  flags: string;
  coverage: number[];
}

export interface LazyFontInfo {
  info: FontFaceInfo[];
  conditions: FontCondition[];
  url: string;
}

export interface CssFontInformationOptions {
  baseUrl?: string | URL;
  flagsByFamily?: Record<string, string>;
  sha256ByUrl?: Record<string, string> | ((url: string) => string | undefined);
}

export interface CssFontFace {
  family: string;
  style: string;
  weight: number;
  stretch: number;
  url: string;
  coverage: number[];
}

type UnicodeRange = [start: number, end: number];

const CSS_MAX_CODEPOINT = 0x10ffff;

const FONT_STRETCH_KEYWORDS: Record<string, number> = {
  "ultra-condensed": 500,
  "extra-condensed": 625,
  condensed: 750,
  "semi-condensed": 875,
  normal: 1000,
  "semi-expanded": 1125,
  expanded: 1250,
  "extra-expanded": 1500,
  "ultra-expanded": 2000,
};

export function cssToFontInformation(
  css: string,
  options: CssFontInformationOptions = {}
): LazyFontInfo[] {
  return parseCssFontFaces(css, options).map((face) => {
    const sha256 = getSha256(face.url, options.sha256ByUrl);
    return {
      info: [
        {
          family: face.family,
          variant: {
            style: face.style,
            weight: face.weight,
            stretch: face.stretch,
          },
          flags: options.flagsByFamily?.[face.family] ?? "",
          coverage: face.coverage,
        },
      ],
      conditions: sha256 ? [{ t: "Sha256", v: sha256 }] : [],
      url: face.url,
    };
  });
}

export function parseCssFontFaces(
  css: string,
  options: Pick<CssFontInformationOptions, "baseUrl"> = {}
): CssFontFace[] {
  return extractFontFaceBlocks(stripCssComments(css)).flatMap((block) => {
    const declarations = parseDeclarations(block);
    const family = declarations.get("font-family");
    const src = declarations.get("src");

    if (!family || !src) {
      return [];
    }

    const url = parseSrcUrl(src, options.baseUrl);
    if (!url) {
      return [];
    }

    const unicodeRange = declarations.get("unicode-range");
    const ranges = unicodeRange
      ? parseUnicodeRangeList(unicodeRange)
      : ([[0, CSS_MAX_CODEPOINT]] satisfies UnicodeRange[]);

    return [
      {
        family: unquoteCssString(family),
        style: parseFontStyle(declarations.get("font-style")),
        weight: parseFontWeight(declarations.get("font-weight")),
        stretch: parseFontStretch(declarations.get("font-stretch")),
        url,
        coverage: rangesToCoverage(ranges),
      },
    ];
  });
}

export function parseUnicodeRangeList(value: string): UnicodeRange[] {
  const ranges = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map(parseUnicodeRange);

  return normalizeRanges(ranges);
}

export function rangesToCoverage(ranges: UnicodeRange[]): number[] {
  const coverage: number[] = [];
  let cursor = 0;

  for (const [start, end] of normalizeRanges(ranges)) {
    coverage.push(start - cursor, end - start + 1);
    cursor = end + 1;
  }

  return coverage;
}

function extractFontFaceBlocks(css: string): string[] {
  const blocks: string[] = [];
  const fontFacePattern = /@font-face\b/gi;

  for (;;) {
    const match = fontFacePattern.exec(css);
    if (!match) {
      return blocks;
    }

    const openBrace = css.indexOf("{", fontFacePattern.lastIndex);
    if (openBrace < 0) {
      return blocks;
    }

    const closeBrace = findMatchingBrace(css, openBrace);
    if (closeBrace < 0) {
      throw new Error("Unclosed @font-face block");
    }

    blocks.push(css.slice(openBrace + 1, closeBrace));
    fontFacePattern.lastIndex = closeBrace + 1;
  }
}

function stripCssComments(css: string): string {
  let result = "";
  let quote: string | undefined;

  for (let i = 0; i < css.length; i++) {
    const char = css[i];
    const next = css[i + 1];

    if (quote) {
      result += char;
      if (char === "\\") {
        result += next ?? "";
        i++;
      } else if (char === quote) {
        quote = undefined;
      }
      continue;
    }

    if (char === "\"" || char === "'") {
      quote = char;
      result += char;
      continue;
    }

    if (char === "/" && next === "*") {
      const end = css.indexOf("*/", i + 2);
      if (end < 0) {
        return result;
      }
      i = end + 1;
      continue;
    }

    result += char;
  }

  return result;
}

function findMatchingBrace(css: string, openBrace: number): number {
  let depth = 0;
  let quote: string | undefined;

  for (let i = openBrace; i < css.length; i++) {
    const char = css[i];

    if (quote) {
      if (char === "\\") {
        i++;
      } else if (char === quote) {
        quote = undefined;
      }
      continue;
    }

    if (char === "\"" || char === "'") {
      quote = char;
      continue;
    }

    if (char === "{") {
      depth++;
    } else if (char === "}") {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
  }

  return -1;
}

function parseDeclarations(block: string): Map<string, string> {
  const declarations = new Map<string, string>();

  for (const declaration of splitCssList(block, ";")) {
    const colon = indexOfCssToken(declaration, ":");
    if (colon < 0) {
      continue;
    }

    const property = declaration.slice(0, colon).trim().toLowerCase();
    const value = declaration.slice(colon + 1).trim();
    if (property && value) {
      declarations.set(property, value);
    }
  }

  return declarations;
}

function parseSrcUrl(src: string, baseUrl?: string | URL): string | undefined {
  const candidates = splitCssList(src, ",")
    .map((part) => ({
      value: part,
      url: parseUrlFunction(part),
      isWoff2: /format\(\s*["']?woff2["']?\s*\)/i.test(part),
    }))
    .filter((part): part is { value: string; url: string; isWoff2: boolean } =>
      Boolean(part.url)
    );

  const rawUrl =
    candidates.find((candidate) => candidate.isWoff2)?.url ?? candidates[0]?.url;
  if (!rawUrl) {
    return undefined;
  }

  return baseUrl ? new URL(rawUrl, baseUrl).toString() : rawUrl;
}

function parseUrlFunction(value: string): string | undefined {
  const urlMatch = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/i.exec(value);
  const rawUrl = urlMatch?.[1] ?? urlMatch?.[2] ?? urlMatch?.[3];
  return rawUrl?.trim();
}

function splitCssList(value: string, separator: string): string[] {
  const parts: string[] = [];
  let quote: string | undefined;
  let parenDepth = 0;
  let start = 0;

  for (let i = 0; i < value.length; i++) {
    const char = value[i];

    if (quote) {
      if (char === "\\") {
        i++;
      } else if (char === quote) {
        quote = undefined;
      }
      continue;
    }

    if (char === "\"" || char === "'") {
      quote = char;
      continue;
    }

    if (char === "(") {
      parenDepth++;
      continue;
    }

    if (char === ")") {
      parenDepth = Math.max(0, parenDepth - 1);
      continue;
    }

    if (char === separator && parenDepth === 0) {
      parts.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }

  parts.push(value.slice(start).trim());
  return parts.filter(Boolean);
}

function indexOfCssToken(value: string, token: string): number {
  let quote: string | undefined;
  let parenDepth = 0;

  for (let i = 0; i < value.length; i++) {
    const char = value[i];

    if (quote) {
      if (char === "\\") {
        i++;
      } else if (char === quote) {
        quote = undefined;
      }
      continue;
    }

    if (char === "\"" || char === "'") {
      quote = char;
      continue;
    }

    if (char === "(") {
      parenDepth++;
      continue;
    }

    if (char === ")") {
      parenDepth = Math.max(0, parenDepth - 1);
      continue;
    }

    if (char === token && parenDepth === 0) {
      return i;
    }
  }

  return -1;
}

function parseUnicodeRange(range: string): UnicodeRange {
  const match = /^u\+([0-9a-f?]+)(?:-([0-9a-f]+))?$/i.exec(
    range.replace(/\s+/g, "")
  );
  if (!match) {
    throw new Error(`Invalid unicode-range value: ${range}`);
  }

  const startRaw = match[1];
  const endRaw = match[2];
  const hasWildcard = startRaw.includes("?");

  if (hasWildcard && endRaw) {
    throw new Error(`Invalid wildcard unicode-range: ${range}`);
  }

  const start = Number.parseInt(startRaw.replace(/\?/g, "0"), 16);
  const end = Number.parseInt((endRaw ?? startRaw).replace(/\?/g, "f"), 16);

  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    end > CSS_MAX_CODEPOINT ||
    start > end
  ) {
    throw new Error(`Invalid unicode-range bounds: ${range}`);
  }

  return [start, end];
}

function normalizeRanges(ranges: UnicodeRange[]): UnicodeRange[] {
  const sorted = ranges
    .map(([start, end]) => [start, end] satisfies UnicodeRange)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const normalized: UnicodeRange[] = [];

  for (const [start, end] of sorted) {
    const previous = normalized[normalized.length - 1];
    if (previous && start <= previous[1] + 1) {
      previous[1] = Math.max(previous[1], end);
    } else {
      normalized.push([start, end]);
    }
  }

  return normalized;
}

function parseFontStyle(value: string | undefined): string {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return "normal";
  }

  return normalized.split(/\s+/)[0];
}

function parseFontWeight(value: string | undefined): number {
  return parseFontAxisNumber(value, {
    normal: 400,
    bold: 700,
  });
}

function parseFontStretch(value: string | undefined): number {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return FONT_STRETCH_KEYWORDS.normal;
  }

  if (normalized in FONT_STRETCH_KEYWORDS) {
    return FONT_STRETCH_KEYWORDS[normalized];
  }

  const percentages = normalized
    .split(/\s+/)
    .map((part) => {
      const match = /^(\d+(?:\.\d+)?)%$/.exec(part);
      return match ? Number.parseFloat(match[1]) * 10 : undefined;
    })
    .filter((part): part is number => part !== undefined);

  if (percentages.length === 0) {
    return FONT_STRETCH_KEYWORDS.normal;
  }

  return chooseAxisValue(percentages, FONT_STRETCH_KEYWORDS.normal);
}

function parseFontAxisNumber(
  value: string | undefined,
  keywords: Record<string, number>
): number {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return keywords.normal;
  }

  if (normalized in keywords) {
    return keywords[normalized];
  }

  const numbers = normalized
    .split(/\s+/)
    .map((part) => Number.parseInt(part, 10))
    .filter((part) => Number.isSafeInteger(part));

  if (numbers.length === 0) {
    return keywords.normal;
  }

  return chooseAxisValue(numbers, keywords.normal);
}

function chooseAxisValue(values: number[], normal: number): number {
  const [first, second] = values;
  if (second !== undefined && first <= normal && normal <= second) {
    return normal;
  }
  return first;
}

function unquoteCssString(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 2) {
    return trimmed;
  }

  const quote = trimmed[0];
  if ((quote !== "\"" && quote !== "'") || trimmed[trimmed.length - 1] !== quote) {
    return trimmed;
  }

  return decodeCssEscapes(trimmed.slice(1, -1));
}

function decodeCssEscapes(value: string): string {
  return value.replace(
    /\\([0-9a-f]{1,6}\s?|.)/gi,
    (_match, escape: string) => {
      const hex = /^[0-9a-f]/i.test(escape);
      if (!hex) {
        return escape;
      }

      const codePoint = Number.parseInt(escape.trim(), 16);
      if (!Number.isSafeInteger(codePoint)) {
        return "";
      }

      return String.fromCodePoint(codePoint);
    }
  );
}

function getSha256(
  url: string,
  sha256ByUrl: CssFontInformationOptions["sha256ByUrl"]
): string | undefined {
  if (!sha256ByUrl) {
    return undefined;
  }

  return typeof sha256ByUrl === "function" ? sha256ByUrl(url) : sha256ByUrl[url];
}
