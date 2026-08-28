export const EDICAO_PADRAO = '2026';

// Turmas que disputam o Interclasses mas não têm alunos cadastrados neste
// app (o professor de Educação Física não dá aula nelas) — somadas às turmas
// reais do banco pra aparecerem no seletor. Sem cadastro local, o aluno
// dessas turmas só entra com nome digitado manualmente (sem autocomplete).
export const TURMAS_SEM_CADASTRO_LOCAL = ['6A', '6B', '6C', '6D', '6E', '7A'];

export function unirTurmas(turmasDoBanco: string[]): string[] {
  return Array.from(new Set([...turmasDoBanco, ...TURMAS_SEM_CADASTRO_LOCAL]))
    .sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
}

// Um time só é considerado "completo" (pronto pra entrar em confrontos) com
// pelo menos esse número de jogadores inscritos.
export const MINIMO_JOGADORES_TIME = 5;
// Acima disso a inscrição de novos jogadores nesse time é bloqueada.
export const MAXIMO_JOGADORES_TIME = 10;

export interface InscricaoInterclasses {
  id: string;
  edicao: string;
  aluno_id: string | null;
  nome_completo: string;
  turma_id: string;
  numero_chamada: number;
  numero_camisa: number;
  nome_time: string;
  // Reservado para expansões futuras (modalidade, categoria, gênero da
  // disputa, capitão, professor responsável) — ainda não usados pela UI.
  modalidade: string | null;
  categoria: string | null;
  genero: string | null;
  capitao: boolean;
  professor_responsavel: string | null;
  criado_em: string;
}

export interface EquipeInterclasses {
  nomeTime: string;
  turmas: string[];
  alunos: InscricaoInterclasses[];
  completo: boolean;
  cheio: boolean;
}

// Agrupa por nome do time ignorando maiúsculas/minúsculas e espaços extras —
// "Os Pernas de Pau" e "os pernas de  pau" caem na mesma equipe. Erros de
// digitação de verdade (ex: "O Pernas de Pau" faltando o "s") continuam
// virando equipes separadas, já que não há como saber se é o mesmo time
// sem confirmação de quem está cadastrando.
function normalizarNomeTime(nome: string): string {
  return nome.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function agruparPorTime(inscricoes: InscricaoInterclasses[]): EquipeInterclasses[] {
  const mapa = new Map<string, { nomeExibicao: string; alunos: InscricaoInterclasses[] }>();
  inscricoes.forEach(i => {
    const nomeExibicao = i.nome_time.trim();
    const chave = normalizarNomeTime(nomeExibicao);
    if (!mapa.has(chave)) mapa.set(chave, { nomeExibicao, alunos: [] });
    mapa.get(chave)!.alunos.push(i);
  });
  return Array.from(mapa.values())
    .map(({ nomeExibicao, alunos }) => ({
      nomeTime: nomeExibicao,
      turmas: Array.from(new Set(alunos.map(a => a.turma_id))).sort(),
      alunos: [...alunos].sort((a, b) => a.numero_camisa - b.numero_camisa),
      completo: alunos.length >= MINIMO_JOGADORES_TIME,
      cheio: alunos.length >= MAXIMO_JOGADORES_TIME,
    }))
    .sort((a, b) => a.nomeTime.localeCompare(b.nomeTime, 'pt-BR'));
}
