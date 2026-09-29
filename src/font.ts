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
export function loadFontSync(font: {
  url: string;
}): (index: number) => Uint8Array {
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

  // Cached fonts are read from IndexedDB up front (local, fast). Uncached
  // fonts that are likely needed (core defaults + fonts documents used before)
  // are prefetched in parallel; the rest are fetched only when the compiler
  // first asks for them: it calls `blob()` lazily and synchronously, so those
  // misses use a sync XHR. Everything fetched is persisted for next time.
  const cachedData: (Uint8Array | undefined)[] = [];
  for (const remoteFont of fontInfo) {
    const conditionKey = fontCacheKey(remoteFont);
    const obj = await promisifiedReq<FontCache>(
      fontCacheFull.get(conditionKey)
    );
    if (obj) {
      // Refresh the ttl on the small metadata record; gc only reads that one.
      fontCache.put(
        { data: obj.data.length, url: obj.url, ttl: refreshDate() },
        conditionKey
      );
    }
    cachedData.push(obj?.data);
  }

  const persist = (conditionKey: string, url: string, data: Uint8Array) => {
    const ttl = refreshDate();
    const tx2 = idb.transaction(["fontCache", "fontCacheFull"], "readwrite");
    tx2
      .objectStore("fontCache")
      .put({ data: data.length, url, ttl }, conditionKey);
    tx2.objectStore("fontCacheFull").put({ data, url, ttl }, conditionKey);
    add.dataLen += data.length;
    add.fonts.push([url, conditionKey]);
  };

  const usedFonts = readUsedFonts();
  await Promise.all(
    fontInfo.map(async (font, i) => {
      const likelyNeeded =
        usedFonts.has(font.url) ||
        CORE_FONTS.some((name) => font.url.endsWith(`/${name}`));
      if (cachedData[i] || !likelyNeeded) return;
      try {
        const res = await fetch(font.url);
        if (!res.ok) return;
        const data = new Uint8Array(await res.arrayBuffer());
        cachedData[i] = data;
        persist(fontCacheKey(font), font.url, data);
      } catch (e) {
        console.warn("font prefetch failed, will load on demand", font.url, e);
      }
    })
  );

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

  return fontInfo.map((font, i) => {
    let data = cachedData[i];
    return {
      ...font,
      blob: () => {
        if (!usedFonts.has(font.url)) {
          usedFonts.add(font.url);
          localStorage.setItem(USED_FONTS_KEY, JSON.stringify([...usedFonts]));
        }
        if (!data) {
          console.log("loading font on demand:", font.url);
          data = loadFontSync(font)(0);
          if (data.length > 0) persist(fontCacheKey(font), font.url, data);
        }
        return data;
      },
    };
  });
}

/// Fonts nearly every document needs (Typst defaults for text, math, raw).
const CORE_FONTS = [
  "LibertinusSerif-Regular.otf",
  "LibertinusSerif-Bold.otf",
  "LibertinusSerif-Italic.otf",
  "NewCMMath-Book.otf",
  "DejaVuSansMono.ttf",
];

/// URLs of fonts the compiler has requested before on this device.
const USED_FONTS_KEY = "gistd-font-used";

function readUsedFonts(): Set<string> {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(USED_FONTS_KEY) || "[]"
    );
    return new Set(
      Array.isArray(parsed) ? parsed.filter((u) => typeof u === "string") : []
    );
  } catch {
    return new Set();
  }
}
