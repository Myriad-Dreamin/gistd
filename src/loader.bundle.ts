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

const getRuntimeConfig = async (runtime: TypstRuntimeId) => {
  switch (runtime) {
    case "0.13": {
      const ts = import("typst.ts-0.13");
      const optionInit = import("typst.ts-0.13/options.init");
      const compilerWrapper = import("typst-ts-compiler-0.13");
      const rendererWrapper = import("typst-ts-renderer-0.13");
      const compilerModule = fetch(compiler013);
      const rendererModule = fetch(renderer013);

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
      const compilerModule = fetch(compiler014);
      const rendererModule = fetch(renderer014);

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
      const compilerModule = fetch(compiler0141);
      const rendererModule = fetch(renderer0141);

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
      const compilerModule = fetch(compiler0142);
      const rendererModule = fetch(renderer0142);

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
      const compilerModule = fetch(compiler015);
      const rendererModule = fetch(renderer015);

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
      const versionConfig: TypstVersionConfig = resolveTypstVersion(args.version);
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
      resolve(undefined);
    })().catch(reject);
  });
  window.typstBindSemantics = function () {};
  window.typstBindSvgDom = function () {};
  window.captureStack = function () {
    return undefined;
  };
})();
