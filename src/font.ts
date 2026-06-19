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
  const cssUrl = googleFontsCssUrl(spec.family);
  const response = await fetcher(cssUrl);
  if (!response.ok) {
    throw new Error(
      `failed to fetch Google Fonts CSS: ${response.status} ${response.statusText}`
    );
  }

  return cssToFontInformation(await response.text(), { baseUrl: cssUrl });
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
