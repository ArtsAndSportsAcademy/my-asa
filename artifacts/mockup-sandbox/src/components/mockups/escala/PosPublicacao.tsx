import { Star, ChevronLeft, Check, AlertTriangle, ChevronRight } from "lucide-react";

const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif";
const GRAD = "linear-gradient(90deg, #7C3AED, #2563EB)";

function NavBar() {
  const tabs = ["Painel", "Escala", "Solicitações", "Mensagens"];
  return (
    <div className="bg-white border-t border-gray-200 px-2 pt-2 pb-6 flex-shrink-0">
      <div className="flex justify-around">
        {tabs.map((t) => (
          <div key={t} className="flex flex-col items-center gap-1 px-1">
            <div className="w-1 h-1 rounded-full" style={{ background: t === "Escala" ? GRAD : "transparent" }} />
            <span className="text-[11px]" style={{ fontWeight: t === "Escala" ? 600 : 400, color: t === "Escala" ? "#7C3AED" : "#9CA3AF" }}>{t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PosPublicacao() {
  const slots = [
    { m: "Beatriz", r: "Astrid", sub: true, risk: false },
    { m: "Bruno", r: "Marcos", sub: false, risk: true },
    { m: "Carol", r: "Elena", sub: false, risk: false },
    { m: "Diego", r: "Figurante A", sub: false, risk: false },
    { m: "Sara", r: "Figurante B", sub: false, risk: false },
    { m: "Rafael", r: "Regência", sub: false, risk: false },
  ];

  return (
    <div className="flex flex-col bg-[#F5F5F7] overflow-hidden" style={{ width: 390, height: 844, fontFamily: FONT }}>
      <div className="bg-white px-6 pt-4 pb-1 flex justify-between flex-shrink-0">
        <span className="text-[15px] font-semibold text-gray-900">10:16</span>
        <span className="text-[13px] text-gray-400">19/06 Sex</span>
      </div>

      {/* Toast verde */}
      <div className="flex items-center gap-2.5 px-5 py-2.5 flex-shrink-0" style={{ background: "#4CAF50" }}>
        <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center">
          <Check size={11} style={{ color: "#4CAF50" }} strokeWidth={3} />
        </div>
        <p className="text-white text-[13px] font-semibold">Escala publicada · 8 notificados</p>
      </div>

      <div className="bg-white px-4 pt-2 pb-3 flex items-center gap-2 flex-shrink-0 border-b border-gray-100">
        <button className="flex items-center gap-1 text-gray-500">
          <ChevronLeft size={16} /><span className="text-[13px]">Painel</span>
        </button>
        <div className="flex-1 text-center"><span className="text-[16px] font-bold text-gray-900">Escala</span></div>
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] font-bold" style={{ background: GRAD }}>F</div>
      </div>

      {/* Date strip — com PUBL */}
      <div className="bg-white px-4 pb-2.5 flex-shrink-0 border-b border-gray-100">
        <div className="flex gap-4 mt-2">
          <div className="flex flex-col items-center gap-1">
            <span className="text-[12px] font-bold text-gray-900">Sáb 20</span>
            <div className="flex items-center gap-1">
              <Star size={10} style={{ color: "#7C3AED" }} fill="#7C3AED" />
              <span className="text-[9px] font-bold text-green-600">PUBL</span>
            </div>
            <div className="h-0.5 w-full rounded-full" style={{ background: GRAD }} />
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-[12px] text-gray-400">Dom 21</span>
            <Star size={10} className="text-gray-300" />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-2 flex flex-col gap-3">
        {/* Resumo publicado */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[13px] font-semibold text-gray-700">Sáb 20/06</p>
            <span className="text-[11px] px-2 py-0.5 rounded-full font-bold text-green-700 bg-green-50">✓ PUBLICADA</span>
          </div>
          <p className="text-[12px] text-gray-400 mb-3">Publicada às 10:16 por Fernanda · 5 cobertas · 1 risco aceito</p>

          {/* Barra de confirmações */}
          <div className="flex items-center gap-2 mb-1">
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-gray-200" style={{ width: "0%" }} />
            </div>
            <span className="text-[12px] font-semibold text-gray-500 flex-shrink-0">0/8 ✓</span>
          </div>
          <p className="text-[11px] text-gray-400">Aguardando confirmações dos membros</p>
        </div>

        {/* Atividade publicada */}
        <p className="text-[10px] font-semibold text-gray-400 tracking-widest uppercase px-1">Atividades — Sáb 20/06</p>
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ borderLeft: "4px solid #4CAF50" }}>
          <div className="px-4 pt-3 pb-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Star size={12} style={{ color: "#7C3AED" }} fill="#7C3AED" />
                <span className="text-[14px] font-bold text-gray-900">Musical das Estrelas</span>
              </div>
              <span className="text-[12px] font-semibold text-gray-500">15:00</span>
            </div>
            <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">PUBLICADA ✓</span>

            <div className="h-px bg-gray-100 my-2" />

            {slots.map((s) => (
              <div key={s.r} className="flex items-center gap-2 py-1.5">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0" style={{ background: s.sub ? GRAD : (s.risk ? "#FF9800" : "#E5E7EB"), color: (s.sub || s.risk) ? "white" : "#6B7280" }}>
                  {s.m[0]}
                </div>
                <div className="flex-1">
                  <span className="text-[13px] text-gray-700">{s.m}</span>
                  {s.sub && <span className="text-[10px] text-purple-500 ml-1">(substituta)</span>}
                </div>
                <span className="text-[12px] text-gray-400">{s.r}</span>
                {s.risk
                  ? <AlertTriangle size={13} style={{ color: "#FF9800" }} />
                  : <Check size={13} style={{ color: "#4CAF50" }} />
                }
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Painel pós-publicação */}
      <div className="bg-white border-t border-gray-200 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <p className="text-[13px] text-gray-500">Publicada · Monitorar confirmações</p>
          <button className="flex items-center gap-1 text-[12px] font-medium" style={{ color: "#7C3AED" }}>
            ← Ir ao Painel <ChevronRight size={13} />
          </button>
        </div>
      </div>

      <NavBar />
    </div>
  );
}
