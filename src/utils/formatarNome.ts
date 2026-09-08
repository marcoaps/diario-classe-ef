const PARTICULAS = new Set(['de', 'da', 'das', 'do', 'dos', 'e', 'em', 'no', 'na', 'nos', 'nas']);

// Deixa o nome em Title Case para exibição (ex: "BRED BRAIAN CAMPOS" ->
// "Bred Braian Campos"), mantendo preposições em minúsculo. Só formata o
// que aparece na tela — o valor salvo no banco continua em CAIXA ALTA,
// que é o que evita duplicar o mesmo aluno com grafias diferentes.
export function formatarNome(nome: string): string {
  return nome.toLowerCase().split(' ').map((p, i) =>
    i > 0 && PARTICULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)
  ).join(' ');
}
