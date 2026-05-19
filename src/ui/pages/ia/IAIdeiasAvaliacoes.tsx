import React from 'react';
import { IABase } from './IABase';

export function IAIdeiasAvaliacoes() {
  return (
    <IABase
      titulo="Ideias para Avaliações Adaptadas"
      descricao="Estratégias criativas de avaliação adaptadas ao perfil dos alunos"
      cor="bg-gradient-to-br from-yellow-500 to-amber-400"
      campos={[
        { id: 'turma', label: 'Turma / Ano', tipo: 'select', opcoes: ['6º Ano', '7º Ano', '8º Ano', '9º Ano'] },
        { id: 'conteudo', label: 'Conteúdo / Unidade Temática', tipo: 'text', placeholder: 'Ex: Esportes de invasão, Ginástica, Dança...' },
        { id: 'perfil', label: 'Perfil da Turma', tipo: 'select', opcoes: [
          'Turma regular',
          'Turma com alunos com NEE',
          'Turma com baixo engajamento',
          'Turma muito heterogênea',
          'Turma com dificuldades motoras',
        ]},
        { id: 'quantidade', label: 'Quantidade de Ideias', tipo: 'select', opcoes: ['5 ideias', '8 ideias', '10 ideias'] },
        { id: 'instrumento', label: 'Tipo de Avaliação (opcional)', tipo: 'select', opcoes: ['', 'Prática/Motora', 'Escrita', 'Autoavaliação', 'Portfólio', 'Observação', 'Misto'], required: false },
      ]}
      gerarPrompt={v => `Você é um professor especialista em Educação Física do Ensino Fundamental com foco em avaliação inclusiva.

Gere ${v.quantidade} CRIATIVAS E DIVERSIFICADAS para avaliação de Educação Física sobre:
- Conteúdo: ${v.conteudo}
- Turma: ${v.turma}
- Perfil: ${v.perfil}
${v.instrumento ? `- Tipo preferido: ${v.instrumento}` : ''}

Para cada ideia, apresente:

💡 IDEIA X: [Nome criativo da estratégia de avaliação]
📋 Como funciona (descrição detalhada):
🎯 O que avalia (habilidades e competências):
👥 Como adaptar para diferentes perfis de alunos:
⏱ Tempo necessário:
📦 Materiais necessários:
📊 Como registrar e pontuar:
✅ Critérios de avaliação sugeridos:
🔗 Habilidade BNCC relacionada:

As ideias devem ser:
- Inclusivas e adaptáveis
- Além da prova escrita tradicional
- Que valorizem o processo, não só o resultado
- Práticas e viáveis para uma escola pública

Ao final, inclua um MODELO DE RUBRICA DE AVALIAÇÃO geral que possa ser adaptado para qualquer uma das ideias.`}
    />
  );
}
