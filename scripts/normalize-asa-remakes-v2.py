from pathlib import Path
from PIL import Image

ROOT = Path('artifacts/brand/asa-mascot-kit/auditoria/remakes-v2').resolve()
SOURCE = ROOT / 'source'
OUT = ROOT / 'itens'
OUT.mkdir(parents=True, exist_ok=True)

CANVAS = 512
SAFE = 62
MAX_CONTENT = CANVAS - SAFE * 2

for src in sorted(SOURCE.glob('*.png')):
    image = Image.open(src).convert('RGBA')
    bbox = image.getchannel('A').getbbox()
    if not bbox:
        raise ValueError(f'Imagem vazia: {src.name}')
    content = image.crop(bbox)
    scale = min(MAX_CONTENT / content.width, MAX_CONTENT / content.height)
    size = (max(1, round(content.width * scale)), max(1, round(content.height * scale)))
    content = content.resize(size, Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (CANVAS, CANVAS), (0, 0, 0, 0))
    position = ((CANVAS - size[0]) // 2, (CANVAS - size[1]) // 2)
    canvas.alpha_composite(content, position)
    canvas.save(OUT / src.name, optimize=True)

print(f'{len(list(OUT.glob("*.png")))} imagens normalizadas em {OUT}')
