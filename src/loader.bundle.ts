import { argsFromUrl } from "./args";
// @ts-ignore
import renderer013 from "typst-ts-renderer-0.13/wasm?url";
// @ts-ignore
import compiler013 from "typst-ts-compiler-0.13/wasm?url";
// @ts-ignore
import renderer014 from "typst-ts-renderer-0.14/wasm?url";
// @ts-ignore
import compiler014 from "typst-ts-compiler-0.14/wasm?url";

const getConfig = async (v: string) => {
  switch (v) {
    case "v0.13.0": {
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
    case "v0.14.0":
    case "latest":
    case undefined: {
      const ts = import("typst.ts-0.14");
      const optionInit = import("typst.ts-0.14/options.init");
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

    default: {
      throw new Error(
        `invalid version: ${v}, expected "v0.13.0", "v0.14.0", or "latest"`
      );
    }
  }
};

(() => {
  const args = argsFromUrl();
  window.$typst$script = new Promise(async (resolve) => {
    const tsConfig = await getConfig(args.version);
    // todo: remove me
    // @ts-ignore
    window.$typst = tsConfig.$typst;
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
  });
  window.typstBindSemantics = function () {};
  window.typstBindSvgDom = function () {};
  window.captureStack = function () {
    return undefined;
  };
})();
