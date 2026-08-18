// Orquestração da geração de uma Sequência Didática via IA: monta o prompt,
// chama a Claude, faz o parsing do JSON e busca as imagens ilustrativas de
// cada Situação de Aprendizagem e Estação. Compartilhado entre o Gerador de
// Sequência genérico e a aba dedicada de Esportes de Invasão.

import { chamarClaudeProxy } from "../../../utils/claudeProxy";
import { buscarReferenciaVideo } from "../../../data/referenciaVideosHandebol";
import type { Estacao, Sequencia } from "./sequenciaDidaticaTypes";
import { buscarImagemPexels, baixarImagemBase64 } from "./sequenciaDidaticaImagens";

// Referência BNCC por grupo de série.
const BNCC_POR_SERIE: Record<string, string> = {
  "6º ano": "EF67EF01, EF67EF02, EF67EF03, EF67EF04, EF67EF05, EF67EF06, EF67EF07, EF67EF08, EF67EF09, EF67EF10, EF67EF11, EF67EF12, EF67EF13, EF67EF14",
  "7º ano": "EF67EF01, EF67EF02, EF67EF03, EF67EF04, EF67EF05, EF67EF06, EF67EF07, EF67EF08, EF67EF09, EF67EF10, EF67EF11, EF67EF12, EF67EF13, EF67EF14",
  "6º e 7º": "EF67EF01, EF67EF02, EF67EF03, EF67EF04, EF67EF05, EF67EF06, EF67EF07, EF67EF08, EF67EF09, EF67EF10, EF67EF11, EF67EF12, EF67EF13, EF67EF14",
  "8º ano": "EF89EF01, EF89EF02, EF89EF03, EF89EF04, EF89EF05, EF89EF06, EF89EF07, EF89EF08, EF89EF09, EF89EF10, EF89EF11, EF89EF12, EF89EF13, EF89EF14",
  "9º ano": "EF89EF01, EF89EF02, EF89EF03, EF89EF04, EF89EF05, EF89EF06, EF89EF07, EF89EF08, EF89EF09, EF89EF10, EF89EF11, EF89EF12, EF89EF13, EF89EF14",
  "8º e 9º": "EF89EF01, EF89EF02, EF89EF03, EF89EF04, EF89EF05, EF89EF06, EF89EF07, EF89EF08, EF89EF09, EF89EF10, EF89EF11, EF89EF12, EF89EF13, EF89EF14",
  "1º EM": "EM13LGG001, EM13LGG002, EM13LGG003, EM13LGG401, EM13LGG402, EM13LGG403, EM13LGG404",
  "2º EM": "EM13LGG001, EM13LGG002, EM13LGG003, EM13LGG401, EM13LGG402, EM13LGG403, EM13LGG404",
  "3º EM": "EM13LGG001, EM13LGG002, EM13LGG003, EM13LGG401, EM13LGG402, EM13LGG403, EM13LGG404",
  "1º e 2º EM": "EM13LGG001, EM13LGG002, EM13LGG003, EM13LGG401, EM13LGG402, EM13LGG403, EM13LGG404",
};

export interface GerarSequenciaParams {
  tema: string;
  serie: string;
  turmas: string;
  aulasPrevistas: string;
  recursos: string;
  numSituacoes: string;
  incluirEstacoes: boolean;
  fundamentos: string;
}

export async function gerarSequenciaComIA(params: GerarSequenciaParams): Promise<Sequencia> {
  const { tema, serie, turmas, aulasPrevistas, recursos, numSituacoes, incluirEstacoes, fundamentos } = params;
  const habilidadesBncc = BNCC_POR_SERIE[serie] || BNCC_POR_SERIE["6º e 7º"];
  const fundamentosList = fundamentos.split(",").map((f) => f.trim()).filter(Boolean);

  // Para fundamentos de handebol com vídeo próprio já analisado, ancora o
  // passo a passo da IA na técnica real do professor em vez de texto genérico.
  const referenciasVideoBrutas = incluirEstacoes && tema.toLowerCase().includes("handebol")
    ? fundamentosList
        .map((f) => buscarReferenciaVideo(f))
        .filter((r): r is NonNullable<typeof r> => r !== null)
    : [];
  const fontesVistas = new Set<string>();
  const referenciasVideo = referenciasVideoBrutas.filter((r) => {
    if (fontesVistas.has(r.descricaoTecnica)) return false;
    fontesVistas.add(r.descricaoTecnica);
    return true;
  });

  const prompt = `Você é um professor de Educação Física experiente do estado do Acre, Brasil. Crie uma sequência didática completa no padrão oficial da SEEDUC/AC para:

Tema: ${tema}
Série: ${serie}
Turmas: ${turmas || "a definir"}
Aulas previstas: ${aulasPrevistas}
Recursos: ${recursos || "materiais básicos"}
Número de situações de aprendizagem: ${numSituacoes}

IMPORTANTE — Use SOMENTE habilidades BNCC para ${serie}: ${habilidadesBncc}
Selecione as que se relacionam com o tema "${tema}". Use os códigos exatos.

TERMINOLOGIA: use sempre "Futsal". NUNCA use o termo "futebol de salão" (nome antigo, em desuso) em nenhum campo do texto.

Para imageQuery de cada situação, siga ESTAS REGRAS:
1. TODA query deve conter a modalidade/esporte do tema "${tema}" traduzida para inglês (ex: "martial arts", "combat sports", "volleyball", "handball"), MAIS a atividade específica daquela situação. Nunca gere uma query só com a atividade sem a modalidade — isso faz a busca de imagem trazer fotos de outro esporte ou de assunto nenhum a ver (ex: sem a modalidade, uma situação sobre um aluno narrando/arbitrando pode trazer foto de balé). Isso vale inclusive para atividades adaptadas ou mais abstratas.
2. FAIXA ETÁRIA obrigatória nas queries conforme a série:
   - 6º e 7º ano (11-13 anos): use "middle school kids", "young students age 12", "children"
   - 8º e 9º ano (13-15 anos): use "high school students", "teenagers age 14", "teen athletes"
   - Ensino Médio: use "high school athletes", "young adults sports"
   A série atual é: ${serie}
3. Descreva a ATIVIDADE ESPECÍFICA de cada situação, sempre junto com a modalidade (regra 1). Ex., para tema "Lutas":
   - 6º/7º aquecimento → "middle school kids martial arts warm up gym"
   - 6º/7º fundamentos → "young students martial arts grappling practice"
   - 8º/9º atividade adaptada (aluno narrador) → "teenagers cheering martial arts match sideline"
   - 8º/9º fundamentos → "teen athletes martial arts training"
4. NUNCA repita a mesma query em situações diferentes
${incluirEstacoes && fundamentosList.length > 0 ? `
ORGANIZAÇÃO POR ESTAÇÕES (ESPORTE DE INVASÃO): esta sequência também deve trazer um circuito de estações de treino, com UMA ESTAÇÃO PARA CADA FUNDAMENTO listado a seguir, na mesma ordem: ${fundamentosList.join(", ")}.
Para cada estação, gere no campo "estacoes":
- "numero": posição da estação (1, 2, 3...)
- "fundamento": o nome do fundamento (exatamente um dos listados acima)
- "objetivo": o que o aluno desenvolve nessa estação
- "passoAPasso": passo a passo prático da estação, numerado e separado por \\n (ex: "Passo 1: organize...\\nPasso 2: ...\\nPasso 3: critério de rotação para a próxima estação..."), incluindo organização do espaço/material e execução
- "imageQuery": segue EXATAMENTE as mesmas regras 1 e 2 acima (modalidade do tema + faixa etária da série ${serie} + a atividade específica da estação), em inglês
${referenciasVideo.length > 0 ? `
MATERIAL REAL DO PROFESSOR (prioridade máxima): para os fundamentos abaixo, o professor já tem vídeos próprios com a técnica que ensina. NÃO invente uma técnica genérica diferente — o "passoAPasso" dessas estações deve ser fiel a esta referência, apenas adaptando a redação para o formato de passo a passo com organização de turma/material:
${referenciasVideo.map((r) => `• (fonte: ${r.fonteVideo})\n  ${r.descricaoTecnica}`).join("\n")}
Para os demais fundamentos da lista que não têm material real listado acima, use conhecimento pedagógico padrão normalmente.
` : ""}` : ""}
Responda SOMENTE com JSON puro, sem markdown, sem texto antes ou depois.
{"objetivos":"...","habilidades":[{"codigo":"EF__EF__","descricao":"descrição completa"},{"codigo":"EF__EF__","descricao":"..."},{"codigo":"EF__EF__","descricao":"..."}],"objetos_conhecimento":["...","...","..."],"aquecimento":"descrição detalhada em 2 parágrafos separados por \\n","situacoes":[{"numero":1,"titulo":"...","objetivo":"...","desenvolvimento":"etapas detalhadas separadas por \\n","adaptacao":"...","imageQuery":"query única e específica desta situação em inglês"}]${incluirEstacoes && fundamentosList.length > 0 ? `,"estacoes":[{"numero":1,"fundamento":"...","objetivo":"...","passoAPasso":"Passo 1: ...\\nPasso 2: ...","imageQuery":"query única e específica desta estação em inglês"}]` : ""},"valores_atitudinais":"...","instrumentos_avaliacao":"...","recursos":"...","referencias":["ACRE. Ref 1.","Ref 2.","Ref 3."]}`;

  const texto = await chamarClaudeProxy(prompt);
  const start = texto.indexOf("{"); const end = texto.lastIndexOf("}");
  if (start === -1) throw new Error("Resposta inesperada da API");
  const seq: Sequencia = JSON.parse(texto.slice(start, end + 1));

  const situacoesComImg = await Promise.all(
    seq.situacoes.map(async (s, idx) => {
      const img = await buscarImagemPexels(s.imageQuery, idx);
      if (!img) return s;
      const b64 = await baixarImagemBase64(img.url);
      return { ...s, imageUrl: img.url, imageAuthor: img.author, imageBase64: b64?.base64 ?? "", imageType: b64?.contentType ?? "image/jpeg" };
    })
  );

  let estacoesComImg: Estacao[] = [];
  if (seq.estacoes && seq.estacoes.length > 0) {
    estacoesComImg = await Promise.all(
      seq.estacoes.map(async (es, idx) => {
        const img = await buscarImagemPexels(es.imageQuery, situacoesComImg.length + idx);
        if (!img) return es;
        const b64 = await baixarImagemBase64(img.url);
        return { ...es, imageUrl: img.url, imageAuthor: img.author, imageBase64: b64?.base64 ?? "", imageType: b64?.contentType ?? "image/jpeg" };
      })
    );
  }

  return { ...seq, situacoes: situacoesComImg, estacoes: estacoesComImg };
}
