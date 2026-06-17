import { AlertTriangle, CheckCircle, Sparkles } from "lucide-react";

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

export function Critico() {
  return (
    <div
      className="flex flex-col bg-[#F5F5F7] overflow-hidden"
      style={{ width: 390, height: 844, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif" }}
    >
      <StatusBar />

      {/* Header com badge de notificação ativo */}
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
            {/* Badge crítico — ! */}
            <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "#D32F2F" }}>
              <span className="text-white text-[13px] font-bold">!</span>
            </div>
          </div>
        </div>
      </div>

      {/* Separador mais denso — estado crítico */}
      <div className="h-[2px] bg-gray-300 mx-5 flex-shrink-0" />

      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
        {/* BLOCO DE ALTERAÇÃO — elemento dominante */}
        <div
          className="rounded-2xl shadow-md"
          style={{
            border: "1px solid #FECACA",
            borderLeft: "6px solid #D32F2F",
            overflow: "visible",
          }}
        >
          {/* Header do bloco */}
          <div
            className="px-4 py-3"
            style={{ background: "#FFF5F5" }}
          >
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={16} style={{ color: "#D32F2F" }} />
              <p className="text-[13px] font-bold tracking-wide" style={{ color: "#D32F2F" }}>
                ALTERAÇÃO NA SUA ESCALA
              </p>
            </div>
            <p className="text-[12px] text-gray-400">Publicada ontem às 22:14 · Supervisor Fernanda</p>
          </div>

          <div className="px-4 py-4" style={{ background: "#FFFBFB" }}>
            {/* Atividade afetada */}
            <p className="text-[12px] font-semibold text-gray-400 tracking-widest uppercase mb-3">
              Musical das Estrelas · 14:00
            </p>

            {/* Antes — tachado + cinza */}
            <div className="flex items-center gap-3 mb-2 py-2 px-3 rounded-xl bg-gray-50">
              <span className="text-[11px] font-semibold text-gray-300 w-10 flex-shrink-0">Antes</span>
              <div>
                <p
                  className="text-[15px] text-gray-300 font-medium"
                  style={{ textDecoration: "line-through" }}
                >
                  Astrid
                </p>
                <p
                  className="text-[12px] text-gray-300"
                  style={{ textDecoration: "line-through" }}
                >
                  Musical das Estrelas
                </p>
              </div>
            </div>

            {/* Agora — bold, vivo */}
            <div className="flex items-center gap-3 py-2 px-3 rounded-xl" style={{ background: "#F0FDF4" }}>
              <span className="text-[11px] font-semibold text-gray-500 w-10 flex-shrink-0">Agora</span>
              <div className="flex-1">
                <p className="text-[20px] font-bold text-gray-900">Marcos</p>
                <p className="text-[12px] text-gray-500">Musical das Estrelas</p>
              </div>
              <CheckCircle size={18} style={{ color: "#4CAF50" }} />
            </div>

            {/* Divisor */}
            <div className="h-px bg-gray-100 my-4" />

            {/* Botão Confirmar — full width gradient */}
            <button
              className="w-full py-4 rounded-xl text-white text-[16px] font-bold tracking-wide shadow-sm"
              style={{
                background: "linear-gradient(90deg, #7C3AED, #2563EB)",
              }}
            >
              Confirmar Alteração
            </button>
          </div>
        </div>

        {/* Card Próxima Atividade — atualizada */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-2">
            <p className="text-[10px] font-semibold text-gray-400 tracking-widest uppercase">
              Próxima Atividade — Atualizada
            </p>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: "#EDE9FE", color: "#7C3AED" }}
            >
              SHOW
            </span>
          </div>
          <p className="text-[16px] font-semibold text-gray-900">Musical das Estrelas</p>
          <p className="text-[22px] font-bold text-gray-900 mt-1">14:00 → 17:30</p>
          <p className="text-[13px] text-gray-400 mt-0.5 mb-3">Teatro Principal</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] text-gray-400">Seu papel</p>
              <p className="text-[18px] font-bold text-gray-900">Marcos</p>
            </div>
            <span
              className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
              style={{ background: "#EDE9FE", color: "#7C3AED" }}
            >
              ↑ novo
            </span>
          </div>
        </div>

        {/* Card IA — contextual à alteração */}
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
              Seu papel no Musical mudou de Astrid para Marcos. O figurino e entrada de cena são diferentes. Confirme quando estiver pronto.
            </p>
          </div>
          <button
            className="text-[12px] font-medium mt-2 ml-7"
            style={{ color: "#7C3AED" }}
          >
            Perguntar sobre a mudança →
          </button>
        </div>

        {/* Link linha do tempo */}
        <button className="text-[12px] text-gray-400 text-center py-1">
          Ver linha do tempo →
        </button>
      </div>

      <NavBar active="Meu Dia" />
    </div>
  );
}
