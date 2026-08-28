import { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { agruparPorTime, MINIMO_JOGADORES_TIME } from '../../../domain/interclasses';
import type { InscricaoInterclasses } from '../../../domain/interclasses';

interface Props {
  inscricoes: InscricaoInterclasses[];
  turmas: string[];
  loading: boolean;
}

export function VisaoGeral({ inscricoes, loading }: Props) {
  const totalAlunos = inscricoes.length;
  const equipes = useMemo(() => agruparPorTime(inscricoes), [inscricoes]);
  const totalTimes = equipes.length;
  const timesCompletos = equipes.filter(e => e.completo).length;
  const turmasParticipando = new Set(inscricoes.map(i => i.turma_id)).size;

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-primary rounded-[2rem] p-5 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10" />
        <h2 className="text-xl font-bold relative z-10">🏆 Interclasses IOP</h2>
        <p className="text-white/70 text-sm relative z-10 mt-0.5">Visão geral das inscrições</p>
      </div>

      {loading ? (
        <div className="flex gap-2 items-center justify-center py-8 text-gray-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Alunos inscritos" value={totalAlunos} />
            <StatCard label="Turmas participando" value={turmasParticipando} />
            <StatCard label="Times formados" value={totalTimes} />
            <StatCard label={`Times completos (${MINIMO_JOGADORES_TIME}+ jogadores)`} value={timesCompletos} />
          </div>
          {totalAlunos === 0 && (
            <div className="text-center text-gray-500 py-10 font-medium px-4">
              Nenhum aluno inscrito ainda. Use a aba "Inscrição de Alunos" para começar.
            </div>
          )}
          {totalAlunos > 0 && timesCompletos < 2 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-amber-700 text-xs font-medium">
              ⏳ É preciso de pelo menos 2 times completos ({MINIMO_JOGADORES_TIME}+ jogadores cada) para montar os confrontos. Você tem {timesCompletos} agora.
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
      <div className="text-2xl font-bold text-primary">{value}</div>
      <div className="text-[11px] text-gray-500 mt-1">{label}</div>
    </div>
  );
}
