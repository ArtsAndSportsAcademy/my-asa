import { Star, ChevronLeft, ChevronDown, ChevronRight, Check, X } from "lucide-react";

const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif";
const GRAD = "linear-gradient(90deg, #7C3AED, #2563EB)";

function NavBar() {
  const tabs = ["Painel", "Escala", "Solicitações", "Mensagens"];
  return (
    <div className="bg-white border-t border-gray-200 px-2 pt-2 pb-6 flex-shrink-0">
      <div className="flex justify-around">
        {tabs.map((t) => (
          <div key={t} className="flex flex-col items-center gap-1 px-1">
            <div className="w-1 h-1 rounded-full" style={{ background: t === "Escala" ? GRAD : "transparent" }} />
            <span className="text-[11px]" style={{ fontWeight: t === "Escala" ? 600 : 400, color: t === "Escala" ? "#7C3AED" : "#9CA3AF" }}>{t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Construcao() {
  const slots = [
    { member: "Amanda", role: "Astrid", open: true, risk: false },
    { member: "Bruno", role: "Marcos", open: false, risk: false },
    { member: "Carol", role: "Elena", open: false, risk: false },
    { member: "Diego", role: "Figurante A", open: false, risk: false },
    { member: "Sara", role: "Figurante B", open: false, risk: false },
    { member: "Rafael", role: "Regência", open: false, risk: false },
  ];

  return (
    <div className="flex flex-col bg-[#F5F5F7] overflow-hidden" style={{ width: 390, height: 844, fontFamily: FONT }}>
      <div className="bg-white px-6 pt-4 pb-1 flex justify-between flex-shrink-0">
        <span className="text-[15px] font-semibold text-gray-900">09:30</span>
        <span className="text-[13px] text-gray-400">19/06 Sex</span>
      </div>

      {/* Header */}
      <div className="bg-white px-4 pt-2 pb-3 flex items-center gap-2 flex-shrink-0 border-b border-gray-100">
        <button className="flex items-center gap-1 text-gray-500">
          <ChevronLeft size={16} /><span className="text-[13px]">Painel</span>
        </button>
        <div className="flex-1 text-center">
          <span className="text-[16px] font-bold text-gray-900">Escala</span>
        </div>
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] font-bold" style={{ background: GRAD }}>F</div>
      </div>

      {/* Date strip */}
      <div className="bg-white px-4 pb-3 flex-shrink-0 border-b border-gray-100">
        <div className="flex gap-3 mt-2 overflow-x-auto">
          {[
            { d: "Sáb 20", show: true, selected: true },
            { d: "Dom 21", show: false, selected: false },
            { d: "Seg 22", show: false, selected: false },
            { d: "Ter 23", show: false, selected: false },
          ].map((day) => (
            <div key={day.d} className="flex flex-col items-center gap-1 flex-shrink-0">
              <span className="text-[12px]" style={{ fontWeight: day.selected ? 700 : 400, color: day.selected ? "#1F2937" : "#9CA3AF" }}>{day.d}</span>
              {day.show && <Star size={10} style={{ color: day.selected ? "#7C3AED" : "#D1D5DB" }} fill={day.selected ? "#7C3AED" : "none"} />}
              {day.selected && <div className="h-0.5 w-full rounded-full" style={{ background: GRAD }} />}
            </div>
          ))}
        </div>
        <p className="text-[11px] text-gray-400 mt-1.5">Musical das Estrelas · Grupo Ballet</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-2 flex flex-col gap-3">
        {/* Resumo de cobertura */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[13px] font-semibold text-gray-700">Sáb 20/06 · Resumo</p>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">Rascunho</span>
          </div>
          {/* Progress bar */}
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: "83%", background: GRAD }} />
            </div>
            <span className="text-[13px] font-bold text-gray-700 flex-shrink-0">5/6</span>
          </div>
          <div className="flex gap-3">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-[11px] text-gray-500">5 cobertas</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-400" />
              <span className="text-[11px] text-gray-500">1 aberta</span>
            </div>
          </div>
        </div>

        {/* Atividades */}
        <p className="text-[10px] font-semibold text-gray-400 tracking-widest uppercase px-1">Atividades — Sáb 20/06</p>

        {/* Atividade 1 — Musical com posição aberta, expandida */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ borderLeft: "4px solid #D32F2F" }}>
          <div className="px-4 pt-3 pb-2">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Star size={13} style={{ color: "#7C3AED" }} fill="#7C3AED" />
                <span className="text-[15px] font-bold text-gray-900">Musical das Estrelas</span>
              </div>
              <span className="text-[13px] font-semibold text-gray-600">15:00</span>
            </div>
            <p className="text-[12px] text-gray-400 mb-2">até 18:30 · Teatro Principal</p>
            <div className="flex gap-2 mb-3">
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-50 text-green-700">5 cobertas</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-50 text-red-700">1 aberta</span>
            </div>
            <div className="h-px bg-gray-100 mb-3" />

            {/* Slots */}
            <div className="flex flex-col gap-2">
              {slots.map((s) => (
                <div key={s.role}>
                  {s.open ? (
                    <div className="rounded-xl px-3 py-2.5" style={{ background: "#FFF3F3", border: "1px dashed #FFCDD2" }}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                            <X size={12} className="text-gray-400" />
                          </div>
                          <div>
                            <p className="text-[12px] font-semibold text-gray-700">{s.member}</p>
                            <p className="text-[10px] text-red-500">Folga aprovada · 20/06</p>
                          </div>
                        </div>
                        <span className="text-[11px] font-medium text-gray-500">{s.role}</span>
                      </div>
                      <button className="w-full mt-1 py-2 rounded-lg text-[12px] font-semibold text-white" style={{ background: GRAD }}>
                        + Alocar substituta
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-1 py-1.5">
                      <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[11px] font-bold text-gray-500">
                        {s.member[0]}
                      </div>
                      <span className="text-[13px] text-gray-700 flex-1">{s.member}</span>
                      <span className="text-[12px] text-gray-400">{s.role}</span>
                      <Check size={14} style={{ color: "#4CAF50" }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Atividade 2 — Ensaio, recolhido */}
        <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100" style={{ borderLeft: "4px solid #4CAF50" }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[14px] font-semibold text-gray-800">Ensaio Técnico</p>
              <p className="text-[12px] text-gray-400">09:00 — 11:30 · Estúdio B</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-green-600 font-medium">6/6 ✓</span>
              <ChevronDown size={14} className="text-gray-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Painel de Validação — fixo */}
      <div className="bg-white border-t border-gray-200 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <p className="text-[13px] text-gray-600">1 posição em aberto <span className="text-gray-400">· Astrid</span></p>
          <button className="px-4 py-2 rounded-xl text-white text-[13px] font-bold" style={{ background: GRAD }}>
            Publicar (!)
          </button>
        </div>
      </div>

      <NavBar />
    </div>
  );
}
