// Peças de tela da regra de atraso da Prova Online: a tabela de prazos (aluno e
// professor) e o formulário em que o professor define prazo e faixas.
import React from 'react';
import { Plus, X } from 'lucide-react';
import {
  FaixaAtraso, RegraAtraso, tabelaDePrazos,
} from '../../domain/atrasoProva';

export function TabelaPrazos({ regra }: { regra: RegraAtraso }) {
  const linhas = tabelaDePrazos(regra);
  if (linhas.length === 0) return null;
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">Prazo de entrega e quanto a nota vale em cada dia</caption>
      <thead>
        <tr className="text-left text-gray-500 text-xs">
          <th scope="col" className="font-bold pb-1">Quando você envia</th>
          <th scope="col" className="font-bold pb-1 text-right">A nota vale</th>
        </tr>
      </thead>
      <tbody>
        {linhas.map(l => (
          <tr key={l.quando} className="border-t border-gray-100">
            <th scope="row" className="py-1.5 pr-3 text-left font-medium text-gray-700">{l.quando}</th>
            <td className={`py-1.5 text-right font-black tabular-nums ${l.percentual === null ? 'text-red-700' : l.percentual >= 100 ? 'text-[#0B7A3D]' : 'text-amber-700'}`}>
              {l.vale}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface FormularioProps {
  prazo: string; // valor do <input type="datetime-local">, horário do Acre
  faixas: FaixaAtraso[];
  onPrazo: (v: string) => void;
  onFaixas: (f: FaixaAtraso[]) => void;
}

/** Mensagem de erro das faixas, ou null se estão corretas. */
export function erroNasFaixas(faixas: FaixaAtraso[]): string | null {
  let diasAntes = 0, percentualAntes = 100;
  for (const f of [...faixas].sort((a, b) => a.dias - b.dias)) {
    if (!Number.isInteger(f.dias) || f.dias < 1) return 'Os dias de atraso devem ser números inteiros a partir de 1.';
    if (f.dias === diasAntes) return 'Há duas faixas com o mesmo número de dias.';
    if (!(f.percentual >= 0 && f.percentual <= 100)) return 'O percentual deve ficar entre 0 e 100.';
    if (f.percentual > percentualAntes) return 'Um atraso maior não pode valer mais que um atraso menor.';
    diasAntes = f.dias;
    percentualAntes = f.percentual;
  }
  return null;
}

export function FormularioRegraAtraso({ prazo, faixas, onPrazo, onFaixas }: FormularioProps) {
  const mudar = (i: number, campo: keyof FaixaAtraso, valor: number) =>
    onFaixas(faixas.map((f, j) => j === i ? { ...f, [campo]: valor } : f));
  const campo = 'bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20';

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs text-gray-500 font-semibold">Prazo para valer 100% (horário do Acre)</span>
        <input type="datetime-local" value={prazo} onChange={e => onPrazo(e.target.value)} className={`w-full ${campo}`} />
        <span className="text-xs text-gray-500">Deixe vazio para a prova não ter desconto por atraso.</span>
      </label>

      {prazo && (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-xs text-gray-500 font-semibold mb-1">Descontos depois do prazo</legend>
          {faixas.map((f, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
              <span>Até</span>
              <input type="number" min={1} step={1} value={Number.isNaN(f.dias) ? '' : f.dias}
                onChange={e => mudar(i, 'dias', e.target.value === '' ? NaN : Number(e.target.value))}
                aria-label={`Faixa ${i + 1}: dias de atraso`} className={`w-14 text-center ${campo}`} />
              <span className="whitespace-nowrap">{f.dias === 1 ? 'dia' : 'dias'}: vale</span>
              <input type="number" min={0} max={100} step={5} value={Number.isNaN(f.percentual) ? '' : f.percentual}
                onChange={e => mudar(i, 'percentual', e.target.value === '' ? NaN : Number(e.target.value))}
                aria-label={`Faixa ${i + 1}: percentual da nota`} className={`w-16 text-center ${campo}`} />
              <span>%</span>
              <button type="button" onClick={() => onFaixas(faixas.filter((_, j) => j !== i))}
                aria-label={`Remover faixa ${i + 1}`} className="ml-auto p-2 text-gray-400 hover:text-red-500">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button type="button"
            onClick={() => {
              const ultima = faixas[faixas.length - 1];
              onFaixas([...faixas, { dias: (ultima?.dias || 0) + 1, percentual: Math.max(0, (ultima?.percentual ?? 90) - 10) }]);
            }}
            className="self-start text-xs text-primary font-bold flex items-center gap-1 py-1">
            <Plus className="w-3 h-3" /> Adicionar faixa
          </button>
          <p className="text-xs text-gray-500">Depois da última faixa a prova não aceita mais envio.</p>
        </fieldset>
      )}
    </div>
  );
}
