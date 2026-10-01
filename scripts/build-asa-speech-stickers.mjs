import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('artifacts/brand/asa-mascot-kit/falas');
const source = path.join(root, 'asa-falas-sheet.png');
const items = [
  ['oi', ['Oi!']],
  ['estou-com-voce', ['Estou com', 'você.']],
  ['voce-consegue', ['Você', 'consegue!']],
  ['que-orgulho', ['Que orgulho!']],
  ['tudo-certo', ['Tudo certo!']],
  ['ate-logo', ['Até logo!']],
];
const meta = await sharp(source).metadata();
const cellW = Math.floor(meta.width / 3);
const cellH = Math.floor(meta.height / 2);
for (const size of [512, 128, 64, 32]) await fs.mkdir(path.join(root, String(size)), { recursive: true });

for (let i = 0; i < items.length; i++) {
  const [slug, lines] = items[i];
  const crop = await sharp(source).extract({left:(i%3)*cellW,top:Math.floor(i/3)*cellH,width:cellW,height:cellH}).png().toBuffer();
  const trimmed = await sharp(crop).trim({background:{r:0,g:0,b:0,alpha:0},threshold:8}).png().toBuffer();
  const mascot = await sharp(trimmed).resize(350,330,{fit:'inside',withoutEnlargement:true}).png().toBuffer();
  const mascotMeta = await sharp(mascot).metadata();
  const left = Math.round((512-mascotMeta.width)/2);
  const top = 512-mascotMeta.height-30;
  const fontSize = lines.length===1 ? 38 : 34;
  const text = lines.map((line,index)=>`<text x="256" y="${72+index*40}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="#241B4B">${line}</text>`).join('');
  const bubble = Buffer.from(`<svg width="512" height="170" xmlns="http://www.w3.org/2000/svg"><defs><filter id="s" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#5B3FD1" flood-opacity=".18"/></filter></defs><path d="M66 18h380a28 28 0 0 1 28 28v68a28 28 0 0 1-28 28H292l-38 26 8-26H66a28 28 0 0 1-28-28V46a28 28 0 0 1 28-28z" fill="#fff" stroke="#B79CFF" stroke-width="5" filter="url(#s)"/>${text}</svg>`);
  const master = path.join(root,'512',`asa-${slug}.png`);
  await sharp({create:{width:512,height:512,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:mascot,left,top},{input:bubble,left:0,top:0}]).png().toFile(master);
  for (const size of [128,64,32]) await sharp(master).resize(size,size).png().toFile(path.join(root,String(size),`asa-${slug}.png`));
}
const composites = items.map(([slug],i)=>({input:path.join(root,'512',`asa-${slug}.png`),left:(i%3)*512,top:Math.floor(i/3)*512}));
await sharp({create:{width:1536,height:1024,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(composites).png().toFile(path.join(root,'asa-falas-final-sheet.png'));
console.log('Created 6 speech stickers in 512, 128, 64 and 32 px.');
