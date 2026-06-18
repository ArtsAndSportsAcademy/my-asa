import { Sparkles, ChevronLeft, AlertTriangle, CheckCircle } from "lucide-react";

const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif";
const GRAD = "linear-gradient(135deg, #7C3AED, #2563EB)";

export function W7AnaliseIndividual() {
  return (
    <div className="flex flex-col bg-[#F5F5F7] overflow-hidden" style={{ width: 390, height: 844, fontFamily: FONT }}>
      {/* Status bar */}
      <div className="bg-white px-6 pt-4 pb-1 flex justify-between items-center flex-shrink-0">
        <span className="text-[15px] font-semibold text-gray-900">9:41</span>
        <span className="text-[13px] text-gray-400">17/06 Ter</span>
      </div>

      {/* Header fixo */}
      <div className="bg-white px-5 pt-2 pb-3 flex-shrink-0">
        <div className="flex items-center gap-3 mb-1">
          <button className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <ChevronLeft size={18} className="text-gray-600" />
          </button>
          <div className="flex-1">
            <p className="text-[16px] font-bold text-gray-900">Amanda Souza · Folga</p>
            <p className="text-[12px] text-gray-400">Sábado, 21 de junho · Dia inteiro</p>
          </div>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: "#D32F2F" }}>CRÍTICO</span>
        </div>
        {/* Progresso */}
        <p className="text-[11px] text-gray-400 ml-11">3 de 7 analisadas</p>
      </div>

      {/* Scrollable — 4 blocos sequenciais */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">

        {/* ══ BLOCO 1 — O PEDIDO ══ */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0" style={{ background: GRAD }}>1</div>
            <p className="text-[11px] font-bold text-gray-400 tracking-widest uppercase">O Pedido</p>
          </div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[14px] font-bold flex-shrink-0" style={{ background: "linear-gradient(135deg, #7C3AED55, #2563EB55)", color: "#7C3AED" }}>A</div>
            <div>
              <p className="text-[15px] font-semibold text-gray-900">Amanda Souza</p>
              <p className="text-[12px] text-gray-400">Membro · Ballet Principal</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl p-2.5" style={{ background: "#F5F5F7" }}>
              <p className="text-[10px] text-gray-400 uppercase font-semibold">Data</p>
              <p className="text-[13px] font-semibold text-gray-900 mt-0.5">Sáb 21/06</p>
            </div>
            <div className="rounded-xl p-2.5" style={{ background: "#F5F5F7" }}>
              <p className="text-[10px] text-gray-400 uppercase font-semibold">Período</p>
              <p className="text-[13px] font-semibold text-gray-900 mt-0.5">Dia inteiro</p>
            </div>
          </div>
          <div className="mt-2.5 rounded-xl p-2.5" style={{ background: "#F5F5F7" }}>
            <p className="text-[10px] text-gray-400 uppercase font-semibold mb-0.5">Motivo</p>
            <p className="text-[13px] text-gray-700">"Compromisso familiar."</p>
          </div>
        </div>

        {/* ══ BLOCO 2 — IMPACTO OPERACIONAL ══ */}
        <div className="bg-white rounded-2xl p-4 shadow-sm" style={{ borderLeft: "4px solid #7C3AED" }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0" style={{ background: GRAD }}>2</div>
            <p className="text-[11px] font-bold text-gray-400 tracking-widest uppercase">Impacto Operacional</p>
            <div className="flex items-center gap-1 ml-auto">
              <Sparkles size={11} style={{ color: "#7C3AED" }} />
              <span className="text-[10px] font-semibold" style={{ color: "#7C3AED" }}>IA</span>
            </div>
          </div>
          <p className="text-[12px] text-gray-500 mb-2">Amanda cobre no sábado 21:</p>

          {/* Papel crítico */}
          <div className="rounded-xl p-3 mb-2" style={{ background: "#FFF3F3", border: "1px solid #FECACA" }}>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={13} style={{ color: "#D32F2F" }} />
              <p className="text-[13px] font-bold" style={{ color: "#B91C1C" }}>Musical 12h30 · Astrid</p>
            </div>
            <p className="text-[12px]" style={{ color: "#D32F2F" }}>Papel único — sem substituto disponível</p>
          </div>

          {/* Papel coberto */}
          <div className="rounded-xl p-3" style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle size={13} style={{ color: "#16A34A" }} />
              <p className="text-[13px] font-bold" style={{ color: "#166534" }}>Ensaio 16h · Bloco 3</p>
            </div>
            <p className="text-[12px]" style={{ color: "#16A34A" }}>Beatriz Alves disponível como substituta</p>
          </div>

          {/* Recomendação IA */}
          <div className="mt-3 px-3 py-2.5 rounded-xl flex items-start gap-2" style={{ background: "#EDE9FE" }}>
            <Sparkles size={13} style={{ color: "#7C3AED" }} className="mt-0.5 flex-shrink-0" />
            <p className="text-[12px] leading-relaxed italic" style={{ color: "#5B21B6" }}>
              "Negociar data alternativa ou confirmar cobertura para Astrid antes de aprovar."
            </p>
          </div>
        </div>

        {/* ══ BLOCO 3 — ACUMULADO ══ */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0" style={{ background: GRAD }}>3</div>
            <p className="text-[11px] font-bold text-gray-400 tracking-widest uppercase">Impacto Acumulado</p>
          </div>
          <p className="text-[12px] text-gray-500 mb-2">Folgas aprovadas · Sáb 21/06:</p>
          <div className="flex flex-col gap-1.5 mb-3">
            {["Carlos Neto · aprovada 3 dias atrás", "Fernanda Lima · aprovada 1 dia atrás"].map((m, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#4CAF50" }} />
                <p className="text-[12px] text-gray-600">{m}</p>
              </div>
            ))}
          </div>

          {/* Cobertura visual */}
          <div className="rounded-xl p-3" style={{ background: "#FFF7ED", border: "1px solid #FDE68A" }}>
            <div className="flex justify-between mb-1.5">
              <p className="text-[11px] text-gray-500">Cobertura atual</p>
              <p className="text-[11px] font-bold text-gray-700">72%</p>
            </div>
            <div className="h-2 rounded-full bg-gray-100 mb-1.5">
              <div className="h-2 rounded-full" style={{ width: "72%", background: "#4CAF50" }} />
            </div>
            <div className="flex justify-between">
              <p className="text-[11px]" style={{ color: "#B45309" }}>Se Amanda for aprovada</p>
              <p className="text-[11px] font-bold" style={{ color: "#D32F2F" }}>61% ⚠</p>
            </div>
            <div className="h-2 rounded-full bg-gray-100 mt-1 mb-1.5">
              <div className="h-2 rounded-full" style={{ width: "61%", background: "#FF9800" }} />
            </div>
            <p className="text-[11px]" style={{ color: "#D32F2F" }}>Astrid ficaria descoberta</p>
          </div>
        </div>

        {/* ══ BLOCO 4 — DECISÃO ══ */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0" style={{ background: GRAD }}>4</div>
            <p className="text-[11px] font-bold text-gray-400 tracking-widest uppercase">Decisão</p>
          </div>
          <div className="flex flex-col gap-2">
            <button className="w-full py-4 rounded-2xl text-white text-[16px] font-bold shadow-sm" style={{ background: GRAD }}>
              ✓ Aprovar
            </button>
            <button className="w-full py-3.5 rounded-2xl text-[14px] font-semibold border border-gray-200 text-gray-700">
              ↗ Propor data alternativa
            </button>
            <button className="w-full py-3.5 rounded-2xl text-[14px] font-semibold border border-gray-200 text-gray-700">
              ✕ Negar
            </button>
          </div>
        </div>

        <div className="h-2" />
      </div>

      {/* Bottom Nav Supervisor */}
      <div className="bg-white border-t border-gray-200 px-2 pt-2 pb-6 flex-shrink-0">
        <div className="flex justify-around">
          {["Painel", "Escala", "Solicitações", "Mensagens"].map((t) => (
            <div key={t} className="flex flex-col items-center gap-1 px-1">
              <div className="w-1 h-1 rounded-full" style={{ background: t === "Solicitações" ? GRAD : "transparent" }} />
              <span className="text-[11px]" style={{ fontWeight: t === "Solicitações" ? 600 : 400, color: t === "Solicitações" ? "#7C3AED" : "#9CA3AF" }}>{t}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
