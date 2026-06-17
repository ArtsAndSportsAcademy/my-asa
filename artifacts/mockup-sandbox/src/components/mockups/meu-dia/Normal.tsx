import { CheckCircle, ChevronRight, Sparkles } from "lucide-react";

function NavBar({ active }: { active: string }) {
  const tabs = ["Meu Dia", "Solicitações", "Entregas", "Mensagens"];
  return (
    <div className="bg-white border-t border-gray-200 px-2 pt-2 pb-6 flex-shrink-0">
      <div className="flex justify-around">
        {tabs.map((t) => (
          <div key={t} className="flex flex-col items-center gap-1 px-1">
            <div
              className="w-1 h-1 rounded-full"
              style={{
                background:
                  t === active
                    ? "linear-gradient(90deg, #7C3AED, #2563EB)"
                    : "transparent",
              }}
            />
            <span
              className="text-[11px]"
              style={{
                fontWeight: t === active ? 600 : 400,
                color: t === active ? "#7C3AED" : "#9CA3AF",
              }}
            >
              {t}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBar() {
  return (
    <div className="bg-white px-6 pt-4 pb-1 flex justify-between items-center flex-shrink-0">
      <span className="text-[15px] font-semibold text-gray-900">9:41</span>
      <span className="text-[13px] text-gray-400">18/06 Qui</span>
    </div>
  );
}

export function Normal() {
  return (
    <div
      className="flex flex-col bg-[#F5F5F7] overflow-hidden"
      style={{ width: 390, height: 844, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif" }}
    >
      <StatusBar />

      {/* Header */}
      <div className="bg-white px-5 pt-2 pb-4 flex-shrink-0">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-[22px] font-bold text-gray-900">Bom dia, Carlos</p>
            <p className="text-[13px] text-gray-400 mt-0.5">Musical das Estrelas</p>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[14px] font-bold"
              style={{ background: "linear-gradient(135deg, #7C3AED, #2563EB)" }}
            >
              C
            </div>
            <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
              <span className="text-[14px] text-gray-400">·</span>
            </div>
          </div>
        </div>
      </div>

      <div className="h-px bg-gray-200 mx-5 flex-shrink-0" />

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
        {/* Card Próxima Atividade */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-[10px] font-semibold text-gray-400 tracking-widest uppercase mb-3">
            Próxima Atividade
          </p>
          <div className="flex justify-between items-start mb-2">
            <p className="text-[16px] font-semibold text-gray-900">Musical das Estrelas</p>
            <span
              className="text-[10px] font-bold px-2.5 py-1 rounded-full"
              style={{ background: "#EDE9FE", color: "#7C3AED" }}
            >
              SHOW
            </span>
          </div>
          <div className="h-px bg-gray-100 mb-3" />
          <p className="text-[26px] font-bold text-gray-900 tracking-tight">14:00 → 17:30</p>
          <p className="text-[14px] text-gray-400 mb-4">Teatro Principal</p>
          <div className="mb-4">
            <p className="text-[11px] text-gray-400 mb-1">Seu papel</p>
            <div className="flex items-center justify-between">
              <p className="text-[22px] font-bold text-gray-900">Marcos</p>
              <div className="flex items-center gap-1.5" style={{ color: "#4CAF50" }}>
                <CheckCircle size={16} strokeWidth={2} />
                <span className="text-[12px] font-medium">confirmado</span>
              </div>
            </div>
          </div>
          <button className="w-full py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-[13px] text-gray-500 font-medium">
            Ver Livro do Dia
          </button>
        </div>

        {/* Card IA */}
        <div
          className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
          style={{ borderLeft: "4px solid #7C3AED" }}
        >
          <div className="flex items-start gap-2.5">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: "linear-gradient(135deg, #7C3AED, #2563EB)" }}
            >
              <Sparkles size={10} color="white" />
            </div>
            <p className="text-[13px] text-gray-500 italic leading-relaxed flex-1">
              Hoje você tem 1 show às 14h como Marcos. Tudo confirmado.{" "}
              Próximo ensaio: sexta, 15h.
            </p>
          </div>
          <button
            className="text-[12px] font-medium mt-2 ml-7"
            style={{ color: "#7C3AED" }}
          >
            Perguntar à IA →
          </button>
        </div>

        {/* Linha do Tempo */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-[10px] font-semibold text-gray-400 tracking-widest uppercase mb-3">
            Hoje — 2 Atividades
          </p>
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-3">
              <span className="text-[12px] text-gray-400 w-10 flex-shrink-0 font-mono">10:00</span>
              <span className="text-[14px] text-gray-400">Aquecimento técnico</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[12px] font-semibold w-10 flex-shrink-0 font-mono" style={{ color: "#7C3AED" }}>
                14:00
              </span>
              <span className="text-[14px] font-semibold text-gray-900">Musical das Estrelas</span>
              <span className="text-[12px]" style={{ color: "#7C3AED" }}>◀</span>
            </div>
          </div>
          <button className="text-[12px] text-gray-400 mt-2.5">
            Ver linha do tempo completa →
          </button>
        </div>

        {/* Pendências */}
        <div>
          <p className="text-[10px] font-semibold text-gray-400 tracking-widest uppercase mb-2 px-1">
            Pendências
          </p>
          <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[14px] text-gray-700 font-medium">Solicitações · 1 em análise</p>
                <p className="text-[12px] text-gray-400 mt-0.5">Folga 25/06 · em análise há 1d</p>
              </div>
              <ChevronRight size={16} className="text-gray-300" />
            </div>
          </div>
        </div>
      </div>

      <NavBar active="Meu Dia" />
    </div>
  );
}
