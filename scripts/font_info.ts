// todo: remove me
// @ts-ignore
import { createTypstFontBuilder } from "@myriaddreamin/typst.ts/compiler";
// todo: remove me
// @ts-ignore
import type { TypstFontInfo } from "@myriaddreamin/typst.ts/compiler";
import fs from "fs/promises";
import { existsSync } from "fs";

await fs.mkdir("dist", { recursive: true });
if (existsSync(".data/fontInfo.json")) {
  await fs.copyFile(".data/fontInfo.json", "dist/fontInfo.json");
  //todo: remove me
  await fs.copyFile(".data/fontInfo.json", "src/fontInfo.json");
  process.exit(0);
}

const builder = createTypstFontBuilder();
await builder.init();

/** @internal */
const _textFonts: string[] = [
  "LibertinusSerif-Bold.otf",
  "LibertinusSerif-BoldItalic.otf",
  "LibertinusSerif-Italic.otf",
  "LibertinusSerif-Regular.otf",
  "LibertinusSerif-Semibold.otf",
  "LibertinusSerif-SemiboldItalic.otf",
  "NewCM10-Bold.otf",
  "NewCM10-BoldItalic.otf",
  "NewCM10-Italic.otf",
  "NewCM10-Regular.otf",
  "NewCMMath-Bold.otf",
  "NewCMMath-Book.otf",
  "NewCMMath-Regular.otf",
  "DejaVuSansMono-Bold.ttf",
  "DejaVuSansMono-BoldOblique.ttf",
  "DejaVuSansMono-Oblique.ttf",
  "DejaVuSansMono.ttf",
];
/** @internal */
const _cjkFonts: string[] = [
  "InriaSerif-Bold.ttf",
  "InriaSerif-BoldItalic.ttf",
  "InriaSerif-Italic.ttf",
  "InriaSerif-Regular.ttf",
  "Roboto-Regular.ttf",
  "NotoSerifCJKsc-Regular.otf",
];
/** @internal */
const _emojiFonts: string[] = [
  "TwitterColorEmoji.ttf",
  "NotoColorEmoji-Regular-COLR.subset.ttf",
];

const fonts = [
  {
    kind: "text",
    value: _textFonts,
  },
  {
    kind: "cjk",
    value: _cjkFonts,
  },
  {
    kind: "emoji",
    value: _emojiFonts,
  },
];

let defaultPrefix: Record<string, string> = {
  text: "https://cdn.jsdelivr.net/gh/typst/typst-assets@v0.13.1/files/fonts/",
  _: "https://cdn.jsdelivr.net/gh/typst/typst-dev-assets@v0.13.1/files/fonts/",
};

const infos = (
  await Promise.all(
    Object.values(fonts).map(({ kind, value }) =>
      Promise.all(
        value.map(async (fileName) => {
          const url = `${
            defaultPrefix[kind === "text" ? "text" : "_"]
          }${fileName}`;
          console.log(url);
          const data = await fetch(new URL(url).toString()).then((res) =>
            res.arrayBuffer()
          );
          const info = (await builder.getFontInfo(
            new Uint8Array(data)
          )) as TypstFontInfo & { url: string };
          info.url = url;

          return info;
        })
      )
    )
  )
).flat();

// copy to .data/fontInfo.json
await fs.mkdir(".data", { recursive: true });
await fs.writeFile(".data/fontInfo.json", JSON.stringify(infos));
await fs.copyFile(".data/fontInfo.json", "dist/fontInfo.json");
//todo: remove me
await fs.copyFile(".data/fontInfo.json", "src/fontInfo.json");
