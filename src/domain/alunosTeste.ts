import { v4 as uuidv4 } from 'uuid';
import type { AlunoSupabase } from './useAlunosPresentesHoje';

const NOMES_TESTE = [
  'Ana Teste', 'Bruno Teste', 'Carla Teste', 'Diego Teste', 'Elisa Teste', 'Fábio Teste',
  'Gabriela Teste', 'Hugo Teste', 'Isabela Teste', 'João Teste', 'Karina Teste', 'Lucas Teste',
];

// Alunos fictícios usados só pela "Chamada de Teste" — nunca vêm do Supabase,
// então testar times/confrontos com eles não lê nem grava nenhum dado real
// (nem em `alunos`, nem em `frequencia`). Gerados uma vez por ativação do
// modo teste (ver useState(() => gerarAlunosTeste()) em RodizioFutsal).
export function gerarAlunosTeste(): AlunoSupabase[] {
  return NOMES_TESTE.map((nome, i) => ({
    id: uuidv4(),
    nome,
    turma_id: 'TESTE',
    numero_chamada: i + 1,
    sexo: i % 2 === 0 ? 'M' : 'F',
  }));
}
