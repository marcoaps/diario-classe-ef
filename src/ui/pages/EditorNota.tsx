import React, { useState } from 'react';
import { interpretarNota } from '../../domain/notaDigitada';

// Edição manual de UMA nota, aberta logo abaixo do aluno na tela Notas.
// `onSalvar` lança erro se nada for gravado; a mensagem aparece aqui.
export function EditorNota({ aluno, notaAtual, onSalvar, onCancelar }: {
  aluno: string;
  notaAtual: number | null;
  onSalvar: (nota: number | null) => Promise<void>;
  onCancelar: () => void;
}) {
  const [texto, setTexto] = useState(notaAtual == null ? '' : notaAtual.toFixed(1).replace('.', ','));
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const lida = interpretarNota(texto);
    if (lida.valida === false) { setErro('Digite uma nota de 0 a 10, como 7 ou 8,5.'); return; }
    setSalvando(true); setErro(null);
    try { await onSalvar(lida.nota); }
    catch (err: any) { setErro('Não foi salva: ' + err.message); setSalvando(false); }
  };

  return (
    <form onSubmit={enviar} onKeyDown={e => { if (e.key === 'Escape' && !salvando) onCancelar(); }}
      className="px-3.5 pb-3 pt-1 pl-[38px] flex flex-col gap-2 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <input autoFocus onFocus={e => e.target.select()} value={texto} inputMode="decimal"
          onChange={e => setTexto(e.target.value)} disabled={salvando}
          aria-label={`Nova nota de ${aluno}`} aria-invalid={!!erro}
          className="w-20 h-11 rounded-xl border border-[#0B6B3A] text-center text-base font-extrabold tabular-nums text-on-surface caret-[#0B6B3A] focus:outline-none focus:ring-2 focus:ring-[#0B6B3A]/40" />
        <button type="submit" disabled={salvando}
          className="h-11 px-4 rounded-xl bg-[#0B6B3A] text-white text-[13px] font-extrabold disabled:opacity-50">
          {salvando ? 'Salvando...' : 'Salvar nota'}
        </button>
        <button type="button" onClick={onCancelar} disabled={salvando}
          className="h-11 px-3 rounded-xl text-[13px] font-bold text-on-surface-variant hover:bg-[#F1F6F3] disabled:opacity-50">
          Cancelar
        </button>
      </div>
      {erro
        ? <p role="alert" className="text-xs font-semibold text-[#B42318]">{erro}</p>
        : <p className="text-xs text-on-surface-variant">Deixe em branco para voltar à nota de frequência.</p>}
    </form>
  );
}
