// Função compartilhada para chamar o proxy da API da Claude (/api/claude).
// Extraída do IASequencia.tsx para ser reutilizada por outras telas
// (ex: geração de conteúdo de aulas no DiarioAulas.tsx), evitando duplicação.

export async function chamarClaudeProxy(prompt: string): Promise<string> {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 8000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);
  const data = await res.json();
  return data.content.map((i: { text?: string }) => i.text ?? "").join("");
}
