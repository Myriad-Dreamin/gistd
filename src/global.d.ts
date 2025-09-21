interface Window {
  $typst: import("@myriaddreamin/typst.ts/contrib/snippet").TypstSnippet;
  $typst$script: any;
  $typst$createRenderer(): Promise<any>;
  initTypstSvg: any;
  handleTypstLocation: any;
  typstBindSemantics: any;
  typstBindSvgDom: any;
  captureStack: any;
}
