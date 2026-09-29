import { createClient } from '@supabase/supabase-js';

// Chamado pelo navegador do aluno logo depois de enviar a prova online
// (ResponderProva.tsx), mas roda com a chave service_role -- nunca confia em
// nenhum valor de nota vindo do cliente, recalcula tudo aqui a partir do
// banco. Sem a service_role a tabela `notas` não aceita escrita anônima (de
// propósito, pra um aluno não conseguir forjar a própria nota mexendo no
// navegador).
//
// Regra (confirmada com o professor em 2026-09-29): a nota da prova online
// sempre SUBSTITUI a nota atual do aluno em Notas pro bimestre da prova --
// é a avaliação alternativa dele, não é somada/combinada com outra coisa.
// Se o aluno ainda não tem linha em Notas pra esse bimestre, cria uma
// (faltas 0, situação "Em Curso"). Entre as até 3 tentativas do aluno na
// mesma prova, vale a de maior nota (mesma regra de AvaliacaoResultados.tsx
// e usePendentesProva.ts).

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
    const { data: tentativas, error: eTentativas } = await supabase
      .from('respostas').select('nota').eq('prova_id', prova_id).eq('turma_id', turma_id).eq('aluno_numero', aluno_numero);
    if (eTentativas) throw eTentativas;
    const melhorNota = (tentativas || []).reduce((max: number, r: any) => Math.max(max, r.nota ?? 0), 0);

    const nomeChave = aluno.nome.toUpperCase();
    const { data: atual } = await supabase
      .from('notas').select('situacao, data_situacao, faltas')
      .eq('turma', turma_id).eq('bimestre', bimestre).eq('nome', nomeChave).maybeSingle();

    const { error: eUpsert } = await supabase.from('notas').upsert({
      turma: turma_id,
      bimestre,
      numero: aluno_numero,
      nome: nomeChave,
      nota: melhorNota,
      situacao: atual?.situacao ?? 'Em Curso',
      data_situacao: atual?.data_situacao ?? '',
      faltas: atual?.faltas ?? 0,
    }, { onConflict: 'turma,bimestre,nome' });
    if (eUpsert) throw eUpsert;

    return res.status(200).json({ ok: true, nota: melhorNota, bimestre });
  } catch (e: any) {
    console.error('Erro ao sincronizar nota online:', e);
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
