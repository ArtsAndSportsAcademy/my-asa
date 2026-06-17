import { ChevronLeft, Check, AlertTriangle, Sparkles } from "lucide-react";

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

export function SimulacaoCascata() {
  return (
    <div className="flex flex-col bg-[#F5F5F7] overflow-hidden" style={{ width: 390, height: 844, fontFamily: FONT }}>
      <div className="bg-white px-6 pt-4 pb-1 flex justify-between flex-shrink-0">
        <span className="text-[15px] font-semibold text-gray-900">09:36</span>
        <span className="text-[13px] text-gray-400">19/06 Sex</span>
      </div>

      {/* Header */}
      <div className="bg-white px-4 pt-2 pb-3 flex items-center gap-2 flex-shrink-0 border-b border-gray-100">
        <button className="flex items-center gap-1 text-gray-500">
          <ChevronLeft size={16} /><span className="text-[13px]">Candidatos</span>
        </button>
        <div className="flex-1 text-center">
          <span className="text-[15px] font-bold text-gray-900">Impacto da Troca</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-3 flex flex-col gap-4">
        {/* Card de escolha — compacto */}
        <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-green-200" style={{ borderLeft: "4px solid #4CAF50" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-green-50 flex items-center justify-center">
              <Check size={16} style={{ color: "#4CAF50" }} strokeWidth={3} />
            </div>
            <div>
              <p className="text-[15px] font-bold text-gray-900">Beatriz → Astrid</p>
              <p className="text-[12px] text-gray-400">Musical das Estrelas · Sáb 20/06 · 15:00</p>
            </div>
          </div>
        </div>

        {/* Seção de cascata */}
        <div>
          <p className="text-[10px] font-semibold text-gray-400 tracking-widest uppercase mb-3 px-1">Impacto desta troca</p>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* O que resolve — verde */}
            <div className="px-4 py-4" style={{ background: "#F0FAF2" }}>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check size={14} style={{ color: "#4CAF50" }} strokeWidth={3} />
                </div>
                <div>
                  <p className="text-[14px] font-bold" style={{ color: "#2E7D32" }}>Astrid no Musical das Estrelas</p>
                  <p className="text-[13px] text-gray-600 mt-0.5">Sáb 20 · 15h → <span className="font-semibold text-green-700">coberta</span></p>
                  <p className="text-[12px] text-gray-400 mt-1">A posição principal fica protegida com a titular habitual</p>
                </div>
              </div>
            </div>

            <div className="h-px bg-gray-100" />

            {/* O que fica exposto — âmbar */}
            <div className="px-4 py-4" style={{ background: "#FFFBF0" }}>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "#FFE082" }}>
                  <AlertTriangle size={13} style={{ color: "#E65100" }} />
                </div>
                <div>
                  <p className="text-[14px] font-semibold" style={{ color: "#E65100" }}>Beatriz era backup de Bloco 3</p>
                  <p className="text-[13px] text-gray-600 mt-0.5">Ensaio de Sáb · 09:00 · Bloco 3 → <span className="font-semibold text-amber-600">sem backup</span></p>
                  <p className="text-[12px] text-gray-400 mt-1">Se a titular de Bloco 3 faltar, não há cobertura definida</p>
                </div>
              </div>
            </div>

            <div className="h-px bg-gray-100" />

            {/* IA — avaliação */}
            <div className="px-4 py-4" style={{ borderLeft: "4px solid #7C3AED" }}>
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: GRAD }}>
                  <Sparkles size={9} color="white" />
                </div>
                <p className="text-[13px] italic leading-relaxed" style={{ color: "#5B21B6" }}>
                  Vale a troca. Bloco 3 no Ensaio tem Carolina disponível como backup — sem risco real. Astrid no show é a prioridade.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Espaço visual antes dos botões */}
        <div className="flex-1" />

        {/* Botões de ação */}
        <div className="flex flex-col gap-3 pb-2">
          <button
            className="w-full py-4 rounded-2xl text-white text-[16px] font-bold shadow-sm"
            style={{ background: GRAD }}
          >
            Confirmar: Beatriz = Astrid
          </button>
          <button className="w-full py-3 rounded-2xl text-[14px] font-medium text-gray-500 bg-white border border-gray-200">
            Escolher outro candidato
          </button>
        </div>
      </div>

      <NavBar />
    </div>
  );
}
