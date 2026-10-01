import assert from "node:assert/strict";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sets = [
  {
    name: "web",
    directory: "artifacts/web-admin/public/asa",
    expected: [
      "atencao", "aviso-importante", "bom-dia", "consultando", "duvida", "estudando", "lembrete",
      "oi", "olhos-de-estrela", "pensativa", "sonolenta", "tarefa-concluida", "travessa", "vencemos",
    ],
    dimension: 512,
  },
  {
    name: "mobile",
    directory: "artifacts/mobile/assets/images/asa-poses",
    expected: [
      "analisando", "arquivo", "aviso_importante", "biblioteca", "boanoite", "bomdia", "carregando",
      "chuva", "comemoracao", "duvida", "enviando", "feliz", "focado", "frio", "idle", "lembrete",
      "planejando", "recomendacao", "tarefa_concluida", "vazio",
    ],
    dimension: 300,
  },
  {
    name: "mobile-clean",
    directory: "artifacts/mobile/assets/images/asa-poses-clean",
    expected: [
      "aviso-importante", "bom-dia", "consultando", "duvida", "estudando", "lembrete",
      "oi", "olhos-de-estrela", "pensativa", "sonolenta", "tarefa-concluida", "travessa", "vencemos",
    ],
    dimension: 300,
  },
];

let totalPngBytes = 0;
let totalWebpBytes = 0;
let totalImages = 0;
let minPsnr = Infinity;

for (const set of sets) {
  const directory = path.join(root, set.directory);
  const files = await readdir(directory);
  const pngNames = files.filter((file) => file.endsWith(".png")).map((file) => file.slice(0, -4)).sort();
  const webpNames = files.filter((file) => file.endsWith(".webp")).map((file) => file.slice(0, -5)).sort();
  const expected = [...set.expected].sort();
  assert.deepEqual(pngNames, expected, `${set.name}: PNGs ausentes ou inesperados`);
  assert.deepEqual(webpNames, expected, `${set.name}: WebPs ausentes ou inesperados`);

  for (const name of expected) {
    const pngPath = path.join(directory, `${name}.png`);
    const webpPath = path.join(directory, `${name}.webp`);
    const [pngMeta, webpMeta, pngFile, webpFile, pngPixels, webpPixels] = await Promise.all([
      sharp(pngPath).metadata(),
      sharp(webpPath).metadata(),
      stat(pngPath),
      stat(webpPath),
      sharp(pngPath).ensureAlpha().raw().toBuffer(),
      sharp(webpPath).ensureAlpha().raw().toBuffer(),
    ]);
    for (const [format, metadata] of [["PNG", pngMeta], ["WebP", webpMeta]]) {
      assert.equal(metadata.width, set.dimension, `${set.name}/${name}: largura ${format}`);
      assert.equal(metadata.height, set.dimension, `${set.name}/${name}: altura ${format}`);
      assert.equal(metadata.hasAlpha, true, `${set.name}/${name}: transparência ${format}`);
    }
    assert.ok(webpFile.size < pngFile.size, `${set.name}/${name}: WebP não reduziu o arquivo`);
    assert.equal(pngPixels.length, webpPixels.length, `${set.name}/${name}: dimensões decodificadas`);
    let squaredError = 0;
    let comparedChannels = 0;
    for (let offset = 0; offset < pngPixels.length; offset += 4) {
      assert.equal(webpPixels[offset + 3], pngPixels[offset + 3], `${set.name}/${name}: alpha alterado`);
      const alpha = pngPixels[offset + 3] / 255;
      for (let channel = 0; channel < 3; channel += 1) {
        const visibleError = (pngPixels[offset + channel] - webpPixels[offset + channel]) * alpha;
        squaredError += visibleError * visibleError;
        comparedChannels += 1;
      }
    }
    const psnr = 10 * Math.log10((255 * 255) / (squaredError / comparedChannels || 1));
    assert.ok(psnr >= 34, `${set.name}/${name}: qualidade visual baixa (${psnr.toFixed(1)} dB PSNR)`);
    minPsnr = Math.min(minPsnr, psnr);
    totalPngBytes += pngFile.size;
    totalWebpBytes += webpFile.size;
    totalImages += 1;
  }
  console.log(`${set.name}: ${expected.length} variantes ${set.dimension}x${set.dimension}, alpha idêntico, fallback válido e PSNR >= 34 dB.`);
}

const reduction = ((1 - totalWebpBytes / totalPngBytes) * 100).toFixed(1);
console.log(`Total: ${totalImages} variantes; ${totalPngBytes} bytes PNG -> ${totalWebpBytes} bytes WebP (${reduction}% menor); PSNR mínimo ${minPsnr.toFixed(1)} dB.`);
