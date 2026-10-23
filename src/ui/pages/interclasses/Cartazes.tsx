import { Download, FileText, Image as ImagemIcon } from 'lucide-react';

// Arquivos fixos em public/interclasses/cartazes. Se o arquivo for refeito com o mesmo
// nome, trocar VERSAO para o navegador (e o service worker) não servirem a cópia antiga.
const VERSAO = '20261023';
const BASE = '/interclasses/cartazes';

interface Arquivo { rotulo: string; arquivo: string; tipo: 'png' | 'pdf' }
interface Cartaz { titulo: string; descricao: string; previa: string; arquivos: Arquivo[] }

const CARTAZES: Cartaz[] = [
  {
    titulo: 'Cartaz — Final do Interclasses 2026',
    descricao: 'Divulgação da final (sexta 23/10). Imagem 4:5 para redes/WhatsApp e PDF A4 para imprimir.',
    previa: 'cartaz-final-4x5.png',
    arquivos: [
      { rotulo: 'Imagem 4:5 (redes)', arquivo: 'cartaz-final-4x5.png', tipo: 'png' },
      { rotulo: 'PDF A4 (imprimir)', arquivo: 'cartaz-final-a4.pdf', tipo: 'pdf' },
    ],
  },
  {
    titulo: 'Cronograma da manhã — Final',
    descricao: 'Programação para a direção: Queimada festiva, Voleibol e finais de Futsal (07:30 às 11:00).',
    previa: 'cronograma-manha.png',
    arquivos: [
      { rotulo: 'PDF A4', arquivo: 'cronograma-manha.pdf', tipo: 'pdf' },
      { rotulo: 'Imagem', arquivo: 'cronograma-manha.png', tipo: 'png' },
    ],
  },
];

const url = (arquivo: string) => `${BASE}/${arquivo}?v=${VERSAO}`;

export function Cartazes() {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-gray-500">
        Cartazes e documentos do Interclasses para ver e baixar. O cartaz do dia com placar sai pelo botão "Cartaz A4 para o mural", na aba Cronograma.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {CARTAZES.map(c => (
          <div key={c.titulo} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
            <a href={url(c.previa)} target="_blank" rel="noreferrer" className="bg-gray-50 border-b border-gray-100 flex items-center justify-center p-3">
              <img src={url(c.previa)} alt={c.titulo} className="max-h-72 w-auto rounded-lg shadow" loading="lazy" />
            </a>
            <div className="p-4 flex flex-col gap-3">
              <div>
                <h3 className="font-bold text-on-surface text-sm">{c.titulo}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{c.descricao}</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                {c.arquivos.map(a => (
                  <a key={a.arquivo} href={url(a.arquivo)} download={a.arquivo}
                     className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:opacity-90">
                    {a.tipo === 'pdf' ? <FileText className="w-4 h-4" /> : <ImagemIcon className="w-4 h-4" />}
                    {a.rotulo}
                    <Download className="w-3.5 h-3.5 opacity-80" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
