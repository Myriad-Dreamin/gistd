// @ts-ignore
import type { LazyFont } from "typst.ts-0.14/dist/esm/options.init.mjs";
import remoteFontInfo from "./fontInfo.json";
import { cssToFontInformation } from "./font-css";
import { googleFontsCssUrl } from "./font-spec";
import type { FontSpec, GoogleFontsSpec } from "./font-spec";

interface RemoteFontInfo {
  info: any[];
  conditions: { t: string; v: string }[];
  url: string;
}

interface GoogleFontsRepositoryEntry {
  name: string;
  type: string;
  download_url: string | null;
}

/**
 * Font cache
 */
interface FontCache<T = Uint8Array> {
  /**
   * Font data
   */
  data: T;
  /**
   * Font url
   */
  url: string;
  /**
   * Font ttl, random after 25~35 days to avoid threath of ttl expiration
   */
  ttl: number;
}

interface FontToLoad {
  conditionKey: string;
  url: string;
  dataFut: Promise<Uint8Array>;
  ttl: number;
}

function fontCacheKey(font: {
  conditions: { t: string; v: string }[];
  url: string;
}) {
  const conditionKey = font.conditions
    .map(({ t, v }) => `${t}:${v}`)
    .sort()
    .join(",");
  return conditionKey || `url:${font.url}`;
}

const promisifiedReq = <T>(req: IDBRequest<T>): Promise<T> => {
  return new Promise((resolve, reject) => {
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
  });
};

const refreshDate = () => {
  const DAY = 24 * 60 * 60 * 1000;
  return Date.now() + 25 * DAY + Math.random() * 10 * DAY;
};

/**
 * Loads a font by a lazy font synchronously, which is required by the compiler.
 * @param font
 */
export function loadFontSync(
  font: LazyFont & { url: string }
): (index: number) => Uint8Array {
  return () => {
    const xhr = new XMLHttpRequest();
    xhr.overrideMimeType("text/plain; charset=x-user-defined");
    xhr.open("GET", font.url, false);
    xhr.send(null);

    if (
      xhr.status === 200 &&
      (xhr.response instanceof String || typeof xhr.response === "string")
    ) {
      return Uint8Array.from(xhr.response, (c: string) => c.charCodeAt(0));
    }
    return new Uint8Array();
  };
}

export async function getFontProvider(fontSpecs: FontSpec[] = []) {
  const configuredFontInfo = await resolveConfiguredFontInfo(fontSpecs);
  try {
    return [...configuredFontInfo, ...(await getWithIDBFontProvider())];
  } catch (err) {
    console.error("error getting font provider with idb", err);
    return [...configuredFontInfo, ...defaultFontInfo()];
  }
}

export async function resolveConfiguredFontInfo(
  fontSpecs: FontSpec[],
  fetcher: typeof fetch = fetch
): Promise<RemoteFontInfo[]> {
  const fontInfo = await Promise.all(
    fontSpecs.map(async (spec) => {
      try {
        return await resolveFontSpec(spec, fetcher);
      } catch (err) {
        console.error("error resolving font provider", spec, err);
        return [];
      }
    })
  );
  return dedupeFontsByUrl(fontInfo.flat());
}

async function resolveFontSpec(
  spec: FontSpec,
  fetcher: typeof fetch
): Promise<RemoteFontInfo[]> {
  switch (spec.provider) {
    case "google-fonts":
      return resolveGoogleFonts(spec, fetcher);
  }
}

async function resolveGoogleFonts(
  spec: GoogleFontsSpec,
  fetcher: typeof fetch
): Promise<RemoteFontInfo[]> {
  try {
    // Browser Google Fonts CSS resolves to woff2 subsets that typst.ts cannot
    // currently turn into usable glyph output, so prefer repository TTF/OTF.
    const repositoryFontInfo = await resolveGoogleFontsRepository(
      spec,
      fetcher
    );
    if (repositoryFontInfo.length > 0) {
      return repositoryFontInfo;
    }
  } catch (err) {
    console.warn("error resolving Google Fonts repository font", spec, err);
  }

  const cssUrl = googleFontsCssUrl(spec.family);
  const response = await fetcher(cssUrl);
  if (!response.ok) {
    throw new Error(
      `failed to fetch Google Fonts CSS: ${response.status} ${response.statusText}`
    );
  }

  return cssToFontInformation(await response.text(), { baseUrl: cssUrl });
}

async function resolveGoogleFontsRepository(
  spec: GoogleFontsSpec,
  fetcher: typeof fetch
): Promise<RemoteFontInfo[]> {
  const family = googleFontsFamilyName(spec.family);
  const slug = googleFontsRepositorySlug(family);
  if (!slug) {
    return [];
  }

  const licenseDirs = ["ofl", "apache", "ufl"];
  for (const licenseDir of licenseDirs) {
    const entries = await fetchGoogleFontsRepositoryEntries(
      `${licenseDir}/${slug}`,
      fetcher
    );
    if (!entries) {
      continue;
    }

    const fontEntries = repositoryFontEntries(entries);
    if (fontEntries.length > 0) {
      return repositoryEntriesToFontInfo(family, spec.family, fontEntries);
    }

    const staticDir = entries.find(
      (entry) => entry.type === "dir" && entry.name === "static"
    );
    if (!staticDir) {
      continue;
    }

    const staticEntries = await fetchGoogleFontsRepositoryEntries(
      `${licenseDir}/${slug}/static`,
      fetcher
    );
    const staticFontEntries = staticEntries
      ? repositoryFontEntries(staticEntries)
      : [];
    if (staticFontEntries.length > 0) {
      return repositoryEntriesToFontInfo(
        family,
        spec.family,
        staticFontEntries
      );
    }
  }

  return [];
}

async function fetchGoogleFontsRepositoryEntries(
  path: string,
  fetcher: typeof fetch
): Promise<GoogleFontsRepositoryEntry[] | undefined> {
  const url = `https://api.github.com/repos/google/fonts/contents/${path}`;
  const response = await fetcher(url, {
    headers: {
      accept: "application/vnd.github+json",
    },
  });

  if (response.status === 404) {
    return undefined;
  }

  if (!response.ok) {
    throw new Error(
      `failed to fetch Google Fonts repository metadata: ${response.status} ${response.statusText}`
    );
  }

  const entries = await response.json();
  return Array.isArray(entries) ? entries : undefined;
}

function repositoryFontEntries(
  entries: GoogleFontsRepositoryEntry[]
): GoogleFontsRepositoryEntry[] {
  return entries.filter(
    (entry) =>
      entry.type === "file" &&
      Boolean(entry.download_url) &&
      /\.(?:otf|ttf)$/i.test(entry.name)
  );
}

function repositoryEntriesToFontInfo(
  family: string,
  familySpec: string,
  entries: GoogleFontsRepositoryEntry[]
): RemoteFontInfo[] {
  return entries.map((entry) => ({
    info: repositoryFontVariants(entry.name, familySpec).map((variant) => ({
      family,
      variant,
      flags: "",
      coverage: [0, 0x110000],
    })),
    conditions: [],
    url: entry.download_url!,
  }));
}

function googleFontsFamilyName(familySpec: string): string {
  return familySpec.split(":")[0].trim();
}

function googleFontsRepositorySlug(family: string): string {
  return family
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function repositoryFontVariants(name: string, familySpec: string) {
  const style = /italic/i.test(name) ? "italic" : "normal";
  const stretch = repositoryFontStretch(name);
  const weights = /\[[^\]]*\bwght\b[^\]]*\]/i.test(name)
    ? requestedGoogleFontsWeights(familySpec) ?? [repositoryFontWeight(name)]
    : [repositoryFontWeight(name)];

  return weights.map((weight) => ({
    style,
    weight,
    stretch,
  }));
}

function requestedGoogleFontsWeights(familySpec: string): number[] | undefined {
  const separator = familySpec.indexOf(":");
  if (separator < 0) {
    return undefined;
  }

  const axisSpec = familySpec.slice(separator + 1);
  const at = axisSpec.indexOf("@");
  if (at < 0) {
    return undefined;
  }

  const axes = axisSpec
    .slice(0, at)
    .split(",")
    .map((axis) => axis.trim());
  const weightIndex = axes.indexOf("wght");
  if (weightIndex < 0) {
    return undefined;
  }

  const weights = axisSpec
    .slice(at + 1)
    .split(";")
    .flatMap((tuple) => {
      const value = tuple.split(",")[weightIndex]?.trim();
      if (!value) {
        return [];
      }
      const range = /^(\d+)\.\.(\d+)$/.exec(value);
      if (range) {
        const start = Number.parseInt(range[1], 10);
        const end = Number.parseInt(range[2], 10);
        return commonFontWeights().filter(
          (weight) => start <= weight && weight <= end
        );
      }
      const weight = Number.parseInt(value, 10);
      return Number.isSafeInteger(weight) ? [weight] : [];
    });

  return weights.length > 0
    ? Array.from(new Set(weights)).sort((a, b) => a - b)
    : undefined;
}

function commonFontWeights(): number[] {
  return [100, 200, 300, 400, 500, 600, 700, 800, 900];
}

function repositoryFontWeight(name: string): number {
  if (/thin/i.test(name)) {
    return 100;
  }
  if (/(?:extra|ultra)[-_ ]?light/i.test(name)) {
    return 200;
  }
  if (/light/i.test(name)) {
    return 300;
  }
  if (/medium/i.test(name)) {
    return 500;
  }
  if (/(?:semi|demi)[-_ ]?bold/i.test(name)) {
    return 600;
  }
  if (/(?:extra|ultra)[-_ ]?bold/i.test(name)) {
    return 800;
  }
  if (/(?:black|heavy)/i.test(name)) {
    return 900;
  }
  if (/bold/i.test(name)) {
    return 700;
  }
  return 400;
}

function repositoryFontStretch(name: string): number {
  if (/semi[-_ ]?condensed/i.test(name)) {
    return 875;
  }
  if (/condensed/i.test(name)) {
    return 750;
  }
  if (/semi[-_ ]?expanded/i.test(name)) {
    return 1125;
  }
  if (/expanded/i.test(name)) {
    return 1250;
  }
  return 1000;
}

function dedupeFontsByUrl(fonts: RemoteFontInfo[]): RemoteFontInfo[] {
  return Array.from(new Map(fonts.map((font) => [font.url, font])).values());
}

function defaultFontInfo(): RemoteFontInfo[] {
  return remoteFontInfo as RemoteFontInfo[];
}

export async function getWithIDBFontProvider(
  fontInfo: RemoteFontInfo[] = defaultFontInfo()
) {
  // todo: move to upstream
  //   const loadFontSync = window.typstLoadFontSync;

  const req = indexedDB.open("gistd-font", 1);
  req.onupgradeneeded = (event) => {
    const db = (event.target as any).result;
    db.createObjectStore("fontCache");
    db.createObjectStore("fontCacheFull");
  };

  const idb = await promisifiedReq<IDBDatabase>(req);

  let fontCache: IDBObjectStore;
  let fontCacheFull: IDBObjectStore;

  const tx = idb.transaction(["fontCache", "fontCacheFull"], "readwrite");
  fontCache = tx.objectStore("fontCache");
  fontCacheFull = tx.objectStore("fontCacheFull");

  interface Stat {
    dataLen: number;
    fonts: [string, any][];
  }

  const add: Stat = {
    dataLen: 0,
    fonts: [],
  };
  const del: Stat = {
    dataLen: 0,
    fonts: [],
  };

  // for all fonts that is requested, we refresh the ttl
  // font rest fonts, if it exceeds ttl, we remove it
  const loadedFontFuts: Promise<Uint8Array>[] = [];
  const fontsToLoad: Record<string, FontToLoad> = {};
  for (const remoteFont of fontInfo) {
    const conditionKey = fontCacheKey(remoteFont);
    const obj = await promisifiedReq<FontCache>(
      fontCacheFull.get(conditionKey)
    );
    const ttl = refreshDate();
    if (obj) {
      obj.ttl = ttl;
      fontCache.put(obj, conditionKey);
      loadedFontFuts.push(Promise.resolve(obj.data));
    } else {
      const dataFut = fetch(remoteFont.url)
        .then((res) => res.arrayBuffer())
        .then((buffer) => new Uint8Array(buffer));
      fontsToLoad[conditionKey] ||= {
        conditionKey,
        url: remoteFont.url,
        dataFut,
        ttl,
      };
      loadedFontFuts.push(dataFut);
    }
  }

  const loadedFonts = await Promise.all(loadedFontFuts);

  const tx2 = idb.transaction(["fontCache", "fontCacheFull"], "readwrite");
  fontCache = tx2.objectStore("fontCache");
  fontCacheFull = tx2.objectStore("fontCacheFull");
  for (const { conditionKey, url, dataFut, ttl } of Object.values(
    fontsToLoad
  )) {
    const data = await dataFut;
    add.dataLen += data.length;
    add.fonts.push([url, conditionKey]);
    fontCache.put(
      {
        data: data.length,
        url,
        ttl,
      },
      conditionKey
    );
    fontCacheFull.put(
      {
        data: data,
        url,
        ttl,
      },
      conditionKey
    );
  }
  // delete all local fonts that is exceed ttl
  (async () => {
    const tx3 = idb.transaction(["fontCache", "fontCacheFull"], "readwrite");
    fontCache = tx3.objectStore("fontCache");
    fontCacheFull = tx3.objectStore("fontCacheFull");
    const cursor = fontCache.openCursor();
    const now = Date.now();
    cursor.onsuccess = async (event) => {
      const cursor: IDBCursorWithValue | null = (event.target as any)?.result;
      if (cursor) {
        const value: FontCache<number> = cursor?.value;
        if (value.ttl < now) {
          del.dataLen += value.data;
          del.fonts.push([value.url, cursor.key]);
          promisifiedReq(fontCacheFull.delete(cursor.key)).catch(console.error);
          promisifiedReq(fontCache.delete(cursor.key)).catch(console.error);
        }
        // cursor.value contains the current record being iterated through
        // this is where you'd do something with the result
        cursor.continue();
      } else {
        // no more results
        console.log("font cache stat:", add, del);
      }
    };
  })();

  return fontInfo.map((font, i) => ({
    blob: () => loadedFonts[i],
    ...font,
  }));
}
