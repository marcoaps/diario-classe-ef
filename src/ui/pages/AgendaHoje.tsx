import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store';
import { buscarAlunos } from '../../data/supabase';
import { v4 as uuidv4 } from 'uuid';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';

// ─── HORÁRIO SEMANAL ─────────────────────────────────────────────────────────
const HORARIO: Record<number, { periodo: string; turmas: string[] }[]> = {
  1: [ // Segunda-feira
    { periodo: 'Manhã',  turmas: ['6F','7D','7E','7F'] },
    { periodo: 'Tarde',  turmas: ['7B','7C'] },
  ],
  3: [ // Quarta-feira
    { periodo: 'Manhã',  turmas: ['8D','8E','8F'] },
    { periodo: 'Tarde',  turmas: ['8A','8B','8C'] },
  ],
  4: [ // Quinta-feira
    { periodo: 'Manhã',  turmas: ['9D','9E','9F'] },
    { periodo: 'Tarde',  turmas: ['9A','9B','9C'] },
  ],
};

const DIAS_PT = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];

const COR_SERIE: Record<string, string> = {
  '6': '#2563eb', '7': '#7c3aed', '8': '#059669', '9': '#d97706',
};

function getSerie(turma: string) { return turma.replace(/\D/g,'').charAt(0); }

export function AgendaHoje() {
  const navigate = useNavigate();
  const { classRooms, setStudents, setSelectedClassId } = useStore();
  const [carregando, setCarregando] = useState<string | null>(null);

  const hoje = new Date().getDay(); // 0=dom, 1=seg, 3=qua, 4=qui
  const diaNome = DIAS_PT[hoje];
  const periodos = HORARIO[hoje] ?? [];
  const temAulas = periodos.length > 0;

  const abrirChamada = async (nomeTurma: string) => {
    const cr = classRooms.find(c => {
      const n = c.name.replace(/[^0-9A-Za-z]/g,'').toUpperCase();
      return n === nomeTurma.toUpperCase();
    });
    if (!cr) { alert(`Turma ${nomeTurma} não encontrada no sistema.`); return; }
    setCarregando(nomeTurma);
    try {
      const alunos = await buscarAlunos(cr.name.replace('º',''));
      if (alunos.length > 0) {
        setStudents(prev => [
          ...prev.filter(s => s.classRoomId !== cr.id),
          ...alunos.map(a => ({
            id: a.id ? String(a.id) : uuidv4(),
            classRoomId: cr.id,
            name: a.nome || a.name || 'Sem nome',
            numero_chamada: a.numero_chamada,
          })),
        ]);
      }
      setSelectedClassId(cr.id);
      localStorage.setItem('selectedClassId', cr.id);
      navigate('/attendance');
    } catch (e) { console.error(e); alert('Erro ao carregar turma.'); }
    finally { setCarregando(null); }
  };

  return (
    <div className="flex flex-col gap-5 pt-4 pb-32 font-sans">

      {/* Header do dia */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-gray-900">Chamada de Hoje</h2>
          <p className="text-sm text-gray-500 mt-0.5">{diaNome}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-bold ${temAulas ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {temAulas ? `${periodos.reduce((s,p) => s + p.turmas.length, 0)} turmas` : 'Sem aulas'}
        </span>
      </div>

      {/* Sem aulas hoje */}
      {!temAulas && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 text-center">
          <div className="text-4xl mb-3">📅</div>
          <p className="text-gray-500 font-medium">Não há aulas programadas para hoje.</p>
          <p className="text-gray-400 text-sm mt-1">Suas aulas são às segundas, quartas e quintas.</p>
        </div>
      )}

      {/* Períodos do dia */}
      {periodos.map(({ periodo, turmas }) => (
        <div key={periodo} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Header período */}
          <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
            <span className="text-sm">{periodo === 'Manhã' ? '🌅' : '🌆'}</span>
            <span className="text-sm font-bold text-gray-700">{periodo}</span>
          </div>

          {/* Botões de turma */}
          <div className="p-3 grid grid-cols-2 gap-2">
            {turmas.map(turma => {
              const serie = getSerie(turma);
              const cor = COR_SERIE[serie] || '#64748b';
              const isLoading = carregando === turma;
              return (
                <button
                  key={turma}
                  onClick={() => abrirChamada(turma)}
                  disabled={carregando !== null}
                  className="flex items-center justify-between px-4 py-3.5 rounded-2xl font-bold text-white text-sm active:scale-95 transition-all disabled:opacity-60 shadow-sm"
                  style={{ background: cor }}
                >
                  <span className="text-lg font-black">{turma}</span>
                  {isLoading
                    ? <Loader2 className="w-4 h-4 animate-spin opacity-80" />
                    : <span className="text-white/70 text-xs">Chamada →</span>
                  }
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Dica */}
      {temAulas && (
        <p className="text-center text-xs text-gray-400">
          Toque em uma turma para abrir a chamada diretamente
        </p>
      )}
    </div>
  );
}
