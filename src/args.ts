import {
  createStorageSpecExt,
  StorageSpecExt,
  storageSpecFromPath,
} from "./storage";
import { README, README_CN } from "./storage";

// @ts-ignore
const isDev = true; // import.meta.env !== undefined;
const DEFAULT_DEV_MODE = "doc";
// const TEST_PATH = "typst/templates/blob/main/charged-ieee/template/main.typ";
const TEST_PATH = "@any/github.com/Myriad-Dreamin/gistd/raw/main/README.typ";
// const TEST_PATH = "@http/localhost:11449/localhost.typ";
// const TEST_PATH = "@any/localhost:3000/jan/test/src/branch/main/test.typ";
// const TEST_PATH = "touying-typ/touying/blob/main/examples/simple.typ";
// const TEST_PATH = "touying-typ/touying/blob/main/examples/example.typ";
// const TEST_PATH = "Jollywatt/typst-fletcher/blob/main/docs/manual.typ";

const DEFAULT_PAGE = "1";
// const DEFAULT_MODE = "doc";
const DEFAULT_MODE = isDev ? DEFAULT_DEV_MODE : "doc";
const DEFAULT_VERSION = "latest";

export interface Args {
  storage: StorageSpecExt;
  page: number;
  mode: "slide" | "doc";
  version: string;
}

let _cacheKey: [string, string, string];
let _cache: Args;
export function argsFromUrl(): Args {
  const newKey: [string, string, string] = [
    window.location.pathname,
    window.location.search,
    window.location.hostname,
  ];

  if (_cache && newKey === _cacheKey) {
    return _cache;
  }
  _cacheKey = newKey;
  const [pathname, locationSearch, hostname] = newKey;

  const inputPath = pathname.slice(1) || "";
  const search = new URLSearchParams(locationSearch || "");
  const readme = /(?:-|.)cn/g.test(hostname) ? README_CN : README;

  const pageStr = search.get("g-page") || DEFAULT_PAGE;
  const page = Number.parseInt(pageStr);
  let mode = (search.get("g-mode") as "slide" | "doc") || DEFAULT_MODE;
  if (mode !== "slide" && mode !== "doc") {
    mode = DEFAULT_MODE;
  }
  let version = search.get("g-version") || DEFAULT_VERSION;

  search.delete("g-page");
  search.delete("g-mode");
  search.delete("g-version");
  return (_cache = {
    storage: createStorageSpecExt(
      storageSpecFromPath(isDev ? TEST_PATH : inputPath, search, readme)
    ),
    version,
    page,
    mode,
  });
}
