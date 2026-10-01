import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";
// Raster export of the existing brand vector, not a new illustration.
const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../artifacts/web-admin/public");
for (const size of [192, 512]) {
  await sharp(path.join(publicDir, "asinha.svg"), { density: 300 }).resize(size, size, { fit: "contain", background: "#faf8f4" }).png().toFile(path.join(publicDir, `pwa-${size}.png`));
}
console.log("PWA: exported brand icons at 192x192 and 512x512");
