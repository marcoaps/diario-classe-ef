// Geração de imagem de questão com o Nano Banana Pro (Gemini), em dois passos:
//  1. O Claude lê a questão inteira (enunciado, alternativas, resposta correta)
//     e descreve a CENA que a imagem precisa mostrar — a ação exata, não só o
//     assunto. É isso que evita "foto genérica de jogador de handebol" quando
//     a questão pede, por exemplo, o drible.
//  2. O servidor (/api/imagem) gera a imagem a partir dessa descrição.
// A chave do Gemini fica só no servidor; aqui só passa o login do professor.

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
    : 'não informada';
  return `Você cria a cena de UMA ilustração didática que acompanha uma questão de prova escolar. A imagem é o que o aluno vai observar para responder.

DADOS DA QUESTÃO
Disciplina: ${ctx.disciplina}. Ano: ${ctx.serie}. Tema: ${assuntoPrincipal(ctx.tema)}.
Enunciado: ${ctx.enunciado}
${alternativas ? `Alternativas:\n${alternativas}\n` : ''}Resposta correta: ${correta}
${ctx.dica ? `Sugestão de cena de quem escreveu a questão (pode estar vaga): ${ctx.dica}\n` : ''}
TAREFA: descreva a cena que a imagem precisa mostrar, de modo que um aluno reconheça o conceito ou a ação que responde à questão olhando SÓ para a imagem.
REGRAS:
- Mostre exatamente a ação ou o conceito da resposta correta, e NUNCA o de uma alternativa errada.
- Traduza o enunciado numa ação corporal visível: quem faz (1 ou 2 jovens estudantes), o que o corpo faz (braços, mãos, pernas, pés), o que acontece com a bola ou o objeto, onde (cenário) e o ponto de vista (de lado ou de frente, personagem de corpo inteiro).
- Se a questão pedir para identificar um equipamento, um espaço ou uma regra, mostre esse item de forma clara e completa (ex.: a trave inteira, a área do goleiro vista de cima).
- Ação claramente reconhecível, poucos elementos, fundo simples. Represente corretamente os equipamentos, a quadra e as regras do esporte.
- Não mencione alternativas, letras nem gabarito; não inclua textos, números, placares ou legendas na imagem.
Responda APENAS com a descrição, em português, em 2 a 4 frases.`;
}

export function montarPromptDaImagem(ctx: ContextoImagem, cena: string): string {
  return `Ilustração didática para uma prova escolar de ${ctx.disciplina} (${ctx.serie}, tema: ${assuntoPrincipal(ctx.tema)}).
Cena: ${cena}
Estilo: ilustração digital limpa e colorida, traços nítidos, composição clara com o assunto principal em destaque, personagens de corpo inteiro quando houver ação corporal, fundo limpo e simples, poucos elementos. Formato horizontal, proporção 3:2.${ctx.cuidado ? `\nCuidados visuais: ${ctx.cuidado}.` : ''}
Não inclua nenhum texto, letra, número, logotipo, marca, placar escrito ou legenda na imagem. Uma única cena, sem colagem e sem painéis; não é uma prova nem uma folha de exercícios, apenas a ilustração.`;
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

// Reduz a imagem (a do Gemini vem grande), recorta ao centro na proporção 3:2
// (as exportações assumem essa proporção; sem o recorte a imagem ficaria
// esticada no Word) e devolve JPEG leve.
export function ajustarImagem(dataUrl: string, larguraMax = 800): Promise<string> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const alvo = 3 / 2;
      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      if (sw / sh > alvo) { sw = Math.round(sh * alvo); sx = Math.round((img.width - sw) / 2); }
      else { sh = Math.round(sw / alvo); sy = Math.round((img.height - sh) / 2); }
      const largura = Math.min(larguraMax, sw);
      const canvas = document.createElement('canvas');
      canvas.width = largura;
      canvas.height = Math.round(largura / alvo);
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(dataUrl);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
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
    if (resp.status === 429 && tentativa < 2) {
      await new Promise(r => setTimeout(r, 20000));
      continue;
    }
    const mensagem = resp.status === 504
      ? 'A geração demorou demais. Tente de novo.'
      : dados.error || `Erro ${resp.status}.`;
    const erro: ErroImagem = new Error(mensagem);
    erro.fatal = [401, 402, 403].includes(resp.status) || dados.codigo === 'sem_chave';
    throw erro;
  }
  throw new Error('Não foi possível gerar a imagem.');
}

/** Gera a imagem da questão a partir do contexto completo. Devolve um data URL JPEG 3:2. */
export async function gerarImagemDaQuestao(ctx: ContextoImagem): Promise<string> {
  const cena = await descreverCena(ctx);
  return gerarNoServidor(montarPromptDaImagem(ctx, cena));
}
