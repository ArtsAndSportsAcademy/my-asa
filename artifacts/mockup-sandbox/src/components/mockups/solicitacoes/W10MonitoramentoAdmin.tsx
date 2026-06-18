import { AlertTriangle, Clock, TrendingUp, ChevronRight } from "lucide-react";

const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif";
const GRAD = "linear-gradient(135deg, #7C3AED, #2563EB)";

function AdminNav() {
  return (
    <div className="bg-white border-t border-gray-200 px-2 pt-2 pb-6 flex-shrink-0">
      <div className="flex justify-around">
        {["Painel", "Operações", "Solicitações", "Relatórios"].map((t) => (
          <div key={t} className="flex flex-col items-center gap-1 px-1">
            <div className="w-1 h-1 rounded-full" style={{ background: t === "Solicitações" ? GRAD : "transparent" }} />
            <span className="text-[11px]" style={{ fontWeight: t === "Solicitações" ? 600 : 400, color: t === "Solicitações" ? "#7C3AED" : "#9CA3AF" }}>{t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function W10MonitoramentoAdmin() {
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
            <p className="text-[20px] font-bold text-gray-900">Saúde Operacional</p>
            <p className="text-[12px] text-gray-400 mt-0.5">Solicitações · Monitoramento</p>
          </div>
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[13px] font-bold" style={{ background: GRAD }}>R</div>
        </div>
        {/* Filtro de operação */}
        <div className="flex gap-2 mt-3">
          <div className="px-3 py-1.5 rounded-full text-[12px] font-semibold text-white" style={{ background: GRAD }}>Snowland</div>
          <div className="px-3 py-1.5 rounded-full text-[12px] font-medium text-gray-500 bg-gray-100">Wonderland</div>
          <div className="px-3 py-1.5 rounded-full text-[12px] font-medium text-gray-500 bg-gray-100">Todas</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4">

        {/* INDICADORES DE SAÚDE */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={14} className="text-gray-400" />
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Indicadores de Saúde · Esta Semana</p>
          </div>
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <p className="text-[13px] text-gray-600">Ana Silva · tempo médio de resposta</p>
              <p className="text-[13px] font-bold" style={{ color: "#4CAF50" }}>3,2h</p>
            </div>
            <div className="flex items-center justify-between rounded-xl px-3 py-2" style={{ background: "#FFF7ED" }}>
              <p className="text-[13px]" style={{ color: "#92400E" }}>João Costa · tempo médio de resposta</p>
              <p className="text-[13px] font-bold" style={{ color: "#D32F2F" }}>28,4h ⚠</p>
            </div>
            <div className="h-px bg-gray-100" />
            <div className="flex gap-4">
              <div className="text-center">
                <p className="text-[20px] font-black text-gray-900">2</p>
                <p className="text-[10px] text-gray-400">escaladas</p>
              </div>
              <div className="text-center">
                <p className="text-[20px] font-black text-gray-900">1</p>
                <p className="text-[10px] text-gray-400">revogações</p>
              </div>
              <div className="text-center">
                <p className="text-[20px] font-black" style={{ color: "#4CAF50" }}>94%</p>
                <p className="text-[10px] text-gray-400">decididas no prazo</p>
              </div>
            </div>
          </div>
        </div>

        {/* ESCALADAS — Admin assumiu */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={12} style={{ color: "#D32F2F" }} />
            <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "#D32F2F" }}>Escaladas — Admin assumiu</p>
          </div>
          <div className="rounded-2xl shadow-md overflow-hidden" style={{ background: "#FFF3F3", border: "2px solid #D32F2F" }}>
            <div className="px-4 py-3.5">
              <p className="text-[14px] font-bold text-gray-900">Carlos Neto · Restrição Médica</p>
              <p className="text-[12px] text-gray-500 mt-0.5">Supervisor João Costa · sem resposta há 52h</p>
              <p className="text-[11px] mt-1" style={{ color: "#D32F2F" }}>Nível Médio · prazo vencido</p>
            </div>
            <button className="w-full py-3 text-center text-[13px] font-bold text-white" style={{ background: "#D32F2F" }}>
              Analisar agora →
            </button>
          </div>
        </div>

        {/* EXPIRAÇÕES — Ação do Supervisor */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Clock size={12} style={{ color: "#F59E0B" }} />
            <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "#B45309" }}>Expirações — Aguardando Supervisor</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: "1.5px solid #FCD34D" }}>
            <div className="px-4 py-3.5">
              <p className="text-[14px] font-semibold text-gray-900">Pedro Faria · Troca de folga</p>
              <p className="text-[12px] text-gray-500 mt-0.5">Supervisora Ana Silva · expirada há 4h</p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: "#F59E0B" }} />
                <p className="text-[11px]" style={{ color: "#92400E" }}>Notificada · sem nova ação</p>
              </div>
            </div>
            <div className="px-4 pb-3">
              <button className="text-[12px] font-semibold" style={{ color: "#7C3AED" }}>Ver solicitação →</button>
            </div>
          </div>
        </div>

        {/* PROXIMIDADE — alertas 80% */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Clock size={12} className="text-gray-400" />
            <p className="text-[10px] font-semibold tracking-widest uppercase text-gray-400">Proximidade — Em Iminência</p>
          </div>
          {[
            { name: "Amanda Souza · Folga", sup: "Supervisor João Costa", pct: 80, level: "Crítico", color: "#D32F2F", bg: "#FEF2F2", timeLeft: "1h para escalar" },
            { name: "Débora Pires · Folga", sup: "Supervisora Ana Silva", pct: 78, level: "Alto", color: "#B45309", bg: "#FEF3C7", timeLeft: "5h para escalar" },
          ].map((item, i) => (
            <div key={i} className={`bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-3.5 ${i === 0 ? "mb-2" : ""}`}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-[13px] font-semibold text-gray-900">{item.name}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{item.sup}</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: item.color, background: item.bg }}>{item.level}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-gray-100">
                  <div className="h-1.5 rounded-full" style={{ width: `${item.pct}%`, background: item.color }} />
                </div>
                <p className="text-[11px] font-bold" style={{ color: item.color }}>{item.pct}%</p>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">{item.timeLeft}</p>
            </div>
          ))}
        </div>

        {/* ESTÁVEL */}
        <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100 opacity-60">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-medium text-gray-600">Estável — abaixo de 50%</p>
            <div className="flex items-center gap-1">
              <span className="text-[12px] text-gray-400">4 solicitações</span>
              <ChevronRight size={14} className="text-gray-300" />
            </div>
          </div>
        </div>

        <div className="h-2" />
      </div>

      <AdminNav />
    </div>
  );
}
