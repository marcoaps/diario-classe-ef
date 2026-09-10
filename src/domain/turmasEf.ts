// Turmas reais que têm aula de Educação Física com o professor, e os
// agrupamentos por série usados como atalho ("Todos 8º" etc) nas telas que
// montam times/escalações — não é "toda turma daquele ano", é a combinação
// real que joga junto (ex: 7º só D/E/F, sem B/C; 9º só D/E/F, sem A/B/C).
export const TURMAS_EF = ["6F", "7B", "7C", "7D", "7E", "7F", "8A", "8B", "8C", "8D", "8E", "8F", "9A", "9B", "9C", "9D", "9E", "9F"];

export const GRUPOS_SERIE_EF: [string, string[]][] = [
  ['6º', ['6F']],
  ['7º', ['7D', '7E', '7F']],
  ['8º', ['8A', '8B', '8C', '8D', '8E', '8F']],
  ['9º', ['9D', '9E', '9F']],
];
