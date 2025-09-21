import {
  createStorageSpecExt,
  StorageSpecExt,
  storageSpecFromPath,
} from "./storage";
import { README, README_CN } from "./storage";

// @ts-ignore
const isDev = false; // import.meta.env !== undefined;
const DEFAULT_DEV_MODE = "slide";
// const TEST_PATH = "typst/templates/blob/main/charged-ieee/template/main.typ";
// const TEST_PATH = "@any/github.com/Myriad-Dreamin/gistd/raw/main/README.typ";
// const TEST_PATH = "@http/localhost:11449/localhost.typ";
// const TEST_PATH = "@any/localhost:3000/jan/test/src/branch/main/test.typ";
const TEST_PATH = "touying-typ/touying/blob/main/examples/simple.typ";
// const TEST_PATH = "Jollywatt/typst-fletcher/blob/main/docs/manual.typ";

const DEFAULT_PAGE = "1";
// const DEFAULT_MODE = "doc";
const DEFAULT_MODE = isDev ? DEFAULT_DEV_MODE : "doc";

export interface Spec {
  storage: StorageSpecExt;
  page: number;
  mode: "slide" | "doc";
}

export function specFromUrl(): Spec {
  const inputPath = window.location.pathname.slice(1) || "";
  const search = new URLSearchParams(window.location.search || "");
  const readme = /(?:-|.)cn/g.test(window.location.hostname)
    ? README_CN
    : README;

  const pageStr = search.get("g-page") || DEFAULT_PAGE;
  const page = Number.parseInt(pageStr);
  let mode = (search.get("g-mode") as "slide" | "doc") || DEFAULT_MODE;
  if (mode !== "slide" && mode !== "doc") {
    mode = DEFAULT_MODE;
  }
  search.delete("g-page");
  search.delete("g-mode");

  return {
    storage: createStorageSpecExt(
      storageSpecFromPath(isDev ? TEST_PATH : inputPath, search, readme)
    ),
    page,
    mode,
  };
}
