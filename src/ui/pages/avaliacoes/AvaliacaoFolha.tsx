import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../../data/supabase';
import { ArrowLeft, Printer, FileText, Download, Sparkles } from 'lucide-react';
import QRCode from 'qrcode';

interface Avaliacao {
  id: string;
  titulo: string;
  descricao: string | null;
  turma_id: string;
  num_questoes: number;
  gabarito: Record<string, string>;
  valor_questao: number;
  questoes_subjetivas: Record<string, string> | null;
  texto_apoio: string | null;
}

interface Aluno {
  id: string;
  nome: string;
  numero_chamada: number;
  token_acesso: string;
}

const NUM_OBJETIVAS = 8;
const NUM_SUBJETIVAS = 2;
const LETRAS = ['A', 'B', 'C', 'D'];

// Questões para 6º e 7º anos — nível intermediário com contexto e exemplos práticos de EF
const QUESTOES_SIMPLES: Record<number, { texto: string; alts: string[] }> = {
  1: { texto: 'Durante uma partida de voleibol escolar, observou-se que um atleta tocou a bola duas vezes consecutivas antes de passá-la para um companheiro. Considerando as regras oficiais do voleibol, qual deve ser a decisão correta do árbitro nessa situação?', alts: ['Permitir a continuidade, pois no voleibol escolar as regras são mais flexíveis', 'Marcar falta e conceder ponto para a equipe adversária, pois o toque duplo é proibido', 'Advertir verbalmente o jogador e reiniciar a jogada sem punição', 'Conceder mais uma tentativa, considerando que é uma partida de aprendizado'] },
  2: { texto: 'O voleibol foi desenvolvido em 1895 por William George Morgan, com o objetivo de criar um esporte menos intenso que o basquete. Qual era o nome original dado por Morgan ao esporte e qual foi a principal motivação para sua criação?', alts: ['Mintonette, criado para oferecer atividade física a homens de negócios mais velhos', 'Volleyball, desenvolvido especificamente para treinar jogadores de basquete no inverno', 'Netball, inventado para competir diretamente com o futebol americano nas escolas', 'Handvolley, criado para substituir o tênis em ambientes fechados sem quadra adequada'] },
  3: { texto: 'Em competições oficiais de voleibol, as dimensões da quadra e a altura da rede variam conforme a categoria. Em relação às medidas oficiais para a categoria adulta, qual alternativa apresenta os valores corretos tanto para a quadra quanto para a rede?', alts: ['Quadra: 16m x 8m, Rede: 2,24m (feminino) e 2,43m (masculino)', 'Quadra: 18m x 9m, Rede: 2,24m (feminino) e 2,43m (masculino)', 'Quadra: 20m x 10m, Rede: 2,20m (feminino) e 2,40m (masculino)', 'Quadra: 18m x 9m, Rede: 2,20m (feminino) e 2,40m (masculino)'] },
  4: { texto: 'No voleibol, a sequência tática de jogo envolve a utilização dos três toques permitidos por equipe de forma estratégica. Qual é a sequência clássica utilizada pelas equipes para organizar o ataque após receber o saque adversário?', alts: ['Quatro toques: recepção, levantamento, ataque e bloqueio, todos obrigatórios', 'Dois toques: passe direto ao atacante e finalização, priorizando a velocidade', 'Três toques: recepção (manchete), levantamento e ataque finalização', 'Cinco toques: recepção, passe, levantamento, ataque e defesa do bloqueio'] },
  5: { texto: 'O sistema de pontuação do voleibol moderno, denominado rally point system, foi adotado pela FIVB em 1999. Com base nesse sistema, como ocorre a contagem de pontos e qual é o critério para vencer um set regular?', alts: ['Somente a equipe que está sacando pode marcar pontos, vencendo quem chegar primeiro a 21', 'Qualquer equipe marca ponto a cada rally, vencendo o set quem chegar primeiro a 25 com vantagem mínima de 2', 'Apenas a equipe receptora pode pontuar, vencendo quem atingir 15 pontos primeiro', 'Pontos são marcados apenas em ataques diretos, vencendo quem chegar a 30 pontos'] },
  6: { texto: 'O bloqueio é um dos fundamentos mais complexos do voleibol e exige coordenação, timing e posicionamento adequado. Qual alternativa descreve corretamente as características e restrições do bloqueio nas regras oficiais?', alts: ['Pode ser executado por qualquer jogador da quadra, incluindo os da linha de defesa', 'É realizado exclusivamente pelos jogadores da linha de frente, com salto e mãos ultrapassando o plano da rede', 'Somente o líbero pode executar o bloqueio, pois é especialista em ações defensivas próximas à rede', 'É permitido apenas após o terceiro toque da equipe adversária, como forma de defesa antecipada'] },
  7: { texto: 'A figura do líbero foi introduzida no voleibol internacional em 1998 pela FIVB, com o objetivo de especializar as funções dentro da equipe. Quais são suas principais características e limitações durante uma partida?', alts: ['Pode atacar de qualquer posição em quadra e utiliza uniforme da mesma cor dos companheiros', 'Atua exclusivamente na linha de defesa, não pode atacar acima da borda superior da rede e usa uniforme de cor contrastante', 'Pode executar saque, ataque e bloqueio, sendo restrito apenas ao levantamento de bola', 'Substitui apenas o levantador titular e tem permissão para atacar a partir da linha de 3 metros'] },
  8: { texto: 'A rotação é um elemento fundamental do voleibol que garante que todos os jogadores participem de diferentes posições. Nas aulas de Educação Física, o professor observou que uma equipe não realizou a rotação ao ganhar o direito ao saque. Qual é a regra correta e qual consequência essa infração gera?', alts: ['A rotação é opcional, cada equipe pode manter seus jogadores nas posições que preferirem durante todo o set', 'Os jogadores devem rodar no sentido horário toda vez que sua equipe conquista o direito de efetuar o saque, sob pena de falta', 'A rotação ocorre apenas no início de cada novo set, mantendo as posições fixas durante todo o set', 'Somente os atletas da linha de frente realizam rotação, enquanto os da linha de defesa permanecem fixos'] },
};

// Questões para 8º e 9º anos — nível Ensino Médio, análise tática e prática de quadra
const QUESTOES_ELABORADAS: Record<number, { texto: string; alts: string[] }> = {
  1: { texto: 'Durante uma aula prática de Educação Física, a equipe A realizou quatro toques consecutivos — o quarto executado pelo mesmo atleta que fez o primeiro — antes de mandar a bola ao campo adversário. O árbitro não apitou. Analisando as regras da FIVB e os fundamentos pedagógicos da arbitragem escolar, qual deveria ter sido a conduta correta e qual princípio regimental foi violado?', alts: ['A jogada é válida pois na Educação Física escolar o limite é quatro toques para favorecer o aprendizado dos fundamentos', 'Deveriam ser marcadas duas faltas simultâneas: quatro toques e toque duplo, concedendo ponto à equipe adversária', 'Apenas o toque duplo deveria ser marcado, pois a infração do mesmo atleta tocar duas vezes é mais grave que exceder o número de toques', 'A jogada é inválida por exceder três toques, com ponto concedido ao adversário, independentemente de quem realizou os toques'] },
  2: { texto: 'Ao analisar a trajetória histórica do voleibol, desde sua criação por Morgan (1895) como "Mintonette" até as modalidades contemporâneas como vôlei de praia e voleibol sentado paralímpico, percebe-se uma tensão entre a proposta pedagógica original e a especialização esportiva atual. Qual aspecto da concepção original foi mais transformado e qual representa maior continuidade no contexto da Educação Física escolar?', alts: ['O caráter recreativo foi mantido integralmente, enquanto as regras foram completamente reformuladas para atender ao alto rendimento', 'A proposta de inclusão e participação foi preservada nas práticas escolares, enquanto a dimensão competitiva e técnica se intensificou no esporte de alto rendimento', 'As regras originais permanecem inalteradas, sendo a principal transformação a introdução de tecnologia nas arbitragens profissionais', 'O voleibol perdeu completamente seu caráter pedagógico original ao se profissionalizar, sendo inadequado para uso na Educação Física escolar'] },
  3: { texto: 'Num jogo-treino de Educação Física, um atacante da equipe A salta e impulsiona a bola com força em direção ao campo adversário. No mesmo instante, um bloqueador da equipe B ultrapassa o plano da rede com as mãos, tocando a bola ainda no espaço de ataque da equipe A. A bola cai no chão da equipe A. Como deve ser interpretada essa jogada e qual fundamento técnico-regulamentar sustenta essa decisão?', alts: ['Ponto para a equipe B, pois a bola caiu no campo da equipe A, independentemente de qualquer infração de bloqueio', 'Falta da equipe B por invasão antecipada do espaço de ataque da equipe A antes de concluída a ação ofensiva, com ponto para a equipe A', 'A jogada é válida pois o bloqueador apenas tocou a bola sem segurar, não configurando falta segundo as regras vigentes', 'Replay da jogada, pois o contato simultâneo de bloqueio e ataque anula a jogada conforme regulamento da FIVB'] },
  4: { texto: 'Numa aula de Educação Física, o professor observou que metade da turma apresentava dificuldade no fundamento da manchete, com os antebraços desalinhados e os cotovelos flexionados no momento do contato com a bola. Sob a perspectiva biomecânica e da progressão pedagógica do ensino dos fundamentos, qual sequência de intervenção o professor deveria adotar para corrigir o gesto técnico de forma eficaz?', alts: ['Interromper as partidas imediatamente e exigir exercícios de repetição da manchete até a correção completa do gesto técnico', 'Iniciar por exercícios analíticos de alinhamento postural e contato com a bola parada, evoluindo progressivamente para situações de jogo reduzido com feedback imediato', 'Substituir o ensino da manchete pelo toque por cima, pois é tecnicamente mais fácil e adequado para iniciantes no contexto escolar', 'Manter as partidas sem intervenção, pois o erro técnico se corrige naturalmente com a prática livre e a experiência de jogo'] },
  5: { texto: 'Numa partida de cinco sets, os quatro primeiros terminaram com os placares 25x22, 20x25, 25x23 e 23x25. No quinto set, a equipe A lidera por 14x13. Analisando as regras do rally point system e considerando o cenário de tie-break, qual é a pontuação mínima necessária para a equipe A vencer o set e o jogo, e em que condição a partida se prolonga além de 15 pontos?', alts: ['A equipe A vence com 15 pontos independentemente da vantagem, pois no quinto set não se aplica a regra de dois pontos de diferença', 'A equipe A precisa de pelo menos 15 pontos com vantagem mínima de 2 sobre o adversário; se o placar chegar a 14x14, o jogo continua até alguém abrir 2 pontos de diferença', 'A equipe A vence o próximo ponto por já ter 14, pois no quinto set basta chegar primeiro a 15 quando o adversário tem 13 ou menos', 'O quinto set é decidido pela soma total de pontos dos sets anteriores, não havendo necessidade de atingir 15 pontos'] },
  6: { texto: 'Analisando o bloqueio sob a perspectiva tática e regulamentar do voleibol de alto nível, um técnico instruiu seus bloqueadores a realizarem penetração ativa acima da rede para cortar o espaço de ataque adversário antes da finalização. Considerando as regras vigentes da FIVB e a distinção entre bloqueio ativo e passivo, qual é a validade dessa instrução tática e quais são os limites regulamentares dessa ação?', alts: ['A instrução é totalmente válida pois no voleibol moderno não existem restrições à penetração ativa dos bloqueadores acima da rede', 'A penetração acima da rede é permitida desde que o bloqueador não toque a bola antes que o atacante conclua sua ação, caracterizando bloqueio passivo válido', 'Os bloqueadores podem penetrar acima da rede com as mãos e tocar a bola no espaço adversário antes da finalização do ataque, pois o bloqueio ativo é regulamentado pela FIVB', 'A instrução é inválida pois qualquer contato dos bloqueadores com a bola acima da rede antes da conclusão do ataque adversário configura falta, independentemente do contexto tático'] },
  7: { texto: 'Numa partida escolar com sistema de substituição simplificado, o professor-árbitro percebeu que o líbero, ao receber uma bola alta próxima à rede na zona 3, optou por realizar um toque por cima com os dedos para o levantador, que por sua vez armou o ataque com sucesso. Em seguida, o técnico solicitou a retirada do líbero por substituição. Considerando as restrições específicas da função do líbero e o impacto estratégico dessa posição, qual infração ocorreu e como essa situação reflete a complexidade tática do voleibol moderno?', alts: ['Nenhuma infração, pois o líbero pode realizar qualquer fundamento quando a bola está acima da altura da rede, incluindo levantamento com os dedos', 'O toque por cima do líbero na zona de ataque (zona 3) para o levantador que finalizou com ataque acima da rede configura infração, pois o líbero não pode levantar bolas que resultem em ataques acima da borda superior da rede', 'A infração ocorreu na substituição, pois o líbero só pode ser retirado de quadra no intervalo entre sets, sendo vedada a substituição durante o set em andamento', 'A situação é completamente regular, pois as restrições do líbero se aplicam apenas a competições profissionais, não às partidas escolares e de iniciação esportiva'] },
  8: { texto: 'Durante uma aula de Educação Física sobre voleibol, o professor propôs uma situação-problema: após a equipe B conquistar o direito ao saque vencendo um rally, os jogadores não realizaram a rotação corretamente — o jogador da posição 1 (zona de saque) não era o atleta que deveria ocupar aquela posição segundo a ordem de rotação registrada na súmula. O árbitro sinalizou falta. Analisando os princípios táticos e regulamentares da rotação no voleibol, qual é o fundamento técnico-regulamentar dessa marcação e como a gestão incorreta da rotação pode comprometer a estratégia de uma equipe?', alts: ['A falta é indevida, pois a rotação é realizada apenas uma vez por set, no início, sendo livre o posicionamento dos atletas durante o restante da partida', 'A marcação é correta: a rotação deve ser realizada no sentido horário toda vez que a equipe conquista o saque, e o não cumprimento dessa ordem resulta em falta e ponto para o adversário, comprometendo também a estratégia de servir com o jogador mais habilidoso', 'O árbitro errou ao marcar a falta, pois a rotação dos jogadores é obrigatória apenas em competições profissionais, sendo opcional nas categorias escolares e de formação', 'A rotação incorreta gera apenas advertência na primeira vez, sendo a falta aplicada somente na reincidência, conforme regras adaptadas para o voleibol escolar'] },
};

function getNivelQuestoes(turmaId: string): Record<number, { texto: string; alts: string[] }> {
  const serie = parseInt(turmaId.replace(/\D/g, '').charAt(0));
  return serie >= 8 ? QUESTOES_ELABORADAS : QUESTOES_SIMPLES;
}

// ─── Gera HTML da prova (página 1) ───────────────────────────────────────────
const LOGO_IOP = "data:image/png;base64,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";

function gerarHtmlTextoApoio(avaliacao: Avaliacao): string {
  if (!avaliacao.texto_apoio) return '';
  const paragrafos = avaliacao.texto_apoio
    .split('\n')
    .filter(p => p.trim())
    .map(p => `<p style="margin-bottom:8px;text-align:justify;font-size:12pt;line-height:1.7;">${p}</p>`)
    .join('');

  return `
    <div style="font-family:Arial,sans-serif;color:#1e293b;width:100%;">
      <!-- CABEÇALHO -->
      <table width="100%" style="border:2px solid #1e3a5f;border-collapse:collapse;margin-bottom:12px;">
        <tr>
          <td width="72" style="padding:6px;text-align:center;vertical-align:middle;">
            <img src="${LOGO_IOP}" width="64" height="64" style="width:64px;height:64px;" />
          </td>
          <td style="padding:6px;vertical-align:middle;">
            <div style="font-size:11pt;font-weight:bold;">Avalia&#231;&#227;o - Ensino Fundamental - 2026</div>
            <div style="font-size:10pt;">Disciplina: <strong>Educa&#231;&#227;o F&#237;sica</strong> &nbsp;&nbsp; Professor(a): <strong>Marco Pedro</strong></div>
            <div style="font-size:10pt;">Turma: <strong>${avaliacao.turma_id.replace(/\d+/, '')}</strong></div>
            <div style="font-size:10pt;border-top:1px solid #cbd5e1;padding-top:3px;margin-top:3px;">
              Nome: <span style="border-bottom:1px solid #333;display:inline-block;width:260px;">&nbsp;</span>
              &nbsp;&nbsp; N&#186;: <span style="border-bottom:1px solid #333;display:inline-block;width:36px;">&nbsp;</span>
              &nbsp;&nbsp; Data: ____/____/______
            </div>
          </td>
        </tr>
      </table>

      <!-- TEXTO DE APOIO -->
      <div style="border:1.5px solid #1e3a5f;border-radius:4px;overflow:hidden;margin-bottom:8px;">
        <div style="background:#1e3a5f;color:white;font-weight:bold;font-size:11pt;padding:6px 12px;">
          TEXTO DE APOIO — Leia com aten&#231;&#227;o antes de responder as quest&#245;es
        </div>
        <div style="padding:14px 16px;background:#f8fafc;">
          ${paragrafos}
        </div>
      </div>

      <div style="font-size:9pt;color:#64748b;text-align:right;margin-top:4px;">
        As respostas das quest&#245;es est&#227;o contidas no texto acima.
      </div>
    </div>`;
}

function gerarHtmlProva(avaliacao: Avaliacao, aluno: Aluno): string {
  const vObj = avaliacao.valor_questao.toFixed(1);
  const qSubj = avaliacao.questoes_subjetivas || {};
  const serie = avaliacao.turma_id.replace(/(\d+).*/, '$1') + 'º ano';

  function questaoHtml(n: number): string {
    const questoes = getNivelQuestoes(avaliacao.turma_id);
    const q = questoes[n];
    if (!q) return '';
    const altsHtml = q.alts.map((a, ai) =>
      `<tr><td style="width:20px;font-weight:bold;vertical-align:top;padding:1px 4px;">(${LETRAS[ai]})</td><td style="vertical-align:top;padding:1px 2px;text-align:justify;">${a}</td></tr>`
    ).join('');
    return `<div style="margin-bottom:8px;">
        <div style="font-weight:bold;margin-bottom:2px;text-align:left;">Questão ${n} –</div>
        <div style="margin-bottom:3px;line-height:1.4;text-align:justify;">${q.texto}</div>
        <table style="border-collapse:collapse;width:100%;">${altsHtml}</table>
      </div>`;
  }

  const q1a4 = [1,2,3,4].map(questaoHtml).join('');
  const q5a8 = [5,6,7,8].map(questaoHtml).join('');

  const dissHtml = [1,2].map(s => {
    const n = 8 + s;
    const enunciado = qSubj[String(n)] || '';
    return `
      <div style="border:1.5px solid #1e3a5f;margin-bottom:10px;page-break-inside:avoid;">
        <div style="background:#1e3a5f;color:white;font-weight:bold;padding:5px 8px;font-size:11pt;">
          Questão ${n} <span style="font-weight:normal;opacity:0.85;">(1,0 ponto)</span>
        </div>
        <div style="padding:8px 8px 10px 8px;background:white;">
          <div style="line-height:1.6;font-size:11pt;margin-bottom:10px;text-align:justify;">${enunciado || ''}</div>
          <div style="font-size:10pt;color:#1e293b;border-top:1px dashed #cbd5e1;padding-top:6px;">
            <strong>Resposta:</strong> <em>Escreva sua resposta no gabarito disponível na página seguinte.</em>
          </div>
        </div>
      </div>`;
  }).join('');

  return `
    <div style="font-family:Arial,sans-serif;font-size:12pt;color:#1e293b;width:100%;">

      <!-- CABEÇALHO -->
      <table style="width:100%;border:2px solid #1e3a5f;border-radius:4px;margin-bottom:6px;border-collapse:collapse;">
        <tr>
          <td style="width:72px;padding:6px;vertical-align:middle;text-align:center;">
            <img src="${LOGO_IOP}" width="64" height="64" style="width:64px;height:64px;max-width:64px;max-height:64px;object-fit:contain;display:block;" />
          </td>
          <td style="padding:6px;vertical-align:middle;">
            <div style="font-size:11pt;font-weight:bold;margin-bottom:2px;">Avaliação - Ensino Fundamental - 2026</div>
            <div style="font-size:10pt;margin-bottom:1px;">Disciplina: <strong>Educa&#231;&#227;o F&#237;sica</strong> &nbsp;&nbsp; Professor(a): <strong>Marco Pedro</strong></div>
            <div style="font-size:10pt;margin-bottom:1px;">S&#233;rie: <strong>${serie}</strong> &nbsp;&nbsp; Turma: <strong>${avaliacao.turma_id.replace(/\d+/, '')}</strong></div>
            <div style="font-size:10pt;border-top:1px solid #cbd5e1;padding-top:3px;margin-top:3px;">Nome: <span style="border-bottom:1px solid #333;display:inline-block;width:320px;">&nbsp;</span> &nbsp;&nbsp; Data: ____/____/______</div>
          </td>
        </tr>
      </table>

      <!-- PARTE 1 -->
      <div style="background:#1e3a5f;color:white;font-weight:bold;font-size:11pt;text-align:center;padding:4px;margin-bottom:6px;">
        PARTE 1 — QUESTÕES OBJETIVAS (${(8 * avaliacao.valor_questao).toFixed(1)} pontos)
      </div>

      <!-- 2 COLUNAS via TABLE -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:4px;">
        <tr>
          <td style="width:49%;vertical-align:top;padding-right:8px;border-right:1.5px solid #1e3a5f;">
            ${q1a4}
          </td>
          <td style="width:2%;"></td>
          <td style="width:49%;vertical-align:top;padding-left:8px;">
            ${q5a8}
          </td>
        </tr>
      </table>

      ${dissHtml}

      <div style="font-size:9pt;color:#94a3b8;text-align:center;margin-top:8px;border-top:1px solid #e2e8f0;padding-top:4px;">
        Brasiléia, Acre — 2026 &nbsp;&nbsp;&nbsp; E.E. Instituto Odilon Pratagi — Educação Física
      </div>
    </div>`;
}

// ─── CSS da prova ─────────────────────────────────────────────────────────────
const CSS_PROVA = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page {
    size: A4 portrait;
    margin: 10mm;
    margin-header: 0;
    margin-footer: 0;
  }
  @page { orphans: 0; widows: 0; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 12pt; color: #1e293b; background: white; }
  p, div, td { text-align: justify; }
  .questao-enunc, .alt { text-align: justify; }
`;


// ─── Gera canvas da folha QR ──────────────────────────────────────────────────
async function desenharFolhaQR(
  canvas: HTMLCanvasElement,
  avaliacao: Avaliacao,
  turmaId: string
): Promise<void> {
  const W = 794;
  const H = 1123;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const _serie = parseInt(turmaId.replace(/\D/g, '').charAt(0));
  const grupoLabel = _serie <= 7 ? '6º/7º Ano' : '8º/9º Ano';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  const MARK = 24;
  const PAD = 16;
  const CX = PAD + MARK + 8;
  const CW = W - 2 * (PAD + MARK + 8);

  // Marcadores OMR
  ctx.fillStyle = '#000000';
  ctx.fillRect(PAD, PAD, MARK, MARK);
  ctx.fillRect(W - PAD - MARK, PAD, MARK, MARK);
  ctx.fillRect(PAD, H - PAD - MARK, MARK, MARK);
  ctx.fillRect(W - PAD - MARK, H - PAD - MARK, MARK, MARK);

  // Cabeçalho
  ctx.fillStyle = '#e8edf2';
  ctx.fillRect(CX, PAD, CW, 60);
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('E.E. INSTITUTO ODILON PRATAGI', W / 2, PAD + 22);
  ctx.font = '11px Arial';
  // Remove o turma_id específico do título (ex: "8A") pois cada folha já mostra sua série no TURMA abaixo
  const tituloCanvas = avaliacao.titulo
    .split(/\s*[-\u2014]\s*/)
    .filter(part => part.trim().toUpperCase() !== avaliacao.turma_id.toUpperCase())
    .join(' \u2014 ')
    .replace(/Recupera\u00e7\u00e3o/gi, 'Avalia\u00e7\u00e3o')
    .trim();
  ctx.fillText('Educa\u00e7\u00e3o F\u00edsica \u2014 ' + tituloCanvas, W / 2, PAD + 40);
  ctx.font = 'bold 12px Arial';
  ctx.fillText(grupoLabel, W / 2, PAD + 56);
  ctx.textAlign = 'left';

  // Área do aluno com 3 campos
  const alunoY = PAD + 70;
  const FIELDS_H = 58;
  const turmLetra = turmaId.replace(/\d/g, '');
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(CX, alunoY, CW, FIELDS_H);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.strokeRect(CX, alunoY, CW, FIELDS_H);
  // Campo NOME
  ctx.fillStyle = '#334155';
  ctx.font = 'bold 10px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('NOME:', CX + 8, alunoY + 15);
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(CX + 54, alunoY + 16);
  ctx.lineTo(CX + CW - 8, alunoY + 16);
  ctx.stroke();
  // Campo TURMA
  ctx.fillStyle = '#334155';
  ctx.font = 'bold 10px Arial';
  ctx.fillText('TURMA:', CX + 8, alunoY + 35);
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(CX + 58, alunoY + 36);
  ctx.lineTo(CX + 130, alunoY + 36);
  ctx.stroke();
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 11px Arial';
  ctx.fillText(turmLetra, CX + 62, alunoY + 35);
  // Campo Nº CHAMADA
  ctx.fillStyle = '#334155';
  ctx.font = 'bold 10px Arial';
  const ncLabel = 'Nº CHAMADA:';
  const ncX = CX + Math.floor(CW / 2);
  ctx.fillText(ncLabel, ncX, alunoY + 35);
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(ncX + 84, alunoY + 36);
  ctx.lineTo(CX + CW - 8, alunoY + 36);
  ctx.stroke();
  // Campo DATA
  ctx.fillStyle = '#334155';
  ctx.font = 'bold 10px Arial';
  ctx.fillText('DATA:', CX + 8, alunoY + 53);
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(CX + 46, alunoY + 54);
  ctx.lineTo(CX + 220, alunoY + 54);
  ctx.stroke();

  // QR Code
  const payload = JSON.stringify({ av: avaliacao.id, turma: turmaId });
  const qrDataUrl = await QRCode.toDataURL(payload, { width: 130, margin: 1, errorCorrectionLevel: 'M' });
  const qrImg = new Image();
  await new Promise<void>(res => { qrImg.onload = () => res(); qrImg.src = qrDataUrl; });
  const qrX = W - PAD - MARK - 8 - 130;
  const qrY = alunoY + 36;
  ctx.drawImage(qrImg, qrX, qrY, 130, 130);
  ctx.fillStyle = '#64748b';
  ctx.font = '9px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('QR para corre\u00e7\u00e3o', qrX + 65, qrY + 143);
  ctx.textAlign = 'left';

  // Instruções
  const instrY = alunoY + FIELDS_H + 4;
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 11px Arial';
  ctx.fillText('INSTRU\u00c7\u00d5ES:', CX + 8, instrY + 16);
  ctx.font = '10px Arial';
  ctx.fillStyle = '#475569';
  ctx.fillText('\u2022 Preencha completamente o c\u00edrculo da alternativa escolhida.', CX + 8, instrY + 32);
  ctx.fillText('\u2022 Use caneta azul ou preta. N\u00e3o use corretivo.', CX + 8, instrY + 48);
  ctx.fillText('\u2022 Marque apenas UMA alternativa por quest\u00e3o.', CX + 8, instrY + 64);

  // Questões objetivas
  const BUBBLE_R = 16;
  const BUBBLE_GAP = 52;
  const Q_ROW_H = 52;
  const Q_START_X = CX + 8;
  const Q_START_Y = instrY + 90;

  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 11px Arial';
  ctx.fillText('QUEST\u00d5ES OBJETIVAS', Q_START_X, Q_START_Y - 8);
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(Q_START_X, Q_START_Y - 4);
  ctx.lineTo(qrX - 16, Q_START_Y - 4);
  ctx.stroke();

  for (let i = 0; i < 8; i++) {
    const qy = Q_START_Y + i * Q_ROW_H + Q_ROW_H / 2;
    if (i % 2 === 0) {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(Q_START_X - 4, qy - Q_ROW_H / 2 + 2, qrX - Q_START_X - 8, Q_ROW_H - 4);
    }
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 16px Arial';
    ctx.fillText(String(i + 1), Q_START_X + 2, qy + 6);
    LETRAS.forEach((l, li) => {
      const bx = Q_START_X + 50 + li * BUBBLE_GAP;
      ctx.beginPath();
      ctx.arc(bx, qy, BUBBLE_R, 0, Math.PI * 2);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.fillStyle = '#334155';
      ctx.font = 'bold 13px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(l, bx, qy + 5);
      ctx.textAlign = 'left';
    });
  }

  // Questões subjetivas — caixas estilo print1
  const subjStartY = Q_START_Y + 8 * Q_ROW_H + 18;
  const valorSubj = avaliacao.valor_questao || 1.0;
  const BOX_H = 185;
  const HDR_H = 24;
  const GAP = 12;

  for (let s = 0; s < 2; s++) {
    const qn = 8 + s + 1;
    const bx = CX - 4;
    const bw = CW + 8;
    const by = subjStartY + s * (BOX_H + GAP);

    ctx.strokeStyle = '#1e3a5f';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx, by, bw, BOX_H);
    ctx.fillStyle = '#1e3a5f';
    ctx.fillRect(bx, by, bw, HDR_H);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Quest\u00e3o ' + qn, bx + 8, by + HDR_H - 7);
    ctx.font = '10px Arial';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('(' + valorSubj.toFixed(1).replace('.', ',') + ' ponto)', bx + 8 + ctx.measureText('Quest\u00e3o ' + qn + '  ').width, by + HDR_H - 7);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(bx, by + HDR_H, bw, BOX_H - HDR_H);
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 10px Arial';
    ctx.fillText('Resposta:', bx + 8, by + HDR_H + 16);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 0.7;
    const lineStartY = by + HDR_H + 26;
    const lineSpacing = (BOX_H - HDR_H - 34) / 8;
    for (let ln = 0; ln < 8; ln++) {
      ctx.beginPath();
      ctx.moveTo(bx + 8, lineStartY + ln * lineSpacing);
      ctx.lineTo(bx + bw - 8, lineStartY + ln * lineSpacing);
      ctx.stroke();
    }
  }

  // Rodapé
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(CX, H - PAD - MARK - 20, CW, 1);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '9px Arial';
  ctx.fillText('Bras\u00edl\u00e9ia, Acre \u2014 2026', CX + 8, H - PAD - MARK - 6);
  ctx.textAlign = 'right';
  ctx.fillText(grupoLabel, W - PAD - MARK - 16, H - PAD - MARK - 6);
  ctx.textAlign = 'left';
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function AvaliacaoFolha() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const criticosParam = new URLSearchParams(location.search).get('criticos');
  const alunosCriticosIds = criticosParam ? criticosParam.split(',') : null;

  const [avaliacao, setAvaliacao] = useState<Avaliacao | null>(null);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [loading, setLoading] = useState(true);
  const [gerandoIdx, setGerandoIdx] = useState<number | null>(null);
  const [folhasQR, setFolhasQR] = useState<Record<string, string>>({});
  const [geradoTodos, setGeradoTodos] = useState(false);
  const [gerandoIA, setGerandoIA] = useState(false);
  const [enunciadoGerado, setEnunciadoGerado] = useState(false);
  const [gerandoTextoApoio, setGerandoTextoApoio] = useState(false);
  const [textoApoioGerado, setTextoApoioGerado] = useState(false);

  async function gerarEnunciadosIA() {
    if (!avaliacao) return;
    setGerandoIA(true);
    setEnunciadoGerado(false);
    try {
      const resp = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          messages: [{ role: 'user', content: (() => {
          const serie = parseInt((avaliacao.turma_id || '').replace(/\D/g, '').charAt(0));
          const nivel = serie >= 8
            ? 'nivel Ensino Medio: questoes complexas com analise tatica, raciocinio critico, exemplos avancados de pratica esportiva, terminologia tecnica e conexao com saude e cidadania'
            : 'nivel intermediario (6 e 7 anos): questoes contextualizadas com exemplos praticos da quadra de Educacao Fisica, que exijam compreensao e aplicacao de regras e fundamentos, linguagem clara mas desafiadora';
          return 'Voce e professor de Educacao Fisica do Ensino Fundamental. Gere EXATAMENTE 2 questoes dissertativas sobre o tema: "' + avaliacao.titulo + '". Nivel de dificuldade: ' + nivel + '. As questoes devem ter entre 3 e 5 linhas, pedir que o aluno explique, justifique ou analise situacoes praticas da quadra. Responda APENAS em JSON sem texto adicional: {"q9": "enunciado da questao 9", "q10": "enunciado da questao 10"}';
        })() }]
        })
      });
      const data = await resp.json();
      const text = data.content?.[0]?.text || '';
      const clean = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      if (parsed.q9 && parsed.q10) {
        await supabase.from('avaliacoes').update({
          questoes_subjetivas: { '9': parsed.q9, '10': parsed.q10 }
        }).eq('id', avaliacao.id);
        setAvaliacao(prev => prev ? { ...prev, questoes_subjetivas: { '9': parsed.q9, '10': parsed.q10 } } : prev);
        setEnunciadoGerado(true);
        setGeradoTodos(false);
      }
    } catch (e) {
      alert('Erro ao gerar enunciados. Tente novamente.');
    } finally {
      setGerandoIA(false);
    }
  }

  async function gerarTextoApoioIA() {
    if (!avaliacao) return;
    setGerandoTextoApoio(true);
    setTextoApoioGerado(false);
    try {
      const serie = parseInt((avaliacao.turma_id || '').replace(/\D/g, '').charAt(0));
      const nivel = serie >= 8
        ? 'nivel Ensino Medio, linguagem tecnica e analitica'
        : 'nivel intermediario para 6 e 7 anos, linguagem clara e acessivel';

      // Montar respostas corretas do gabarito
      const questoes = serie >= 8 ? QUESTOES_ELABORADAS : QUESTOES_SIMPLES;
      const gabarito = avaliacao.gabarito || {};
      const respostasCorretas = [1,2,3,4,5,6,7,8].map(n => {
        const q = questoes[n];
        const letra = gabarito[String(n)] || 'A';
        const idx = ['A','B','C','D'].indexOf(letra);
        const textoAlt = q?.alts?.[idx >= 0 ? idx : 0] || '';
        return `Q${n} (${letra}): ${textoAlt}`;
      }).join('\n');

      // Q9 e Q10 discursivas
      const q9 = avaliacao.questoes_subjetivas?.['9'] || '';
      const q10 = avaliacao.questoes_subjetivas?.['10'] || '';
      const discursivas = q9
        ? `\n\nQUESTOES DISCURSIVAS (o texto deve conter a resposta para estas):\nQ9: ${q9}\nQ10: ${q10}`
        : '';

      const prompt = `Voce e professor de Educacao Fisica do Ensino Fundamental. Crie um TEXTO DE APOIO CURTO E DENSO (1 paragrafo unico de 10 a 14 linhas) sobre o tema: "${avaliacao.titulo}". Nivel: ${nivel}.

O texto DEVE conter, de forma COMPLETAMENTE NATURAL E CAMUFLADA, as informacoes corretas das 8 questoes objetivas abaixo. O aluno que ler com atencao deve conseguir responder todas as questoes sem que as respostas estejam obvias ou destacadas:

${respostasCorretas}${discursivas}

REGRAS:
- Texto corrido, sem numeros de questao, sem marcacoes, sem sublinhados
- Todas as 8 respostas devem estar embutidas naturalmente como informacoes do texto
- Inclua tambem conteudo que permita responder as discursivas
- Maximo de 14 linhas no total

Responda APENAS com o texto puro.`;

      const resp = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 700,
          messages: [{ role: 'user', content: prompt }]
        })
      });
      const data = await resp.json();
      const texto = data.content?.[0]?.text || '';
      if (texto) {
        await supabase.from('avaliacoes').update({ texto_apoio: texto }).eq('id', avaliacao.id);
        setAvaliacao(prev => prev ? { ...prev, texto_apoio: texto } : prev);
        setTextoApoioGerado(true);
        setGeradoTodos(false);
      }
    } catch (e) {
      alert('Erro ao gerar texto de apoio. Tente novamente.');
    } finally {
      setGerandoTextoApoio(false);
    }
  }

  useEffect(() => {
    async function init() {
      if (!id) return;
      const { data: av } = await supabase.from('avaliacoes').select('*').eq('id', id).single();
      setAvaliacao(av);
      if (av) {
        // Buscar nomes dos alunos especiais
        const { data: especiais } = await supabase
          .from('alunos_especiais')
          .select('nome');
        const nomesEspeciais = (especiais || []).map((e: { nome: string }) =>
          e.nome.toLowerCase().trim()
        );

        // Buscar nomes dos transferidos/remanejados
        const { data: transferidos } = await supabase
          .from('notas')
          .select('nome')
          .eq('turma', av.turma_id)
          .or('situacao.ilike.%transferi%,situacao.ilike.%remanej%');
        const nomesTransferidos = (transferidos || []).map((e: { nome: string }) =>
          e.nome.toLowerCase().trim()
        );

        const nomesExcluidos = new Set([...nomesEspeciais, ...nomesTransferidos]);

        let query = supabase
          .from('alunos')
          .select('id, nome, numero_chamada, token_acesso')
          .eq('turma_id', av.turma_id)
          .order('numero_chamada');
        if (alunosCriticosIds && alunosCriticosIds.length > 0) {
          query = query.in('id', alunosCriticosIds);
        }
        const { data: al } = await query;

        // Excluir especiais e transferidos da lista
        const filtrados = (al || []).filter(
          (a: Aluno) => !nomesExcluidos.has(a.nome.toLowerCase().trim())
        );
        setAlunos(filtrados);
      }
      setLoading(false);
    }
    init();
  }, [id]);

  async function gerarTodos() {
    if (!avaliacao) return;
    setGeradoTodos(false);
    setFolhasQR({});
    // Detecta o nível pela série da avaliação:
    // 6º/7º → 2 folhas: "6º Ano" + "7º Ano"  (QUESTOES_SIMPLES)
    // 8º/9º → 2 folhas: "8º Ano" + "9º Ano"  (QUESTOES_ELABORADAS)
    const _s = parseInt(avaliacao.turma_id.replace(/\D/g, '').charAt(0));
    const grupoLabel = _s <= 7 ? '6º/7º Ano' : '8º/9º Ano';
    setGerandoIdx(0);
    const canvas = document.createElement('canvas');
    await desenharFolhaQR(canvas, avaliacao, avaliacao.turma_id);
    setFolhasQR({ [avaliacao.turma_id]: canvas.toDataURL('image/png') });
    setGerandoIdx(null);
    setGeradoTodos(true);
  }

  // Imprime UMA folha QR individual (abre janela separada por série)
  function imprimirFolha(turma: string, src: string) {
    if (!avaliacao) return;
    const html = `<!DOCTYPE html><html><head>
      <meta charset="utf-8">
      <title>Folha QR \u2014 ${turma}</title>
      <style>* { margin:0; padding:0; box-sizing:border-box; } @page { margin:0; size: A4 portrait; } body { background:white; }</style>
    </head><body>
      <div style="text-align:center;">
        <img src="${src}" style="width:100%;max-width:794px;display:block;margin:0 auto;" />
      </div>
      <script>setTimeout(function(){ window.print(); }, 600);<\/script>
    </body></html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) win.onafterprint = () => URL.revokeObjectURL(url);
  }

  function imprimirProva() {
    if (!avaliacao) return;
    const textoApoioHtml = gerarHtmlTextoApoio(avaliacao);
    // Prova igual para todos — gera só uma vez
    const htmlProva = gerarHtmlProva(avaliacao, alunos[0]);
    const paginaTexto = textoApoioHtml
      ? `<div style="page-break-after: always;">${textoApoioHtml}</div>`
      : '';
    const html = `<!DOCTYPE html><html><head>
      <meta charset="utf-8">
      <title>${avaliacao.titulo} -- ${avaliacao.turma_id} -- 2026</title>
      <style>${CSS_PROVA} @page { margin: 10mm; size: A4 portrait; }</style>
    </head><body>
      ${paginaTexto}
      <div>${htmlProva}</div>
      <script>setTimeout(function(){ window.print(); }, 600);<\/script>
    </body></html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) win.onafterprint = () => URL.revokeObjectURL(url);
  }

  function imprimirQR() {
    if (!avaliacao) return;
    const turmasEntries = Object.entries(folhasQR);
    const blocos = turmasEntries.map(([turma, qrSrc], idx) => {
      const isLast = idx === turmasEntries.length - 1;
      return `<div style="${isLast ? '' : 'page-break-after: always;'}text-align:center;">
        <img src="${qrSrc}" style="width:100%;max-width:794px;display:block;margin:0 auto;" />
      </div>`;
    }).join('');
    const html = `<!DOCTYPE html><html><head>
      <meta charset="utf-8">
      <title>Folhas QR — ${avaliacao.titulo}</title>
      <style>* { margin:0; padding:0; box-sizing:border-box; } @page { margin:0; size: A4 portrait; } body { background:white; }</style>
    </head><body>${blocos}
      <script>setTimeout(function(){ window.print(); }, 600);<\/script>
    </body></html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) win.onafterprint = () => URL.revokeObjectURL(url);
  }

  async function exportarWord() {
    if (!avaliacao || alunos.length === 0) return;

    const textoApoioHtml = gerarHtmlTextoApoio(avaliacao);
    // Word: texto de apoio (pág 1) + questões (pág 2) — sem QR, sem gabarito
    // Prova é igual para todos, só gera uma vez
    const htmlProva = gerarHtmlProva(avaliacao, alunos[0]);
    const paginaTexto = textoApoioHtml
      ? `<div style="page-break-after:always;">${textoApoioHtml}</div>`
      : '';

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:w="urn:schemas-microsoft-com:office:word"
            xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <title>${avaliacao.titulo} -- ${avaliacao.turma_id} -- 2026</title>
        <!--[if gte mso 9]>
        <xml>
          <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>100</w:Zoom>
            <w:DoNotOptimizeForBrowser/>
          </w:WordDocument>
          <w:DocumentProperties>
            <w:Orientation>Portrait</w:Orientation>
          </w:DocumentProperties>
        </xml>
        <![endif]-->
        <style>
          ${CSS_PROVA}
          @page {
            size: 21.0cm 29.7cm;
            margin: 10mm 10mm 10mm 10mm;
            mso-page-orientation: portrait;
          }
          body { margin: 0; }
        </style>
      </head>
      <body>
        ${paginaTexto}
        <div>${htmlProva}</div>
      </body>
      </html>`;

    const blob = new Blob([html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${avaliacao.titulo}_${avaliacao.turma_id}_${Date.now()}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (!avaliacao) return (
    <div className="py-8 text-center text-on-surface-variant text-sm">Avaliação não encontrada.</div>
  );

  return (
    <div className="py-4 space-y-4">

      {/* Cabeçalho */}
      <div className="flex items-center gap-2">
        <button onClick={() => navigate('/avaliacoes')} className="p-1 rounded-lg text-on-surface-variant">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-base font-bold text-on-surface">{avaliacao.titulo}</h1>
          <p className="text-xs text-on-surface-variant">
            Turma {avaliacao.turma_id} &middot; {alunos.length} aluno{alunos.length !== 1 ? 's' : ''}
            {alunosCriticosIds ? ' (críticos)' : ''}
          </p>
        </div>
      </div>

      {/* Info + Gerar enunciados IA */}
      <div className="bg-secondary-container rounded-2xl p-4 space-y-3">
        <p className="text-sm font-medium text-on-secondary-container">
          <strong>Pág. 1</strong> — Prova em texto (HTML) &nbsp;+&nbsp; <strong>Pág. 2</strong> — Folha QR individual
        </p>
        {avaliacao.questoes_subjetivas?.['9'] ? (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-on-secondary-container">✅ Enunciados cadastrados:</p>
            <p className="text-xs text-on-secondary-container"><strong>Q9:</strong> {avaliacao.questoes_subjetivas['9']}</p>
            <p className="text-xs text-on-secondary-container"><strong>Q10:</strong> {avaliacao.questoes_subjetivas['10']}</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-on-secondary-container">⚠️ Enunciados das questões 9 e 10 não cadastrados.</p>
            <button
              onClick={gerarEnunciadosIA}
              disabled={gerandoIA}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-semibold disabled:opacity-60"
            >
              <Sparkles className="w-4 h-4" />
              {gerandoIA ? 'Gerando enunciados com IA...' : 'Gerar enunciados Q9 e Q10 com IA'}
            </button>
          </div>
        )}
        {enunciadoGerado && (
          <p className="text-xs text-green-700 font-semibold">✅ Enunciados gerados e salvos! Clique em "Gerar folhas QR" para aplicar.</p>
        )}

        {/* Texto de apoio */}
        <div className="pt-2 border-t border-black/10 space-y-2">
          {avaliacao.texto_apoio ? (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-on-secondary-container">✅ Texto de apoio cadastrado</p>
              <p className="text-xs text-on-secondary-container line-clamp-3">{avaliacao.texto_apoio.slice(0, 200)}...</p>
              <button
                onClick={gerarTextoApoioIA}
                disabled={gerandoTextoApoio}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-teal-700 text-white text-xs font-semibold disabled:opacity-60"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {gerandoTextoApoio ? 'Gerando...' : 'Regenerar texto de apoio com IA'}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-on-secondary-container">⚠️ Sem texto de apoio (opcional — aparece na pág. 1 antes das questões).</p>
              <button
                onClick={gerarTextoApoioIA}
                disabled={gerandoTextoApoio}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-semibold disabled:opacity-60"
              >
                <Sparkles className="w-4 h-4" />
                {gerandoTextoApoio ? 'Gerando texto de apoio com IA...' : 'Gerar texto de apoio com IA'}
              </button>
            </div>
          )}
          {textoApoioGerado && (
            <p className="text-xs text-green-700 font-semibold">✅ Texto de apoio gerado e salvo!</p>
          )}
        </div>
      </div>

      {/* Botões */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={gerarTodos}
          disabled={gerandoIdx !== null}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary text-on-primary font-semibold text-sm disabled:opacity-60"
        >
          {gerandoIdx !== null
            ? `Gerando ${gerandoIdx + 1}/2...`
            : 'Gerar folhas QR'}
        </button>
        <button
          onClick={imprimirProva}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-secondary-container text-on-secondary-container font-semibold text-sm"
        >
          <Printer className="w-4 h-4" />
          Prova
        </button>
        <button
          onClick={exportarWord}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-blue-600 text-white font-semibold text-sm"
        >
          <FileText className="w-4 h-4" />
          Word
        </button>
      </div>

      {/* Preview folhas QR */}
      {geradoTodos && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-on-surface-variant">
            Folhas QR geradas — {alunos.length} aluno{alunos.length !== 1 ? 's' : ''}
          </p>
          {Object.entries(folhasQR).map(([turma, src]) => (
            <div key={turma} className="border border-outline-variant rounded-xl overflow-hidden">
              <div className="px-3 py-1.5 bg-surface flex items-center justify-between">
                <span className="text-xs font-semibold text-on-surface-variant">
                  {turma}
                </span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => imprimirFolha(turma, src)}
                    className="flex items-center gap-1 text-xs text-teal-600 font-semibold"
                  >
                    <Printer className="w-3 h-3" />
                    Imprimir
                  </button>
                  <a
                    href={src}
                    download={`folha_qr_${turma.replace(/\s/g, '_')}.png`}
                    className="flex items-center gap-1 text-xs text-primary"
                  >
                    <Download className="w-3 h-3" />
                    Baixar
                  </a>
                </div>
              </div>
              <img src={src} alt={turma} className="w-full" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
