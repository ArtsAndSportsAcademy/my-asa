import { CheckCircle, ChevronRight, Sparkles, Shield } from "lucide-react";

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

export function Pronta() {
  return (
    <div className="flex flex-col bg-[#F5F5F7] overflow-hidden" style={{ width: 390, height: 844, fontFamily: FONT }}>
      {/* Status bar */}
      <div className="bg-white px-6 pt-4 pb-1 flex justify-between flex-shrink-0">
        <span className="text-[15px] font-semibold text-gray-900">10:15</span>
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
            <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
              <span className="text-[14px] text-gray-400">·</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-3 flex flex-col gap-3">
        {/* STATUS — OPERAÇÃO PRONTA */}
        <div className="rounded-2xl p-5 shadow-sm border border-green-100" style={{ background: "#F0FAF2" }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#DCFCE7" }}>
              <Shield size={20} style={{ color: "#4CAF50" }} />
            </div>
            <div>
              <p className="text-[20px] font-bold" style={{ color: "#2E7D32" }}>Operação Pronta</p>
              <p className="text-[12px]" style={{ color: "#4CAF50" }}>todas as posições cobertas</p>
            </div>
          </div>
          <div className="h-px bg-green-100 mb-3" />
          <div className="flex gap-4">
            <div className="flex items-center gap-1.5">
              <CheckCircle size={14} style={{ color: "#4CAF50" }} />
              <span className="text-[13px] text-gray-600">2 shows hoje</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle size={14} style={{ color: "#4CAF50" }} />
              <span className="text-[13px] text-gray-600">8/8 confirmados</span>
            </div>
          </div>
        </div>

        {/* Card IA */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100" style={{ borderLeft: "4px solid #7C3AED" }}>
          <div className="flex items-start gap-2.5">
            <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: GRAD }}>
              <Sparkles size={10} color="white" />
            </div>
            <p className="text-[13px] text-gray-500 italic leading-relaxed flex-1">
              Bom dia, Fernanda. A operação está protegida. Bruno e Carol confirmaram há 20 minutos. Amanhã: um risco leve no show das 15h — vale antecipar.
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
                { day: "Qui 18", dot: "#4CAF50", label: "hoje", active: true },
                { day: "Sex 19", dot: "#FF9800", label: "risco", active: false },
                { day: "Sáb 20", dot: "#4CAF50", label: "", active: false },
              ].map((d) => (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-xl" style={{ background: d.active ? "#F0FAF2" : "transparent" }}>
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.dot }} />
                  <span className="text-[12px] font-semibold text-gray-700">{d.day}</span>
                  {d.label ? <span className="text-[10px]" style={{ color: d.dot }}>↑ {d.label}</span> : null}
                </div>
              ))}
            </div>
            {/* Risco de sexta expandido inline */}
            <div className="rounded-xl px-3 py-2.5 border-l-4" style={{ background: "#FFF8E1", borderLeftColor: "#FF9800" }}>
              <p className="text-[12px] font-semibold text-gray-700 mb-0.5">Sex 19 — Folga de Amanda</p>
              <p className="text-[12px] text-gray-500">Musical 15h · cobertura no limite</p>
              <button className="text-[11px] mt-1.5" style={{ color: "#FF9800" }}>Antecipar resolução →</button>
            </div>
          </div>
        </div>

        {/* Solicitações */}
        <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[14px] text-gray-700 font-medium">Solicitações</p>
              <p className="text-[12px] text-gray-400 mt-0.5">0 pendentes</p>
            </div>
            <ChevronRight size={16} className="text-gray-300" />
          </div>
        </div>

        {/* Último evento */}
        <p className="text-[12px] text-gray-400 text-center pb-1">Último evento: Escala publicada ontem às 21:45</p>
      </div>

      <NavBar />
    </div>
  );
}
