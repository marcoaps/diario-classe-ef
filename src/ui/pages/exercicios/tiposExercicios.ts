export const COMPONENTE_CURRICULAR_EXERCICIOS = 'Educação Física';

export interface ParametrosGeracaoExercicio {
  turmaId: string;
  /** Tema/conteúdo livre digitado pelo professor (ex: "Handebol — fundamentos"). */
  conteudo: string;
  quantidadeQuestoes: number;
}

export interface CenaExercicioIA {
  numero: number;
  descricaoCena: string;
  elementosCenario: string[];
}

export interface RoteiroExercicioIA {
  titulo: string;
  cenas: CenaExercicioIA[];
}

export interface QuestaoExercicioIA {
  enunciado: string;
  /** Número da cena (1 a N) que a questão pergunta diretamente — a mesma imagem daquela cena ilustra a questão na prova impressa. null se for uma questão geral, não amarrada a uma cena específica. */
  cenaReferenciada: number | null;
}

export interface QuestoesExercicioIA {
  questoes: QuestaoExercicioIA[];
}

export interface ExercicioGeradoIA {
  titulo: string;
  cenas: CenaExercicioIA[];
  questoes: QuestaoExercicioIA[];
  promptImagem: string;
}
