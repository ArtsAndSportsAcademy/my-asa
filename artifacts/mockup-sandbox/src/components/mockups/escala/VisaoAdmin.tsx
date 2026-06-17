import { Star, ChevronLeft, Check, AlertTriangle } from "lucide-react";

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

export function VisaoAdmin() {
  const grupos = [
    { nome: "Ballet", total: 6, cobertas: 5, risco: 0, aberta: 1, supervisor: "Fernanda", status: "amber" },
    { nome: "Elenco", total: 8, cobertas: 8, risco: 0, aberta: 0, supervisor: "Ricardo", status: "green" },
    { nome: "Técnico", total: 4, cobertas: 4, risco: 0, aberta: 0, supervisor: "Ana", status: "green" },
  ];

  return (
    <div className="flex flex-col bg-[#F5F5F7] overflow-hidden" style={{ width: 390, height: 844, fontFamily: FONT }}>
      <div className="bg-white px-6 pt-4 pb-1 flex justify-between flex-shrink-0">
        <span className="text-[15px] font-semibold text-gray-900">09:30</span>
        <span className="text-[13px] text-gray-400">19/06 Sex</span>
      </div>

      <div className="bg-white px-4 pt-2 pb-3 flex items-center gap-2 flex-shrink-0 border-b border-gray-100">
        <button className="flex items-center gap-1 text-gray-500">
          <ChevronLeft size={16} /><span className="text-[12px]">Painel de Saúde</span>
        </button>
        <div className="flex-1 text-center"><span className="text-[15px] font-bold text-gray-900">Escala — Admin</span></div>
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] font-bold" style={{ background: GRAD }}>A</div>
      </div>

      {/* Filtro de grupos — Admin vê todos */}
      <div className="bg-white px-4 pb-2.5 flex-shrink-0 border-b border-gray-100">
        <p className="text-[11px] text-gray-400 mt-2 mb-2">Musical das Estrelas · Todos os grupos</p>
        <div className="flex gap-2">
          {["Todos", "Ballet", "Elenco", "Técnico"].map((g, i) => (
            <button key={g} className="px-3 py-1 rounded-full text-[12px] font-medium flex-shrink-0"
              style={i === 0
                ? { background: GRAD, color: "white" }
                : { background: "#F3F4F6", color: "#6B7280" }}>
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Date strip */}
      <div className="bg-white px-4 pb-2.5 flex-shrink-0 border-b border-gray-100">
        <div className="flex gap-4 mt-2">
          {[{ d: "Sáb 20", show: true, sel: true }, { d: "Dom 21", show: true, sel: false }, { d: "Seg 22", show: false, sel: false }].map(day => (
            <div key={day.d} className="flex flex-col items-center gap-1">
              <span className="text-[12px]" style={{ fontWeight: day.sel ? 700 : 400, color: day.sel ? "#1F2937" : "#9CA3AF" }}>{day.d}</span>
              {day.show && <Star size={10} style={{ color: day.sel ? "#7C3AED" : "#D1D5DB" }} fill={day.sel ? "#7C3AED" : "none"} />}
              {day.sel && <div className="h-0.5 w-6 rounded-full" style={{ background: GRAD }} />}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-2 flex flex-col gap-3">
        {/* Resumo agregado */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-[13px] font-semibold text-gray-700 mb-3">Sáb 20/06 · Todos os Grupos</p>
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: "94%", background: GRAD }} />
            </div>
            <span className="text-[13px] font-bold text-gray-700">17/18</span>
          </div>
          <div className="flex gap-3">
            <span className="text-[11px] text-green-600">17 cobertas</span>
            <span className="text-[11px] text-red-500">1 aberta</span>
          </div>
        </div>

        {/* Por grupo */}
        <p className="text-[10px] font-semibold text-gray-400 tracking-widest uppercase px-1">Por Grupo</p>

        {grupos.map((g) => (
          <div key={g.nome} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
            style={{ borderLeft: `4px solid ${g.status === "green" ? "#4CAF50" : "#FF9800"}` }}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-[16px] font-bold text-gray-900">{g.nome}</p>
                <p className="text-[12px] text-gray-400">Supervisora: {g.supervisor}</p>
              </div>
              <div className="text-right">
                <p className="text-[18px] font-bold" style={{ color: g.status === "green" ? "#4CAF50" : "#FF9800" }}>
                  {g.cobertas}/{g.total}
                </p>
                {g.aberta > 0 && (
                  <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">{g.aberta} aberta</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(g.cobertas / g.total) * 100}%`, background: g.status === "green" ? "#4CAF50" : "#FF9800" }} />
              </div>
            </div>

            <div className="flex gap-2">
              {g.cobertas === g.total ? (
                <div className="flex items-center gap-1">
                  <Check size={12} style={{ color: "#4CAF50" }} />
                  <span className="text-[11px] text-green-600">cobertura completa</span>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <AlertTriangle size={12} style={{ color: "#FF9800" }} />
                  <span className="text-[11px] text-amber-600">1 posição em aberto</span>
                </div>
              )}
            </div>

            {/* Responsável visível para Admin */}
            {g.aberta > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-100">
                <p className="text-[11px] text-gray-400">Supervisora responsável: <span className="font-medium text-gray-600">{g.supervisor}</span></p>
              </div>
            )}
          </div>
        ))}

        {/* Nota Admin — sem botão publicar */}
        <div className="bg-gray-50 rounded-2xl px-4 py-3 border border-gray-100">
          <p className="text-[12px] text-gray-400 text-center">Visão de diagnóstico — ações operacionais são do Supervisor de cada grupo</p>
        </div>
      </div>

      <NavBar />
    </div>
  );
}
