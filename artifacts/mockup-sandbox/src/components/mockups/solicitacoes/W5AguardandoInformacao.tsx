import { ChevronLeft, Send } from "lucide-react";

const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif";
const GRAD = "linear-gradient(135deg, #7C3AED, #2563EB)";

export function W5AguardandoInformacao() {
  return (
    <div className="flex flex-col bg-[#F5F5F7] overflow-hidden" style={{ width: 390, height: 844, fontFamily: FONT }}>
      {/* Status bar */}
      <div className="bg-white px-6 pt-4 pb-1 flex justify-between items-center flex-shrink-0">
        <span className="text-[15px] font-semibold text-gray-900">9:41</span>
        <span className="text-[13px] text-gray-400">17/06 Ter</span>
      </div>

      {/* Header */}
      <div className="bg-white px-5 pt-2 pb-4 flex-shrink-0">
        <div className="flex items-center gap-3 mb-2">
          <button className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <ChevronLeft size={18} className="text-gray-600" />
          </button>
          <div>
            <p className="text-[18px] font-bold text-gray-900">Pedir algo diferente</p>
            <p className="text-[12px] text-gray-400">Terça, 18 de junho</p>
          </div>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: "#FEF3C7" }}>
          <span className="text-[12px] font-bold" style={{ color: "#B45309" }}>● Aguardando sua resposta</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">

        {/* Pergunta do Supervisor — centro da tela */}
        <div className="rounded-2xl p-4 shadow-md" style={{ background: "#FFF7ED", border: "1.5px solid #FCD34D" }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0" style={{ background: "linear-gradient(135deg, #7C3AED, #2563EB)" }}>A</div>
            <div>
              <p className="text-[13px] font-semibold text-gray-900">Supervisora Ana Silva</p>
              <p className="text-[11px] text-gray-400">17/06 · 15h42</p>
            </div>
          </div>
          <p className="text-[15px] text-gray-800 leading-relaxed font-medium">
            "Você mencionou participar de um evento externo. Trata-se de atividade remunerada ou pessoal?"
          </p>
        </div>

        {/* Pedido original — contexto preservado */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Seu pedido original</p>
          <p className="text-[13px] font-medium text-gray-800">Terça, 18 de junho · Dia inteiro</p>
          <p className="text-[13px] text-gray-600 mt-1 italic">"Preciso participar de um evento de formação profissional."</p>
        </div>

        {/* Aviso de ciclos */}
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl" style={{ background: "#F0F9FF" }}>
          <span className="text-[13px] flex-shrink-0">ℹ️</span>
          <p className="text-[12px] text-gray-500 leading-relaxed">Esta é a <strong className="text-gray-700">1ª de no máximo 2</strong> rodadas de informação. Após isso, o Supervisor precisará tomar uma decisão.</p>
        </div>

        {/* Campo de resposta */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-[12px] font-semibold text-gray-700 mb-2">Sua resposta *</p>
          <div className="rounded-xl border border-gray-200 p-3 min-h-[100px] flex items-start">
            <p className="text-[14px] text-gray-300">Escreva sua resposta aqui...</p>
          </div>
        </div>

        {/* Enviar */}
        <button className="w-full py-4 rounded-2xl text-white text-[16px] font-bold shadow-sm flex items-center justify-center gap-2" style={{ background: GRAD }}>
          <Send size={16} />
          Enviar resposta
        </button>

        <div className="h-2" />
      </div>

      {/* Bottom Nav */}
      <div className="bg-white border-t border-gray-200 px-2 pt-2 pb-6 flex-shrink-0">
        <div className="flex justify-around">
          {["Meu Dia", "Solicitações", "Entregas", "Mensagens"].map((t) => (
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
