import { Sparkles, ChevronLeft, AlertTriangle, ChevronRight } from "lucide-react";

const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif";
const GRAD = "linear-gradient(135deg, #7C3AED, #2563EB)";

function CoverageBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-2 rounded-full bg-gray-100">
      <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function W8VisaoConsolidada() {
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
            <p className="text-[18px] font-bold text-gray-900">Impacto Consolidado</p>
            <p className="text-[12px] text-gray-400">Sexta-feira, 27 de junho · 3 solicitações</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">

        {/* Simulação de cobertura */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-3">Simulação de Cobertura</p>

          {/* 100% */}
          <div className="mb-3">
            <div className="flex justify-between mb-1">
              <p className="text-[12px] text-gray-500">Agora (sem aprovações)</p>
              <p className="text-[12px] font-bold text-gray-700">100%</p>
            </div>
            <CoverageBar pct={100} color="#4CAF50" />
          </div>

          {/* 88% */}
          <div className="mb-3">
            <div className="flex justify-between mb-1">
              <p className="text-[12px] text-gray-500">Se Carolina aprovada</p>
              <p className="text-[12px] font-bold" style={{ color: "#4CAF50" }}>88%</p>
            </div>
            <CoverageBar pct={88} color="#4CAF50" />
          </div>

          {/* 76% */}
          <div className="mb-3">
            <div className="flex justify-between mb-1">
              <p className="text-[12px] text-gray-500">+ Arthur aprovado</p>
              <p className="text-[12px] font-bold" style={{ color: "#FF9800" }}>76%</p>
            </div>
            <CoverageBar pct={76} color="#FF9800" />
          </div>

          {/* 61% — crítico */}
          <div className="rounded-xl p-2.5" style={{ background: "#FFF3F3", border: "1px solid #FECACA" }}>
            <div className="flex justify-between mb-1">
              <p className="text-[12px] font-semibold" style={{ color: "#D32F2F" }}>+ Débora aprovada ⚠</p>
              <p className="text-[12px] font-bold" style={{ color: "#D32F2F" }}>61%</p>
            </div>
            <CoverageBar pct={61} color="#D32F2F" />
            <p className="text-[11px] mt-1.5" style={{ color: "#D32F2F" }}>Abaixo do mínimo operacional</p>
          </div>
        </div>

        {/* Papéis críticos descobertos */}
        <div className="rounded-2xl p-4 shadow-sm" style={{ background: "#FFF3F3", border: "1.5px solid #FECACA" }}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} style={{ color: "#D32F2F" }} />
            <p className="text-[11px] font-bold tracking-wide uppercase" style={{ color: "#D32F2F" }}>Se todas aprovadas:</p>
          </div>
          <div className="flex flex-col gap-2">
            <div className="rounded-xl p-2.5 bg-white">
              <p className="text-[13px] font-bold text-gray-900">Astrid · Musical 14h</p>
              <p className="text-[12px]" style={{ color: "#D32F2F" }}>Nenhum substituto disponível</p>
            </div>
            <div className="rounded-xl p-2.5 bg-white">
              <p className="text-[13px] font-bold text-gray-900">Bloco 3 · Ensaio 16h</p>
              <p className="text-[12px]" style={{ color: "#FF9800" }}>Beatriz disponível (1 opção)</p>
            </div>
          </div>
        </div>

        {/* Membros solicitantes */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-3">Membros Solicitantes</p>
          {[
            { name: "Carolina Lima", roles: "Mensageira (subs: 2)", risk: "Baixo", riskColor: "#166534", riskBg: "#F0FDF4", order: 1 },
            { name: "Arthur Melo", roles: "Bloco 3 Ensaio (subs: 1)", risk: "Médio", riskColor: "#92400E", riskBg: "#FEF3C7", order: 2 },
            { name: "Débora Pires", roles: "Astrid Musical 14h (subs: 0)", risk: "Crítico", riskColor: "#991B1B", riskBg: "#FEF2F2", order: 3 },
          ].map((m, i, arr) => (
            <div key={i} className={`flex items-center justify-between py-2.5 ${i < arr.length - 1 ? "border-b border-gray-100" : ""}`}>
              <div className="flex items-center gap-2 flex-1">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0" style={{ background: GRAD, opacity: 0.7 }}>{m.order}</div>
                <div>
                  <p className="text-[13px] font-semibold text-gray-900">{m.name}</p>
                  <p className="text-[11px] text-gray-400">{m.roles}</p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: m.riskColor, background: m.riskBg }}>{m.risk}</span>
            </div>
          ))}
        </div>

        {/* IA Recomendação */}
        <div className="rounded-2xl p-4 shadow-sm" style={{ borderLeft: "4px solid #7C3AED", background: "#FAFAFA" }}>
          <div className="flex items-start gap-2">
            <Sparkles size={13} style={{ color: "#7C3AED" }} className="mt-0.5 flex-shrink-0" />
            <p className="text-[12px] text-gray-600 italic leading-relaxed">
              "Carolina e Arthur podem ser aprovados sem risco crítico. Débora: negociar data alternativa — Astrid ficaria sem cobertura se aprovada."
            </p>
          </div>
        </div>

        {/* CTAs em ordem de risco */}
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1">Analisar individualmente</p>
          {["Carolina Lima →", "Arthur Melo →", "Débora Pires →"].map((name, i) => (
            <button key={i} className={`w-full py-3 rounded-2xl text-[14px] font-semibold flex items-center justify-between px-4 ${i === 2 ? "border-2" : "border border-gray-100 bg-white"}`}
              style={i === 2 ? { borderColor: "#D32F2F", background: "#FFF3F3", color: "#D32F2F" } : { color: "#374151" }}>
              <span>{name}</span>
              <ChevronRight size={15} />
            </button>
          ))}
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
