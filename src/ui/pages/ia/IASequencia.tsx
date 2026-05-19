import React from 'react';
import { IABase } from './IABase';

export function IASequencia() {
  return (
    <IABase
      titulo="Gerador de Sequências Didáticas"
      descricao="Modelo oficial — estrutura completa com situações de aprendizagem, BNCC e avaliação"
      cor="bg-gradient-to-br from-emerald-600 to-emerald-500"
      campos={[
        {
          id: 'professor',
          label: 'Nome do Professor',
          tipo: 'text',
          placeholder: 'Ex: Marco Antonio Pedro da Silva',
        },
        {
          id: 'turma',
          label: 'Ano / Turma',
          tipo: 'select',
          opcoes: ['6º Ano', '7º Ano', '8º Ano', '9º Ano'],
        },
        {
          id: 'aulas',
          label: 'Aulas Previstas',
          tipo: 'select',
          opcoes: ['2h/aulas', '4h/aulas', '6h/aulas', '8h/aulas'],
        },
        {
          id: 'unidade',
          label: 'Unidade Temática (BNCC)',
          tipo: 'select',
          opcoes: [
            'Brincadeiras e Jogos',
            'Esportes',
            'Ginásticas',
            'Danças',
            'Lutas',
            'Práticas Corporais de Aventura',
          ],
        },
        {
          id: 'tema',
          label: 'Tema / Objeto de Conhecimento',
          tipo: 'text',
          placeholder: 'Ex: Futsal — regras, fundamentos e cooperação',
        },
        {
          id: 'situacoes',
          label: 'Número de Situações de Aprendizagem',
          tipo: 'select',
          opcoes: ['2 situações', '3 situações', '4 situações'],
        },
        {
          id: 'contexto',
          label: 'Contexto / Observações (opcional)',
          tipo: 'textarea',
          placeholder: 'Ex: Turma inclusiva, sem quadra coberta, alunos iniciantes...',
          required: false,
        },
      ]}
      gerarPrompt={v => `Você é um professor especialista em Educação Física do Ensino Fundamental, com domínio da BNCC e do modelo de Sequência Didática da Secretaria de Educação do Acre.

Crie uma SEQUÊNCIA DIDÁTICA COMPLETA no modelo oficial abaixo, para:
- Professor(a): ${v.professor}
- Componente Curricular: Educação Física
- Ano: ${v.turma}
- Aulas Previstas: ${v.aulas}
- Unidade Temática BNCC: ${v.unidade}
- Tema / Objeto de Conhecimento: ${v.tema}
- Número de Situações de Aprendizagem: ${v.situacoes}
${v.contexto ? `- Contexto: ${v.contexto}` : ''}

Use EXATAMENTE esta estrutura e formatação:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SEQUÊNCIA DIDÁTICA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROFESSOR(A): ${v.professor}
COMPONENTE CURRICULAR: Educação Física
ANO: ${v.turma}
AULAS PREVISTAS: ${v.aulas}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OBJETIVOS / CAPACIDADES
(Competências amplas do componente)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Escreva 2-3 objetivos gerais amplos relacionados ao tema, focados no desenvolvimento humano, social e motor dos alunos]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONTEÚDOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

HABILIDADES                          | OBJETOS DE CONHECIMENTO
─────────────────────────────────────|────────────────────────────────────
[Liste 4-6 habilidades específicas   | [Liste os objetos de conhecimento
que os alunos desenvolverão,         | da BNCC relacionados ao tema,
incluindo códigos EF quando          | com seus respectivos códigos]
aplicável. Uma por linha.]           |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DESENVOLVIMENTO DAS ATIVIDADES
(Descrição de situações de ensino e aprendizagem para desenvolver as habilidades)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Para cada situação de aprendizagem, use este formato:]

─────────────────────────────────────────────
Situação de Aprendizagem [N] – [Nome da Situação]
Tempo: [X min]
─────────────────────────────────────────────

[Descrição detalhada e prática da situação. Inclua:]

ANTES DA ATIVIDADE:
[O que preparar, como organizar o espaço, como introduzir o tema, perguntas para problematizar]

DESENVOLVIMENTO:
[Passo a passo das atividades, organização dos alunos, variações possíveis]

APÓS A ATIVIDADE:
[Questões para reflexão, sistematização do aprendizado, o que registrar]

[Repita para cada situação de aprendizagem, sendo progressivas]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VALORES ATITUDINAIS ENVOLVIDOS
(O que se espera que o aluno desenvolva a partir das atividades)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• [Liste 4-5 valores atitudinais relevantes para o tema, ex: respeito, cooperação, autonomia...]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INSTRUMENTOS DE AVALIAÇÃO
(Mecanismos para avaliar a evolução da aprendizagem)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• [Liste 4-5 instrumentos de avaliação adequados ao tema e à faixa etária]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RECURSOS
(Meios necessários para o desenvolvimento das atividades)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• [Liste todos os recursos materiais e tecnológicos necessários]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REFERÊNCIAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ACRE. Secretaria de Estado de Educação, Cultura e Esporte. Proposta de Plano de Curso do Ensino Fundamental Anos Finais, 2023.
BRASIL. Ministério da Educação. Base Nacional Comum Curricular. Brasília: MEC, 2018.
[Adicione 2-3 referências relevantes sobre o tema específico]

Seja detalhado e prático. Cada situação de aprendizagem deve ter atividades concretas e executáveis. Use linguagem direta de professor para professor. As situações devem ser progressivas, conectadas entre si e adequadas ao ${v.turma} do Ensino Fundamental.`}
    />
  );
}
