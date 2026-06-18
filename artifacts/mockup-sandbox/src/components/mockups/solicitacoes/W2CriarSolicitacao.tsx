import { ChevronRight, X } from "lucide-react";

const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif";
const GRAD = "linear-gradient(135deg, #7C3AED, #2563EB)";

const tipos = [
  { label: "Pedir folga", icon: "🌙", desc: "Ausência em uma ou mais datas" },
  { label: "Trocar minha folga", icon: "🔄", desc: "Trabalho em um dia, folgo em outro" },
  { label: "Pedir saída antecipada", icon: "⏰", desc: "Encerrar antes do previsto" },
  { label: "Pedir chegada tardia", icon: "🕐", desc: "Iniciar depois do horário previsto" },
  { label: "Corrigir minha escala", icon: "📋", desc: "Ajuste em atividade já publicada" },
  { label: "Reportar uma limitação", icon: "🏥", desc: "Restrição física ou operacional" },
  { label: "Pedir algo diferente", icon: "💬", desc: "Situação que não se encaixa acima" },
  { label: "Pedido administrativo", icon: "📄", desc: "Documentos, dados cadastrais e outros" },
];

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

export function W2CriarSolicitacao() {
  return (
    <div className="flex flex-col bg-[#F5F5F7] overflow-hidden" style={{ width: 390, height: 844, fontFamily: FONT }}>
      {/* Status bar */}
      <div className="bg-white px-6 pt-4 pb-1 flex justify-between items-center flex-shrink-0">
        <span className="text-[15px] font-semibold text-gray-900">9:41</span>
        <span className="text-[13px] text-gray-400">17/06 Ter</span>
      </div>

      {/* Header */}
      <div className="bg-white px-5 pt-2 pb-4 flex-shrink-0">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-[11px] text-gray-400 uppercase tracking-widest font-medium mb-0.5">Etapa 1 de 3</p>
            <p className="text-[20px] font-bold text-gray-900">Nova Solicitação</p>
          </div>
          <button className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <X size={16} className="text-gray-500" />
          </button>
        </div>
        <p className="text-[14px] text-gray-500 mt-2">O que você precisa pedir?</p>
      </div>

      {/* Progress */}
      <div className="bg-white px-5 pb-3 flex-shrink-0">
        <div className="flex gap-1.5">
          <div className="h-1 flex-1 rounded-full" style={{ background: GRAD }} />
          <div className="h-1 flex-1 rounded-full bg-gray-200" />
          <div className="h-1 flex-1 rounded-full bg-gray-200" />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
        {tipos.map((tipo, i) => (
          <button
            key={i}
            className="w-full bg-white rounded-2xl px-4 py-3.5 shadow-sm border border-gray-100 flex items-center gap-3 text-left"
          >
            <span className="text-[22px] flex-shrink-0">{tipo.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-gray-900">{tipo.label}</p>
              <p className="text-[12px] text-gray-400 mt-0.5">{tipo.desc}</p>
            </div>
            <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
          </button>
        ))}
        <div className="h-3" />
      </div>

      <NavBar />
    </div>
  );
}
