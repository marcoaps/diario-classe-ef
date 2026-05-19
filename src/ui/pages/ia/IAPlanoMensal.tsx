import React from 'react';
import { IABase } from './IABase';

export function IAPlanoMensal() {
  return (
    <IABase
      titulo="Gerador de Plano Mensal"
      descricao="Planejamento mensal organizado semana a semana com objetivos e atividades"
      cor="bg-gradient-to-br from-violet-600 to-violet-500"
      campos={[
        { id: 'turma', label: 'Turma / Ano', tipo: 'select', opcoes: ['6º Ano', '7º Ano', '8º Ano', '9º Ano'] },
        { id: 'mes', label: 'Mês', tipo: 'select', opcoes: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'] },
        { id: 'ano', label: 'Ano', tipo: 'text', placeholder: 'Ex: 2026' },
        { id: 'unidade', label: 'Unidade Temática', tipo: 'text', placeholder: 'Ex: Esportes de Rede/Parede, Ginástica...' },
        { id: 'aulasSemana', label: 'Aulas por Semana', tipo: 'select', opcoes: ['1 aula', '2 aulas', '3 aulas'] },
      ]}
      gerarPrompt={v => `Você é um professor especialista em Educação Física do Ensino Fundamental.

Crie um PLANO MENSAL DETALHADO para:
- Turma: ${v.turma}
- Mês: ${v.mes}/${v.ano}
- Unidade Temática: ${v.unidade}
- Frequência: ${v.aulasSemana} por semana

O plano mensal deve conter:

1. CABEÇALHO (escola, disciplina, professor, turma, mês/ano)
2. UNIDADE TEMÁTICA E JUSTIFICATIVA
3. OBJETIVOS DO MÊS
4. HABILIDADES BNCC trabalhadas no mês (com códigos EF)

5. ORGANIZAÇÃO SEMANAL — para cada semana:
   📅 Semana X (datas aproximadas)
   - Conteúdo da semana
   - Atividades de cada aula (descrição resumida)
   - Recursos necessários
   - Habilidade BNCC foco

6. AVALIAÇÃO DO MÊS (instrumentos e critérios)
7. OBSERVAÇÕES E DATAS IMPORTANTES

Seja organizado e visual — use formatação clara com separação por semanas.`}
    />
  );
}
