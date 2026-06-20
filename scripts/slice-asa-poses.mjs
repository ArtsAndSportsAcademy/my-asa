import sharp from "sharp";
import { mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const SRC = join(ROOT, "attached_assets/ChatGPT_Image_19_jun_2026,_07_13_47_p.m._1781963887961.png");
const WEB_OUT = join(ROOT, "artifacts/web-admin/public/asa-poses");
const MOB_OUT = join(ROOT, "artifacts/mobile/assets/images/asa-poses");

mkdirSync(WEB_OUT, { recursive: true });
mkdirSync(MOB_OUT, { recursive: true });

const COLS = 4;
const ROWS = 5;
const IMG_W = 1024;
const IMG_H = 1536;
const CELL_W = Math.floor(IMG_W / COLS);
const CELL_H = Math.floor(IMG_H / ROWS);

const POSES = [
  ["idle",             "bomdia",    "boanoite",       "duvida"          ],
  ["aviso_importante", "arquivo",   "lembrete",       "tarefa_concluida"],
  ["biblioteca",       "analisando","carregando",     "enviando"        ],
  ["chuva",            "frio",      "recomendacao",   "comemoracao"     ],
  ["vazio",            "focado",    "planejando",     "feliz"           ],
];

const meta = await sharp(SRC).metadata();
console.log(`Sprite sheet: ${meta.width}×${meta.height}`);
console.log(`Cell size: ${CELL_W}×${CELL_H}`);

for (let row = 0; row < ROWS; row++) {
  for (let col = 0; col < COLS; col++) {
    const pose = POSES[row][col];
    const left = col * CELL_W;
    const top  = row * CELL_H;
    const width  = (col === COLS - 1) ? IMG_W - left : CELL_W;
    const height = (row === ROWS - 1) ? IMG_H - top  : CELL_H;

    await sharp(SRC)
      .extract({ left, top, width, height })
      .resize(300, 300, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(join(WEB_OUT, `${pose}.png`));

    await sharp(SRC)
      .extract({ left, top, width, height })
      .resize(300, 300, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(join(MOB_OUT, `${pose}.png`));

    console.log(`  ✓ ${pose} (${row},${col})`);
  }
}

console.log("\nDone — 20 poses sliced to web-admin and mobile.");
