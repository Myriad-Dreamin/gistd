import { expect, test } from "vitest";
import {
  cssToFontInformation,
  parseUnicodeRangeList,
  rangesToCoverage,
} from "./font-css";

test("converts Google Fonts CSS font-face blocks", () => {
  const css = `
    /* latin-ext */
    @font-face {
      font-family: 'Roboto';
      font-style: normal;
      font-weight: 400;
      font-stretch: 100%;
      font-display: swap;
      src: url(https://fonts.gstatic.com/s/roboto/v50/latin-ext.woff2) format('woff2');
      unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC;
    }

    /* latin */
    @font-face {
      font-family: 'Roboto';
      font-style: italic;
      font-weight: 700;
      src: url("https://fonts.gstatic.com/s/roboto/v50/latin.woff2") format("woff2");
      unicode-range: U+0000-00FF;
    }
  `;

  expect(cssToFontInformation(css)).toEqual([
    {
      info: [
        {
          family: "Roboto",
          variant: {
            style: "normal",
            weight: 400,
            stretch: 1000,
          },
          flags: "",
          coverage: [256, 443, 2, 9, 1, 6],
        },
      ],
      conditions: [],
      url: "https://fonts.gstatic.com/s/roboto/v50/latin-ext.woff2",
    },
    {
      info: [
        {
          family: "Roboto",
          variant: {
            style: "italic",
            weight: 700,
            stretch: 1000,
          },
          flags: "",
          coverage: [0, 256],
        },
      ],
      conditions: [],
      url: "https://fonts.gstatic.com/s/roboto/v50/latin.woff2",
    },
  ]);
});

test("parses wildcard unicode ranges and compresses coverage", () => {
  const ranges = parseUnicodeRangeList("U+4??, U+500-501, U+0041");

  expect(ranges).toEqual([
    [0x41, 0x41],
    [0x400, 0x501],
  ]);
  expect(rangesToCoverage(ranges)).toEqual([65, 1, 958, 258]);
});

test("resolves URLs, picks woff2 sources, and injects real sha256 when supplied", () => {
  const css = `
    @font-face {
      font-family: "Recursive";
      font-style: oblique 0deg 10deg;
      font-weight: 300 900;
      font-stretch: semi-condensed;
      src:
        local("Recursive"),
        url("../fonts/recursive.woff") format("woff"),
        url("../fonts/recursive.woff2") format("woff2");
    }
  `;
  const url = "https://example.com/assets/fonts/recursive.woff2";

  expect(
    cssToFontInformation(css, {
      baseUrl: "https://example.com/assets/css/google-fonts.css",
      flagsByFamily: { Recursive: "MONOSPACE" },
      sha256ByUrl: { [url]: "a".repeat(64) },
    })
  ).toEqual([
    {
      info: [
        {
          family: "Recursive",
          variant: {
            style: "oblique",
            weight: 400,
            stretch: 875,
          },
          flags: "MONOSPACE",
          coverage: [0, 0x110000],
        },
      ],
      conditions: [{ t: "Sha256", v: "a".repeat(64) }],
      url,
    },
  ]);
});

test("uses URL callback to inject sha256 after URL normalization", () => {
  const css = `
    @font-face {
      font-family: Roboto;
      src: url(./roboto.woff2) format("woff2");
      unicode-range: U+20;
    }
  `;

  expect(
    cssToFontInformation(css, {
      baseUrl: "https://example.com/fonts/",
      sha256ByUrl: (url) =>
        url === "https://example.com/fonts/roboto.woff2"
          ? "b".repeat(64)
          : undefined,
    })
  ).toEqual([
    {
      info: [
        {
          family: "Roboto",
          variant: {
            style: "normal",
            weight: 400,
            stretch: 1000,
          },
          flags: "",
          coverage: [32, 1],
        },
      ],
      conditions: [{ t: "Sha256", v: "b".repeat(64) }],
      url: "https://example.com/fonts/roboto.woff2",
    },
  ]);
});
