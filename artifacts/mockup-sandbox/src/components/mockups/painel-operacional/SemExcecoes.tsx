import { AlertTriangle, ChevronRight, Sparkles } from "lucide-react";

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

export function SemExcecoes() {
  return (
    <div className="flex flex-col bg-[#F5F5F7] overflow-hidden" style={{ width: 390, height: 844, fontFamily: FONT }}>
      {/* Status bar */}
      <div className="bg-white px-6 pt-4 pb-1 flex justify-between flex-shrink-0">
        <span className="text-[15px] font-semibold text-gray-900">9:00</span>
        <span className="text-[13px] text-gray-400">16/06 Seg</span>
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
            <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
              <span className="text-[14px] text-gray-400">·</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-3 flex flex-col gap-3">
        {/* STATUS — Sem Atividades (diferente de Pronta) */}
        <div className="rounded-2xl p-5 shadow-sm border border-gray-200" style={{ background: "#FAFAFA" }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#F0F0F0" }}>
              <span className="text-[22px]">✦</span>
            </div>
            <div>
              <p className="text-[20px] font-bold text-gray-700">Sem Atividades Hoje</p>
              <p className="text-[12px] text-gray-400">modo de planejamento</p>
            </div>
          </div>
          <div className="h-px bg-gray-200 mb-3" />
          <div>
            <p className="text-[11px] text-gray-400 mb-0.5">Próximo show</p>
            <p className="text-[14px] font-semibold text-gray-700">Quarta, 18/06 · Musical das Estrelas · 14h</p>
          </div>
        </div>

        {/* Card IA — planejamento preventivo */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100" style={{ borderLeft: "4px solid #7C3AED" }}>
          <div className="flex items-start gap-2.5">
            <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: GRAD }}>
              <Sparkles size={10} color="white" />
            </div>
            <p className="text-[13px] text-gray-500 italic leading-relaxed flex-1">
              Dia sem operação. Próximo show é quarta. Amanda solicitou folga para quarta — ela cobre Astrid. Vale analisar antes de aprovar.
            </p>
          </div>
          <button className="text-[12px] font-medium mt-2 ml-7" style={{ color: "#7C3AED" }}>Perguntar à IA →</button>
        </div>

        {/* Multi-horizonte expandido */}
        <div>
          <p className="text-[10px] font-semibold text-gray-400 tracking-widest uppercase mb-2 px-1">Próximos 3 Dias</p>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            {/* Strip de 3 dias */}
            <div className="flex gap-2 mb-3">
              {[
                { day: "Seg 16", dot: "#BDBDBD", label: "hoje · sem shows", active: true },
                { day: "Ter 17", dot: "#BDBDBD", label: "sem shows", active: false },
                { day: "Qua 18", dot: "#FF9800", label: "risco", active: false },
              ].map((d) => (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-xl" style={{ background: d.active ? "#F5F5F5" : "transparent" }}>
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.dot }} />
                  <span className="text-[12px] font-semibold text-gray-600">{d.day}</span>
                  <span className="text-[9px] text-gray-400 text-center leading-tight">{d.label}</span>
                </div>
              ))}
            </div>

            {/* Dias sem shows */}
            <div className="mb-2.5">
              <div className="flex items-center gap-2 py-2">
                <div className="w-2 h-2 rounded-full bg-gray-300" />
                <span className="text-[13px] text-gray-400">Seg 16 · Ter 17 — sem atividades</span>
              </div>
            </div>

            {/* Qua 18 — risco expandido */}
            <div className="rounded-xl px-3 py-2.5 border-l-4" style={{ background: "#FFF8E1", borderLeftColor: "#FF9800" }}>
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-2 h-2 rounded-full" style={{ background: "#FF9800" }} />
                <p className="text-[13px] font-semibold text-gray-700">Qua 18 — Show 14h</p>
              </div>
              <div className="flex items-start gap-1.5">
                <AlertTriangle size={12} style={{ color: "#FF9800" }} className="mt-0.5 flex-shrink-0" />
                <p className="text-[12px] text-gray-600">Amanda solicitou folga · Astrid afetada · cobertura no limite</p>
              </div>
              <button className="text-[11px] mt-1.5" style={{ color: "#FF9800" }}>Antecipar resolução →</button>
            </div>
          </div>
        </div>

        {/* Solicitações com contexto de impacto */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100" style={{ borderLeft: "4px solid #FF9800" }}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="text-[14px] font-semibold text-gray-800 mb-0.5">Solicitações · 1 pendente</p>
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle size={12} style={{ color: "#FF9800" }} />
                <p className="text-[12px] text-gray-600">Amanda · Folga Qua 18/06</p>
              </div>
              <p className="text-[12px] text-gray-400">Afeta Astrid no show das 14h</p>
            </div>
            <button className="text-[12px] font-semibold px-3 py-1.5 rounded-xl text-white flex-shrink-0" style={{ background: GRAD }}>Analisar</button>
          </div>
        </div>

        {/* Espaço em branco — modo de planejamento, sem urgência */}
        <div className="flex-1" />
      </div>

      <NavBar />
    </div>
  );
}
