import { MessageSquare, Sparkles, ChevronLeft } from "lucide-react";

const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif";
const GRAD = "linear-gradient(135deg, #7C3AED, #2563EB)";

function TimelineDot({ done = true, last = false }: { done?: boolean; last?: boolean }) {
  return (
    <div className="flex flex-col items-center flex-shrink-0">
      <div className="w-3 h-3 rounded-full border-2 flex-shrink-0" style={{
        background: done ? "#7C3AED" : "#E5E7EB",
        borderColor: done ? "#7C3AED" : "#D1D5DB"
      }} />
      {!last && <div className="w-0.5 flex-1 mt-1" style={{ background: "#E5E7EB", minHeight: 28 }} />}
    </div>
  );
}

export function W3Acompanhamento() {
  return (
    <div className="flex flex-col bg-[#F5F5F7] overflow-hidden" style={{ width: 390, height: 844, fontFamily: FONT }}>
      {/* Status bar */}
      <div className="bg-white px-6 pt-4 pb-1 flex justify-between items-center flex-shrink-0">
        <span className="text-[15px] font-semibold text-gray-900">10:22</span>
        <span className="text-[13px] text-gray-400">17/06 Ter</span>
      </div>

      {/* Header */}
      <div className="bg-white px-5 pt-2 pb-4 flex-shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <button className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <ChevronLeft size={18} className="text-gray-600" />
          </button>
          <div>
            <p className="text-[18px] font-bold text-gray-900">Pedir folga</p>
            <p className="text-[12px] text-gray-400">Sábado, 21 de junho · Dia inteiro</p>
          </div>
        </div>
        {/* State pill — NEGADA */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: "#F3F4F6" }}>
          <span className="text-[13px] font-semibold text-gray-600">✕ Negada</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">

        {/* LINHA DO TEMPO */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase mb-3">Linha do Tempo</p>

          <div className="flex gap-3">
            <div className="flex flex-col items-center flex-shrink-0">
              <div className="w-3 h-3 rounded-full" style={{ background: "#7C3AED" }} />
              <div className="w-0.5 bg-gray-200" style={{ height: 36 }} />
              <div className="w-3 h-3 rounded-full" style={{ background: "#7C3AED" }} />
              <div className="w-0.5 bg-gray-200" style={{ height: 36 }} />
              <div className="w-3 h-3 rounded-full" style={{ background: "#6B7280" }} />
            </div>
            <div className="flex flex-col gap-0 flex-1">
              <div className="pb-4">
                <p className="text-[13px] font-semibold text-gray-900">Enviada</p>
                <p className="text-[11px] text-gray-400">17/06/2026 · 14h37</p>
              </div>
              <div className="pb-4">
                <p className="text-[13px] font-semibold text-gray-900">Em análise</p>
                <p className="text-[11px] text-gray-400">17/06/2026 · 16h02 · Supervisora Ana Silva</p>
              </div>
              <div>
                <p className="text-[13px] font-semibold text-gray-600">Negada</p>
                <p className="text-[11px] text-gray-400">17/06/2026 · 18h15 · Supervisora Ana Silva</p>
              </div>
            </div>
          </div>
        </div>

        {/* PEDIDO */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase mb-2">Seu Pedido</p>
          <p className="text-[13px] text-gray-700">"Compromisso familiar."</p>
        </div>

        {/* DECISÃO */}
        <div className="rounded-2xl p-4 shadow-sm" style={{ background: "#F3F4F6", borderLeft: "4px solid #6B7280" }}>
          <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase mb-2">Decisão</p>
          <p className="text-[14px] font-bold text-gray-700 mb-2">✕ Negada</p>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Motivo</p>
          <p className="text-[13px] text-gray-700 leading-relaxed">
            "Você é a única titular de Astrid disponível nesta data. O Musical das 14h ficaria sem cobertura."
          </p>
        </div>

        {/* Card IA */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100" style={{ borderLeft: "4px solid #7C3AED" }}>
          <div className="flex items-start gap-2.5">
            <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: GRAD }}>
              <Sparkles size={10} color="white" />
            </div>
            <p className="text-[12px] text-gray-500 italic leading-relaxed flex-1">
              O Musical das 14h tem cobertura apenas por você nessa data. Tente para uma data onde Beatriz esteja disponível como substituta.
            </p>
          </div>
          <button className="text-[12px] font-semibold mt-2 ml-7" style={{ color: "#7C3AED" }}>Perguntar à IA →</button>
        </div>

        {/* Ações */}
        <button className="w-full bg-white py-3.5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center gap-2">
          <MessageSquare size={15} className="text-gray-500" />
          <span className="text-[14px] font-medium text-gray-700">Abrir conversa com o Supervisor</span>
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
