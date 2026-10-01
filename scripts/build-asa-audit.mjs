import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('artifacts/brand/asa-mascot-kit');
const audit = path.join(root, 'auditoria');
await fs.mkdir(audit, { recursive: true });

const esc = s => s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const pretty = s => s.replace(/^asa-/,'').replace(/\.png$/,'').replaceAll('-',' ').replace(/\b\w/g,c=>c.toUpperCase());
const cardW=300, cardH=340, cols=6, gap=20, pad=40, header=150;

const categories = [
  ['Essenciais','stickers'],['Operações','operations/512'],['Emojis','emojis/512'],
  ['Acolhimento','acolhimento/512'],['Estados','system-states/512'],['Falas','falas/512'],
  ['Comunicação','comunicacao/512'],['Perfil e equipe','perfil-equipe/512'],
];
const current=[];
for(const [category,rel] of categories){
  const dir=path.join(root,rel); const files=(await fs.readdir(dir)).filter(f=>f.endsWith('.png')).sort();
  for(const file of files) current.push({category,label:pretty(file),file:path.join(dir,file)});
}

async function contactSheet(items,title,subtitle,out){
  const rows=Math.ceil(items.length/cols), width=pad*2+cols*cardW+(cols-1)*gap, height=header+pad+rows*cardH+(rows-1)*gap+pad;
  const bg=sharp({create:{width,height,channels:4,background:'#F7F7FC'}});
  const comp=[];
  comp.push({input:Buffer.from(`<svg width="${width}" height="${header}"><text x="40" y="62" font-family="Arial" font-size="36" font-weight="700" fill="#21183F">${esc(title)}</text><text x="40" y="100" font-family="Arial" font-size="18" fill="#5C5870">${esc(subtitle)}</text></svg>`),left:0,top:0});
  for(let i=0;i<items.length;i++){
    const x=pad+(i%cols)*(cardW+gap), y=header+pad+Math.floor(i/cols)*(cardH+gap);
    const img=await sharp(items[i].file).resize(240,240,{fit:'contain',background:'#FFFFFF'}).flatten({background:'#FFFFFF'}).png().toBuffer();
    const label=items[i].label.length>27?items[i].label.slice(0,26)+'…':items[i].label;
    const card=Buffer.from(`<svg width="${cardW}" height="${cardH}"><rect x="1" y="1" width="298" height="338" rx="22" fill="#FFFFFF" stroke="#E6E1F4"/><text x="24" y="282" font-family="Arial" font-size="18" font-weight="700" fill="#261D49">${esc(label)}</text><text x="24" y="312" font-family="Arial" font-size="13" fill="#7857D8">${esc(items[i].category)}</text></svg>`);
    comp.push({input:card,left:x,top:y},{input:img,left:x+30,top:y+22});
  }
  await bg.composite(comp).png().toFile(out);
}

await contactSheet(current,'ASA — acervo atual',`${current.length} assets oficiais já disponíveis no projeto`,path.join(audit,'01-acervo-atual.png'));

const remakePacks=[
 ['Saudações','remakes/pack-1.png',2,2,['Oi','Bom dia','Boa noite','Dúvida']],
 ['Comunicação','remakes/pack-2.png',2,2,['Aviso importante','Atenção','Lembrete','Tarefa concluída']],
 ['Utilidade','remakes/pack-3.png',2,2,['Biblioteca','Consultando','Carregando','Enviando']],
 ['Afeto e conquista','remakes/pack-4.png',2,2,['Abraço fofo','Vencemos','Estudando','Bem-vindo']],
 ['Emojis A','remakes/emojis-a.png',3,2,['Apaixonada','Gargalhada','Olhos de estrela','Beijinho','Piscadinha','Pensativa']],
 ['Emojis B','remakes/emojis-b.png',3,2,['Muito apaixonada','Brava','Sonolenta','Preocupada','Chocada','Travessa']],
];
const remakes=[];
for(const [category,rel,c,r,labels] of remakePacks){
 const src=path.join(audit,rel), meta=await sharp(src).metadata(), cw=Math.floor(meta.width/c), ch=Math.floor(meta.height/r);
 for(let i=0;i<labels.length;i++){
   const out=path.join(audit,'remakes','itens',`${String(remakes.length+1).padStart(2,'0')}-${labels[i].toLowerCase().replaceAll(' ','-')}.png`); await fs.mkdir(path.dirname(out),{recursive:true});
   const crop=await sharp(src).extract({left:(i%c)*cw,top:Math.floor(i/c)*ch,width:cw,height:ch}).png().toBuffer();
   await sharp(crop).trim({background:{r:0,g:0,b:0,alpha:0},threshold:8}).resize(512,512,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toFile(out);
   remakes.push({category,label:labels[i],file:out});
 }
}
await contactSheet(remakes,'ASA — remakes em avaliação',`${remakes.length} reconstruções baseadas na folha enviada`,path.join(audit,'02-remakes-28.png'));

const refs=[
 ['Propostas 1','referencias/gemini-emocoes.jpg'],['Propostas 2','referencias/gemini-mascote.jpg'],['Propostas 3','referencias/gemini-rostos.jpg']
];
const rw=720,rh=1080,rpad=40,rhead=150,rwidth=rpad*2+rw*3+30*2,rheight=rhead+rh+80;
const refComp=[{input:Buffer.from(`<svg width="${rwidth}" height="${rhead}"><text x="40" y="62" font-family="Arial" font-size="36" font-weight="700" fill="#21183F">ASA — propostas originais</text><text x="40" y="100" font-family="Arial" font-size="18" fill="#5C5870">Três folhas para triagem de conceitos, duplicidades e adequação ao produto</text></svg>`),left:0,top:0}];
for(let i=0;i<refs.length;i++){const img=await sharp(path.join(audit,refs[i][1])).resize(rw,rh,{fit:'inside'}).jpeg().toBuffer();refComp.push({input:img,left:rpad+i*(rw+30),top:rhead});}
await sharp({create:{width:rwidth,height:rheight,channels:4,background:'#F7F7FC'}}).composite(refComp).png().toFile(path.join(audit,'03-propostas-originais.png'));

console.log(JSON.stringify({current:current.length,remakes:remakes.length,outputs:['01-acervo-atual.png','02-remakes-28.png','03-propostas-originais.png']}));
