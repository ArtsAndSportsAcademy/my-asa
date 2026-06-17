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

export function Atencao() {
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
            <div className="w-7 h-7 rounded-full border flex items-center justify-center" style={{ background: "#FFF8E1", borderColor: "#FF9800" }}>
              <AlertTriangle size={13} style={{ color: "#FF9800" }} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-3 flex flex-col gap-3">
        {/* STATUS — ATENÇÃO */}
        <div className="rounded-2xl p-4 shadow-sm border border-amber-100" style={{ background: "#FFF8E1" }}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "#FFE082" }}>
              <AlertTriangle size={18} style={{ color: "#E65100" }} />
            </div>
            <div>
              <p className="text-[20px] font-bold" style={{ color: "#E65100" }}>Atenção</p>
              <p className="text-[12px]" style={{ color: "#FF9800" }}>2 exceções ativas</p>
            </div>
          </div>
          <div className="h-px bg-amber-100 mb-2" />
          <p className="text-[13px] text-gray-600">Mais urgente: <span className="font-semibold">Astrid · show 19h30</span></p>
        </div>

        {/* Exceções */}
        <div>
          <p className="text-[10px] font-semibold tracking-widest uppercase mb-2 px-1" style={{ color: "#FF9800" }}>Exceções — 2 Ativas</p>

          {/* Exceção 1 — maior, mais urgente */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-2" style={{ borderLeft: "4px solid #FF9800" }}>
            <div className="flex items-start gap-2 mb-2">
              <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" style={{ color: "#FF9800" }} />
              <div className="flex-1">
                <p className="text-[15px] font-bold text-gray-900">Show das 19h30</p>
                <p className="text-[13px] text-gray-500">Musical das Estrelas</p>
              </div>
            </div>
            <p className="text-[13px] text-gray-600 mb-2">Marina ausente · <span className="font-semibold">Astrid ↓</span></p>
            <div className="h-px bg-gray-100 mb-2" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] text-gray-400 mb-0.5">Cobertura</p>
                <span className="text-[12px] font-bold px-2 py-0.5 rounded-full" style={{ background: "#FFEBEE", color: "#D32F2F" }}>NENHUMA</span>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-gray-400 mb-1">9h30 até o show</p>
                <button className="text-[13px] font-semibold px-3 py-1.5 rounded-xl text-white" style={{ background: GRAD }}>Resolver →</button>
              </div>
            </div>
          </div>

          {/* Exceção 2 — padrão */}
          <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-gray-100" style={{ borderLeft: "3px solid #FF9800" }}>
            <div className="flex items-start gap-2 mb-1">
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" style={{ color: "#FF9800" }} />
              <p className="text-[14px] font-semibold text-gray-800">Confirmação pendente — Bruno</p>
            </div>
            <p className="text-[12px] text-gray-500 mb-0.5">Show das 14h · Bruno · Marcos</p>
            <p className="text-[12px] text-gray-400 mb-2">Publicada há 2h · Atividade em: 3h45</p>
            <button className="text-[12px] border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 bg-gray-50">Renotificar Bruno</button>
          </div>
        </div>

        {/* Card IA */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100" style={{ borderLeft: "4px solid #7C3AED" }}>
          <div className="flex items-start gap-2.5">
            <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: GRAD }}>
              <Sparkles size={10} color="white" />
            </div>
            <p className="text-[13px] text-gray-500 italic leading-relaxed flex-1">
              Marina solicitou folga hoje cedo. Astrid no 2° show está em aberto. Beatriz é a melhor opção — sem conflitos hoje.
            </p>
          </div>
          <button className="text-[12px] font-medium mt-2 ml-7" style={{ color: "#7C3AED" }}>Perguntar à IA →</button>
        </div>

        {/* Multi-horizonte recolhido */}
        <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-medium text-gray-600">Próximos 3 Dias</p>
            <span className="text-[12px] text-gray-400">Ver ▾</span>
          </div>
        </div>

        {/* Solicitações */}
        <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[14px] text-gray-700 font-medium">Solicitações · 1 pendente</p>
              <p className="text-[12px] mt-0.5" style={{ color: "#FF9800" }}>Marina · folga hoje · urgente</p>
            </div>
            <ChevronRight size={16} className="text-gray-300" />
          </div>
        </div>
      </div>

      <NavBar />
    </div>
  );
}
