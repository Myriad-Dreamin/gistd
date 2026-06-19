export type FontSpec = GoogleFontsSpec;

export interface GoogleFontsSpec {
  provider: "google-fonts";
  family: string;
}

export function parseFontSpecsFromSearch(search: string): FontSpec[] {
  return new URLSearchParams(search).getAll("fonts").map(parseFontSpec);
}

export function parseFontSpec(spec: string): FontSpec {
  const separator = spec.indexOf(":");
  if (separator < 0) {
    throw new Error(`Missing font provider in font spec: ${spec}`);
  }

  const provider = spec.slice(0, separator).trim();
  const value = spec.slice(separator + 1).trim();

  if (provider !== "google-fonts") {
    throw new Error(`Unsupported font provider: ${provider}`);
  }

  if (!value) {
    throw new Error(`Missing font family for provider: ${provider}`);
  }

  return {
    provider,
    family: value,
  };
}

export function googleFontsCssUrl(family: string): string {
  const url = new URL("https://fonts.googleapis.com/css2");
  url.searchParams.set("family", family);
  url.searchParams.set("display", "swap");
  return url.toString();
}
