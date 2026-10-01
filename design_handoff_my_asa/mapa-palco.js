/* Geometria do palco — fonte única do mapa.
   Usada pelo Livro do Show (13) e pelo Livro do Dia (14): mesmo palco,
   mesmas áreas, mesmo cálculo de posição. Nenhuma tela desenha por conta própria. */
(function () {
  var LBL = ["1", "2", "3", "&", "4", "5", "6"];

  var STAGES = {
    /* Medida real da pista, levantada em campo (uploads/medidas_pista.png):
       externo 52,5 m × 74,5 m · braço inferior 25,9 m de largura a partir de 26,6 m
       · altura do bloco superior 35,2 m. Normalizado: recorte em x=50.7%, y=47.2%.
       ratio = 52.5/74.5 — o mapa é MAIS ALTO QUE LARGO; quem desenha deve respeitar. */
    L: {
      label: "L — pista de patinação",
      ratio: 0.705,
      points: "0,0 100,0 100,100 50.7,100 50.7,47.2 0,47.2",
      clip: "polygon(0% 0%, 100% 0%, 100% 100%, 50.7% 100%, 50.7% 47.2%, 0% 47.2%)",
      areas: { BL: [4, 6, 18, 34], BR: [56, 54, 36, 40], PER: [30, 14, 34, 20] },
      zones: [["BACKSTAGE LEFT", 12, 7], ["CENTRO", 40, 25], ["STAGE LEFT", 10, 43],
              ["BACKSTAGE RIGHT", 76, 52], ["DOWNSTAGE", 76, 94]],
      openings: [[16, 0, "h"], [40, 0, "h"], [64, 0, "h"], [88, 0, "h"],
                 [100, 62, "v"], [48, 47.2, "h"]],
      notes: [[70, 26], [96, 74]]
    },
    RET: {
      label: "Retângulo",
      ratio: 1.4,
      points: "0,0 100,0 100,100 0,100",
      clip: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
      areas: { BL: [8, 26, 24, 60], BR: [68, 26, 24, 60], PER: [36, 13, 28, 7] },
      zones: [["BACKSTAGE LEFT", 16, 4], ["BACKSTAGE RIGHT", 84, 4],
              ["CENTRO", 50, 52], ["DOWNSTAGE", 50, 96]],
      openings: [[26, 0, "h"], [74, 0, "h"], [0, 50, "v"], [100, 50, "v"]],
      notes: [[50, 22], [50, 82]]
    },
    QUAD: {
      label: "Quadrado",
      ratio: 1,
      points: "14,0 86,0 86,100 14,100",
      clip: "polygon(14% 0%, 86% 0%, 86% 100%, 14% 100%)",
      areas: { BL: [20, 26, 20, 60], BR: [60, 26, 20, 60], PER: [36, 13, 28, 7] },
      zones: [["BACKSTAGE LEFT", 27, 4], ["BACKSTAGE RIGHT", 73, 4],
              ["CENTRO", 50, 52], ["DOWNSTAGE", 50, 96]],
      openings: [[30, 0, "h"], [70, 0, "h"]],
      notes: [[50, 24], [50, 80]]
    },
    NONE: {
      label: "Sem palco",
      ratio: 1,
      points: "", clip: "",
      areas: { BL: [0, 0, 0, 0], BR: [0, 0, 0, 0], PER: [0, 0, 0, 0] },
      zones: [], openings: [], notes: [[0, 0], [0, 0]]
    }
  };

  var MODES = { inicial: "line", splice: "diag", locacao: "arc", saida: "front" };

  /* Marcador tem 24-28px num mapa de ~394px: 7% na horizontal e 8% na vertical é o mínimo
     entre centros. O posicionamento é uma grade que respeita esse mínimo — o "modo" do quadro
     só desloca cada marcador dentro da folga da grade, então nunca pode gerar sobreposição. */
  var GAP_X = 7, GAP_Y = 8;

  function layout(side, labels, area, mode) {
    var ax = area[0], ay = area[1], aw = area[2], ah = area[3];
    var n = labels.length;
    if (!n) return [];

    var rowsFit = Math.max(1, Math.floor(ah / GAP_Y) + 1);
    var colsFit = Math.max(1, Math.floor(aw / GAP_X) + 1);
    var cols = Math.min(n, Math.max(Math.ceil(n / rowsFit), Math.min(colsFit, n)));
    var rows = Math.ceil(n / cols);

    var swing = Math.min(6, ah * 0.22);
    var out = [];
    for (var i = 0; i < n; i++) {
      var r = Math.floor(i / cols);
      var inRow = Math.min(cols, n - r * cols);
      var c = i - r * cols;
      var cf = inRow < 2 ? 0.5 : c / (inRow - 1);
      var rf = rows < 2 ? 0.5 : (r + 0.5) / rows;

      var x = ax + aw * (inRow < 2 ? 0.5 : cf);
      var y = ay + ah * rf;

      if (mode === "diag") y += (cf - 0.5) * swing;
      else if (mode === "arc") y -= Math.sin(Math.PI * cf) * swing * 0.9;
      else if (mode === "front") y += swing * 0.5;
      else y += (i % 2 ? 1 : -1) * swing * 0.35;

      out.push({ side: side, label: labels[i], x: x, y: y });
    }
    return out;
  }

  /* scene: { bl: [...], br: [...], chars: [[label, ...], ...] } — só a contagem e os rótulos importam. */
  function buildMarkers(scene, kind, stage) {
    if (!stage.points) return [];
    var mode = MODES[kind] || "line";
    return [].concat(
      layout("BL", scene.bl.map(function (n, i) { return LBL[i]; }), stage.areas.BL, mode),
      layout("BR", scene.br.map(function (n, i) { return LBL[i]; }), stage.areas.BR, mode),
      layout("PER", scene.chars.map(function (c) { return c[0]; }), stage.areas.PER, "line")
    );
  }

  window.ASA_MAPA = {
    LBL: LBL, STAGES: STAGES, MODES: MODES,
    GAP_X: GAP_X, GAP_Y: GAP_Y,
    layout: layout, buildMarkers: buildMarkers
  };
})();
