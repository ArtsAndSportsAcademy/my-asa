import { AlertTriangle, Check, CheckCircle, Sparkles } from "lucide-react";

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

export function PosResolucao() {
  return (
    <div className="flex flex-col bg-[#F5F5F7] overflow-hidden" style={{ width: 390, height: 844, fontFamily: FONT }}>
      {/* Status bar */}
      <div className="bg-white px-6 pt-4 pb-1 flex justify-between flex-shrink-0">
        <span className="text-[15px] font-semibold text-gray-900">11:52</span>
        <span className="text-[13px] text-gray-400">18/06 Qui</span>
      </div>

      {/* Toast de confirmação */}
      <div className="flex items-center gap-2.5 px-5 py-3 flex-shrink-0" style={{ background: "#4CAF50" }}>
        <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center">
          <Check size={12} style={{ color: "#4CAF50" }} strokeWidth={3} />
        </div>
        <p className="text-white text-[14px] font-semibold">Beatriz alocada como Astrid</p>
      </div>

      {/* Header */}
      <div className="bg-white px-5 pt-3 pb-3 flex-shrink-0">
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
        {/* STATUS — ainda Atenção, 1 exceção */}
        <div className="rounded-2xl p-4 shadow-sm border border-amber-100" style={{ background: "#FFF8E1" }}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#FFE082" }}>
              <AlertTriangle size={16} style={{ color: "#E65100" }} />
            </div>
            <div>
              <p className="text-[18px] font-bold" style={{ color: "#E65100" }}>Atenção</p>
              <p className="text-[11px]" style={{ color: "#FF9800" }}>1 exceção ativa</p>
            </div>
          </div>
          <div className="h-px bg-amber-100 mb-2" />
          <p className="text-[13px] text-gray-600">Show das 19h30 · <span className="font-semibold">Astrid sem cobertura</span> · 7h38</p>
        </div>

        {/* Exceção restante */}
        <div>
          <p className="text-[10px] font-semibold tracking-widest uppercase mb-2 px-1" style={{ color: "#FF9800" }}>Exceções — 1 Ativa</p>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100" style={{ borderLeft: "4px solid #FF9800" }}>
            <div className="flex items-start gap-2 mb-2">
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" style={{ color: "#FF9800" }} />
              <div className="flex-1">
                <p className="text-[15px] font-bold text-gray-900">Show das 19h30</p>
                <p className="text-[12px] text-gray-500">Musical das Estrelas</p>
              </div>
            </div>
            <p className="text-[13px] text-gray-600 mb-2">Marina ausente · <span className="font-semibold">Astrid ↓</span></p>
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-bold px-2 py-0.5 rounded-full" style={{ background: "#FFEBEE", color: "#D32F2F" }}>NENHUMA</span>
              <button className="text-[13px] font-semibold px-3 py-1.5 rounded-xl text-white" style={{ background: GRAD }}>Resolver →</button>
            </div>
          </div>
        </div>

        {/* Rastreador de Confirmações — expandido */}
        <div>
          <p className="text-[10px] font-semibold text-gray-400 tracking-widest uppercase mb-2 px-1">Confirmações — Show 14h</p>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-[12px] text-gray-400 mb-2">Beatriz notificada · Show em andamento</p>

            {/* Barra de progresso */}
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: "87.5%", background: GRAD }} />
              </div>
              <span className="text-[12px] font-semibold text-gray-700 flex-shrink-0">7/8</span>
              <CheckCircle size={14} style={{ color: "#4CAF50" }} />
            </div>

            {/* Confirmados */}
            <p className="text-[11px] text-gray-400 mb-1">Confirmados (7):</p>
            <p className="text-[12px] text-gray-500 mb-3">✓ Beatriz · ✓ Ana · ✓ Marcos · ✓ Julia · ✓ Rafael · ✓ Sara · ✓ Paulo</p>

            {/* Pendente */}
            <div className="rounded-xl px-3 py-2.5 border-l-4" style={{ background: "#FFF8E1", borderLeftColor: "#FF9800" }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-semibold text-gray-800">◯ Bruno · 1h12 sem confirmar</p>
                </div>
                <button className="text-[12px] border border-gray-200 rounded-lg px-2.5 py-1 bg-white text-gray-600 flex-shrink-0">Renotificar</button>
              </div>
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
              Beatriz confirmou por mensagem há 3 minutos. Falta Bruno confirmar. Marina entrou em contato e confirmou a folga.
            </p>
          </div>
        </div>
      </div>

      <NavBar />
    </div>
  );
}
