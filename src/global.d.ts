interface Window {
  $typst: import("@myriaddreamin/typst.ts/contrib/snippet").TypstSnippet;
  $typst$script: any;
  $typst$createRenderer(): Promise<any>;
  $typstVersion: import("./typst-version").TypstVersionConfig;
  typstLoadFontSync(font: any): Uint8Array;
  initTypstSvg: any;
  handleTypstLocation: any;
  typstBindSemantics: any;
  typstBindSvgDom: any;
  captureStack: any;
}
