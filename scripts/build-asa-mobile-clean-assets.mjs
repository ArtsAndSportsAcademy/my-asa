import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDirectory = path.join(root, "artifacts/web-admin/public/asa");
const outputDirectory = path.join(root, "artifacts/mobile/assets/images/asa-poses-clean");
const poses = [
  "aviso-importante", "bom-dia", "consultando", "duvida", "estudando", "lembrete",
  "oi", "olhos-de-estrela", "pensativa", "sonolenta", "tarefa-concluida", "travessa", "vencemos",
];

await mkdir(outputDirectory, { recursive: true });
for (const pose of poses) {
  const png = await sharp(path.join(sourceDirectory, `${pose}.png`))
    .resize(300, 300, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp(png).toFile(path.join(outputDirectory, `${pose}.png`));
  await sharp(png).webp({ quality: 90, alphaQuality: 100, effort: 6 }).toFile(path.join(outputDirectory, `${pose}.webp`));
}

console.log(`Geradas ${poses.length} poses limpas em 300x300 para o app móvel.`);
