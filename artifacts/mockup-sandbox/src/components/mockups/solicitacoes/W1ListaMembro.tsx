import { Plus, ChevronRight, Clock, MessageSquare } from "lucide-react";

const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif";
const GRAD = "linear-gradient(135deg, #7C3AED, #2563EB)";

function NavBar() {
  const tabs = ["Meu Dia", "Solicitações", "Entregas", "Mensagens"];
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

function StatePill({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ color, background: bg }}>{label}</span>
  );
}

export function W1ListaMembro() {
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
            {/* Badge de ação necessária */}
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[12px] font-bold" style={{ background: "#D32F2F" }}>2</div>
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[13px] font-bold" style={{ background: GRAD }}>A</div>
          </div>
        </div>
      </div>

      {/* CTA + Nova */}
      <div className="px-4 pb-3 bg-white flex-shrink-0">
        <button className="w-full py-3 rounded-2xl text-white text-[15px] font-semibold flex items-center justify-center gap-2 shadow-sm" style={{ background: GRAD }}>
          <Plus size={18} />
          Nova solicitação
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4">

        {/* SEÇÃO: AÇÃO NECESSÁRIA */}
        <div>
          <p className="text-[10px] font-bold text-[#D32F2F] tracking-widest uppercase mb-2 px-1">Ação Necessária</p>

          {/* PROPOSTA ALTERNATIVA */}
          <div className="bg-white rounded-2xl p-4 shadow-sm mb-2" style={{ borderLeft: "4px solid #FF9800" }}>
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="text-[14px] font-semibold text-gray-900">Pedir folga</p>
                <p className="text-[12px] text-gray-400 mt-0.5">Sábado, 21 de junho</p>
              </div>
              <StatePill label="Proposta Alternativa" color="#B45309" bg="#FEF3C7" />
            </div>
            <div className="rounded-xl px-3 py-2 mb-3" style={{ background: "#FFF7ED" }}>
              <p className="text-[12px] text-gray-600">Supervisor propôs: <span className="font-semibold text-gray-800">Dom 22/06</span></p>
              <div className="flex items-center gap-1.5 mt-1">
                <Clock size={13} style={{ color: "#B45309" }} />
                <span className="text-[13px] font-bold" style={{ color: "#B45309" }}>19h restantes</span>
              </div>
            </div>
            <button className="w-full py-2.5 rounded-xl text-white text-[14px] font-semibold" style={{ background: GRAD }}>
              Responder agora
            </button>
          </div>

          {/* AGUARDANDO INFORMAÇÃO */}
          <div className="bg-white rounded-2xl p-4 shadow-sm" style={{ borderLeft: "4px solid #FF9800" }}>
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="text-[14px] font-semibold text-gray-900">Pedir algo diferente</p>
                <p className="text-[12px] text-gray-400 mt-0.5">Terça, 18 de junho</p>
              </div>
              <StatePill label="Aguardando Info" color="#B45309" bg="#FEF3C7" />
            </div>
            <div className="rounded-xl px-3 py-2 mb-3" style={{ background: "#FFF7ED" }}>
              <p className="text-[12px] text-gray-500 italic">"Qual o motivo específico do evento externo?"</p>
            </div>
            <button className="w-full py-2.5 rounded-xl text-white text-[14px] font-semibold" style={{ background: GRAD }}>
              Responder agora
            </button>
          </div>
        </div>

        {/* SEÇÃO: EM PROCESSO */}
        <div>
          <p className="text-[10px] font-semibold text-gray-400 tracking-widest uppercase mb-2 px-1">Em Processo</p>

          {/* EM ANÁLISE */}
          <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100 mb-2">
            <div className="flex justify-between items-center">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-[14px] font-medium text-gray-900">Pedir folga</p>
                  <StatePill label="Em Análise" color="#92400E" bg="#FEF3C7" />
                </div>
                <p className="text-[12px] text-gray-400">Sex 28/06 · Supervisora Ana Silva · há 6h</p>
              </div>
              <ChevronRight size={16} className="text-gray-300" />
            </div>
          </div>

          {/* EXPIRADA */}
          <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100 mb-2 opacity-75">
            <div className="flex justify-between items-center">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-[14px] font-medium text-gray-700">Pedir folga</p>
                  <StatePill label="Expirada" color="#6B7280" bg="#F3F4F6" />
                </div>
                <p className="text-[12px] text-gray-400">Dom 29/06 · Aguardando nova decisão</p>
              </div>
              <ChevronRight size={16} className="text-gray-300" />
            </div>
          </div>

          {/* ENVIADA */}
          <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100">
            <div className="flex justify-between items-center">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-[14px] font-medium text-gray-900">Pedir chegada tardia</p>
                  <StatePill label="Enviada" color="#6B7280" bg="#F3F4F6" />
                </div>
                <p className="text-[12px] text-gray-400">Qui 19/06 · Aguardando análise · há 2h</p>
              </div>
              <ChevronRight size={16} className="text-gray-300" />
            </div>
          </div>
        </div>

        {/* SEÇÃO: DECIDIDAS */}
        <div>
          <p className="text-[10px] font-semibold text-gray-400 tracking-widest uppercase mb-2 px-1">Decididas Recentemente</p>

          {/* APROVADA */}
          <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100 mb-2 opacity-70">
            <div className="flex justify-between items-center">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-[13px] font-medium text-gray-700">Pedir folga</p>
                  <StatePill label="✓ Aprovada" color="#166534" bg="#F0FDF4" />
                </div>
                <p className="text-[11px] text-gray-400">Seg 16/06 · 2 dias atrás</p>
              </div>
              <ChevronRight size={15} className="text-gray-200" />
            </div>
          </div>

          {/* NEGADA */}
          <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100 mb-2 opacity-70">
            <div className="flex justify-between items-center">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-[13px] font-medium text-gray-700">Corrigir minha escala</p>
                  <StatePill label="✕ Negada" color="#6B7280" bg="#F3F4F6" />
                </div>
                <p className="text-[11px] text-gray-400">3 dias atrás · "Posição já confirmada com..."</p>
              </div>
              <ChevronRight size={15} className="text-gray-200" />
            </div>
          </div>

          {/* REVOGADA */}
          <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100 opacity-70">
            <div className="flex justify-between items-center">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-[13px] font-medium text-gray-700">Pedir folga</p>
                  <StatePill label="✕ Revogada" color="#DC2626" bg="#FEF2F2" />
                </div>
                <p className="text-[11px] text-gray-400">Qui 12/06 · "Nova restrição eliminou..."</p>
              </div>
              <ChevronRight size={15} className="text-gray-200" />
            </div>
          </div>
        </div>

        {/* Ver mais */}
        <button className="w-full py-3 rounded-2xl text-center text-[13px] font-medium text-gray-400 border border-gray-200 bg-white">
          Ver solicitações anteriores
        </button>

        <div className="h-2" />
      </div>

      <NavBar />
    </div>
  );
}
