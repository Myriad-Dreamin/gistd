pnpm link "@myriaddreamin/typst.ts"
pnpm link "@myriaddreamin/typst-ts-renderer"
pnpm link "@myriaddreamin/typst-ts-web-compiler"

pnpm build

Remove-Item .\pnpm-workspace.yaml
pnpm install