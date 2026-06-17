import { AlertTriangle, Sparkles } from "lucide-react";

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

export function MultiplasExcecoes() {
  return (
    <div className="flex flex-col bg-[#F5F5F7] overflow-hidden" style={{ width: 390, height: 844, fontFamily: FONT }}>
      {/* Status bar */}
      <div className="bg-white px-6 pt-4 pb-1 flex justify-between flex-shrink-0">
        <span className="text-[15px] font-semibold text-gray-900">11:30</span>
        <span className="text-[13px] text-gray-400">18/06 Qui</span>
      </div>

      {/* Header */}
      <div className="bg-white px-5 pt-2 pb-3 flex-shrink-0">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-[18px] font-bold text-gray-900">Painel Operacional</p>
            <p className="text-[12px] text-gray-400 mt-0.5">Musical das Estrelas · Grupo Ballet</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[13px] font-bold" style={{ background: GRAD }}>F</div>
            <div className="w-7 h-7 rounded-full border flex items-center justify-center" style={{ background: "#FFF8E1", borderColor: "#FF9800" }}>
              <AlertTriangle size={13} style={{ color: "#FF9800" }} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-3 flex flex-col gap-2.5">
        {/* STATUS com lista de prioridades */}
        <div className="rounded-2xl p-4 shadow-sm border border-amber-100" style={{ background: "#FFF8E1" }}>
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#FFE082" }}>
              <AlertTriangle size={16} style={{ color: "#E65100" }} />
            </div>
            <div>
              <p className="text-[18px] font-bold" style={{ color: "#E65100" }}>Atenção</p>
              <p className="text-[11px]" style={{ color: "#FF9800" }}>3 exceções ativas</p>
            </div>
          </div>
          <div className="h-px bg-amber-100 mb-2" />
          <p className="text-[12px] text-gray-500 font-medium mb-1">Resolver nesta ordem:</p>
          {[
            "1. Astrid · 14h · posição descoberta",
            "2. Conflito Bruno · 15h",
            "3. Escala 19h30 não publicada",
          ].map((item, i) => (
            <p key={i} className="text-[12px] text-gray-600 py-0.5">{item}</p>
          ))}
        </div>

        {/* Seção exceções */}
        <div>
          <p className="text-[10px] font-semibold tracking-widest uppercase mb-2 px-1" style={{ color: "#FF9800" }}>Exceções — 3 Ativas</p>

          {/* Exceção 1 — destaque, maior, borda completa */}
          <div className="rounded-2xl p-4 shadow-sm mb-2" style={{ background: "#FFFBF0", border: "2px solid #FF9800" }}>
            <div className="flex items-start gap-2 mb-2">
              <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[11px] font-bold" style={{ background: "#FF9800" }}>1</div>
              <div className="flex-1">
                <p className="text-[15px] font-bold text-gray-900">Show das 14h · 2h30</p>
                <p className="text-[12px] text-gray-500">Musical das Estrelas</p>
              </div>
            </div>
            <p className="text-[13px] font-semibold text-gray-800 mb-2">Astrid: <span style={{ color: "#D32F2F" }}>sem cobertura</span></p>
            {/* IA inline */}
            <div className="rounded-xl px-3 py-2 mb-3" style={{ background: "#EDE9FE" }}>
              <p className="text-[12px] italic" style={{ color: "#7C3AED" }}>✦ Beatriz disponível e habilitada para Astrid</p>
            </div>
            <button className="w-full py-2.5 rounded-xl text-white text-[13px] font-bold" style={{ background: GRAD }}>Resolver →</button>
          </div>

          {/* Exceção 2 — padrão */}
          <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100 mb-2" style={{ borderLeft: "3px solid #FF9800" }}>
            <div className="flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[11px] font-bold" style={{ background: "#FF9800" }}>2</div>
              <div className="flex-1">
                <p className="text-[14px] font-semibold text-gray-900">Conflito de horário · Bruno</p>
                <p className="text-[12px] text-gray-500">Ensaio 15h + Foto 15h</p>
                <p className="text-[12px] text-gray-400">Um deverá ser remanejado</p>
              </div>
              <button className="text-[12px] text-gray-500 border border-gray-200 rounded-lg px-2.5 py-1 bg-gray-50 flex-shrink-0 mt-1">Resolver</button>
            </div>
          </div>

          {/* Exceção 3 — padrão */}
          <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100" style={{ borderLeft: "3px solid #FF9800" }}>
            <div className="flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[11px] font-bold" style={{ background: "#FF9800" }}>3</div>
              <div className="flex-1">
                <p className="text-[14px] font-semibold text-gray-900">Escala 19h30 não publicada</p>
                <p className="text-[12px] text-gray-500">Show em 8h · gerar antes</p>
              </div>
              <button className="text-[12px] text-gray-500 border border-gray-200 rounded-lg px-2.5 py-1 bg-gray-50 flex-shrink-0 mt-1">Publicar</button>
            </div>
          </div>
        </div>

        {/* Card IA — raciocínio de prioridade */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100" style={{ borderLeft: "4px solid #7C3AED" }}>
          <div className="flex items-start gap-2.5">
            <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: GRAD }}>
              <Sparkles size={10} color="white" />
            </div>
            <p className="text-[13px] text-gray-500 italic leading-relaxed flex-1">
              Três exceções. Comece por Astrid — posição sem cobertura com o show mais próximo. O conflito do Bruno precisa ser resolvido até 14h.
            </p>
          </div>
          <button className="text-[12px] font-medium mt-2 ml-7" style={{ color: "#7C3AED" }}>Perguntar à IA →</button>
        </div>
      </div>

      <NavBar />
    </div>
  );
}
