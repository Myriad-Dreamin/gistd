import { expect, test } from "vitest";
import { missingFilePaths, resolvePath } from "./missing-files";

const sources: Record<string, string> = {
  "/examples/simple.typ":
    '#import "/lib.typ": *\n#include "../chapters/intro.typ"',
  "/paper/main.typ": '#image("fig/plot.png")',
};
const readSource = (path: string) =>
  path in sources ? new TextEncoder().encode(sources[path]) : undefined;

test("resolvePath", () => {
  expect(resolvePath("/a/b", "c.typ")).toBe("/a/b/c.typ");
  expect(resolvePath("/a/b/", "../c.typ")).toBe("/a/c.typ");
  expect(resolvePath("/a/b", "/c.typ")).toBe("/c.typ");
  expect(resolvePath("/", "./x/../y.typ")).toBe("/y.typ");
  expect(resolvePath("/a", "../../../z")).toBe("/z");
});

test("paths from `file not found (searched at ...)`", () => {
  const diagnostics = [
    {
      path: "/main.typ",
      range: "0:0-0:1",
      message: "file not found (searched at /data/table.csv)",
    },
  ];
  expect(missingFilePaths(diagnostics, readSource)).toEqual([
    "/data/table.csv",
  ]);
});

test("paths from the literal under `failed to load file` ranges", () => {
  const diagnostics = [
    {
      path: "/examples/simple.typ",
      range: "0:8-0:18",
      message: "failed to load file (access denied)",
    },
    {
      path: "/examples/simple.typ",
      range: "1:9-1:33",
      message: "failed to load file (access denied)",
    },
    {
      path: "/paper/main.typ",
      range: "0:7-0:21",
      message: "file not found",
    },
  ];
  expect(missingFilePaths(diagnostics, readSource)).toEqual([
    "/lib.typ",
    "/chapters/intro.typ",
    "/paper/fig/plot.png",
  ]);
});

test("ignores unrelated or unreadable diagnostics", () => {
  const diagnostics = [
    { path: "/paper/main.typ", range: "0:0-0:6", message: "unknown variable" },
    {
      path: "/missing.typ",
      range: "0:0-0:5",
      message: "failed to load file (access denied)",
    },
    {
      path: "/paper/main.typ",
      range: "0:1-0:6",
      message: "failed to load file (access denied)",
    },
  ];
  expect(missingFilePaths(diagnostics, readSource)).toEqual([]);
});
