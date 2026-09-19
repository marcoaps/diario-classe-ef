// Geração de imagem de questão (Nano Banana/Gemini ou FLUX/Cloudflare, conforme
// IMAGE_PROVIDER no Vercel), em dois passos:
//  1. O Claude lê a questão inteira (enunciado, alternativas, resposta correta)
//     e descreve a CENA que a imagem precisa mostrar — a ação exata, não só o
//     assunto. É isso que evita "foto genérica de jogador de handebol" quando
//     a questão pede, por exemplo, o drible.
//  2. O servidor (/api/imagem) gera a imagem a partir dessa descrição.
// A cena e o prompt saem em inglês: os modelos de imagem seguem melhor o inglês
// (o FLUX quase não entende português). As chaves ficam só no servidor; aqui só
// passa o login do professor.

import { supabase } from '../data/supabase';

export interface ContextoImagem {
  disciplina: string;
  serie: string;
  tema: string;
  /** Texto completo que o aluno lê (contexto + pergunta). */
  enunciado: string;
  alternativas?: { letra: string; texto: string }[];
  /** Letra (ou texto) da resposta correta, quando conhecida. */
  respostaCorreta?: string;
  /** Sugestão de cena feita por quem escreveu a questão (pode ser vaga). */
  dica?: string;
  /** Cuidado visual extra (ex: aluno com NEE precisa de poucos elementos). */
  cuidado?: string;
}

export interface ErroImagem extends Error { fatal?: boolean }

/** "Handebol:História,Fundamentos e Regras" -> "Handebol" (o resto puxa elementos que não são da cena). */
function assuntoPrincipal(tema: string): string {
  return tema.split(/[:;,\n]/)[0].trim() || tema;
}

export function montarPedidoDeCena(ctx: ContextoImagem): string {
  const alternativas = (ctx.alternativas ?? []).map(a => `${a.letra}) ${a.texto}`).join('\n');
  const correta = ctx.respostaCorreta
    ? (ctx.alternativas?.find(a => a.letra === ctx.respostaCorreta)
        ? `${ctx.respostaCorreta}) ${ctx.alternativas?.find(a => a.letra === ctx.respostaCorreta)?.texto}`
        : ctx.respostaCorreta)
    : 'not informed';
  return `You write the scene of ONE educational illustration that accompanies a school exam question (in Portuguese). The image is what the student will look at to answer.

QUESTION DATA
Subject: ${ctx.disciplina}. Grade: ${ctx.serie}. Topic: ${assuntoPrincipal(ctx.tema)}.
Question: ${ctx.enunciado}
${alternativas ? `Options:
${alternativas}
` : ''}Correct answer: ${correta}
${ctx.dica ? `Scene suggestion from the question's author (may be vague): ${ctx.dica}
` : ''}${ctx.cuidado ? `Visual care required: ${ctx.cuidado}
` : ''}
TASK: describe the scene the image must show, so that a student recognizes the concept or action that answers the question by looking ONLY at the image.
RULES:
- Show exactly the action or concept of the correct answer, and NEVER that of a wrong option.
- Name the sport or subject explicitly in English (e.g. "handball", "volleyball") in the first sentence.
- Turn the question into a visible body action: who does it (1 or 2 teenage students), what the body does (arms, hands, legs, feet), what happens to the ball or object, where (setting) and the point of view (side or front view, full-body characters).
- If the question asks to identify equipment, a space or a rule, show that item clearly and completely (e.g. the whole goal, the goal area seen from above).
- Clearly recognizable action, few elements, plain background. Represent equipment, court and rules of the sport correctly.
- Do not mention options, letters or the answer key; no text, numbers, scores or captions in the image.
Reply ONLY with the description, in English, in 2 to 4 sentences.`;
}

export function montarPromptDaImagem(_ctx: ContextoImagem, cena: string): string {
  return `Educational illustration for a school exam question.
Scene: ${cena}
Style: clean, colorful flat digital illustration, sharp outlines, main subject clearly in focus, full-body characters when there is body action, plain simple background, few elements. Horizontal composition.
No text, letters, numbers, logos, brands, written scoreboards or captions anywhere in the image. A single scene, no collage, no panels; it is not an exam sheet, only the illustration.`;
}

// Passo 1. Se o Claude falhar (rede, saldo), segue com a sugestão da própria
// questão em vez de travar a geração da imagem.
async function descreverCena(ctx: ContextoImagem): Promise<string> {
  const reserva = ctx.dica?.trim() || ctx.enunciado.slice(0, 300);
  try {
    const resp = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 400,
        messages: [{ role: 'user', content: montarPedidoDeCena(ctx) }],
      }),
    });
    const dados = await resp.json();
    const texto = (dados.content?.[0]?.text || '').trim();
    return resp.ok && texto ? texto : reserva;
  } catch {
    return reserva;
  }
}

// Reduz a imagem e a põe na proporção 3:2 (as exportações assumem essa
// proporção; sem isso ela ficaria esticada no Word). Imagem larga (Gemini) é
// recortada ao centro; quase quadrada ou em pé (FLUX) vai inteira sobre fundo
// branco, pra não cortar cabeça e pés. Devolve JPEG leve.
export function ajustarImagem(dataUrl: string, larguraMax = 800): Promise<string> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const alvo = 3 / 2;
      const largura = Math.min(larguraMax, Math.round(Math.max(img.width, img.height) * alvo));
      const canvas = document.createElement('canvas');
      canvas.width = largura;
      canvas.height = Math.round(largura / alvo);
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(dataUrl);
      if (img.width / img.height >= 1.35) {
        let sx = 0, sy = 0, sw = img.width, sh = img.height;
        if (sw / sh > alvo) { sw = Math.round(sh * alvo); sx = Math.round((img.width - sw) / 2); }
        else { sh = Math.round(sw / alvo); sy = Math.round((img.height - sh) / 2); }
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const escala = Math.min(canvas.width / img.width, canvas.height / img.height);
        const w = Math.round(img.width * escala), h = Math.round(img.height * escala);
        ctx.drawImage(img, Math.round((canvas.width - w) / 2), Math.round((canvas.height - h) / 2), w, h);
      }
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// Passo 2. Uma imagem por chamada. Repete se o Google limitar as chamadas por
// minuto (429); erros que se repetiriam em todas as questões (login, chave,
// faturamento) ficam marcados como "fatal" pra o lote parar em vez de insistir.
async function gerarNoServidor(prompt: string): Promise<string> {
  const { data: sessao } = await supabase.auth.getSession();
  const token = sessao.session?.access_token;
  if (!token) throw new Error('Sessão expirada. Entre de novo no app.');

  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const resp = await fetch('/api/imagem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ prompt }),
    });
    const dados = await resp.json().catch(() => ({} as any));
    if (resp.ok && dados.base64) {
      return ajustarImagem(`data:${dados.contentType || 'image/png'};base64,${dados.base64}`);
    }
    // "limit: 0" / plano gratuito / limite do dia: esperar não adianta (só faturamento resolve).
    const semCota = resp.status === 429 && /limit: 0|free tier|per day|billing|upgrade|daily|allocation|neurons/i.test(String(dados.error || ''));
    if (resp.status === 429 && !semCota && tentativa < 2) {
      await new Promise(r => setTimeout(r, 20000));
      continue;
    }
    const mensagem = resp.status === 504
      ? 'A geração demorou demais. Tente de novo.'
      : dados.error || `Erro ${resp.status}.`;
    const erro: ErroImagem = new Error(mensagem);
    erro.fatal = semCota || [401, 402, 403].includes(resp.status) || dados.codigo === 'sem_chave';
    throw erro;
  }
  throw new Error('Não foi possível gerar a imagem.');
}

/** Gera a imagem da questão a partir do contexto completo. Devolve um data URL JPEG 3:2. */
export async function gerarImagemDaQuestao(ctx: ContextoImagem): Promise<string> {
  const cena = await descreverCena(ctx);
  return gerarNoServidor(montarPromptDaImagem(ctx, cena));
}
