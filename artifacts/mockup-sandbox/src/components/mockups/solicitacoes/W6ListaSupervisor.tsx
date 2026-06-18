import { ChevronRight, AlertTriangle, ArrowUp, Minus, ArrowDown, Users } from "lucide-react";

const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif";
const GRAD = "linear-gradient(135deg, #7C3AED, #2563EB)";

function NavBar() {
  const tabs = ["Painel", "Escala", "Solicitações", "Mensagens"];
  return (
    <div className="bg-white border-t border-gray-200 px-2 pt-2 pb-6 flex-shrink-0">
      <div className="flex justify-around">
        {tabs.map((t) => (
          <div key={t} className="flex flex-col items-center gap-1 px-1">
            <div className="w-1 h-1 rounded-full" style={{ background: t === "Solicitações" ? GRAD : "transparent" }} />
            <span className="text-[11px]" style={{ fontWeight: t === "Solicitações" ? 600 : 400, color: t === "Solicitações" ? "#7C3AED" : "#9CA3AF" }}>{t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function W6ListaSupervisor() {
  return (
    <div className="flex flex-col bg-[#F5F5F7] overflow-hidden" style={{ width: 390, height: 844, fontFamily: FONT }}>
      {/* Status bar */}
      <div className="bg-white px-6 pt-4 pb-1 flex justify-between items-center flex-shrink-0">
        <span className="text-[15px] font-semibold text-gray-900">9:41</span>
        <span className="text-[13px] text-gray-400">17/06 Ter</span>
      </div>

      {/* Header */}
      <div className="bg-white px-5 pt-2 pb-3 flex-shrink-0">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-[20px] font-bold text-gray-900">Solicitações</p>
            <p className="text-[12px] text-gray-400 mt-0.5">Musical das Estrelas</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[12px] font-bold" style={{ background: "#D32F2F" }}>7</div>
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[13px] font-bold" style={{ background: GRAD }}>S</div>
          </div>
        </div>
        {/* Filtros */}
        <div className="flex gap-2 mt-3">
          <div className="px-3 py-1.5 rounded-full text-[12px] font-semibold text-white" style={{ background: GRAD }}>Pendentes</div>
          <div className="px-3 py-1.5 rounded-full text-[12px] font-medium text-gray-500 bg-gray-100">Todas</div>
          <div className="px-3 py-1.5 rounded-full text-[12px] font-medium text-gray-500 bg-gray-100">Decididas</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4">

        {/* CRÍTICO */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={12} style={{ color: "#D32F2F" }} />
            <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "#D32F2F" }}>Crítico — Atividade em &lt; 24h</p>
          </div>
          <div className="rounded-2xl shadow-md overflow-hidden" style={{ background: "#FFF3F3", border: "2px solid #D32F2F" }}>
            <div className="px-4 py-3.5">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: "#D32F2F" }}>CRÍTICO</span>
                    <span className="text-[11px] text-gray-500">Sáb 21/06 · 8h</span>
                  </div>
                  <p className="text-[15px] font-bold text-gray-900">Amanda Souza · Folga</p>
                  <p className="text-[12px] mt-0.5" style={{ color: "#D32F2F" }}>⚠ Única titular de Astrid · sem substituto</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Enviada há 4h · em análise</p>
                </div>
                <ChevronRight size={18} style={{ color: "#D32F2F" }} />
              </div>
            </div>
          </div>
        </div>

        {/* ALTO — com agrupamento */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <ArrowUp size={12} style={{ color: "#F59E0B" }} />
            <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "#B45309" }}>Alto — Atividade em 1-7 dias</p>
          </div>

          {/* Agrupamento por data */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-amber-100 mb-2">
            {/* Header do grupo */}
            <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: "#FFFBEB", borderBottom: "1px solid #FDE68A" }}>
              <div className="flex items-center gap-2">
                <Users size={13} style={{ color: "#B45309" }} />
                <p className="text-[12px] font-bold" style={{ color: "#92400E" }}>3 solicitações · Sex 27/06</p>
              </div>
              <button className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ color: "#7C3AED", background: "#EDE9FE" }}>Ver impacto consolidado</button>
            </div>
            {/* Itens do grupo */}
            {[
              { name: "Carolina Lima", type: "Folga", time: "há 2h", state: "enviada" },
              { name: "Arthur Melo", type: "Folga", time: "há 5h", state: "em análise" },
              { name: "Débora Pires", type: "Folga", time: "há 1h", state: "enviada" },
            ].map((item, i, arr) => (
              <div key={i} className={`px-4 py-3 flex items-center justify-between ${i < arr.length - 1 ? "border-b border-gray-100" : ""}`}>
                <div className="flex-1">
                  <p className="text-[13px] font-semibold text-gray-900">{item.name} · {item.type}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Enviada {item.time} · {item.state}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: "#B45309", background: "#FEF3C7" }}>ALTO</span>
                  <ChevronRight size={14} className="text-gray-300" />
                </div>
              </div>
            ))}
          </div>

          {/* Item alto sem agrupamento */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-3.5">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: "#B45309", background: "#FEF3C7" }}>ALTO</span>
                </div>
                <p className="text-[13px] font-semibold text-gray-900">Carlos Neto · Restrição Médica</p>
                <p className="text-[11px] text-gray-400 mt-0.5">20/06 a 30/07 · Enviada há 3h</p>
              </div>
              <ChevronRight size={15} className="text-gray-300" />
            </div>
          </div>
        </div>

        {/* MÉDIO */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Minus size={12} className="text-gray-400" />
            <p className="text-[10px] font-semibold tracking-widest uppercase text-gray-400">Médio — Atividade em 7-30 dias</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-3.5">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-[13px] font-semibold text-gray-900">Pedro Faria · Troca de folga</p>
                <p className="text-[11px] text-gray-400 mt-0.5">30/06 → 05/07 · Enviada há 1 dia</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-gray-400 bg-gray-100">MÉDIO</span>
                <ChevronRight size={14} className="text-gray-300" />
              </div>
            </div>
          </div>
        </div>

        {/* BAIXO */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <ArrowDown size={12} className="text-gray-300" />
            <p className="text-[10px] font-semibold tracking-widest uppercase text-gray-300">Baixo</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-3.5 opacity-80">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-[13px] font-semibold text-gray-800">Júlia Costa · Adm. urgente</p>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: "#D32F2F", background: "#FEF2F2" }}>URGENTE</span>
                </div>
                <p className="text-[11px] text-gray-400">Documento · Enviada há 30min</p>
              </div>
              <ChevronRight size={14} className="text-gray-300" />
            </div>
          </div>
        </div>

        <div className="h-2" />
      </div>

      <NavBar />
    </div>
  );
}
