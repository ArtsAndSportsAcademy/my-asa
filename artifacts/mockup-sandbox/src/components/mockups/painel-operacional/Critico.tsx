import { AlertTriangle, Sparkles, Clock } from "lucide-react";

const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif";
const GRAD = "linear-gradient(90deg, #7C3AED, #2563EB)";

function NavBar() {
  const tabs = ["Painel", "Escala", "Solicitações", "Mensagens"];
  return (
    <div className="bg-white border-t border-gray-200 px-2 pt-2 pb-6 flex-shrink-0">
      <div className="flex justify-around">
        {tabs.map((t) => (
          <div key={t} className="flex flex-col items-center gap-1 px-1">
            <div className="w-1 h-1 rounded-full" style={{ background: t === "Painel" ? GRAD : "transparent" }} />
            <span className="text-[11px]" style={{ fontWeight: t === "Painel" ? 600 : 400, color: t === "Painel" ? "#7C3AED" : "#9CA3AF" }}>{t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Critico() {
  return (
    <div className="flex flex-col bg-[#F5F5F7] overflow-hidden" style={{ width: 390, height: 844, fontFamily: FONT }}>
      {/* Status bar */}
      <div className="bg-white px-6 pt-4 pb-1 flex justify-between flex-shrink-0">
        <span className="text-[15px] font-semibold text-gray-900">13:38</span>
        <span className="text-[13px] text-gray-400">18/06 Qui</span>
      </div>

      {/* Header */}
      <div className="bg-white px-5 pt-2 pb-4 flex-shrink-0">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-[18px] font-bold text-gray-900">Painel Operacional</p>
            <p className="text-[12px] text-gray-400 mt-0.5">Musical das Estrelas · Grupo Ballet</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[13px] font-bold" style={{ background: GRAD }}>F</div>
            {/* Badge duplo crítico */}
            <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "#D32F2F" }}>
              <span className="text-white text-[11px] font-bold">!!</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-3 flex flex-col gap-3">
        {/* STATUS CRÍTICO — borda completa, dominante */}
        <div
          className="rounded-2xl p-5 shadow-md"
          style={{
            background: "#FFF3F3",
            border: "2px solid #D32F2F",
          }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#FFCDD2" }}>
              <AlertTriangle size={20} style={{ color: "#D32F2F" }} />
            </div>
            <div>
              <p className="text-[22px] font-bold" style={{ color: "#B71C1C" }}>Crítico</p>
              <p className="text-[12px]" style={{ color: "#D32F2F" }}>Musical das Estrelas · 14:00</p>
            </div>
          </div>

          <div className="mb-3">
            <p className="text-[14px] font-semibold text-gray-700 mb-0.5">Marcos · <span style={{ color: "#D32F2F" }}>sem cobertura</span></p>
          </div>

          {/* Countdown */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl mb-4" style={{ background: "#FFEBEE" }}>
            <Clock size={16} style={{ color: "#D32F2F" }} />
            <span className="text-[14px] text-gray-600">Começa em:</span>
            <span className="text-[22px] font-bold" style={{ color: "#B71C1C" }}>22 min</span>
          </div>

          {/* Botão RESOLVER AGORA — full width gradient */}
          <button
            className="w-full py-4 rounded-xl text-white text-[16px] font-bold tracking-wide shadow-sm"
            style={{ background: GRAD }}
          >
            Resolver Agora
          </button>
        </div>

        {/* Card IA — contextual à crise */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100" style={{ borderLeft: "4px solid #7C3AED" }}>
          <div className="flex items-start gap-2.5">
            <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: GRAD }}>
              <Sparkles size={10} color="white" />
            </div>
            <p className="text-[13px] text-gray-500 italic leading-relaxed flex-1">
              Carlos não apareceu. Marcos em aberto. Beatriz pode cobrir — ela saiu às 11h do Estúdio e não tem conflito. Recomendo ligar agora.
            </p>
          </div>
          <button className="text-[12px] font-medium mt-2 ml-7" style={{ color: "#7C3AED" }}>Resolver via IA →</button>
        </div>

        {/* Outras exceções — menor, segundo plano */}
        <div>
          <p className="text-[10px] font-semibold text-gray-400 tracking-widest uppercase mb-2 px-1">Outras Exceções — 1</p>
          <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100 opacity-80">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium text-gray-700">Marina · 19h30 · Astrid</p>
                <p className="text-[12px] text-gray-400 mt-0.5">Cobertura: nenhuma · 6h12 restantes</p>
              </div>
              <span className="text-gray-300">›</span>
            </div>
          </div>
        </div>

        {/* Confirmações recolhidas */}
        <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-medium text-gray-600">Confirmações</p>
            <span className="text-[12px] text-gray-400">Ver ▾</span>
          </div>
        </div>
      </div>

      <NavBar />
    </div>
  );
}
