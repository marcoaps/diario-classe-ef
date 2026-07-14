import React from 'react';
import { IABase } from './IABase';

export function IAPlanejamentoAnual() {
  return (
    <IABase
      titulo="Gerador de Planejamento Anual"
      descricao="Planejamento anual bimestral completo com integração à BNCC"
      cor="bg-gradient-to-br from-indigo-600 to-indigo-500"
      campos={[
        { id: 'turma', label: 'Turma / Ano', tipo: 'select', opcoes: ['6º Ano', '7º Ano', '8º Ano', '9º Ano'] },
        { id: 'ano', label: 'Ano Letivo', tipo: 'text', placeholder: 'Ex: 2026' },
        { id: 'escola', label: 'Nome da Escola (opcional)', tipo: 'text', placeholder: 'Ex: Instituto Odilon Pratagi', required: false },
        { id: 'foco', label: 'Foco / Ênfase (opcional)', tipo: 'text', placeholder: 'Ex: Esportes coletivos, lutas, dança...', required: false },
      ]}
      gerarPrompt={v => `Você é um professor especialista em Educação Física do Ensino Fundamental.

Crie um PLANEJAMENTO ANUAL COMPLETO para:
- Turma: ${v.turma}
- Ano letivo: ${v.ano}
${v.escola ? `- Escola: ${v.escola}` : ''}
${v.foco ? `- Foco/ênfase: ${v.foco}` : ''}

O planejamento deve conter:
1. IDENTIFICAÇÃO (escola, disciplina, professor, turma, ano)
2. APRESENTAÇÃO DA DISCIPLINA (importância da EF no currículo)
3. OBJETIVOS GERAIS DO ANO
4. UNIDADES TEMÁTICAS BNCC trabalhadas

Para cada BIMESTRE (1º ao 4º):
- Período aproximado
- Unidade(s) temática(s) e objetos de conhecimento
- Habilidades BNCC (com códigos EF)
- Conteúdos específicos
- Atividades e estratégias principais
- Avaliações previstas
- Carga horária estimada

5. METODOLOGIA GERAL
6. CRITÉRIOS E INSTRUMENTOS DE AVALIAÇÃO
7. REFERÊNCIAS (BNCC, PCNs, legislação)

Seja completo e alinhado com a BNCC para o ${v.turma} do Ensino Fundamental.`}
    />
  );
}
