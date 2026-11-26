import { formatarNome } from '../utils/formatarNome';

const CONECTORES = new Set(['de', 'da', 'das', 'do', 'dos', 'e']);
// Primeiros nomes que quase sempre vêm compostos ("Maria Eduarda", "João Carlos").
const COMPOSTOS = new Set(['ana', 'maria', 'joão', 'joao', 'josé', 'jose', 'pedro', 'luiz', 'luis', 'luís']);
const SUFIXOS = new Set(['júnior', 'junior', 'neto', 'filho', 'sobrinho']);

function encurtar(nome: string): string {
  const p = nome.split(' ');
  if (p.length <= 2) return nome;
  const inicio = COMPOSTOS.has(p[0].toLowerCase()) && !CONECTORES.has(p[1].toLowerCase()) ? 2 : 1;
  const fim = SUFIXOS.has(p[p.length - 1].toLowerCase()) ? 2 : 1;
  if (inicio + fim >= p.length) return nome;
  return [...p.slice(0, inicio), ...p.slice(-fim)].join(' ');
}

// Nome curto para listas que vão para grupo de WhatsApp. Se dois alunos da
// turma ficarem iguais depois de encurtar, os dois saem com o nome completo.
export function nomesCurtos(nomes: string[]): string[] {
  const completos = nomes.map(n => formatarNome(n.trim().replace(/\s+/g, ' ')));
  const curtos = completos.map(encurtar);
  const vezes = new Map<string, number>();
  for (const c of curtos) vezes.set(c, (vezes.get(c) ?? 0) + 1);
  return curtos.map((c, i) => (vezes.get(c)! > 1 ? completos[i] : c));
}
