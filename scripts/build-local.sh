#!/bin/bash

pnpm link "@myriaddreamin/typst.ts"
pnpm link "@myriaddreamin/typst-ts-renderer"
pnpm link "@myriaddreamin/typst-ts-web-compiler"

pnpm build

rm ./pnpm-workspace.yaml
pnpm install
