import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../data/supabase';
import { filtrarTransferenciasEfetivas } from './situacaoAluno';
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
export type Envio = { prova_id: string; turma_id: string; aluno_numero: number | null; aluno_nome: string | null; nota: number | null };
// Prova IMPRESSA já corrigida e vinculada a um aluno (tela "Correções
// realizadas"). Correções ainda anônimas (aluno_id nulo) não entram aqui.
export type AvaliacaoImpressa = { id: string; titulo: string; bimestre: string | null; valor_total_objetivas: number | null; valor_total_discursivas: number | null };
export type CorrecaoImpressa = { avaliacao_id: string; aluno_id: string; nota_final: number | null };

export interface ContextoPendentesProva {
  nomesExcluidos: Set<string>; // transferidos/remanejados — turma|nome
  aeeNomes: Set<string>;
  provasOnline: ProvaOnline[];
  envios: Envio[];
  avaliacoesImpressas: AvaliacaoImpressa[];
  correcoesImpressas: CorrecaoImpressa[];
}

// Busca uma vez (independe de turma/bimestre) os dados compartilhados entre
// todas as turmas: quem é AEE, quem foi transferido/remanejado, e todas as
// provas online + respostas já enviadas.
export function useContextoPendentesProva(): ContextoPendentesProva {
  const [nomesExcluidos, setNomesExcluidos] = useState<Set<string>>(new Set());
  const [aeeNomes, setAeeNomes] = useState<Set<string>>(new Set());
  const [provasOnline, setProvasOnline] = useState<ProvaOnline[]>([]);
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [avaliacoesImpressas, setAvaliacoesImpressas] = useState<AvaliacaoImpressa[]>([]);
  const [correcoesImpressas, setCorrecoesImpressas] = useState<CorrecaoImpressa[]>([]);

  useEffect(() => {
    (async () => {
      const { data: aee } = await supabase.from('alunos_especiais').select('nome');
      const { data: transf } = await supabase.from('notas').select('nome, turma, situacao, data_situacao').or('situacao.ilike.%transferi%,situacao.ilike.%remanej%');
      setAeeNomes(new Set<string>((aee || []).map((e: any) => normNome(e.nome))));
      setNomesExcluidos(new Set<string>(filtrarTransferenciasEfetivas(transf || []).map((e: any) => `${chaveTurma(e.turma)}|${normNome(e.nome)}`)));
    })();
    (async () => {
      const { data: provas } = await supabase.from('provas').select('id, titulo, turma_id');
      const { data: resp } = await supabase.from('respostas').select('prova_id, turma_id, aluno_numero, aluno_nome, nota');
      setProvasOnline(provas || []);
      setEnvios(resp || []);
    })();
    // Provas impressas corrigidas e já vinculadas a um aluno. Na página
    // pública dos líderes (sem login) a RLS de avaliacoes_respostas não
    // libera leitura -- aí volta vazio e a página segue só com as online.
    (async () => {
      try {
        const { data: cor, error } = await supabase
          .from('avaliacoes_respostas')
          .select('avaliacao_id, aluno_id, nota_final')
          .not('aluno_id', 'is', null);
        if (error || !cor || cor.length === 0) return;
        const ids = Array.from(new Set(cor.map((c: any) => c.avaliacao_id)));
        const { data: avs } = await supabase
          .from('avaliacoes')
          .select('id, titulo, bimestre, valor_total_objetivas, valor_total_discursivas')
          .in('id', ids);
        setAvaliacoesImpressas((avs || []) as AvaliacaoImpressa[]);
        setCorrecoesImpressas(cor as CorrecaoImpressa[]);
      } catch { /* sem acesso: mantém só as provas online */ }
    })();
  }, []);

  return { nomesExcluidos, aeeNomes, provasOnline, envios, avaliacoesImpressas, correcoesImpressas };
}

// Pra uma turma+bimestre, calcula quem precisa fazer a prova (farao), quem
// está dispensado pela presença (naoFarao) e quem já fez a prova -- online
// ou impressa já corrigida e vinculada (fizeramOnline, nome mantido; não
// entra em farao nem em naoFarao).
export function usePendentesProva(turmaId: string, bimestre: Bimestre, ctx: ContextoPendentesProva) {
  const { alunos: alunosBrutos, loading, erro } = useRelatorioFrequencia(turmaId, bimestre);
  const { nomesExcluidos, aeeNomes, provasOnline, envios, avaliacoesImpressas, correcoesImpressas } = ctx;

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

  // Quem já enviou a prova online do bimestre, com a MAIOR nota entre as
  // tentativas (até 3, ver MAX_TENTATIVAS em ResponderProva.tsx) — mesma
  // regra usada em AvaliacaoResultados.tsx. O nome digitado tem prioridade:
  // se bater (mesmo parcialmente) com um aluno da turma, o nº de chamada é
  // ignorado. Sem nome reconhecível, vale o nº de chamada.
  const notasOnline = useMemo(() => {
    const re = new RegExp(String.raw`(^|\D)${bimestre}\s*[º°o]?\s*bim`, 'i');
    const provaIds = new Set(provasOnline.filter(p => re.test(p.titulo)).map(p => p.id));
    const turma = chaveTurma(turmaId);
    const tokens = (n: string) => normNome(n).split(/\s+/).filter(t => t.length > 1);
    const mapa = new Map<string, number | null>();
    const registrar = (id: string, nota: number | null) => {
      const atual = mapa.get(id);
      if (!mapa.has(id) || (nota ?? -1) > (atual ?? -1)) mapa.set(id, nota);
    };
    for (const e of envios) {
      if (!provaIds.has(e.prova_id) || chaveTurma(e.turma_id) !== turma) continue;
      const digitado = tokens(e.aluno_nome || '');
      const porNome = digitado.length === 0 ? [] : alunosBrutos.filter(a => {
        const t = new Set(tokens(a.nome));
        return digitado.every(d => t.has(d));
      });
      const porNumero = alunosBrutos.filter(a => e.aluno_numero != null && a.numero_chamada != null && Number(a.numero_chamada) === e.aluno_numero);
      if (porNome.length === 1) registrar(porNome[0].id, e.nota);
      else if (porNome.length > 1) {
        const desempate = porNome.find(a => porNumero.some(n => n.id === a.id));
        if (desempate) registrar(desempate.id, e.nota);
      } else {
        // Sem nome reconhecível: usa o nº de chamada, mas só se o nome digitado
        // tiver alguma palavra em comum com o dono do número (evita excluir outro aluno).
        const sig = (t: string) => t.length > 2 && !['dos', 'das'].includes(t);
        porNumero.forEach(a => {
          const t = new Set(tokens(a.nome));
          if (digitado.length === 0 || digitado.some(d => sig(d) && t.has(d))) registrar(a.id, e.nota);
        });
      }
    }
    // Provas impressas corrigidas e vinculadas a um aluno desta turma, de uma
    // avaliação deste bimestre (campo bimestre; sem ele, o título). A nota
    // vai pra escala 0-10, a mesma da prova online; vale a maior das duas.
    const avsDoBim = new Map(avaliacoesImpressas
      .filter(a => (a.bimestre ? String(a.bimestre).trim() === String(bimestre) : re.test(a.titulo || '')))
      .map(a => [a.id, a]));
    const idsDaTurma = new Set(alunosBrutos.map(a => a.id));
    for (const c of correcoesImpressas) {
      const av = avsDoBim.get(c.avaliacao_id);
      if (!av || !idsDaTurma.has(c.aluno_id)) continue;
      const total = (av.valor_total_objetivas || 0) + (av.valor_total_discursivas || 0);
      const nota = c.nota_final == null ? null : total > 0 ? Math.round((c.nota_final / total) * 100) / 10 : c.nota_final;
      registrar(c.aluno_id, nota);
    }
    return mapa;
  }, [provasOnline, envios, avaliacoesImpressas, correcoesImpressas, bimestre, turmaId, alunosBrutos]);

  const fizeramOnline = alunos
    .filter(a => precisaFazerProva(a) && notasOnline.has(a.id))
    .map(a => ({ ...a, nota: notasOnline.get(a.id) ?? null }));
  const farao = alunos.filter(a => precisaFazerProva(a) && !notasOnline.has(a.id));
  const dispensados = alunos.filter(a => !precisaFazerProva(a));

  return { loading, erro, alunos, isAEE, farao, dispensados, fizeramOnline, notasOnline };
}
