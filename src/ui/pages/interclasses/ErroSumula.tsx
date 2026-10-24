import { Component, type ReactNode } from 'react';

// Se a súmula quebrar ao desenhar, mostra o erro na tela (em vez de ficar tudo em
// branco) — o professor está no meio de um jogo e precisa saber o que houve.
export class ErroSumula extends Component<{ children: ReactNode }, { erro: Error | null }> {
  state = { erro: null as Error | null };
  static getDerivedStateFromError(erro: Error) { return { erro }; }
  componentDidCatch(erro: Error) { console.error('Erro na súmula virtual:', erro); }
  render() {
    if (!this.state.erro) return this.props.children;
    return (
      <div className="fixed inset-0 z-[70] bg-white p-5 overflow-auto text-sm">
        <h3 className="font-bold text-red-600 mb-2">A súmula deu erro ao abrir</h3>
        <p className="mb-2 text-gray-600">Os lances já anotados continuam guardados no aparelho. Mande esta mensagem para o suporte:</p>
        <pre className="whitespace-pre-wrap text-xs bg-red-50 border border-red-200 rounded-lg p-3">{String(this.state.erro.stack || this.state.erro.message)}</pre>
      </div>
    );
  }
}
