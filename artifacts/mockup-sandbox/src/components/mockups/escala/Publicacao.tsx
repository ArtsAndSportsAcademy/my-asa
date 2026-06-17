import { Star, ChevronLeft, Check, AlertTriangle, Sparkles } from "lucide-react";

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

export function Publicacao() {
  return (
    <div className="flex flex-col bg-[#F5F5F7] overflow-hidden" style={{ width: 390, height: 844, fontFamily: FONT }}>
      <div className="bg-white px-6 pt-4 pb-1 flex justify-between flex-shrink-0">
        <span className="text-[15px] font-semibold text-gray-900">10:15</span>
        <span className="text-[13px] text-gray-400">19/06 Sex</span>
      </div>

      <div className="bg-white px-4 pt-2 pb-3 flex items-center gap-2 flex-shrink-0 border-b border-gray-100">
        <button className="flex items-center gap-1 text-gray-500">
          <ChevronLeft size={16} /><span className="text-[13px]">Painel</span>
        </button>
        <div className="flex-1 text-center"><span className="text-[16px] font-bold text-gray-900">Escala</span></div>
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] font-bold" style={{ background: GRAD }}>F</div>
      </div>

      {/* Date strip */}
      <div className="bg-white px-4 pb-2.5 flex-shrink-0 border-b border-gray-100">
        <div className="flex gap-4 mt-2">
          {[{ d: "Sáb 20", show: true, selected: true }, { d: "Dom 21", show: false, selected: false }].map((day) => (
            <div key={day.d} className="flex flex-col items-center gap-1">
              <span className="text-[12px]" style={{ fontWeight: day.selected ? 700 : 400, color: day.selected ? "#1F2937" : "#9CA3AF" }}>{day.d}</span>
              {day.show && <Star size={10} style={{ color: "#7C3AED" }} fill="#7C3AED" />}
              {day.selected && <div className="h-0.5 w-full rounded-full" style={{ background: GRAD }} />}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-2 flex flex-col gap-3">
        {/* Resumo */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-[13px] font-semibold text-gray-700 mb-2">Sáb 20/06 · Resumo</p>
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: "92%", background: GRAD }} />
            </div>
            <span className="text-[12px] font-bold text-gray-700 flex-shrink-0">5/6 ✓</span>
          </div>
          <div className="flex gap-3">
            <span className="text-[11px] text-green-600">5 cobertas</span>
            <span className="text-[11px] text-amber-600">1 risco aceito</span>
          </div>
        </div>

        {/* Painel de Validação expandido para publicação */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 pt-4 pb-2" style={{ background: GRAD }}>
            <p className="text-[16px] font-bold text-white">Publicar Escala</p>
            <p className="text-white text-[12px] opacity-80">Sáb 20/06 · Musical das Estrelas</p>
          </div>

          <div className="px-4 py-4">
            {/* Checklist de estado */}
            <div className="flex flex-col gap-2 mb-4">
              <div className="flex items-center gap-2">
                <Check size={15} style={{ color: "#4CAF50" }} strokeWidth={3} />
                <span className="text-[13px] text-gray-700">5 posições cobertas</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} style={{ color: "#FF9800" }} />
                <span className="text-[13px] text-gray-600">1 risco ativo <span className="text-gray-400">(Bruno/Marcos · restrição lombar)</span></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[14px] text-gray-400">—</span>
                <span className="text-[13px] text-gray-500">0 posições em aberto</span>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl px-3 py-2.5 mb-4">
              <p className="text-[12px] text-gray-500">Membros a notificar: <span className="font-bold text-gray-700">8</span></p>
              <p className="text-[11px] text-gray-400 mt-0.5">todos que têm posição no Sáb 20</p>
            </div>

            <div className="h-px bg-gray-100 mb-3" />

            {/* IA confirma */}
            <div className="flex items-start gap-2 mb-4" style={{ borderLeft: "3px solid #7C3AED", paddingLeft: "10px" }}>
              <Sparkles size={12} style={{ color: "#7C3AED" }} className="flex-shrink-0 mt-0.5" />
              <p className="text-[12px] italic text-gray-500 leading-relaxed">
                Escala está bem coberta. O risco do Bruno é baixo se ele aqueceu adequadamente. Você decidiu manter — OK.
              </p>
            </div>

            {/* Botão principal */}
            <button className="w-full py-4 rounded-xl text-white text-[16px] font-bold mb-3 shadow-sm" style={{ background: GRAD }}>
              Publicar Escala
            </button>
            <button className="w-full py-2.5 rounded-xl text-[14px] font-medium text-gray-500 bg-gray-50">
              Continuar editando
            </button>
          </div>
        </div>
      </div>

      <NavBar />
    </div>
  );
}
