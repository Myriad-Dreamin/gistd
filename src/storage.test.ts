import { expect, test } from "vitest";
import {
  corsUrl,
  createStorageSpecExt,
  refSegmentCount,
  storageSpecFromPath,
} from "./storage";

test("redirect to README", () => {
  expect(storageSpecFromPath("")).toMatchInlineSnapshot(`
    {
      "cors": true,
      "domain": "github.com",
      "kind": "blob",
      "protocol": "https",
      "ref": "main",
      "repo": "gistd",
      "rest": [
        "README.typ",
      ],
      "slug": "README.typ",
      "type": "github",
      "user": "Myriad-Dreamin",
    }
  `);
  expect(storageSpecFromPath("README.typ")).toMatchInlineSnapshot(`
    {
      "cors": true,
      "domain": "github.com",
      "kind": "blob",
      "protocol": "https",
      "ref": "main",
      "repo": "gistd",
      "rest": [
        "README.typ",
      ],
      "slug": "README.typ",
      "type": "github",
      "user": "Myriad-Dreamin",
    }
  `);
});

test("@any for raw", () => {
  expect(
    storageSpecFromPath(
      "@http/localhost:11449/main.typ",
      new URLSearchParams("g-cors=false")
    )
  ).toMatchInlineSnapshot(`
    {
      "cors": false,
      "type": "http",
      "url": "http://localhost:11449/main.typ",
    }
  `);
  expect(
    storageSpecFromPath(
      "@any/github.com/Myriad-Dreamin/gistd/raw/main/README.typ"
    )
  ).toMatchInlineSnapshot(`
    {
      "cors": true,
      "type": "http",
      "url": "https://github.com/Myriad-Dreamin/gistd/raw/main/README.typ",
    }
  `);
  expect(
    storageSpecFromPath(
      "@any/github.com/Myriad-Dreamin/gistd/blob/main/README.typ"
    )
  ).toMatchInlineSnapshot(`
    {
      "cors": true,
      "domain": "github.com",
      "kind": "blob",
      "protocol": "https",
      "ref": "main",
      "repo": "gistd",
      "rest": [
        "README.typ",
      ],
      "slug": "README.typ",
      "type": "github",
      "user": "Myriad-Dreamin",
    }
  `);
});

test("@any for forgejo", () => {
  expect(
    storageSpecFromPath(
      "@any/codeberg.org/typst/templates/src/unused/main/main.typ"
    )
  ).toMatchInlineSnapshot(`
    {
      "cors": true,
      "domain": "codeberg.org",
      "protocol": "https",
      "ref": "main",
      "repo": "templates",
      "rest": [
        "main.typ",
      ],
      "slug": "main.typ",
      "type": "forgejo",
      "user": "typst",
    }
  `);
});

test("originUrl", () => {
  const test = (it: string) =>
    createStorageSpecExt(storageSpecFromPath(it)).originUrl();
  expect(test("Myriad-Dreamin/gistd/blob/main/README.typ")).toBe(
    "https://github.com/Myriad-Dreamin/gistd/blob/main/README.typ"
  );
  expect(test("@any/github.com/Myriad-Dreamin/gistd/raw/main/README.typ")).toBe(
    "https://github.com/Myriad-Dreamin/gistd/raw/main/README.typ"
  );
  expect(
    test("@any/codeberg.org/typst/templates/src/unused/main/main.typ")
  ).toBe("https://codeberg.org/typst/templates/src/main/main.typ");
  expect(test("@http/localhost:11449/localhost.typ")).toBe(
    "http://localhost:11449/localhost.typ"
  );
});

test("default cors proxy uses same-origin path", () => {
  expect(
    corsUrl(
      "https://github.com/Myriad-Dreamin/gistd.git/info/refs?service=git-upload-pack",
      true
    )
  ).toBe(
    "/git-cors-proxy/github.com/Myriad-Dreamin/gistd.git/info/refs?service=git-upload-pack"
  );
  expect(
    corsUrl(
      "https://github.com/Myriad-Dreamin/gistd/raw/main/README.typ",
      false
    )
  ).toBe("https://github.com/Myriad-Dreamin/gistd/raw/main/README.typ");
  expect(
    corsUrl(
      "https://github.com/Myriad-Dreamin/gistd.git/info/refs?service=git-upload-pack",
      "http://localhost:9999"
    )
  ).toBe(
    "http://localhost:9999/github.com/Myriad-Dreamin/gistd.git/info/refs?service=git-upload-pack"
  );
});

test("refSegmentCount picks the longest matching ref", () => {
  const refs = [
    "HEAD",
    "refs/heads/main",
    "refs/heads/coro",
    "refs/heads/coro/delegation-study",
    "refs/tags/v1/rc",
  ];
  const count = (path: string) => refSegmentCount(path.split("/"), refs);
  expect(count("main/paper/main.typ")).toBe(1);
  expect(count("coro/delegation-study/crates/paper.typ")).toBe(2);
  expect(count("coro/other/paper.typ")).toBe(1);
  expect(count("v1/rc/main.typ")).toBe(2);
  // the last segment is always left for the file
  expect(count("coro/delegation-study")).toBe(1);
  // unknown refs (e.g. commit hashes) default to one segment
  expect(count("89944b7/paper/main.typ")).toBe(1);
});
