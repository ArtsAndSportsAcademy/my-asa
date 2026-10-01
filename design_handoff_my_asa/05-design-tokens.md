# Design tokens

## Tipografia

Três famílias, do Google Fonts:

```html
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet" />
```

| uso | família | peso | tamanho | espaçamento |
|---|---|---|---|---|
| Título de tela | Outfit | 700 | 38px | -0.02em |
| Título de seção | Outfit | 600 | 26px | -0.01em |
| Título de cartão | Outfit | 600 | 15–17px | — |
| Número grande | Outfit | 700 | 34px | -0.02em |
| Corpo | Manrope | 400/600 | **12–15px** | — |
| Etiqueta (maiúsculas) | JetBrains Mono | 500/700 | 10–11px | .14–.18em |

**Piso de tamanho — corrigir na implementação:** o protótipo usa texto abaixo de 11px em
várias telas (chega a 7,5px na Escala). Na implementação: **mínimo 12px para qualquer texto
que se lê**, 11px só para etiqueta em maiúsculas. Isso é dívida conhecida do protótipo.

## Cores

### Tinta e superfície
| token | hex | uso |
|---|---|---|
| tinta | `#1b1630` | texto principal |
| tinta-escura | `#1c1440` | botão sólido, fundo do app mobile |
| texto-secundario | `#6b6482` | apoio, etiqueta |
| texto-corpo | `#5b5473` | parágrafo longo |
| fundo | `#faf8ff` | página |
| superficie | `#ffffff` | cartão |
| borda | `#e6e1f2` | borda padrão |
| borda-suave | `#f0ecf8` / `#f5f2fa` | divisória interna |

### Primária
| token | hex | uso |
|---|---|---|
| roxo | `#6C2BF2` | ação primária, destaque, foco |
| roxo-escuro | `#5B23C9` | roxo como texto pequeno |
| roxo-claro | `#f3ecfe` | fundo tingido |
| rosa-personagem | `#C2508F` | **só no mapa de palco**: marcador de papel nomeado (personagem), para distinguir da posição numerada, que é roxa. Não use em nenhum outro lugar |

### Semânticas
Cada uma tem **matiz** (barra, ponto, fundo) e **tinta** (texto pequeno — mais escura, por contraste):

| significado | matiz | tinta | fundo |
|---|---|---|---|
| positivo / feito | `#0E8F86` | `#0A6F68` | `#e3f4f1` |
| atenção / atraso | `#C97A17` | `#8F5409` | `#fdf3e4` |
| erro / falta | `#C2334D` | `#C2334D` | `#fdeef1` |
| informação | `#2E63D6` | `#2E63D6` | `#eaf0fd` |

**Regra**: texto pequeno usa a tinta, não a matiz. Contraste mínimo 4,5:1.

## Forma e sombra

| token | valor | uso |
|---|---|---|
| raio-pilula | `999px` | botão, chip, aba |
| raio-cartao | `14–18px` | cartão, painel |
| raio-pequeno | `6–12px` | etiqueta, caixa pequena |
| sombra-painel | `0 20px 44px -30px rgba(40,20,90,.5)` | moldura de tela |
| foco | `box-shadow: 0 0 0 3px <cor>1a` | anel de foco |

## Espaçamento

Escala de 4: `4 · 8 · 10 · 12 · 14 · 16 · 20 · 26px`.
Layout com **flex/grid + gap**, nunca margens soltas.

## Componentes

### Botão primário
```
background:#1c1440; color:#fff; border:none; border-radius:999px;
font-family:Manrope; font-size:13px; font-weight:700;
padding:10px 18px; min-height:44px; cursor:pointer;
```

### Botão secundário
```
background:#fff; color:#6b6482; border:1px solid #e6e1f2; border-radius:999px;
font-size:13px; font-weight:600; padding:8px 14px; min-height:44px;
```

### Cartão
```
background:#fff; border:1px solid #e6e1f2; border-radius:16px; padding:16px 18px;
```

### Chip / filtro
```
border-radius:999px; padding:8px 13px; font-size:12px; font-weight:600;
ativo:  border:1px solid <cor>; background:<cor>14; color:<tinta>;
inativo: border:1px solid #e6e1f2; background:#fff; color:#6b6482;
```

### Etiqueta de estado
```
font-family:'JetBrains Mono'; font-size:10.5px; font-weight:700;
letter-spacing:.06em; text-transform:uppercase;
padding:3px 8px; border-radius:6px;
background:<fundo semântico>; color:<tinta semântica>;
```

## Alvos de toque

**Mínimo 44px de altura** em qualquer coisa clicável. O protótipo tem alvos de 32 a 38px em
8 telas — corrigir na implementação. O elenco usa no celular, de pressa, no camarim.

## Telas

- **Web**: desenhado em 1920×1080. Barra lateral de navegação à esquerda (~230px),
  cabeçalho fino no topo, conteúdo em grid.
- **Mobile**: 390×844. Abas no rodapé, botão de voltar no cabeçalho, assistente como botão
  flutuante. Nenhuma tela pode ser sem saída.

O app é responsivo: mesma rota, mesmo conteúdo, layout que reflui.
