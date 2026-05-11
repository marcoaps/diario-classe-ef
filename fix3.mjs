import {readFileSync,writeFileSync} from "fs"; const f="src/ui/pages/ProvasOnline.tsx"; let c=readFileSync(f,"utf8"); const oldLoop = `  let questaoAtual: Questao | null = null;
  let numQuestao = 0;
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    const matchQuestao = linha.match(/^(?:questÃ£o\\s*)?(\\d+)\\s*[.)]\\s*(.*)$/i);
    if (matchQuestao) {
      if (questaoAtual) questoes.push(questaoAtual);
      numQuestao = parseInt(matchQuestao[1]);
      questaoAtual = {
        id: Math.random().toString(36).substring(2),
        enunciado: matchQuestao[2] || \"\",
        imagem: null,
        tipo: \"multipla_escolha\",
        opcoes: [],
        resposta_correta: gabaritoMap[numQuestao] !== undefined ? String(gabaritoMap[numQuestao]) : \"\",
        pontos: 1,
      };
      continue;
    }
    const matchAlternativa = linha.match(/^([A-Ea-e])\\s*[.)]\\s*(.+)$/);
    if (matchAlternativa && questaoAtual) {
      if (questaoAtual.opcoes.length < 5) questaoAtual.opcoes.push(matchAlternativa[2]);
      continue;
    }
    if (questaoAtual && !/^gabarito/i.test(linha) && questaoAtual.opcoes.length === 0) {
      questaoAtual.enunciado += \" \" + linha;
    }
  }`; const newLoop = `  // Processa HTML para extrair imagens por questao
  const htmlLinhas = resultHtml.value
    .replace(/<p>/g, "\\n").replace(/<\\/p>/g, "")
    .replace(/<br\\s*\\/?>/g, "\\n")
    .split("\\n").map(l => l.trim()).filter(Boolean);

  let questaoAtual: Questao | null = null;
  let numQuestao = 0;
  let ultimaImagem: string | null = null;

  for (let i = 0; i < htmlLinhas.length; i++) {
    const linhaHtml = htmlLinhas[i];
    const matchImg = linhaHtml.match(/src="(img_\\d+)"/);
    if (matchImg && imagensMap[matchImg[1]]) {
      ultimaImagem = imagensMap[matchImg[1]];
      if (questaoAtual && !questaoAtual.imagem) {
        questaoAtual.imagem = ultimaImagem;
        ultimaImagem = null;
      }
      continue;
    }
    const linha = linhaHtml.replace(/<[^>]*>/g, "").trim();
    if (!linha) continue;
    const matchQuestao = linha.match(/^(?:quest[aã]o\\s*)?(\\d+)\\s*[.)]\\s*(.*)$/i);
    if (matchQuestao) {
      if (questaoAtual) questoes.push(questaoAtual);
      numQuestao = parseInt(matchQuestao[1]);
      questaoAtual = {
        id: Math.random().toString(36).substring(2),
        enunciado: matchQuestao[2] || "",
        imagem: ultimaImagem,
        tipo: "multipla_escolha",
        opcoes: [],
        resposta_correta: gabaritoMap[numQuestao] !== undefined ? String(gabaritoMap[numQuestao]) : "",
        pontos: 1,
      };
      ultimaImagem = null;
      continue;
    }
    const matchAlternativa = linha.match(/^([A-Ea-e])\\s*[.)]\\s*(.+)$/);
    if (matchAlternativa && questaoAtual) {
      if (questaoAtual.opcoes.length < 5) questaoAtual.opcoes.push(matchAlternativa[2]);
      continue;
    }
    if (questaoAtual && !/^gabarito/i.test(linha) && questaoAtual.opcoes.length === 0) {
      questaoAtual.enunciado += " " + linha;
      if (ultimaImagem && !questaoAtual.imagem) {
        questaoAtual.imagem = ultimaImagem;
        ultimaImagem = null;
      }
    }
  }`; c=c.replace(oldLoop,newLoop); writeFileSync(f,c,"utf8"); console.log("OK:",c.includes("htmlLinhas")?"loop atualizado":"FALHOU");
