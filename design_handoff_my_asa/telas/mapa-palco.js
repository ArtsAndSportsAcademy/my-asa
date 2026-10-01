/* Geometria do palco — fonte única do mapa.
   Usada pelo Livro do Show (13) e pelo Livro do Dia (14): mesmo palco,
   mesmas áreas, mesmo cálculo de posição. Nenhuma tela desenha por conta própria. */
(function () {
  var LBL = ["1", "2", "3", "&", "4", "5", "6"];

  var STAGES = {
    L: {
      label: "L — pista de patinação",
      points: "0,0 100,0 100,100 71,100 71,45 0,45",
      clip: "polygon(0% 0%, 100% 0%, 100% 100%, 71% 100%, 71% 45%, 0% 45%)",
      areas: { BL: [5, 12, 30, 20], BR: [74, 56, 22, 38], PER: [46, 12, 20, 20] },
      zones: [["BACKSTAGE LEFT", 15, 5], ["BACKSTAGE RIGHT", 86, 5],
              ["STAGE LEFT", 11, 41], ["CENTRO", 45, 41], ["DOWNSTAGE", 85, 96]],
      openings: [[16, 0, "h"], [45, 0, "h"], [88, 0, "h"], [100, 70, "v"], [71, 62, "v"], [34, 45, "h"]],
      notes: [[62, 41], [96, 50]]
    },
    RET: {
      label: "Retângulo",
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
