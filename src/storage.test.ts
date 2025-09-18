import { expect, test } from "vitest";
import { createStorageSpecExt, storageSpecFromPath } from "./storage";

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
  expect(storageSpecFromPath("@http/localhost:11449/main.typ", "g-cors=false"))
    .toMatchInlineSnapshot(`
      {
        "cors": false,
        "type": "http",
        "url": "http://localhost:11449/main.typ?g-cors=false",
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
