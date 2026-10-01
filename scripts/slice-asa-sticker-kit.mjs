import sharp from "sharp";
import { mkdirSync } from "node:fs";

const input = "artifacts/brand/asa-mascot-kit/asa-stickers-sheet.png";
const output = "artifacts/brand/asa-mascot-kit/stickers";
const names = ["aceno", "celebracao", "orientacao", "alerta", "pensando", "calendario"];
const width = 1536;
const height = 1024;
const cellWidth = width / 3;
const cellHeight = height / 2;

mkdirSync(output, { recursive: true });

for (let index = 0; index < names.length; index += 1) {
  const column = index % 3;
  const row = Math.floor(index / 3);
  const crop = names[index] === "calendario"
    ? { left: 940, top: 512, width: 596, height: 512 }
    : names[index] === "pensando"
      ? { left: 520, top: 520, width: 450, height: 496 }
      : { left: column * cellWidth + 8, top: row * cellHeight + 8, width: cellWidth - 16, height: cellHeight - 16 };
  const cropped = await sharp(input)
    .extract(crop)
    .png()
    .toBuffer();
  const trimmed = await sharp(cropped)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const sticker = sharp(trimmed);
  // Every exported sticker has a fixed 12.5% transparent safe area on all sides.
  // This prevents wings, props, and effects from being clipped in FIT/FILL consumers.
  sticker
    .resize(384, 384, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({ top: 64, bottom: 64, left: 64, right: 64, background: { r: 0, g: 0, b: 0, alpha: 0 } });
  await sticker.png().toFile(`${output}/asa-${names[index]}.png`);
}

console.log(`Created ${names.length} ASA stickers in ${output}`);
