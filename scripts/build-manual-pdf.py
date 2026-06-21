import re
import markdown
from xhtml2pdf import pisa

SRC = "docs/MANUAL.md"
OUT = "docs/MANUAL.pdf"

with open(SRC, encoding="utf-8") as f:
    md_text = f.read()

html_body = markdown.markdown(
    md_text,
    extensions=["tables", "fenced_code", "toc", "sane_lists"],
)

CSS = """
@page {
  size: A4;
  margin: 2cm 1.8cm 2.2cm 1.8cm;
  @frame footer {
    -pdf-frame-content: footerContent;
    bottom: 1cm; left: 1.8cm; right: 1.8cm; height: 1cm;
  }
}
body { font-family: Helvetica, Arial, sans-serif; font-size: 10.5pt; color: #1f2937; line-height: 1.5; }
h1 { font-size: 22pt; color: #4338ca; border-bottom: 3px solid #4338ca; padding-bottom: 6px; margin-top: 4px; }
h2 { font-size: 15pt; color: #3730a3; margin-top: 20px; border-bottom: 1px solid #c7d2fe; padding-bottom: 3px; }
h3 { font-size: 12.5pt; color: #4f46e5; margin-top: 14px; }
h4 { font-size: 11pt; color: #6366f1; margin-top: 10px; }
p { margin: 4px 0; }
ul { margin: 4px 0 8px 0; }
li { margin: 2px 0; }
strong { color: #111827; }
code { background: #eef2ff; color: #3730a3; padding: 1px 4px; border-radius: 3px; font-family: monospace; font-size: 9.5pt; }
table { border-collapse: collapse; width: 100%; margin: 8px 0; }
th { background: #4338ca; color: #ffffff; text-align: left; padding: 6px 8px; font-size: 9.5pt; }
td { border: 1px solid #c7d2fe; padding: 5px 8px; font-size: 9.5pt; vertical-align: top; }
tr:nth-child(even) td { background: #f5f7ff; }
blockquote { background: #f5f7ff; border-left: 4px solid #6366f1; margin: 8px 0; padding: 6px 12px; color: #374151; }
hr { border: 0; border-top: 1px solid #e5e7eb; margin: 16px 0; }
"""

html = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><style>{CSS}</style></head>
<body>
<div id="footerContent" style="text-align:center; font-size:8pt; color:#9ca3af;">
  MyASA 2.0 — Manual &nbsp;|&nbsp; pagina <pdf:pagenumber> de <pdf:pagecount>
</div>
{html_body}
</body>
</html>"""

with open(OUT, "w+b") as out_file:
    result = pisa.CreatePDF(html, dest=out_file, encoding="utf-8")

if result.err:
    raise SystemExit(f"Erro ao gerar PDF: {result.err}")
print(f"PDF gerado: {OUT}")
