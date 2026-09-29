import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../data/supabase';
import { useRelatorioFrequencia, type Bimestre, type AlunoFrequencia } from './useRelatorioFrequencia';

// Regra de quem precisa fazer a prova (papel/online) num bimestre — usada
// tanto na tela do professor (AlunosProva.tsx, com ações de liberar/exportar)
// quanto na página pública dos líderes de turma (LideresProva.tsx, só
// leitura). Extraído pra um lugar só pra nunca as duas telas divergirem.

// Aluno com MAIS de 2 dias de aula (4 presenças, já que cada dia conta em
// dobro — ver useRelatorioFrequencia.ts) no bimestre já cumpriu a prática e
// não precisa fazer a prova; com 2 dias ou menos, faz a prova.
export const LIMITE_PRESENCAS = 4;

// Alunos AEE têm um corte próprio, maior: com mais de 4 dias de aula (8
// presenças) no bimestre já cumpriram o suficiente e ficam dispensados; com
// menos, fazem a prova — não depende de PI/PP/PA (na prática, muitos AEE
// nunca têm participação marcada mesmo comparecendo, então esse sinal não
// era confiável).
export const LIMITE_PRESENCAS_AEE = 8;

// As 18 turmas de Educação Física do professor (mesma lista usada em
// GradeReport.tsx) — usada onde não há uma lista de turmas vinda do banco
// autenticado (ex.: páginas públicas, sem login).
export const TURMAS_PADRAO = ['6F', '7B', '7C', '7D', '7E', '7F', '8A', '8B', '8C', '8D', '8E', '8F', '9A', '9B', '9C', '9D', '9E', '9F'];

// "8ºD" (nome no app) e "8D" (banco/prova online) viram a mesma chave: "8D".
export function chaveTurma(t: string | null | undefined) { return String(t ?? '').replace(/[^0-9A-Za-z]/g, '').toUpperCase(); }

export function normNome(s: string) { return s.toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

export type ProvaOnline = { id: string; titulo: string; turma_id?: string | null };
export type Envio = { prova_id: string; turma_id: string; aluno_numero: number | null; aluno_nome: string | null };

export interface ContextoPendentesProva {
  nomesExcluidos: Set<string>; // transferidos/remanejados — turma|nome
  aeeNomes: Set<string>;
  provasOnline: ProvaOnline[];
  envios: Envio[];
}

// Busca uma vez (independe de turma/bimestre) os dados compartilhados entre
// todas as turmas: quem é AEE, quem foi transferido/remanejado, e todas as
// provas online + respostas já enviadas.
export function useContextoPendentesProva(): ContextoPendentesProva {
  const [nomesExcluidos, setNomesExcluidos] = useState<Set<string>>(new Set());
  const [aeeNomes, setAeeNomes] = useState<Set<string>>(new Set());
  const [provasOnline, setProvasOnline] = useState<ProvaOnline[]>([]);
  const [envios, setEnvios] = useState<Envio[]>([]);

  useEffect(() => {
    (async () => {
      const { data: aee } = await supabase.from('alunos_especiais').select('nome');
      const { data: transf } = await supabase.from('notas').select('nome, turma').or('situacao.ilike.%transferi%,situacao.ilike.%remanej%');
      setAeeNomes(new Set<string>((aee || []).map((e: any) => normNome(e.nome))));
      setNomesExcluidos(new Set<string>((transf || []).map((e: any) => `${chaveTurma(e.turma)}|${normNome(e.nome)}`)));
    })();
    (async () => {
      const { data: provas } = await supabase.from('provas').select('id, titulo, turma_id');
      const { data: resp } = await supabase.from('respostas').select('prova_id, turma_id, aluno_numero, aluno_nome');
      setProvasOnline(provas || []);
      setEnvios(resp || []);
    })();
  }, []);

  return { nomesExcluidos, aeeNomes, provasOnline, envios };
}

// Pra uma turma+bimestre, calcula quem precisa fazer a prova (farao), quem
// está dispensado pela presença (naoFarao) e quem já fez a prova online
// (fizeramOnline, não entra em farao nem em naoFarao).
export function usePendentesProva(turmaId: string, bimestre: Bimestre, ctx: ContextoPendentesProva) {
  const { alunos: alunosBrutos, loading, erro } = useRelatorioFrequencia(turmaId, bimestre);
  const { nomesExcluidos, aeeNomes, provasOnline, envios } = ctx;

  // Transferido/remanejado: exclui de vez, só vale na turma em que a situação
  // foi registrada (quem mudou de turma continua fazendo a prova na atual).
  // AEE não é excluído aqui — tem corte de presença próprio, ver isAEE abaixo.
  const turmaChave = chaveTurma(turmaId);
  const alunos = alunosBrutos.filter(a => {
    const n = normNome(a.nome);
    return !nomesExcluidos.has(n) && !nomesExcluidos.has(`${turmaChave}|${n}`);
  });

  const isAEE = (a: AlunoFrequencia) => aeeNomes.has(normNome(a.nome));
  const precisaFazerProva = (a: AlunoFrequencia) => a.presentes < (isAEE(a) ? LIMITE_PRESENCAS_AEE : LIMITE_PRESENCAS + 1);

  // Quem já enviou a prova online do bimestre (ids dos alunos). O nome
  // digitado tem prioridade: se bater (mesmo parcialmente) com um aluno da
  // turma, o nº de chamada é ignorado. Sem nome reconhecível, vale o nº.
  const idsOnline = useMemo(() => {
    const re = new RegExp(String.raw`(^|\D)${bimestre}\s*[º°o]?\s*bim`, 'i');
    const provaIds = new Set(provasOnline.filter(p => re.test(p.titulo)).map(p => p.id));
    const turma = chaveTurma(turmaId);
    const tokens = (n: string) => normNome(n).split(/\s+/).filter(t => t.length > 1);
    const feitos = new Set<string>();
    for (const e of envios) {
      if (!provaIds.has(e.prova_id) || chaveTurma(e.turma_id) !== turma) continue;
      const digitado = tokens(e.aluno_nome || '');
      const porNome = digitado.length === 0 ? [] : alunosBrutos.filter(a => {
        const t = new Set(tokens(a.nome));
        return digitado.every(d => t.has(d));
      });
      const porNumero = alunosBrutos.filter(a => e.aluno_numero != null && a.numero_chamada != null && Number(a.numero_chamada) === e.aluno_numero);
      if (porNome.length === 1) feitos.add(porNome[0].id);
      else if (porNome.length > 1) {
        const desempate = porNome.find(a => porNumero.some(n => n.id === a.id));
        if (desempate) feitos.add(desempate.id);
      } else {
        // Sem nome reconhecível: usa o nº de chamada, mas só se o nome digitado
        // tiver alguma palavra em comum com o dono do número (evita excluir outro aluno).
        const sig = (t: string) => t.length > 2 && !['dos', 'das'].includes(t);
        porNumero.forEach(a => {
          const t = new Set(tokens(a.nome));
          if (digitado.length === 0 || digitado.some(d => sig(d) && t.has(d))) feitos.add(a.id);
        });
      }
    }
    return feitos;
  }, [provasOnline, envios, bimestre, turmaId, alunosBrutos]);

  const fizeramOnline = alunos.filter(a => precisaFazerProva(a) && idsOnline.has(a.id));
  const farao = alunos.filter(a => precisaFazerProva(a) && !fizeramOnline.includes(a));
  const dispensados = alunos.filter(a => !precisaFazerProva(a));

  return { loading, erro, alunos, isAEE, farao, dispensados, fizeramOnline };
}
