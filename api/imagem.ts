// Gera UMA imagem por chamada. O serviço é escolhido no Vercel pela variável
// IMAGE_PROVIDER: "gemini" (padrão, Nano Banana) ou "cloudflare" (FLUX schnell,
// com cota gratuita diária). A geração leva de 5 a 40s, então o app pede uma
// de cada vez. Só responde a professor logado: cada imagem pode custar dinheiro
// e, sem isso, qualquer pessoa com a URL poderia gastar o saldo. As chaves
// (GEMINI_API_KEY / CLOUDFLARE_API_TOKEN) ficam só aqui, no servidor.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://rsifjxeqitgiecqwvien.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_Vw7h5WZ5BF-GzaAM0hOECg_TMjwdiby';

// Trocáveis no Vercel sem mexer no código. Ex: GEMINI_IMAGE_MODEL=gemini-3.1-flash-image
// (versão mais barata da família) ou GEMINI_IMAGE_SIZE=2K.
const MODELO = process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image';
const TAMANHO = process.env.GEMINI_IMAGE_SIZE || '1K';

const URL_INTERACTIONS = 'https://generativelanguage.googleapis.com/v1beta/interactions';

// Cloudflare Workers AI: CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN.
// CLOUDFLARE_IMAGE_STEPS (1 a 8, padrão 4): mais passos = melhor qualidade, mais lento.
const MODELO_CLOUDFLARE = process.env.CLOUDFLARE_IMAGE_MODEL || '@cf/black-forest-labs/flux-1-schnell';
const PASSOS_CLOUDFLARE = Math.min(8, Math.max(1, Number(process.env.CLOUDFLARE_IMAGE_STEPS) || 4));

type Resultado =
  | { ok: true; imagem: { base64: string; contentType: string } }
  | { ok: false; status: number; error: string; codigo: string | null };

// A resposta da API muda de formato entre versões (output_image, outputs[],
// candidates[].content.parts[].inlineData...). Em vez de depender de um
// caminho fixo, procura o primeiro objeto que tenha uma imagem em base64.
function acharImagem(no: any, profundidade = 0): { base64: string; contentType: string } | null {
  if (!no || typeof no !== 'object' || profundidade > 8) return null;
  const dados = no.data ?? no.inlineData?.data ?? no.inline_data?.data;
  const mime = no.mime_type ?? no.mimeType ?? no.inlineData?.mimeType ?? no.inline_data?.mime_type;
  if (typeof dados === 'string' && dados.length > 1000 && typeof mime === 'string' && mime.startsWith('image/')) {
    return { base64: dados, contentType: mime };
  }
  for (const valor of Object.values(no)) {
    const achada = acharImagem(valor, profundidade + 1);
    if (achada) return achada;
  }
  return null;
}

async function chamarGemini(chave: string, prompt: string, comFormato: boolean) {
  const corpo: any = { model: MODELO, input: [{ type: 'text', text: prompt }] };
  if (comFormato) {
    corpo.response_format = { type: 'image', aspect_ratio: '3:2', image_size: TAMANHO };
  }
  const resposta = await fetch(URL_INTERACTIONS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave },
    body: JSON.stringify(corpo),
  });
  const dados: any = await resposta.json().catch(() => ({}));
  return { resposta, dados };
}

// FLUX schnell responde { result: { image: "<base64 JPEG>" }, success, errors }.
async function gerarCloudflare(conta: string, token: string, prompt: string): Promise<Resultado> {
  const resposta = await fetch(`https://api.cloudflare.com/client/v4/accounts/${conta}/ai/run/${MODELO_CLOUDFLARE}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    // O FLUX aceita no máximo 2048 caracteres de prompt.
    body: JSON.stringify({ prompt: prompt.slice(0, 2048), steps: PASSOS_CLOUDFLARE }),
  });
  const dados: any = await resposta.json().catch(() => ({}));
  const base64 = dados?.result?.image ?? dados?.image;
  if (resposta.ok && typeof base64 === 'string' && base64.length > 1000) {
    return { ok: true, imagem: { base64, contentType: 'image/jpeg' } };
  }
  const mensagem = String(dados?.errors?.[0]?.message || '');
  console.error('Cloudflare image error:', resposta.status, JSON.stringify(dados).slice(0, 800));
  if (resposta.ok) {
    return { ok: false, status: 422, error: 'A Cloudflare não devolveu imagem. Tente gerar de novo.', codigo: 'sem_imagem' };
  }
  if (/nsfw|flagged|safety/i.test(mensagem)) {
    return { ok: false, status: 422, error: 'A Cloudflare bloqueou esta imagem pelo filtro de conteúdo. Tente gerar de novo.', codigo: 'sem_imagem' };
  }
  return { ok: false, status: resposta.status, error: mensagem || 'Erro na API de imagem da Cloudflare.', codigo: dados?.errors?.[0]?.code ? String(dados.errors[0].code) : null };
}

async function gerarGemini(chave: string, prompt: string): Promise<Resultado> {
  let { resposta, dados } = await chamarGemini(chave, prompt, true);

  // Se a API recusar os campos de formato (nome/valor diferente do esperado),
  // tenta de novo sem eles — melhor uma imagem em tamanho padrão que nenhuma.
  if (resposta.status === 400) {
    console.error('Gemini 400 com response_format, repetindo sem ele:', JSON.stringify(dados).slice(0, 500));
    ({ resposta, dados } = await chamarGemini(chave, prompt, false));
  }

  if (!resposta.ok) {
    console.error('Gemini image error:', resposta.status, JSON.stringify(dados).slice(0, 800));
    return { ok: false, status: resposta.status, error: dados?.error?.message || 'Erro na API de imagem do Gemini.', codigo: dados?.error?.status || null };
  }

  const imagem = acharImagem(dados);
  if (!imagem) {
    console.error('Gemini sem imagem na resposta:', JSON.stringify(dados).slice(0, 800));
    return {
      ok: false,
      status: 422,
      error: 'O Gemini não devolveu imagem (pode ter sido bloqueada pelo filtro de segurança). Tente gerar de novo.',
      codigo: 'sem_imagem',
    };
  }
  return { ok: true, imagem };
}

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

  const cloudflare = String(process.env.IMAGE_PROVIDER || '').toLowerCase() === 'cloudflare';
  const chave = process.env.GEMINI_API_KEY;
  const conta = process.env.CLOUDFLARE_ACCOUNT_ID;
  const tokenCloudflare = process.env.CLOUDFLARE_API_TOKEN;
  if (cloudflare ? !(conta && tokenCloudflare) : !chave) {
    return res.status(500).json({
      error: cloudflare
        ? 'CLOUDFLARE_ACCOUNT_ID e CLOUDFLARE_API_TOKEN ainda não foram configurados no Vercel.'
        : 'A chave GEMINI_API_KEY ainda não foi configurada no Vercel.',
      codigo: 'sem_chave',
    });
  }

  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
  if (!prompt || prompt.length > 4000) {
    return res.status(400).json({ error: 'Prompt vazio ou longo demais.' });
  }

  try {
    const r = cloudflare
      ? await gerarCloudflare(conta as string, tokenCloudflare as string, prompt)
      : await gerarGemini(chave as string, prompt);

    if (!('imagem' in r)) return res.status(r.status).json({ error: r.error, codigo: r.codigo });

    // Limite de ~4,5MB de resposta das funções do Vercel.
    if (r.imagem.base64.length > 4_200_000) {
      return res.status(502).json({ error: 'A imagem veio grande demais. Tente de novo ou use GEMINI_IMAGE_SIZE=1K.', codigo: 'grande_demais' });
    }
    return res.status(200).json(r.imagem);
  } catch (e) {
    console.error('imagem proxy error:', e);
    return res.status(500).json({ error: String(e) });
  }
}
