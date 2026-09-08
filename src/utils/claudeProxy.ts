// Função compartilhada para chamar o proxy da API da Claude (/api/claude).
// Extraída do IASequencia.tsx para ser reutilizada por outras telas
// (ex: geração de conteúdo de aulas no DiarioAulas.tsx), evitando duplicação.

export async function chamarClaudeProxy(prompt: string): Promise<string> {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      // 8000 cortava respostas grandes no meio (ex: sequência didática com
      // 5 estações), quebrando o JSON. max_tokens é só um teto — a IA gera
      // só o que precisa, então subir esse valor não aumenta custo à toa.
      max_tokens: 16000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    // Tenta extrair a mensagem real da API (ex: "Your credit balance is too
    // low...") em vez de só o código HTTP genérico, para o erro exibido ao
    // professor já dizer o que de fato aconteceu.
    let mensagem = `Erro HTTP ${res.status}`;
    try {
      const corpo = await res.json();
      const mensagemApi: string | undefined = corpo?.error?.message ?? corpo?.message;
      if (mensagemApi) mensagem = mensagemApi;
    } catch {
      // Corpo não era JSON válido (ex: página de erro HTML) — mantém a mensagem genérica.
    }
    throw new Error(mensagem);
  }
  const data = await res.json();
  return data.content.map((i: { text?: string }) => i.text ?? "").join("");
}
