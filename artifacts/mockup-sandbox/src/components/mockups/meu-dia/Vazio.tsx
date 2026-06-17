import { ChevronRight, Sparkles } from "lucide-react";

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
      <span className="text-[15px] font-semibold text-gray-900">10:15</span>
      <span className="text-[13px] text-gray-400">22/06 Dom</span>
    </div>
  );
}

export function Vazio() {
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

      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
        {/* Card Dia Livre — afirmativo, não negativo */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          {/* Ícone sutil de descanso */}
          <div className="flex justify-center mb-4">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #EDE9FE, #DBEAFE)" }}
            >
              <span className="text-[28px]">✦</span>
            </div>
          </div>

          <p className="text-[22px] font-bold text-gray-900 text-center mb-1">
            Dia livre hoje
          </p>
          <p className="text-[14px] text-gray-400 text-center mb-4">
            Sem atividades programadas
          </p>

          <div className="h-px bg-gray-100 mb-4" />

          {/* Próxima atividade futura */}
          <div>
            <p className="text-[11px] font-semibold text-gray-400 tracking-widest uppercase mb-2">
              Próxima atividade
            </p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[16px] font-semibold text-gray-900">Ensaio Técnico</p>
                <p className="text-[13px] text-gray-400 mt-0.5">Segunda, 24/06 · 10:00</p>
              </div>
              <span
                className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                style={{ background: "#EDE9FE", color: "#7C3AED" }}
              >
                ENSAIO
              </span>
            </div>
          </div>
        </div>

        {/* Card IA — dia livre */}
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
              Dia livre. Sua próxima atividade é segunda, 10h. Você tem uma solicitação pendente de análise.
            </p>
          </div>
          <button
            className="text-[12px] font-medium mt-2 ml-7"
            style={{ color: "#7C3AED" }}
          >
            Perguntar à IA →
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
                <p className="text-[14px] text-gray-700 font-medium">Folga 25/06</p>
                <p className="text-[12px] text-gray-400 mt-0.5">Em análise há 2 dias</p>
              </div>
              <ChevronRight size={16} className="text-gray-300" />
            </div>
          </div>
        </div>

        {/* Grande espaço em branco — respira. Dia livre = calma. */}
        <div className="flex-1" />
      </div>

      <NavBar active="Meu Dia" />
    </div>
  );
}
