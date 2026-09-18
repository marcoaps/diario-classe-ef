// Gera UMA imagem por chamada (a geração leva de 10 a 40s e a OpenAI limita as
// imagens por minuto, então o app pede uma de cada vez). Só responde a
// professor logado: cada imagem custa dinheiro e, sem isso, qualquer pessoa
// com a URL poderia gastar o saldo.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://rsifjxeqitgiecqwvien.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_Vw7h5WZ5BF-GzaAM0hOECg_TMjwdiby';

// Modelo e qualidade podem ser trocados no Vercel sem mexer no código
// (OPENAI_IMAGE_MODEL / OPENAI_IMAGE_QUALITY). "low" sai bem mais barato.
const MODELO = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2';
const QUALIDADE = process.env.OPENAI_IMAGE_QUALITY || 'medium';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Sessão expirada. Entre de novo no app.' });

  try {
    const sessao = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    });
    if (!sessao.ok) return res.status(401).json({ error: 'Sessão inválida. Entre de novo no app.' });
  } catch {
    return res.status(502).json({ error: 'Não consegui validar o login. Tente de novo.' });
  }

  const chave = process.env.OPENAI_API_KEY;
  if (!chave) {
    return res.status(500).json({ error: 'A chave OPENAI_API_KEY ainda não foi configurada no Vercel.', codigo: 'sem_chave' });
  }

  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
  if (!prompt || prompt.length > 2000) {
    return res.status(400).json({ error: 'Prompt vazio ou longo demais.' });
  }

  try {
    const resposta = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${chave}` },
      body: JSON.stringify({
        model: MODELO,
        prompt,
        n: 1,
        size: '1536x1024',
        quality: QUALIDADE,
        output_format: 'jpeg',
        output_compression: 80,
      }),
    });
    const dados: any = await resposta.json().catch(() => ({}));

    if (!resposta.ok) {
      console.error('OpenAI image error:', resposta.status, dados);
      return res.status(resposta.status).json({
        error: dados?.error?.message || 'Erro na API de imagem.',
        codigo: dados?.error?.code || null,
      });
    }

    const base64 = dados?.data?.[0]?.b64_json;
    if (!base64) return res.status(502).json({ error: 'A API não devolveu imagem.' });
    return res.status(200).json({ base64, contentType: 'image/jpeg' });
  } catch (e) {
    console.error('imagem proxy error:', e);
    return res.status(500).json({ error: String(e) });
  }
}
