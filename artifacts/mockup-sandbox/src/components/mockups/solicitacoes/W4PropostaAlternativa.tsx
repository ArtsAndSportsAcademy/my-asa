import { Clock, ChevronLeft, MessageSquare } from "lucide-react";

const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif";
const GRAD = "linear-gradient(135deg, #7C3AED, #2563EB)";

export function W4PropostaAlternativa() {
  return (
    <div className="flex flex-col bg-[#F5F5F7] overflow-hidden" style={{ width: 390, height: 844, fontFamily: FONT }}>
      {/* Status bar */}
      <div className="bg-white px-6 pt-4 pb-1 flex justify-between items-center flex-shrink-0">
        <span className="text-[15px] font-semibold text-gray-900">9:41</span>
        <span className="text-[13px] text-gray-400">17/06 Ter</span>
      </div>

      {/* Header */}
      <div className="bg-white px-5 pt-2 pb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <ChevronLeft size={18} className="text-gray-600" />
          </button>
          <div>
            <p className="text-[18px] font-bold text-gray-900">Pedir folga</p>
            <p className="text-[12px] text-gray-400">Supervisora Ana Silva</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">

        {/* PRAZO — domina visualmente, topo, impossível de ignorar */}
        <div className="rounded-2xl p-4 shadow-md" style={{ background: "#FFF7ED", border: "2px solid #F59E0B" }}>
          <div className="flex items-center gap-2 mb-2">
            <Clock size={18} style={{ color: "#B45309" }} />
            <p className="text-[13px] font-bold uppercase tracking-wide" style={{ color: "#B45309" }}>Resposta Necessária</p>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-[32px] font-black" style={{ color: "#92400E" }}>19h</p>
            <p className="text-[18px] font-bold" style={{ color: "#B45309" }}>restantes</p>
          </div>
          <p className="text-[12px] mt-1" style={{ color: "#92400E" }}>Até hoje às 23h59 — se não responder, ficará como <span className="font-semibold">Expirada</span></p>
        </div>

        {/* Comparação: O que pediu vs O que foi proposto */}
        <div className="flex gap-2">
          {/* O que pediu */}
          <div className="flex-1 bg-white rounded-2xl p-3 shadow-sm border border-gray-100">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Você pediu</p>
            <p className="text-[15px] font-bold text-gray-900">Sáb 21/06</p>
            <p className="text-[12px] text-gray-500 mt-0.5">Dia inteiro</p>
          </div>
          {/* Seta */}
          <div className="flex items-center">
            <span className="text-gray-300 text-xl">→</span>
          </div>
          {/* O que foi proposto */}
          <div className="flex-1 rounded-2xl p-3 shadow-sm" style={{ background: "#F0FDF4", border: "1.5px solid #86EFAC" }}>
            <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: "#166534" }}>Proposta</p>
            <p className="text-[15px] font-bold text-gray-900">Dom 22/06</p>
            <p className="text-[12px] mt-0.5" style={{ color: "#166534" }}>Dia inteiro</p>
          </div>
        </div>

        {/* Justificativa */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Justificativa do Supervisor</p>
          <p className="text-[13px] text-gray-700 leading-relaxed italic">
            "O sábado 21 está crítico de cobertura — você cobre Astrid e não há substituto. No domingo 22 você pode folgar sem impacto operacional."
          </p>
        </div>

        {/* Ações com hierarquia visual */}
        <div className="flex flex-col gap-2 mt-1">
          {/* Aceitar — CTA principal */}
          <button className="w-full py-4 rounded-2xl text-white text-[16px] font-bold shadow-sm" style={{ background: GRAD }}>
            ✓ Aceitar — Dom 22/06
          </button>

          {/* Negociar via mensagem — secundário */}
          <button className="w-full py-3.5 rounded-2xl text-[14px] font-semibold flex items-center justify-center gap-2 border border-gray-200 bg-white" style={{ color: "#7C3AED" }}>
            <MessageSquare size={15} />
            Negociar via mensagem
          </button>

          {/* Recusar — terciário, menor peso */}
          <button className="w-full py-3 rounded-2xl text-[13px] font-medium text-gray-400 border border-gray-100 bg-white">
            ✕ Recusar proposta
          </button>
        </div>

        <div className="h-2" />
      </div>

      {/* Bottom Nav */}
      <div className="bg-white border-t border-gray-200 px-2 pt-2 pb-6 flex-shrink-0">
        <div className="flex justify-around">
          {["Meu Dia", "Solicitações", "Entregas", "Mensagens"].map((t) => (
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
