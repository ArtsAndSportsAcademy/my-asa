import { ChevronLeft, AlertTriangle } from "lucide-react";

const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif";
const GRAD = "linear-gradient(135deg, #7C3AED, #2563EB)";

export function W9Revogacao() {
  return (
    <div className="flex flex-col bg-[#F5F5F7] overflow-hidden" style={{ width: 390, height: 844, fontFamily: FONT }}>
      {/* Status bar */}
      <div className="bg-white px-6 pt-4 pb-1 flex justify-between items-center flex-shrink-0">
        <span className="text-[15px] font-semibold text-gray-900">11:03</span>
        <span className="text-[13px] text-gray-400">19/06 Qui</span>
      </div>

      {/* Header */}
      <div className="bg-white px-5 pt-2 pb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <ChevronLeft size={18} className="text-gray-600" />
          </button>
          <div>
            <p className="text-[18px] font-bold text-gray-900">Revogar Aprovação</p>
            <p className="text-[12px] text-gray-400">Amanda Souza · Folga 21/06</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">

        {/* Aprovação original — contexto */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 opacity-60">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Aprovação em vigor</p>
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">✓ Aprovada</span>
            <span className="text-[12px] text-gray-500">por você em 17/06 às 18h00</span>
          </div>
          <p className="text-[12px] text-gray-500 mt-1.5">Folga · Sábado 21/06 · Dia inteiro</p>
        </div>

        {/* IMPACTO DA REVOGAÇÃO — bloco proeminente, gera reflexão */}
        <div className="rounded-2xl p-4 shadow-md" style={{ background: "#FFF3F3", border: "2px solid #FCA5A5" }}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} style={{ color: "#D32F2F" }} />
            <p className="text-[13px] font-bold uppercase tracking-wide" style={{ color: "#D32F2F" }}>Impacto desta revogação</p>
          </div>
          <p className="text-[14px] text-gray-800 leading-relaxed mb-3">
            Amanda voltará a estar <span className="font-bold text-gray-900">disponível</span> para todas as atividades do sábado, 21 de junho.
          </p>
          <div className="rounded-xl p-3 bg-white mb-3">
            <p className="text-[12px] font-semibold text-gray-700 mb-1">A Escala será revertida automaticamente:</p>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#D32F2F" }} />
              <p className="text-[12px] text-gray-600">Musical 12h30 · Amanda restaurada como Astrid</p>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#D32F2F" }} />
              <p className="text-[12px] text-gray-600">Ensaio 16h · Bloco 3 restaurado</p>
            </div>
          </div>

          {/* Alerta adicional — Livro do Dia */}
          <div className="rounded-xl p-3" style={{ background: "#FEF3C7", border: "1px solid #FDE68A" }}>
            <p className="text-[12px] font-semibold mb-1" style={{ color: "#92400E" }}>⚠ Ação adicional necessária</p>
            <p className="text-[12px]" style={{ color: "#92400E" }}>O Livro do Dia do sábado 21 já foi gerado e precisará de revisão manual após a revogação.</p>
          </div>
        </div>

        {/* Motivo da revogação — obrigatório */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[13px] font-semibold text-gray-900">Motivo da revogação</p>
            <span className="text-[11px] font-bold text-white px-2 py-0.5 rounded-full" style={{ background: "#D32F2F" }}>Obrigatório</span>
          </div>
          <div className="rounded-xl border-2 border-gray-200 p-3 min-h-[80px]">
            <p className="text-[13px] text-gray-300">Ex: "A lesão de Beatriz eliminou a cobertura de Astrid que sustentava esta folga."</p>
          </div>
          <p className="text-[11px] text-gray-400 mt-1.5">O motivo será enviado para Amanda junto com a notificação.</p>
        </div>

        {/* Ações */}
        <div className="flex flex-col gap-2 mt-1">
          {/* Confirmar — desabilitado (campo vazio) */}
          <button className="w-full py-4 rounded-2xl text-[15px] font-bold text-gray-300 border-2 border-gray-200 bg-gray-50 cursor-not-allowed">
            Confirmar revogação
          </button>
          <p className="text-[11px] text-center text-gray-400">Preencha o motivo para confirmar</p>

          {/* Cancelar */}
          <button className="w-full py-3.5 rounded-2xl text-[14px] font-medium text-gray-600 border border-gray-200 bg-white mt-1">
            ← Cancelar
          </button>
        </div>

        <div className="h-2" />
      </div>

      {/* Bottom Nav */}
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
