import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
  );

  const { avaliacao_id, aluno_id, respostas, metodo_scan } = req.body;

  if (!avaliacao_id || !aluno_id || !respostas) {
    return res.status(400).json({ error: 'Dados incompletos' });
  }

  const { error } = await supabase
    .from('avaliacoes_respostas')
    .upsert({
      avaliacao_id,
      aluno_id,
      respostas,
      metodo_scan: metodo_scan || 'upload'
    }, { onConflict: 'avaliacao_id,aluno_id' });

  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ ok: true });
}
