# gistd

Instantly share [typst](https://typst.app) documents on git and other network storage.

## Usage

Assuming that you have a GitHub link for example:

```
https://github.com/typst/templates/blob/main/charged-ieee/template/main.typ
```

Simply replace the `github.com` with `gistd.myriad-dreamin.com`:

```
https://gistd.myriad-dreamin.com/typst/templates/blob/main/charged-ieee/template/main.typ
```

If you have another link to a forgejo/gitea instance, you can simply use `https://gistd.myriad-dreamin.com/<domain>/<url>` istead of `https://gistd.myriad-dreamin.com/<url>`

## Example Documents

- https://gistd.myriad-dreamin.com/johanvx/typst-undergradmath/blob/main/undergradmath.typ
- https://gistd.myriad-dreamin.com/Jollywatt/typst-fletcher/blob/main/docs/manual.typ
- https://gistd.myriad-dreamin.com/typst/templates/blob/main/charged-ieee/template/main.typ

## Development

Install dependencies:

```
pnpm install
```

Develop locally:

```
pnpm dev
```

Build:

```
pnpm build
```
