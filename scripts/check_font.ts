// read LibertinusSerif-Regular.otf

import fs from "fs/promises";

const font = new Uint8Array(
  await fs.readFile(".data/LibertinusSerif-Regular.otf")
);
console.log(font.length, hash(font));

function hash(result: Uint8Array) {
  let hash = 0;
  for (let i = 0; i < result.length; i++) {
    hash = (hash << 5) - hash + result[i];
    hash = hash & hash;
  }
  return hash;
}
