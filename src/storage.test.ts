import { expect, test } from "vitest";
import { storageSpecFromPath } from "./storage";

test("redirect to README", () => {
  expect(storageSpecFromPath("")).toMatchInlineSnapshot(`
    {
      "domain": "https://github.com",
      "kind": "blob",
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
      "domain": "https://github.com",
      "kind": "blob",
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
      "domain": "codeberg.org",
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
