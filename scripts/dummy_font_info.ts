import { existsSync } from "fs";
import fs from "fs/promises";

await fs.mkdir("dist", { recursive: true });
await fs.writeFile("dist/fontInfo.json", JSON.stringify([]));
