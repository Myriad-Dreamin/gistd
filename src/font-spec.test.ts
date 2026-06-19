import { expect, test } from "vitest";
import { resolveConfiguredFontInfo } from "./font";
import {
  googleFontsCssUrl,
  parseFontSpec,
  parseFontSpecsFromSearch,
} from "./font-spec";

test("parses repeated fonts params with provider on each font", () => {
  expect(
    parseFontSpecsFromSearch(
      "?fonts=google-fonts:Noto+Sans+SC&fonts=google-fonts:Roboto&g-mode=doc"
    )
  ).toEqual([
    {
      provider: "google-fonts",
      family: "Noto Sans SC",
    },
    {
      provider: "google-fonts",
      family: "Roboto",
    },
  ]);
});

test("preserves commas inside a repeated font spec", () => {
  expect(
    parseFontSpecsFromSearch(
      "?fonts=google-fonts:Roboto:ital,wght@0,400;1,700"
    )
  ).toEqual([
    {
      provider: "google-fonts",
      family: "Roboto:ital,wght@0,400;1,700",
    },
  ]);
});

test("rejects google-font typo instead of accepting it as an alias", () => {
  expect(() => parseFontSpec("google-font:Noto Sans SC")).toThrow(
    "Unsupported font provider: google-font"
  );
});

test("builds Google Fonts CSS URL", () => {
  expect(googleFontsCssUrl("Noto Sans SC:wght@400;700")).toBe(
    "https://fonts.googleapis.com/css2?family=Noto+Sans+SC%3Awght%40400%3B700&display=swap"
  );
});

test("resolves google-fonts provider through CSS conversion", async () => {
  const css = `
    @font-face {
      font-family: 'Noto Sans SC';
      font-style: normal;
      font-weight: 400;
      src: url(https://fonts.gstatic.com/s/notosanssc/v40/chinese.woff2) format('woff2');
      unicode-range: U+4F60, U+597D;
    }
  `;
  const requests: string[] = [];
  const fetcher = async (url: string | URL | Request) => {
    requests.push(url.toString());
    return new Response(css, {
      status: 200,
      statusText: "OK",
      headers: { "content-type": "text/css" },
    });
  };

  await expect(
    resolveConfiguredFontInfo(
      [{ provider: "google-fonts", family: "Noto Sans SC" }],
      fetcher
    )
  ).resolves.toEqual([
    {
      info: [
        {
          family: "Noto Sans SC",
          variant: {
            style: "normal",
            weight: 400,
            stretch: 1000,
          },
          flags: "",
          coverage: [0x4f60, 1, 0x0a1c, 1],
        },
      ],
      conditions: [],
      url: "https://fonts.gstatic.com/s/notosanssc/v40/chinese.woff2",
    },
  ]);
  expect(requests).toEqual([googleFontsCssUrl("Noto Sans SC")]);
});
