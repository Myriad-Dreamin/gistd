import { $typst } from "@myriaddreamin/typst.ts";
import { disableDefaultFontAssets } from "@myriaddreamin/typst.ts/options.init";
import { renderer_build_info } from "@myriaddreamin/typst-ts-renderer";
// @ts-ignore
import renderer from "@myriaddreamin/typst-ts-renderer/wasm?url";
// @ts-ignore
import compiler from "@myriaddreamin/typst-ts-web-compiler/wasm?url";

(() => {
  const tsConfig = {
    compilerModule: fetch(compiler),
    rendererModule: fetch(renderer),
  };
  // todo: remove me
  // @ts-ignore
  window.$typst = $typst;
  window.$typst$script = new Promise(async (resolve) => {
    const $typst = window.$typst;
    $typst.setCompilerInitOptions({
      beforeBuild: [disableDefaultFontAssets()],
      getModule: () => tsConfig.compilerModule,
    });
    $typst.setRendererInitOptions({ getModule: () => tsConfig.rendererModule });
    $typst.getRenderer().then(() => {
      console.log("renderer:", renderer_build_info());
    });
    resolve(undefined);
  });
  window.typstBindSemantics = function () {};
  window.typstBindSvgDom = function () {};
  window.captureStack = function () {
    return undefined;
  };
})();
