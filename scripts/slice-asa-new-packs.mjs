import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('artifacts/brand/asa-mascot-kit');
const packs = [
  { source: 'perfil-equipe/asa-perfil-equipe-sheet.png', dir: 'perfil-equipe', names: ['boas-vindas', 'perfil-concluido', 'nova-pessoa', 'equipe-reunida', 'aniversario', 'reconhecimento'] },
  { source: 'comunicacao/asa-comunicacao-sheet.png', dir: 'comunicacao', names: ['nova-mensagem', 'enviando-aviso', 'lendo-mensagem', 'aguardando-resposta', 'notificacoes-pausadas', 'mensagem-importante'] },
  { source: 'acolhimento/asa-acolhimento-sheet.png', dir: 'acolhimento', names: ['abraco', 'incentivo', 'estou-com-voce', 'gratidao', 'orgulho', 'desculpas'] },
  { source: 'system-states/asa-system-states-sheet.png', dir: 'system-states', names: ['carregando', 'vazio', 'concluido', 'erro', 'sem-conexao', 'manutencao'] },
  { source: 'operations/asa-operations-sheet.png', dir: 'operations', names: ['lupa', 'checklist', 'livro', 'megafone', 'mensagem', 'tudo-certo'] },
  { source: 'emojis/asa-emojis-a-sheet.png', dir: 'emojis', names: ['feliz', 'gargalhada', 'piscadinha', 'apaixonada', 'surpresa', 'aliviada'] },
  { source: 'emojis/asa-emojis-b-sheet.png', dir: 'emojis', names: ['pensativa', 'confusa', 'preocupada', 'triste', 'sonolenta', 'focada'] },
];

for (const pack of packs) {
  const input = path.join(root, pack.source);
  const meta = await sharp(input).metadata();
  const cellW = Math.floor(meta.width / 3);
  const cellH = Math.floor(meta.height / 2);
  const outputDir = path.join(root, pack.dir, '512');
  await fs.mkdir(outputDir, { recursive: true });
  for (const size of [128, 64, 32]) await fs.mkdir(path.join(root, pack.dir, String(size)), { recursive: true });

  for (let i = 0; i < pack.names.length; i++) {
    const crop = await sharp(input).extract({ left: (i % 3) * cellW, top: Math.floor(i / 3) * cellH, width: cellW, height: cellH }).png().toBuffer();
    const trimmed = await sharp(crop).trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 8 }).png().toBuffer();
    const name = `asa-${pack.names[i]}.png`;
    const master = path.join(outputDir, name);
    await sharp(trimmed).resize(384, 384, { fit: 'inside', withoutEnlargement: true }).extend({ top: 64, bottom: 64, left: 64, right: 64, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(master);
    for (const size of [128, 64, 32]) {
      await sharp(master).resize(size, size, { fit: 'contain' }).png().toFile(path.join(root, pack.dir, String(size), name));
    }
  }
}

console.log('Created 18 masters plus 128/64/32 exports with protected transparent margins.');
