// Visualização (prévia em HTML) da Sequência Didática gerada, no mesmo
// layout do .docx exportado. Compartilhado entre o Gerador de Sequência
// genérico e a aba dedicada de Esportes de Invasão.

import type { Sequencia } from "./sequenciaDidaticaTypes";
import { ordinal } from "./sequenciaDidaticaHelpers";

export interface SequenciaDidaticaPreviewProps {
  sequencia: Sequencia;
  professor: string;
  coordenador: string;
  serie: string;
  turmas: string;
  aulasPrevistas: string;
  periodo: string;
  tema: string;
  numeroAtual: number;
}

export function SequenciaDidaticaPreview({
  sequencia, professor, coordenador, serie, turmas, aulasPrevistas, periodo, tema, numeroAtual,
}: SequenciaDidaticaPreviewProps) {
  return (
    <div className="bg-white border border-gray-300 shadow-lg rounded-lg overflow-hidden" style={{ fontFamily: "Arial, sans-serif" }}>
      {/* Cabeçalho oficial */}
      <div className="flex items-center border-b-4 border-yellow-500 pb-2 px-4 pt-3 gap-3">
        <img src="/brasao-acre.png" alt="Brasão do Acre" className="h-16 w-16 object-contain shrink-0" />
        <div>
          <div className="text-xs font-bold text-green-800">GOVERNO DO ESTADO DO ACRE</div>
          <div className="text-xs text-green-700">www.acre.gov.br</div>
        </div>
        <div className="flex-1 text-right">
          <div className="text-xs text-green-800">SECRETARIA DE ESTADO DE</div>
          <div className="text-sm font-bold text-green-800">EDUCAÇÃO, CULTURA E ESPORTES</div>
          <div className="text-base font-bold text-green-800">DIRETORIA DE ENSINO</div>
          <div className="text-xs font-bold text-green-800">DIVISÃO DE ENSINO FUNDAMENTAL I E II</div>
          <div className="text-xs font-bold text-green-800">DIVISÃO DE ENSINO ANOS FINAIS</div>
        </div>
      </div>

      {/* Número da sequência */}
      <div className="px-4 py-2 text-center border-b border-gray-200">
        <span className="text-base font-bold text-blue-900">{ordinal(numeroAtual)} SEQUÊNCIA DIDÁTICA — EDUCAÇÃO FÍSICA</span>
      </div>

      <div className="px-4 pb-1 pt-2"><p className="text-sm font-bold text-gray-900">ESCOLA: INSTITUTO ODILON PRATAGI</p></div>
      <div className="px-4 pb-2">
        <table className="w-full border-collapse text-xs">
          <tbody>
            <tr><td colSpan={4} className="border border-gray-400 bg-blue-800 text-white font-bold px-2 py-1">IDENTIFICAÇÃO</td></tr>
            <tr>
              <td className="border border-gray-400 px-2 py-1 font-semibold bg-gray-50 w-1/4">PROFESSOR(A):<br /><span className="font-normal">{professor}</span></td>
              <td className="border border-gray-400 px-2 py-1 font-semibold bg-gray-50 w-1/4">COMPONENTE:<br /><span className="font-normal">Educação Física</span></td>
              <td className="border border-gray-400 px-2 py-1 font-semibold bg-gray-50 w-1/4">ANO/SÉRIE:<br /><span className="font-normal">{serie}</span></td>
              <td className="border border-gray-400 px-2 py-1 font-semibold bg-gray-50 w-1/4">TURMAS:<br /><span className="font-normal">{turmas || "—"}</span></td>
            </tr>
            <tr>
              <td className="border border-gray-400 px-2 py-1 font-semibold bg-gray-50" colSpan={2}>COORDENADOR(A):<br /><span className="font-normal">{coordenador}</span></td>
              <td className="border border-gray-400 px-2 py-1 font-semibold bg-gray-50">AULAS PREVISTAS:<br /><span className="font-normal">{aulasPrevistas}</span></td>
              <td className="border border-gray-400 px-2 py-1 font-semibold bg-gray-50">PERÍODO DE EXECUÇÃO:<br /><span className="font-normal">{periodo || "—"}</span></td>
            </tr>
            <tr><td colSpan={4} className="border border-gray-400 px-2 py-1 bg-gray-50 font-semibold">TEMA: <span className="font-normal">{tema}</span></td></tr>
          </tbody>
        </table>
      </div>
      <div className="px-4 pb-2">
        <table className="w-full border-collapse text-xs">
          <tbody>
            <tr><td className="border border-gray-400 bg-blue-100 font-bold px-2 py-1 text-center text-sm">OBJETIVOS/CAPACIDADES</td></tr>
            <tr><td className="border border-gray-400 px-3 py-2 text-gray-800 leading-relaxed">{sequencia.objetivos}</td></tr>
          </tbody>
        </table>
      </div>
      <div className="px-4 pb-2">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr><td colSpan={2} className="border border-gray-400 bg-blue-100 font-bold px-2 py-1 text-center text-sm">CONTEÚDOS</td></tr>
            <tr>
              <td className="border border-gray-400 bg-gray-100 font-bold px-2 py-1 text-center w-1/2">HABILIDADES</td>
              <td className="border border-gray-400 bg-gray-100 font-bold px-2 py-1 text-center w-1/2">OBJETOS DE CONHECIMENTO</td>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-400 px-2 py-2 align-top">{sequencia.habilidades.map((h, i) => <p key={i} className="mb-1 leading-relaxed"><strong>{h.codigo}:</strong> {h.descricao}</p>)}</td>
              <td className="border border-gray-400 px-2 py-2 align-top"><ul className="list-disc list-inside space-y-1">{sequencia.objetos_conhecimento.map((o, i) => <li key={i} className="leading-relaxed">{o}</li>)}</ul></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="px-4 pb-2">
        <table className="w-full border-collapse text-xs">
          <thead><tr><td colSpan={2} className="border border-gray-400 bg-blue-100 font-bold px-2 py-1 text-center text-sm">DESENVOLVIMENTO DAS ATIVIDADES</td></tr></thead>
          <tbody>
            <tr><td colSpan={2} className="border border-gray-400 px-2 py-2 bg-amber-50">
              <p className="font-bold text-amber-900 mb-1">Atividade de Acolhida e Aquecimento</p>
              <p className="text-gray-800 leading-relaxed whitespace-pre-line">{sequencia.aquecimento}</p>
            </td></tr>
            {sequencia.situacoes.map((sit) => (
              <tr key={sit.numero}><td colSpan={2} className="border border-gray-400 p-0">
                <div className="bg-blue-700 text-white font-bold px-2 py-1 text-xs">Situação de Aprendizagem {sit.numero} — {sit.titulo}</div>
                <div className="flex">
                  <div className="flex-1 px-3 py-2">
                    <p className="font-semibold text-gray-700 mb-1 text-xs">Objetivo Específico: <span className="font-normal">{sit.objetivo}</span></p>
                    <div className="text-gray-800 leading-relaxed whitespace-pre-line text-xs">{sit.desenvolvimento}</div>
                    {sit.adaptacao && <div className="mt-2 bg-purple-50 border-l-2 border-purple-400 px-2 py-1"><p className="font-semibold text-purple-800 text-xs">Atividades Adaptadas:</p><p className="text-gray-700 text-xs">{sit.adaptacao}</p></div>}
                  </div>
                  {sit.imageUrl ? (
                    <div className="relative shrink-0" style={{ width: 180 }}>
                      <img src={sit.imageUrl} alt={sit.imageQuery} className="w-full h-full object-cover" style={{ minHeight: 140 }} />
                      {sit.imageAuthor && <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white px-1 py-0.5 text-center" style={{ fontSize: 9 }}>📷 {sit.imageAuthor} / Pexels</div>}
                    </div>
                  ) : (
                    <div className="shrink-0 bg-gray-100 flex items-center justify-center text-gray-400 text-xs" style={{ width: 180, minHeight: 140 }}>Sem imagem</div>
                  )}
                </div>
              </td></tr>
            ))}
          </tbody>
        </table>
      </div>
      {sequencia.estacoes && sequencia.estacoes.length > 0 && (
        <div className="px-4 pb-2">
          <table className="w-full border-collapse text-xs">
            <thead><tr><td className="border border-gray-400 bg-orange-100 font-bold px-2 py-1 text-center text-sm">ORGANIZAÇÃO POR ESTAÇÕES (CIRCUITO POR FUNDAMENTO)</td></tr></thead>
            <tbody>
              {sequencia.estacoes.map((es) => (
                <tr key={es.numero}><td className="border border-gray-400 p-0">
                  <div className="bg-orange-600 text-white font-bold px-2 py-1 text-xs">Estação {es.numero} — {es.fundamento}</div>
                  <div className="flex">
                    <div className="flex-1 px-3 py-2">
                      <p className="font-semibold text-gray-700 mb-1 text-xs">Objetivo: <span className="font-normal">{es.objetivo}</span></p>
                      <div className="text-gray-800 leading-relaxed whitespace-pre-line text-xs">{es.passoAPasso}</div>
                    </div>
                    {es.imageUrl ? (
                      <div className="relative shrink-0" style={{ width: 180 }}>
                        <img src={es.imageUrl} alt={es.imageQuery} className="w-full h-full object-cover" style={{ minHeight: 140 }} />
                        {es.imageAuthor && <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white px-1 py-0.5 text-center" style={{ fontSize: 9 }}>📷 {es.imageAuthor} / Pexels</div>}
                      </div>
                    ) : (
                      <div className="shrink-0 bg-gray-100 flex items-center justify-center text-gray-400 text-xs" style={{ width: 180, minHeight: 140 }}>Sem imagem</div>
                    )}
                  </div>
                </td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="px-4 pb-2">
        <table className="w-full border-collapse text-xs">
          <thead><tr>
            <td className="border border-gray-400 bg-blue-100 font-bold px-2 py-1 text-center w-1/3">VALORES ATITUDINAIS</td>
            <td className="border border-gray-400 bg-blue-100 font-bold px-2 py-1 text-center w-1/3">INSTRUMENTOS DE AVALIAÇÃO</td>
            <td className="border border-gray-400 bg-blue-100 font-bold px-2 py-1 text-center w-1/3">RECURSOS</td>
          </tr></thead>
          <tbody><tr>
            <td className="border border-gray-400 px-2 py-2 align-top leading-relaxed">{sequencia.valores_atitudinais}</td>
            <td className="border border-gray-400 px-2 py-2 align-top leading-relaxed">{sequencia.instrumentos_avaliacao}</td>
            <td className="border border-gray-400 px-2 py-2 align-top leading-relaxed">{sequencia.recursos}</td>
          </tr></tbody>
        </table>
      </div>
      <div className="px-4 pb-2">
        <table className="w-full border-collapse text-xs">
          <tbody>
            <tr><td className="border border-gray-400 bg-blue-100 font-bold px-2 py-1 text-center text-sm">REFERÊNCIAS</td></tr>
            <tr><td className="border border-gray-400 px-3 py-2"><ul className="list-disc list-inside space-y-1 text-gray-800">{sequencia.referencias.map((r, i) => <li key={i} className="leading-relaxed">{r}</li>)}</ul></td></tr>
          </tbody>
        </table>
      </div>
      <div className="px-4 pb-4">
        <table className="w-full border-collapse text-xs">
          <tbody>
            <tr><td colSpan={2} className="border border-gray-400 bg-blue-800 text-white font-bold px-2 py-1 text-center">DEVOLUTIVA DO COORDENADOR PEDAGÓGICO</td></tr>
            <tr>
              <td className="border border-gray-400 px-4 py-8 text-center w-1/2"><div className="border-t border-gray-500 mt-6 pt-1">Assinatura do (a) Coordenador (a)</div></td>
              <td className="border border-gray-400 px-4 py-8 text-center w-1/2"><div className="border-t border-gray-500 mt-6 pt-1">Assinatura do (a) Professor (a)</div></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
