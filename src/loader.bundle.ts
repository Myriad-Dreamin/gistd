import { argsFromUrl } from "./args";
import {
  resolveTypstVersion,
  TypstRuntimeId,
  TypstVersionConfig,
} from "./typst-version";
// @ts-ignore
import renderer013 from "typst-ts-renderer-0.13/wasm?url";
// @ts-ignore
import compiler013 from "typst-ts-compiler-0.13/wasm?url";
// @ts-ignore
import renderer014 from "typst-ts-renderer-0.14/wasm?url";
// @ts-ignore
import compiler014 from "typst-ts-compiler-0.14/wasm?url";
// @ts-ignore
import renderer0141 from "typst-ts-renderer-0.14.1/wasm?url";
// @ts-ignore
import compiler0141 from "typst-ts-compiler-0.14.1/wasm?url";
// @ts-ignore
import renderer0142 from "typst-ts-renderer-0.14.2/wasm?url";
// @ts-ignore
import compiler0142 from "typst-ts-compiler-0.14.2/wasm?url";
// @ts-ignore
import renderer015 from "typst-ts-renderer-0.15.0/wasm?url";
// @ts-ignore
import compiler015 from "typst-ts-compiler-0.15.0/wasm?url";

const WASM_CACHE = "gistd-wasm";
const WASM_URLS = [
  compiler013,
  renderer013,
  compiler014,
  renderer014,
  compiler0141,
  renderer0141,
  compiler0142,
  renderer0142,
  compiler015,
  renderer015,
].map((url: string) => new URL(url, location.href).href);

/// Wasm asset names are content-hashed, so a URL's bytes never change: keep
/// them in Cache Storage forever instead of trusting the host's HTTP cache
/// (GitHub Pages: max-age=600 and a new etag on every deploy).
async function fetchImmutable(url: string): Promise<Response> {
  let cache: Cache;
  try {
    cache = await caches.open(WASM_CACHE);
    const hit = await cache.match(url);
    if (hit) return hit;
  } catch (e) {
    console.warn("wasm cache unavailable", e);
    return fetch(url);
  }
  const res = await fetch(url);
  if (!res.ok) return res;
  // Buffer, then store: streaming a 30 MB response into `cache.put` fails in
  // Chrome with "Cache.put() encountered a network error".
  const body = await res.arrayBuffer();
  const init = { headers: { "content-type": "application/wasm" } };
  cache
    .put(url, new Response(body.slice(0), init))
    .catch((e) => console.warn("wasm cache put", e));
  return new Response(body, init);
}

/// Drops cached wasm from older deploys.
async function gcWasmCache() {
  const cache = await caches.open(WASM_CACHE);
  for (const req of await cache.keys()) {
    if (!WASM_URLS.includes(req.url)) await cache.delete(req);
  }
}

const getRuntimeConfig = async (runtime: TypstRuntimeId) => {
  switch (runtime) {
    case "0.13": {
      const ts = import("typst.ts-0.13");
      const optionInit = import("typst.ts-0.13/options.init");
      const compilerWrapper = import("typst-ts-compiler-0.13");
      const rendererWrapper = import("typst-ts-renderer-0.13");
      const compilerModule = fetchImmutable(compiler013);
      const rendererModule = fetchImmutable(renderer013);

      return {
        $typst: (await ts).$typst,
        disableDefaultFontAssets: (await optionInit).disableDefaultFontAssets,
        renderer_build_info: (await rendererWrapper).renderer_build_info,
        compilerWrapper,
        rendererWrapper,
        compilerModule,
        rendererModule,
      };
    }
    case "0.14.0": {
      const ts = import("typst.ts-0.14.1");
      const optionInit = import("typst.ts-0.14.1/options.init");
      const compilerWrapper = import("typst-ts-compiler-0.14");
      const rendererWrapper = import("typst-ts-renderer-0.14");
      const compilerModule = fetchImmutable(compiler014);
      const rendererModule = fetchImmutable(renderer014);

      return {
        $typst: (await ts).$typst,
        disableDefaultFontAssets: (await optionInit).disableDefaultFontAssets,
        renderer_build_info: (await rendererWrapper).renderer_build_info,
        compilerWrapper,
        rendererWrapper,
        compilerModule,
        rendererModule,
      };
    }
    case "0.14.1": {
      const ts = import("typst.ts-0.14.1");
      const optionInit = import("typst.ts-0.14.1/options.init");
      const compilerWrapper = import("typst-ts-compiler-0.14.1");
      const rendererWrapper = import("typst-ts-renderer-0.14.1");
      const compilerModule = fetchImmutable(compiler0141);
      const rendererModule = fetchImmutable(renderer0141);

      return {
        $typst: (await ts).$typst,
        disableDefaultFontAssets: (await optionInit).disableDefaultFontAssets,
        renderer_build_info: (await rendererWrapper).renderer_build_info,
        compilerWrapper,
        rendererWrapper,
        compilerModule,
        rendererModule,
      };
    }
    case "0.14.2": {
      const ts = import("typst.ts-0.14.2");
      const optionInit = import("typst.ts-0.14.2/options.init");
      const compilerWrapper = import("typst-ts-compiler-0.14.2");
      const rendererWrapper = import("typst-ts-renderer-0.14.2");
      const compilerModule = fetchImmutable(compiler0142);
      const rendererModule = fetchImmutable(renderer0142);

      return {
        $typst: (await ts).$typst,
        disableDefaultFontAssets: (await optionInit).disableDefaultFontAssets,
        renderer_build_info: (await rendererWrapper).renderer_build_info,
        compilerWrapper,
        rendererWrapper,
        compilerModule,
        rendererModule,
      };
    }
    case "0.15.0": {
      const ts = import("typst.ts-0.15.0");
      const optionInit = import("typst.ts-0.15.0/options.init");
      const compilerWrapper = import("typst-ts-compiler-0.15.0");
      const rendererWrapper = import("typst-ts-renderer-0.15.0");
      const compilerModule = fetchImmutable(compiler015);
      const rendererModule = fetchImmutable(renderer015);

      return {
        $typst: (await ts).$typst,
        disableDefaultFontAssets: (await optionInit).disableDefaultFontAssets,
        renderer_build_info: (await rendererWrapper).renderer_build_info,
        compilerWrapper,
        rendererWrapper,
        compilerModule,
        rendererModule,
      };
    }

    default: {
      throw new Error(`invalid runtime: ${runtime}`);
    }
  }
};

(() => {
  const args = argsFromUrl();
  window.$typst$script = new Promise((resolve, reject) => {
    (async () => {
      const versionConfig: TypstVersionConfig = resolveTypstVersion(
        args.version
      );
      const tsConfig = await getRuntimeConfig(versionConfig.runtime);
      // todo: remove me
      // @ts-ignore
      window.$typst = tsConfig.$typst;
      window.$typstVersion = versionConfig;
      const $typst = window.$typst;
      $typst.setCompilerInitOptions({
        beforeBuild: [tsConfig.disableDefaultFontAssets()],
        getWrapper: () => tsConfig.compilerWrapper,
        getModule: () => tsConfig.compilerModule,
      });
      $typst.setRendererInitOptions({
        getWrapper: () => tsConfig.rendererWrapper,
        getModule: () => tsConfig.rendererModule,
      });
      $typst.getRenderer().then(() => {
        console.log("renderer:", tsConfig.renderer_build_info());
      });
      gcWasmCache().catch((e) => console.warn("wasm cache gc", e));
      resolve(undefined);
    })().catch(reject);
  });
  window.typstBindSemantics = function () {};
  window.typstBindSvgDom = function () {};
  window.captureStack = function () {
    return undefined;
  };
})();
