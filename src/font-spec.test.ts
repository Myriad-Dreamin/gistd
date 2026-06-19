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
    const requestUrl = url.toString();
    requests.push(requestUrl);
    if (requestUrl.includes("api.github.com/repos/google/fonts/contents")) {
      return new Response("not found", {
        status: 404,
        statusText: "Not Found",
      });
    }
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
  expect(requests).toEqual([
    "https://api.github.com/repos/google/fonts/contents/ofl/notosanssc",
    "https://api.github.com/repos/google/fonts/contents/apache/notosanssc",
    "https://api.github.com/repos/google/fonts/contents/ufl/notosanssc",
    googleFontsCssUrl("Noto Sans SC"),
  ]);
});

test("resolves google-fonts provider through Google Fonts repository", async () => {
  const requests: string[] = [];
  const fetcher = async (url: string | URL | Request) => {
    const requestUrl = url.toString();
    requests.push(requestUrl);
    if (requestUrl.endsWith("/ofl/notosanssc")) {
      return Response.json([
        {
          name: "NotoSansSC[wght].ttf",
          type: "file",
          download_url:
            "https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf",
        },
      ]);
    }
    return new Response("not found", {
      status: 404,
      statusText: "Not Found",
    });
  };

  const fontInfo = await resolveConfiguredFontInfo(
    [{ provider: "google-fonts", family: "Noto Sans SC:wght@400;700" }],
    fetcher
  );

  expect(requests).toEqual([
    "https://api.github.com/repos/google/fonts/contents/ofl/notosanssc",
  ]);
  expect(fontInfo).toHaveLength(1);
  expect(fontInfo[0].url).toBe(
    "https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf"
  );
  expect(fontInfo[0].conditions).toEqual([]);
  expect(fontInfo[0].info).toEqual([
    {
      family: "Noto Sans SC",
      variant: {
        style: "normal",
        weight: 400,
        stretch: 1000,
      },
      flags: "",
      coverage: [0, 0x110000],
    },
    {
      family: "Noto Sans SC",
      variant: {
        style: "normal",
        weight: 700,
        stretch: 1000,
      },
      flags: "",
      coverage: [0, 0x110000],
    },
  ]);
});
