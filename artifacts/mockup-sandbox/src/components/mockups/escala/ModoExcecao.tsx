import { ChevronLeft, Clock, Sparkles, Check } from "lucide-react";

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

export function ModoExcecao() {
  return (
    <div className="flex flex-col bg-[#F5F5F7] overflow-hidden" style={{ width: 390, height: 844, fontFamily: FONT }}>
      <div className="bg-white px-6 pt-4 pb-1 flex justify-between flex-shrink-0">
        <span className="text-[15px] font-semibold text-gray-900">13:42</span>
        <span className="text-[13px] text-gray-400">18/06 Qui</span>
      </div>

      <div className="bg-white px-4 pt-2 pb-3 flex items-center gap-2 flex-shrink-0 border-b border-gray-100">
        <button className="flex items-center gap-1 text-gray-500">
          <ChevronLeft size={16} /><span className="text-[13px]">Painel</span>
        </button>
        <div className="flex-1 text-center"><span className="text-[16px] font-bold text-gray-900">Escala</span></div>
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] font-bold" style={{ background: GRAD }}>F</div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-2 flex flex-col gap-3">
        {/* Exceção pré-carregada — dominante */}
        <div className="rounded-2xl p-5 shadow-md" style={{ background: "#FFF3F3", border: "2px solid #D32F2F" }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: "#D32F2F" }}>⚑ EXCEÇÃO — AÇÃO NECESSÁRIA</span>
          </div>
          <p className="text-[14px] font-semibold text-gray-800 mt-2">Musical das Estrelas · 14:00</p>
          <p className="text-[13px] text-gray-600 mb-3">Marcos · <span className="font-semibold" style={{ color: "#D32F2F" }}>Carlos ausente</span></p>

          <div className="flex items-center gap-2 px-3 py-2 rounded-xl mb-3" style={{ background: "#FFEBEE" }}>
            <Clock size={14} style={{ color: "#D32F2F" }} />
            <span className="text-[13px] text-gray-600">Começa em:</span>
            <span className="text-[20px] font-bold" style={{ color: "#B71C1C" }}>18 min</span>
          </div>

          <div className="h-px bg-red-100 mb-3" />

          {/* IA inline no card de exceção */}
          <div className="flex items-start gap-2">
            <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: GRAD }}>
              <Sparkles size={8} color="white" />
            </div>
            <p className="text-[12px] italic" style={{ color: "#7C3AED" }}>Beatriz disponível e habilitada. Recomendo ela como primeira opção.</p>
          </div>
        </div>

        {/* Candidatos */}
        <div className="flex items-center justify-between px-1">
          <p className="text-[10px] font-semibold text-gray-400 tracking-widest uppercase">Candidatos — Marcos</p>
          <span className="text-[11px] text-gray-400">3 disponíveis</span>
        </div>

        {/* Candidato 1 — RECOMENDADA — maior, borda verde completa */}
        <div className="rounded-2xl p-4 shadow-sm" style={{ background: "#F0FAF2", border: "2px solid #4CAF50" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full text-white" style={{ background: "#4CAF50" }}>✓ RECOMENDADA</span>
            <span className="text-[11px] text-green-600">Risco: mínimo</span>
          </div>
          <p className="text-[20px] font-bold text-gray-900 mb-2">Beatriz</p>
          <div className="flex items-start gap-1.5 mb-3">
            <div className="w-3.5 h-3.5 rounded-full flex-shrink-0 mt-0.5" style={{ background: GRAD }}>
              <span />
            </div>
            <p className="text-[12px] text-gray-500 italic leading-relaxed">
              Substituta habitual de Marcos · Disponível agora · Sem restrições · Sem conflito
            </p>
          </div>
          <button className="w-full py-3 rounded-xl text-white text-[14px] font-bold" style={{ background: GRAD }}>
            Selecionar Beatriz
          </button>
        </div>

        {/* Candidato 2 — risco moderado */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100" style={{ borderLeft: "4px solid #FF9800" }}>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full text-amber-700 bg-amber-50">⚠ Risco moderado</span>
          <p className="text-[17px] font-bold text-gray-900 mt-2 mb-1">Clara</p>
          <p className="text-[12px] text-gray-400 italic mb-3">Já fez Marcos como titular mas há 3 meses. Disponível.</p>
          <button className="w-full py-2 rounded-xl text-[13px] font-medium border-2 border-gray-200 text-gray-600 bg-white">
            Selecionar Clara
          </button>
        </div>

        {/* Candidato 3 — risco alto */}
        <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100 opacity-80">
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full text-red-700 bg-red-50">✕ Risco alto</span>
          <p className="text-[15px] font-semibold text-gray-700 mt-2 mb-1">Diana</p>
          <p className="text-[12px] text-gray-400 italic mb-2">Nunca fez Marcos como titular</p>
          <button className="text-[12px] text-gray-400 underline">Selecionar mesmo assim</button>
        </div>
      </div>

      {/* Painel de validação simplificado */}
      <div className="bg-white border-t border-gray-200 px-4 py-2.5 flex-shrink-0">
        <p className="text-[12px] text-center text-gray-400">Exceção ativa · Resolução pendente</p>
      </div>
      <NavBar />
    </div>
  );
}
