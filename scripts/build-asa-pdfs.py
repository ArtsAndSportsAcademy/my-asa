from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader

ROOT = Path('artifacts/brand/asa-mascot-kit').resolve()
OUT = Path('output/pdf').resolve()
OUT.mkdir(parents=True, exist_ok=True)

pdfmetrics.registerFont(TTFont('ASA-Regular', r'C:\Windows\Fonts\arial.ttf'))
pdfmetrics.registerFont(TTFont('ASA-Bold', r'C:\Windows\Fonts\arialbd.ttf'))

PACKS = [
    ('Essenciais', ROOT / 'stickers'),
    ('Operações', ROOT / 'operations' / '512'),
    ('Emojis', ROOT / 'emojis' / '512'),
    ('Acolhimento', ROOT / 'acolhimento' / '512'),
    ('Estados do sistema', ROOT / 'system-states' / '512'),
    ('Figurinhas com falas', ROOT / 'falas' / '512'),
    ('Comunicação', ROOT / 'comunicacao' / '512'),
    ('Perfil e equipe', ROOT / 'perfil-equipe' / '512'),
]

REMAKES_V2 = ROOT / 'auditoria' / 'remakes-v2' / 'itens'
EXTRA_PACKS = [
    ('Novas figurinhas', list(sorted(REMAKES_V2.glob('*.png')))[:16]),
    ('Emojis ASA', list(sorted(REMAKES_V2.glob('*.png')))[16:]),
]

def pretty(path):
    words = path.stem.removeprefix('asa-').replace('-', ' ').split()
    fixes = {'oi':'Oi', 'voce':'você', 'conexao':'conexão', 'orientacao':'orientação',
             'celebracao':'celebração', 'gratidao':'gratidão', 'manutencao':'manutenção',
             'notificacoes':'notificações', 'comunicacao':'comunicação',
             'concluido':'concluído', 'aniversario':'aniversário'}
    return ' '.join(fixes.get(w, w.capitalize()) for w in words)

def footer(c, page_num, label):
    w, _ = landscape(A4)
    c.setFont('ASA-Regular', 7.5)
    c.setFillColor(HexColor('#777287'))
    c.drawString(30, 18, f'My ASA - {label}')
    c.drawRightString(w - 30, 18, str(page_num))

def draw_header(c, title, subtitle):
    w, h = landscape(A4)
    c.setFillColor(HexColor('#201744'))
    c.setFont('ASA-Bold', 22)
    c.drawString(34, h - 38, title)
    c.setFillColor(HexColor('#625D73'))
    c.setFont('ASA-Regular', 9)
    c.drawString(34, h - 55, subtitle)
    c.setStrokeColor(HexColor('#DDD6F5'))
    c.line(34, h - 66, w - 34, h - 66)

def draw_grid_page(c, title, files, page_num, total, subtitle):
    w, h = landscape(A4)
    draw_header(c, title, subtitle)
    cols, rows = 3, 2
    gap_x, gap_y = 12, 12
    left, right, top, bottom = 34, 34, 78, 34
    cw = (w - left - right - gap_x * 2) / cols
    ch = (h - top - bottom - gap_y) / rows
    for i, fp in enumerate(files):
        col, row = i % cols, i // cols
        x = left + col * (cw + gap_x)
        y = h - top - (row + 1) * ch - row * gap_y
        c.setFillColor(HexColor('#FFFFFF'))
        c.setStrokeColor(HexColor('#E4DFF2'))
        c.roundRect(x, y, cw, ch, 12, fill=1, stroke=1)
        max_img = min(cw - 34, ch - 42)
        c.drawImage(ImageReader(str(fp)), x + (cw-max_img)/2, y + 29, max_img, max_img,
                    preserveAspectRatio=True, anchor='c', mask='auto')
        c.setFillColor(HexColor('#251C48'))
        c.setFont('ASA-Bold', 9)
        c.drawCentredString(x + cw/2, y + 12, pretty(fp))
    footer(c, page_num, title)
    c.showPage()

def package_pdf(title, folder, out_path):
    files = sorted(folder.glob('*.png'))
    c = canvas.Canvas(str(out_path), pagesize=landscape(A4))
    pages = (len(files) + 5)//6
    for p in range(pages):
        draw_grid_page(c, f'ASA - {title}', files[p*6:(p+1)*6], p+1, pages,
                       f'{len(files)} assets com fundo transparente e área segura')
    c.save()
    return files

def cover(c, title, subtitle, count):
    w, h = landscape(A4)
    c.setFillColor(HexColor('#F7F6FC')); c.rect(0,0,w,h,fill=1,stroke=0)
    c.setFillColor(HexColor('#24194B')); c.setFont('ASA-Bold', 34)
    c.drawString(54, h-130, title)
    c.setFillColor(HexColor('#6F54D9')); c.setFont('ASA-Bold', 13)
    c.drawString(56, h-160, f'{count} figurinhas organizadas por pacote')
    c.setFillColor(HexColor('#625D73')); c.setFont('ASA-Regular', 11)
    c.drawString(56, h-192, subtitle)
    c.setFillColor(HexColor('#EEE9FF')); c.roundRect(54, 70, w-108, 180, 24, fill=1, stroke=0)
    c.setFillColor(HexColor('#322263')); c.setFont('ASA-Bold', 16)
    c.drawString(78, 210, 'Padrao de exportacao')
    c.setFont('ASA-Regular', 11)
    c.drawString(78, 176, 'PNG transparente - área segura - nenhuma asa ou acessório cortado')
    c.drawString(78, 146, 'Versoes de uso: 512 px, 128 px, 64 px e 32 px')
    c.drawString(78, 116, 'Arquivo de avaliação visual - My ASA')
    c.showPage()

def catalog_pdf(out_path):
    total = sum(len(list(folder.glob('*.png'))) for _,folder in PACKS) + sum(len(files) for _, files in EXTRA_PACKS)
    c = canvas.Canvas(str(out_path), pagesize=landscape(A4))
    cover(c, 'ASA - Catálogo completo', 'Coleção oficial atual da mascote ASA', total)
    page = 1
    for title, folder in PACKS:
        files = sorted(folder.glob('*.png'))
        for i in range(0, len(files), 6):
            draw_grid_page(c, f'ASA - {title}', files[i:i+6], page, 0,
                           f'Pacote {title} - {len(files)} assets')
            page += 1
    for title, files in EXTRA_PACKS:
        for i in range(0, len(files), 6):
            draw_grid_page(c, f'ASA - {title}', files[i:i+6], page, 0,
                           f'Pacote {title} - {len(files)} assets refeitos')
            page += 1
    c.save()

def remakes_pdf(out_path):
    files = sorted(REMAKES_V2.glob('*.png'))
    c = canvas.Canvas(str(out_path), pagesize=landscape(A4))
    cover(c, 'ASA - Figurinhas e emojis refeitos', 'Coleção corrigida com a identidade completa da mascote', len(files))
    for p, i in enumerate(range(0, len(files), 6), start=1):
        section = 'Novas figurinhas' if i < 16 else 'Emojis ASA'
        draw_grid_page(c, f'ASA - {section}', files[i:i+6], p, 0,
                       f'{len(files)} assets refeitos com margem segura')
    c.save()

for title, folder in PACKS:
    slug = title.lower().replace(' ', '-').replace('ç','c').replace('ã','a').replace('õ','o')
    package_pdf(title, folder, OUT / f'asa-pacote-{slug}.pdf')

catalog_pdf(OUT / 'asa-catalogo-completo.pdf')
remakes_pdf(OUT / 'asa-remakes-em-avaliacao.pdf')
print('\n'.join(str(p) for p in sorted(OUT.glob('asa-*.pdf'))))
