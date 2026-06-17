import { Star, ChevronLeft, ChevronDown, AlertTriangle, X, Sparkles } from "lucide-react";

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

export function ConstrucaoComAlertas() {
  return (
    <div className="flex flex-col bg-[#F5F5F7] overflow-hidden" style={{ width: 390, height: 844, fontFamily: FONT }}>
      <div className="bg-white px-6 pt-4 pb-1 flex justify-between flex-shrink-0">
        <span className="text-[15px] font-semibold text-gray-900">09:45</span>
        <span className="text-[13px] text-gray-400">19/06 Sex</span>
      </div>

      <div className="bg-white px-4 pt-2 pb-3 flex items-center gap-2 flex-shrink-0 border-b border-gray-100">
        <button className="flex items-center gap-1 text-gray-500">
          <ChevronLeft size={16} /><span className="text-[13px]">Painel</span>
        </button>
        <div className="flex-1 text-center"><span className="text-[16px] font-bold text-gray-900">Escala</span></div>
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] font-bold" style={{ background: GRAD }}>F</div>
      </div>

      {/* Date strip */}
      <div className="bg-white px-4 pb-3 flex-shrink-0 border-b border-gray-100">
        <div className="flex gap-3 mt-2">
          {[
            { d: "Sáb 20", show: true, selected: true, dot: null },
            { d: "Dom 21", show: true, selected: false, dot: "#FF9800" },
            { d: "Seg 22", show: false, selected: false, dot: null },
          ].map((day) => (
            <div key={day.d} className="flex flex-col items-center gap-1 flex-shrink-0">
              <span className="text-[12px]" style={{ fontWeight: day.selected ? 700 : 400, color: day.selected ? "#1F2937" : "#9CA3AF" }}>{day.d}</span>
              <div className="flex items-center gap-1">
                {day.show && <Star size={10} style={{ color: day.selected ? "#7C3AED" : "#D1D5DB" }} fill={day.selected ? "#7C3AED" : "none"} />}
                {day.dot && <div className="w-1.5 h-1.5 rounded-full" style={{ background: day.dot }} />}
              </div>
              {day.selected && <div className="h-0.5 w-full rounded-full" style={{ background: GRAD }} />}
            </div>
          ))}
        </div>
        <p className="text-[11px] text-gray-400 mt-1.5">Musical das Estrelas · Grupo Ballet</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-2 flex flex-col gap-2.5">
        {/* Resumo — múltiplos alertas */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[13px] font-semibold text-gray-700">Sáb 20/06 · Resumo</p>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">Rascunho</span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-amber-400" style={{ width: "50%" }} />
            </div>
            <span className="text-[13px] font-bold text-gray-700 flex-shrink-0">3/6</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            <span className="flex items-center gap-1 text-[11px] text-gray-500"><div className="w-2 h-2 rounded-full bg-green-400" />3 cobertas</span>
            <span className="flex items-center gap-1 text-[11px] text-amber-600"><div className="w-2 h-2 rounded-full bg-amber-400" />2 em risco</span>
            <span className="flex items-center gap-1 text-[11px] text-red-600"><div className="w-2 h-2 rounded-full bg-red-400" />1 aberta</span>
          </div>
        </div>

        {/* Atividade Musical — múltiplos alertas */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ borderLeft: "4px solid #D32F2F" }}>
          <div className="px-4 pt-3 pb-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Star size={12} style={{ color: "#7C3AED" }} fill="#7C3AED" />
                <span className="text-[14px] font-bold text-gray-900">Musical das Estrelas</span>
              </div>
              <span className="text-[13px] text-gray-600 font-semibold">15:00</span>
            </div>
            <div className="h-px bg-gray-100 mb-2" />

            {/* Slot aberto — Amanda */}
            <div className="rounded-xl px-3 py-2 mb-2" style={{ background: "#FFF3F3", border: "1px dashed #FFCDD2" }}>
              <div className="flex items-center gap-2 mb-1">
                <X size={13} style={{ color: "#D32F2F" }} />
                <span className="text-[13px] font-semibold text-gray-800">Amanda</span>
                <span className="text-[12px] text-gray-400">— Astrid</span>
              </div>
              <p className="text-[11px] text-red-500 mb-1.5">Folga aprovada</p>
              <button className="w-full py-1.5 rounded-lg text-[12px] font-semibold text-white" style={{ background: GRAD }}>
                + Alocar substituta
              </button>
            </div>

            {/* Slot em risco — Bruno */}
            <div className="rounded-xl px-3 py-2 mb-2" style={{ background: "#FFF8E1", borderLeft: "3px solid #FF9800" }}>
              <div className="flex items-center gap-2 mb-0.5">
                <AlertTriangle size={12} style={{ color: "#FF9800" }} />
                <span className="text-[13px] font-semibold text-gray-800">Bruno</span>
                <span className="text-[12px] text-gray-400">— Marcos</span>
              </div>
              <p className="text-[11px] text-amber-600 mb-1">Restrição: sem saltos · Marcos inclui sequência A5</p>
              <button className="text-[11px] text-amber-600 underline">Ver impacto →</button>
            </div>

            {/* Slots OK */}
            {[{ m: "Carol", r: "Elena" }, { m: "Diego", r: "Figurante A" }, { m: "Sara", r: "Figurante B" }, { m: "Rafael", r: "Regência" }].map(s => (
              <div key={s.r} className="flex items-center gap-2 py-1 px-1">
                <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500">{s.m[0]}</div>
                <span className="text-[12px] text-gray-600 flex-1">{s.m}</span>
                <span className="text-[11px] text-gray-400">{s.r}</span>
                <span className="text-[11px]" style={{ color: "#4CAF50" }}>✓</span>
              </div>
            ))}
          </div>
        </div>

        {/* Workshop — conflito de horário */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ borderLeft: "4px solid #FF9800" }}>
          <div className="px-4 pt-3 pb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[14px] font-bold text-gray-900">Workshop de Repertório</span>
              <span className="text-[12px] text-gray-500">11:00</span>
            </div>
            <div className="rounded-xl px-3 py-2 mb-1" style={{ background: "#FFF8E1", borderLeft: "3px solid #FF9800" }}>
              <div className="flex items-center gap-2 mb-0.5">
                <AlertTriangle size={12} style={{ color: "#FF9800" }} />
                <span className="text-[13px] font-semibold text-gray-800">Elena — Regência</span>
              </div>
              <p className="text-[11px] text-amber-700">↕ Conflito: Ensaio 09h até 11:30 / Workshop 11:00</p>
              <p className="text-[11px] text-amber-600 mb-1">Sobreposição: 30 minutos</p>
              <button className="text-[11px] text-amber-600 underline">Resolver conflito →</button>
            </div>
          </div>
        </div>

        {/* Card IA */}
        <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100" style={{ borderLeft: "4px solid #7C3AED" }}>
          <div className="flex items-start gap-2">
            <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: GRAD }}>
              <Sparkles size={10} color="white" />
            </div>
            <p className="text-[12px] text-gray-500 italic leading-relaxed">
              3 itens: 1. Astrid em aberto (crítico). 2. Conflito de Elena (resolva antes das 11h). 3. Bruno: sequência A5 é risco baixo se aqueceu hoje.
            </p>
          </div>
        </div>
      </div>

      {/* Painel de Validação */}
      <div className="bg-white border-t border-gray-200 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <p className="text-[12px] text-gray-600">1 aberta · 2 em risco · 1 conflito</p>
          <button className="px-3 py-2 rounded-xl text-white text-[12px] font-bold" style={{ background: GRAD }}>Publicar (!!!)</button>
        </div>
      </div>

      <NavBar />
    </div>
  );
}
