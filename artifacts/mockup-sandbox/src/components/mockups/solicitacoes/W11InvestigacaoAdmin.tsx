import { Sparkles, ChevronLeft, ChevronRight } from "lucide-react";

const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif";
const GRAD = "linear-gradient(135deg, #7C3AED, #2563EB)";

const eventos = [
  {
    data: "17/06 · 10h14",
    titulo: "Solicitação criada",
    desc: "Amanda Souza · Folga · 21/06 · Dia inteiro",
    tipo: "membro",
    cor: "#7C3AED",
  },
  {
    data: "17/06 · 16h02",
    titulo: "Visualizada e aberta",
    desc: "Supervisora Ana Silva → EM ANÁLISE",
    tipo: "supervisor",
    cor: "#7C3AED",
  },
  {
    data: "17/06 · 18h00",
    titulo: "Aprovada",
    desc: "Supervisora Ana Silva · Escala atualizada automaticamente",
    tipo: "supervisor",
    cor: "#4CAF50",
  },
  {
    data: "19/06 · 09h22",
    titulo: "Alerta automático gerado",
    desc: "Restrição de Beatriz Lima aprovada → cobertura de Astrid afetada · Ana Silva notificada",
    tipo: "sistema",
    cor: "#FF9800",
  },
  {
    data: "19/06 · 11h05",
    titulo: "Aprovação revogada",
    desc: 'Supervisora Ana Silva · Motivo: "Lesão de Beatriz eliminou cobertura de Astrid." · Escala revertida · Amanda notificada',
    tipo: "supervisor",
    cor: "#D32F2F",
  },
  {
    data: "19/06 · 11h15",
    titulo: "Livro do Dia revisado",
    desc: "Supervisora Ana Silva · Sábado 21/06 corrigido",
    tipo: "supervisor",
    cor: "#4CAF50",
  },
];

export function W11InvestigacaoAdmin() {
  return (
    <div className="flex flex-col bg-[#F5F5F7] overflow-hidden" style={{ width: 390, height: 844, fontFamily: FONT }}>
      {/* Status bar */}
      <div className="bg-white px-6 pt-4 pb-1 flex justify-between items-center flex-shrink-0">
        <span className="text-[15px] font-semibold text-gray-900">9:41</span>
        <span className="text-[13px] text-gray-400">20/06 Sex</span>
      </div>

      {/* Header */}
      <div className="bg-white px-5 pt-2 pb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <ChevronLeft size={18} className="text-gray-600" />
          </button>
          <div>
            <p className="text-[18px] font-bold text-gray-900">Investigação</p>
            <p className="text-[12px] text-gray-400">Amanda Souza · Folga 21/06</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">

        {/* RESUMO NARRATIVO — IA no topo */}
        <div className="rounded-2xl p-4 shadow-sm" style={{ borderLeft: "4px solid #7C3AED", background: "#FAFAFA" }}>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={13} style={{ color: "#7C3AED" }} />
            <p className="text-[11px] font-bold tracking-wide uppercase" style={{ color: "#7C3AED" }}>Resumo</p>
          </div>
          <p className="text-[13px] text-gray-700 leading-relaxed">
            Solicitação de folga criada por Amanda em 17/06. Aprovada pelo Supervisor em 18h. Revogada em 19/06 após nova restrição de Beatriz eliminar a cobertura de Astrid.
          </p>

          {/* Padrão de reincidência */}
          <div className="mt-3 rounded-xl px-3 py-2" style={{ background: "#FEF3C7" }}>
            <p className="text-[12px] font-semibold" style={{ color: "#92400E" }}>
              ⚠ Reincidência detectada
            </p>
            <p className="text-[12px] mt-0.5" style={{ color: "#92400E" }}>
              3ª solicitação de folga de Amanda para o mesmo dia nas últimas 4 semanas.
            </p>
          </div>
        </div>

        {/* LINHA DO TEMPO COMPLETA */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-4">Linha do Tempo Completa</p>

          <div className="flex flex-col">
            {eventos.map((ev, i) => (
              <div key={i} className="flex gap-3">
                {/* Linha vertical + ponto */}
                <div className="flex flex-col items-center flex-shrink-0" style={{ width: 16 }}>
                  <div className="w-3 h-3 rounded-full flex-shrink-0 border-2 border-white" style={{ background: ev.cor, boxShadow: `0 0 0 2px ${ev.cor}30` }} />
                  {i < eventos.length - 1 && (
                    <div className="w-0.5 flex-1" style={{ background: "#E5E7EB", minHeight: 32 }} />
                  )}
                </div>

                {/* Conteúdo */}
                <div className={`flex-1 ${i < eventos.length - 1 ? "pb-4" : ""}`}>
                  <p className="text-[11px] text-gray-400 mb-0.5">{ev.data}</p>
                  <p className="text-[13px] font-semibold text-gray-900">{ev.titulo}</p>
                  <p className="text-[12px] text-gray-500 mt-0.5 leading-relaxed">{ev.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ATORES */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-3">Atores</p>
          {[
            { nome: "Amanda Souza", papel: "Membro · Requerente", inicial: "A" },
            { nome: "Ana Silva", papel: "Supervisora · Aprovadora / Revogadora", inicial: "S" },
            { nome: "Beatriz Lima", papel: "Membro · Gerou alerta (restrição)", inicial: "B" },
          ].map((a, i, arr) => (
            <div key={i} className={`flex items-center gap-3 ${i < arr.length - 1 ? "pb-3 mb-3 border-b border-gray-100" : ""}`}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[13px] font-bold flex-shrink-0" style={{ background: GRAD, opacity: 0.75 }}>{a.inicial}</div>
              <div>
                <p className="text-[13px] font-semibold text-gray-900">{a.nome}</p>
                <p className="text-[11px] text-gray-400">{a.papel}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Ações */}
        <div className="flex flex-col gap-2">
          <button className="w-full bg-white py-3.5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <Sparkles size={14} style={{ color: "#7C3AED" }} />
              <span className="text-[13px] font-medium text-gray-700">Perguntar à IA sobre este caso</span>
            </div>
            <ChevronRight size={15} className="text-gray-300" />
          </button>
          <button className="w-full bg-white py-3.5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between px-4">
            <span className="text-[13px] font-medium text-gray-700">Ver outras solicitações de Amanda</span>
            <ChevronRight size={15} className="text-gray-300" />
          </button>
        </div>

        <div className="h-2" />
      </div>

      {/* Bottom Nav Admin */}
      <div className="bg-white border-t border-gray-200 px-2 pt-2 pb-6 flex-shrink-0">
        <div className="flex justify-around">
          {["Painel", "Operações", "Solicitações", "Relatórios"].map((t) => (
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
