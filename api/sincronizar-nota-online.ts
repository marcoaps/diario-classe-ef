import { createClient } from '@supabase/supabase-js';

// Chamado pelo navegador do aluno logo depois de enviar a prova online
// (ResponderProva.tsx), mas roda com a chave service_role -- nunca confia em
// nenhum valor de nota vindo do cliente, recalcula tudo aqui a partir do
// banco. Sem a service_role a tabela `notas` não aceita escrita anônima (de
// propósito, pra um aluno não conseguir forjar a própria nota mexendo no
// navegador).
//
// Regra (2026-09-29, ajustada em 2026-10-10): a nota da prova online vai pra
// Notas no bimestre da prova, mas NUNCA rebaixa: se a nota atual do aluno já é
// maior (ex.: 8,5 de outra avaliação), ela é mantida -- vale a maior nota.
// Se o aluno ainda não tem linha em Notas pra esse bimestre, cria uma
// (faltas 0, situação "Em Curso"). Entre as até 3 tentativas do aluno na
// mesma prova, vale a de maior nota (mesma regra de AvaliacaoResultados.tsx
// e usePendentesProva.ts).

// Normalização da nota antes de gravar em Notas (regra de 2026-09-30):
// arredonda pra cima (inteiro) e nunca passa de 9,5 -- então 9,5 fica 9,5,
// qualquer coisa acima de 9,5 vira 9,5, e o resto sobe pro inteiro seguinte
// (ex.: 7,2 -> 8; 9,1 -> 9,5 pelo teto). O round(2) antes do ceil evita que
// ruído de ponto flutuante (8,0000000001) suba um ponto à toa.
const NOTA_MAXIMA_ONLINE = 9.5;
// Piso (26/11/2026): quem fez a prova entra em Notas com no mínimo 7,0. A nota
// real da tentativa continua em `respostas.nota` (tela de Resultados).
const NOTA_MINIMA_ONLINE = 7;
// 4º Bimestre de 2026 (ajustada em 27/11): de 9,7 para cima vira 10,0 (comparado
// com uma casa decimal, como aparece na tela de Resultados); abaixo disso segue
// a regra normal (teto 9,5).
const CORTE_DEZ_4BIM = 9.7;
export function normalizarNotaOnline(nota: number, bimestre?: number | null): number {
  if (!(nota >= NOTA_MINIMA_ONLINE)) return NOTA_MINIMA_ONLINE;
  if (bimestre === 4 && Number(nota.toFixed(1)) >= CORTE_DEZ_4BIM) return 10;
  if (nota >= NOTA_MAXIMA_ONLINE) return NOTA_MAXIMA_ONLINE;
  return Math.min(Math.ceil(Math.round(nota * 100) / 100), NOTA_MAXIMA_ONLINE);
}

// Prazo e atraso (sql/prova_online_prazo_atraso.sql): tentativa com desconto
// vai pra Notas com a nota final calculada pelo banco, SEM o piso de 7,0 nem o
// arredondamento para inteiro. No prazo (ou com falta justificada) vale a regra
// acima. Entre as tentativas, vale a que der a maior nota no Diário.
export function notaDiarioDaTentativa(
  r: { nota: number | null; nota_final?: number | string | null; percentual_aplicado?: number | string | null },
  bimestre?: number | null,
): number {
  if (r.percentual_aplicado != null && Number(r.percentual_aplicado) < 100) return Number(r.nota_final ?? 0);
  return normalizarNotaOnline(r.nota ?? 0, bimestre);
}

// Mesma regra de src/domain/nomeNasNotas.ts: `notas` diferencia maiúsculas e
// acentos no nome, então compara sem eles pra não criar linha duplicada.
const chaveNome = (n: string) =>
  n.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim().replace(/\s+/g, ' ');

function bimestreDoTitulo(titulo: string): number | null {
  const m = titulo.match(/([1-4])\s*[º°o]?\s*bim/i);
  return m ? parseInt(m[1], 10) : null;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!serviceKey) {
    // Sem a chave configurada no Vercel ainda: não faz nada, mas não quebra
    // o fluxo do aluno (a resposta dele já foi salva antes desta chamada).
    return res.status(200).json({ ok: false, motivo: 'SUPABASE_SERVICE_KEY não configurada' });
  }

  const { prova_id, turma_id, aluno_numero } = req.body || {};
  if (!prova_id || !turma_id || aluno_numero == null) {
    return res.status(400).json({ error: 'Dados incompletos' });
  }

  const supabase = createClient(process.env.VITE_SUPABASE_URL!, serviceKey);

  try {
    const { data: prova, error: eProva } = await supabase
      .from('provas').select('titulo').eq('id', prova_id).single();
    if (eProva || !prova) throw new Error('Prova não encontrada: ' + (eProva?.message || ''));

    const bimestre = bimestreDoTitulo(prova.titulo);
    if (!bimestre) return res.status(200).json({ ok: false, motivo: 'Não foi possível identificar o bimestre pelo título da prova.' });

    const { data: aluno, error: eAluno } = await supabase
      .from('alunos').select('nome').eq('turma_id', turma_id).eq('numero_chamada', aluno_numero).maybeSingle();
    if (eAluno) throw eAluno;
    if (!aluno) return res.status(200).json({ ok: false, motivo: 'Aluno não encontrado em alunos (turma/número não batem).' });

    // Maior nota entre todas as tentativas dessa prova pra esse aluno.
    // select('*') para continuar funcionando antes da migração de atraso.
    const { data: tentativas, error: eTentativas } = await supabase
      .from('respostas').select('*').eq('prova_id', prova_id).eq('turma_id', turma_id).eq('aluno_numero', aluno_numero);
    if (eTentativas) throw eTentativas;
    // Sem nenhuma tentativa não há o que lançar (evita criar nota 7,0 à toa).
    if (!tentativas?.length) return res.status(200).json({ ok: false, motivo: 'Nenhuma resposta deste aluno nesta prova.' });
    const melhorNota = Math.max(...tentativas.map((r: any) => notaDiarioDaTentativa(r, bimestre)));

    const { data: linhas, error: eNotas } = await supabase
      .from('notas').select('nome, nota, situacao, data_situacao, faltas')
      .eq('turma', turma_id).eq('bimestre', bimestre);
    if (eNotas) throw eNotas;
    // Se o aluno já tiver mais de uma linha, usa a que tem a maior nota.
    const chave = chaveNome(aluno.nome);
    const atual = (linhas || [])
      .filter((l: any) => chaveNome(l.nome) === chave)
      .sort((a: any, b: any) => Number(b.nota ?? -1) - Number(a.nota ?? -1))[0];

    const notaGravada = atual?.nota != null && Number(atual.nota) > melhorNota ? Number(atual.nota) : melhorNota;

    const { error: eUpsert } = await supabase.from('notas').upsert({
      turma: turma_id,
      bimestre,
      numero: aluno_numero,
      nome: atual?.nome ?? aluno.nome.toUpperCase(),
      nota: notaGravada,
      situacao: atual?.situacao ?? 'Em Curso',
      data_situacao: atual?.data_situacao ?? '',
      faltas: atual?.faltas ?? 0,
    }, { onConflict: 'turma,bimestre,nome' });
    if (eUpsert) throw eUpsert;

    return res.status(200).json({ ok: true, nota: notaGravada, bimestre });
  } catch (e: any) {
    console.error('Erro ao sincronizar nota online:', e);
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
