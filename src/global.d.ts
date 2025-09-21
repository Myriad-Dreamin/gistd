interface Window {
  $typst: import("@myriaddreamin/typst.ts/contrib/snippet").TypstSnippet;
  $typst$script: any;
  $typst$createRenderer(): Promise<any>;
  typstLoadFontSync(font: any): Uint8Array;
  initTypstSvg: any;
  handleTypstLocation: any;
  typstBindSemantics: any;
  typstBindSvgDom: any;
  captureStack: any;
}
