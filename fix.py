f = "src/ui/pages/ProvasOnline.tsx"
c = open(f, encoding="utf-8").read()

old = "  let questaoAtual: Questao | null = null;\n  let numQuestao = 0;\n\n  for (let i = 0; i < linhas.length; i++) {\n    const linha = linhas[i];\n    const matchQuestao = linha.match"

new_code = """  const htmlLinhas = resultHtml.value
    .replace(/<p>/g, "\\n").replace(/<\\/p>/g, "")
    .replace(/<br\\s*\\/?>/g, "\\n")
    .split("\\n").map(l => l.trim()).filter(Boolean);

  let questaoAtual: Questao | null = null;
  let numQuestao = 0;
  let ultimaImagem: string | null = null;

  for (let i = 0; i < htmlLinhas.length; i++) {
    const linhaHtml = htmlLinhas[i];
    const matchImg = linhaHtml.match(/src="(img_PLACEHOLDER+)"/);
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
    const matchQuestao = linha.match"""

new_code = new_code.replace("PLACEHOLDER", "\\\\d")
result = c.replace(old, new_code, 1)
print("Substituido:", "htmlLinhas" in result)
open(f, "w", encoding="utf-8").write(result)
