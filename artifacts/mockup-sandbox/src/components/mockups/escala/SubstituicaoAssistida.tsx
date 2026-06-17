import { ChevronLeft, Sparkles } from "lucide-react";

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

export function SubstituicaoAssistida() {
  return (
    <div className="flex flex-col bg-[#F5F5F7] overflow-hidden" style={{ width: 390, height: 844, fontFamily: FONT }}>
      <div className="bg-white px-6 pt-4 pb-1 flex justify-between flex-shrink-0">
        <span className="text-[15px] font-semibold text-gray-900">09:35</span>
        <span className="text-[13px] text-gray-400">19/06 Sex</span>
      </div>

      {/* Header contextual */}
      <div className="bg-white px-4 pt-2 pb-3 flex-shrink-0 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-1">
          <button className="flex items-center gap-1 text-gray-500">
            <ChevronLeft size={16} /><span className="text-[13px]">Escala</span>
          </button>
          <div className="flex-1 text-center">
            <span className="text-[15px] font-bold text-gray-900">Candidatos — Astrid</span>
          </div>
        </div>
        <p className="text-[11px] text-gray-400 text-center">Musical das Estrelas · Sáb 20/06</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-2 flex flex-col gap-3">
        {/* Contexto da posição */}
        <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] text-gray-400 mb-0.5">Posição em aberto</p>
              <p className="text-[15px] font-bold text-gray-900">Astrid</p>
              <p className="text-[12px] text-gray-500">Show · Sáb 20/06 · 15:00</p>
            </div>
            <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-red-50 text-red-600">NENHUMA</span>
          </div>
        </div>

        <div className="flex items-center justify-between px-1">
          <p className="text-[10px] font-semibold text-gray-400 tracking-widest uppercase">Candidatos Disponíveis</p>
          <span className="text-[11px] text-gray-400">3</span>
        </div>

        {/* Candidato 1 — Recomendada */}
        <div className="rounded-2xl p-4 shadow-sm" style={{ background: "#F0FAF2", border: "2px solid #4CAF50" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full text-white" style={{ background: "#4CAF50" }}>✓ RECOMENDADA</span>
            <span className="text-[11px] text-green-600 font-medium">Risco: mínimo</span>
          </div>
          <p className="text-[22px] font-bold text-gray-900 mb-2">Beatriz</p>
          <div className="bg-white rounded-xl px-3 py-2.5 mb-3" style={{ borderLeft: "3px solid #7C3AED" }}>
            <div className="flex items-start gap-1.5">
              <Sparkles size={11} style={{ color: "#7C3AED" }} className="flex-shrink-0 mt-0.5" />
              <div className="text-[12px] text-gray-500 italic leading-relaxed">
                <p>Titular de Astrid · 12 shows nos últimos 90 dias</p>
                <p>Disponível Sáb 20 · Sem restrições ativas</p>
                <p>Aloca Astrid: sem conflito</p>
              </div>
            </div>
          </div>
          <button className="w-full py-3 rounded-xl text-white text-[14px] font-bold shadow-sm" style={{ background: GRAD }}>
            Selecionar Beatriz
          </button>
        </div>

        {/* Candidato 2 — Risco moderado */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100" style={{ borderLeft: "4px solid #FF9800" }}>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">⚠ Risco moderado</span>
          <p className="text-[19px] font-bold text-gray-900 mt-2 mb-1.5">Clara</p>
          <div className="flex items-start gap-1.5 mb-3">
            <Sparkles size={10} style={{ color: "#7C3AED" }} className="flex-shrink-0 mt-0.5" />
            <p className="text-[12px] text-gray-400 italic leading-relaxed">Fez Astrid como titular há 3 meses · 4 shows no total · Disponível Sáb 20</p>
          </div>
          <button className="w-full py-2 rounded-xl text-[13px] font-medium border-2 border-gray-200 text-gray-600">
            Selecionar Clara
          </button>
        </div>

        {/* Candidato 3 — Risco alto */}
        <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100 opacity-75" style={{ borderLeft: "3px solid #D32F2F" }}>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600">✕ Risco alto</span>
          <p className="text-[16px] font-semibold text-gray-700 mt-2 mb-0.5">Diana</p>
          <div className="flex items-start gap-1.5 mb-2">
            <Sparkles size={10} style={{ color: "#7C3AED" }} className="flex-shrink-0 mt-0.5" />
            <p className="text-[12px] text-gray-400 italic">Nunca fez como titular · Apenas observou em 2 ensaios</p>
          </div>
          <button className="text-[12px] text-gray-400 underline">Selecionar Diana mesmo assim</button>
        </div>

        {/* Card IA — raciocínio geral */}
        <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-gray-100" style={{ borderLeft: "4px solid #7C3AED" }}>
          <div className="flex items-start gap-2">
            <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: GRAD }}>
              <Sparkles size={9} color="white" />
            </div>
            <p className="text-[12px] text-gray-500 italic leading-relaxed">
              Beatriz é a escolha mais segura. Clara tem histórico mas está há 3 meses sem fazer Astrid. Diana não tem experiência suficiente para um show.
            </p>
          </div>
        </div>
      </div>

      <NavBar />
    </div>
  );
}
