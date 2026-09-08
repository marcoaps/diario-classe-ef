// Animações de "gerando" e "baixando" compartilhadas entre as telas de
// geração de Sequência Didática via IA.

const ETAPAS_ANIMACAO = [
  { icone: "🧠", texto: "Analisando tema e série..." },
  { icone: "📚", texto: "Selecionando habilidades BNCC..." },
  { icone: "✏️", texto: "Redigindo objetivos e conteúdos..." },
  { icone: "🏃", texto: "Criando situações de aprendizagem..." },
  { icone: "🖼️", texto: "Buscando imagens ilustrativas..." },
  { icone: "📄", texto: "Finalizando documento..." },
];

export function AnimacaoGerando({ etapa }: { etapa: number }) {
  const e = ETAPAS_ANIMACAO[etapa % ETAPAS_ANIMACAO.length];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
        <div className="relative w-20 h-20 mx-auto mb-6">
          <svg className="w-20 h-20 animate-spin" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="34" fill="none" stroke="#E5E7EB" strokeWidth="6" />
            <circle cx="40" cy="40" r="34" fill="none" stroke="#1D4ED8" strokeWidth="6" strokeDasharray="80 134" strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-3xl">{e.icone}</div>
        </div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Gerando Sequência Didática</h3>
        <p className="text-sm text-blue-600 font-medium mb-4">{e.texto}</p>
        <div className="flex justify-center gap-1.5">
          {ETAPAS_ANIMACAO.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i <= etapa % ETAPAS_ANIMACAO.length ? "bg-blue-600 w-6" : "bg-gray-200 w-3"}`} />
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-4">Isso pode levar alguns segundos...</p>
      </div>
    </div>
  );
}

export function AnimacaoBaixando() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
        <div className="relative w-20 h-20 mx-auto mb-6">
          <svg className="w-20 h-20 animate-spin" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="34" fill="none" stroke="#E5E7EB" strokeWidth="6" />
            <circle cx="40" cy="40" r="34" fill="none" stroke="#15803D" strokeWidth="6" strokeDasharray="100 114" strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-3xl">📄</div>
        </div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Gerando arquivo Word</h3>
        <p className="text-sm text-green-600 font-medium">Incorporando imagens e formatando...</p>
        <p className="text-xs text-gray-400 mt-4">O download iniciará automaticamente</p>
      </div>
    </div>
  );
}
