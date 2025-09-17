

#let forest = green.darken(20%)
#show "github.com": text.with(forest)
#show "gistd.myriad-dreamin.com": text.with(eastern)
#show link: text.with(blue)
#show link: underline

#align(center, text(size: 28pt)[Gistd])

Instantly share #link("https://typst.app")[typst] documents on git and other network storage.

= Usage

Assuming that you have a GitHub link for example:

```
https://github.com/typst/templates/blob/main/charged-ieee/template/main.typ
```

Simply replace the `github.com` with `gistd.myriad-dreamin.com`:

```
https://gistd.myriad-dreamin.com/typst/templates/blob/main/charged-ieee/template/main.typ
```

= Example Documents

- https://gistd.myriad-dreamin.com/johanvx/typst-undergradmath/blob/main/undergradmath.typ
- https://gistd.myriad-dreamin.com/Jollywatt/typst-fletcher/blob/main/docs/manual.typ
- https://gistd.myriad-dreamin.com/typst/templates/blob/main/charged-ieee/template/main.typ
