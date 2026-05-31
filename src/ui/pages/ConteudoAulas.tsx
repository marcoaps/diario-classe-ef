import { useState, useEffect } from 'react';
import { BookOpen, Plus, Save, Loader2, FileDown, Trash2, ChevronDown } from 'lucide-react';
import { supabase } from '../../data/supabase';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ConteudoAula {
  id: string;
  turma_id: string;
  data: string;
  conteudo: string;
  created_at: string;
}

interface Props {
  turmaId: string;
  turmaNome: string;
}

export function ConteudoAulas({ turmaId, turmaNome }: Props) {
  const [registros, setRegistros] = useState<ConteudoAula[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form novo registro
  const [novaData, setNovaData] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [novoConteudo, setNovoConteudo] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showListaSugestoes, setShowListaSugestoes] = useState(false);

  // Filtro PDF
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [gerandoPdf, setGerandoPdf] = useState(false);

  // Lista unica de conteudos anteriores (sem duplicatas)
  const conteudosAnteriores = Array.from(
    new Set(registros.map(r => r.conteudo))
  );

  useEffect(() => {
    if (!turmaId) return;
    carregar();
  }, [turmaId]);

  async function carregar() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('conteudo_aulas')
        .select('*')
        .eq('turma_id', turmaId)
        .order('data', { ascending: false });
      if (error) throw error;
      setRegistros(data || []);
    } catch (err) {
      console.error('Erro ao carregar conteudos:', err);
    } finally {
      setLoading(false);
    }
  }

  async function salvar() {
    if (!novoConteudo.trim() || !novaData) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('conteudo_aulas').insert({
        turma_id: turmaId,
        data: novaData,
        conteudo: novoConteudo.trim(),
      });
      if (error) throw error;
      setNovoConteudo('');
      setShowForm(false);
      await carregar();
    } catch (err) {
      alert('Erro ao salvar conteudo.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este registro?')) return;
    try {
      const { error } = await supabase.from('conteudo_aulas').delete().eq('id', id);
      if (error) throw error;
      setRegistros(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      alert('Erro ao excluir.');
    }
  }

  function formatarData(dataStr: string) {
    try {
      return format(parseISO(dataStr), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return dataStr;
    }
  }

  function formatarDataExtenso(dataStr: string) {
    try {
      return format(parseISO(dataStr), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    } catch {
      return dataStr;
    }
  }

  async function gerarPdf() {
    const registrosFiltrados = registros
      .filter(r => {
        if (dataInicio && r.data < dataInicio) return false;
        if (dataFim && r.data > dataFim) return false;
        return true;
      })
      .sort((a, b) => a.data.localeCompare(b.data));

    if (registrosFiltrados.length === 0) {
      alert('Nenhum registro no periodo selecionado.');
      return;
    }

    setGerandoPdf(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      const pW = 210;
      const pH = 297;
      const mLeft = 15;
      const mRight = 15;
      const mTop = 15;
      const usableW = pW - mLeft - mRight;

      // Cores
      const azul = '#3B82F6';
      const cinzaClaro = '#F3F4F6';
      const cinzaBorda = '#D1D5DB';
      const textEscuro = '#1F2937';
      const textMedio = '#6B7280';
      const roxo = '#7C3AED';

      let y = mTop;

      // Cabecalho
      doc.setFillColor(azul);
      doc.rect(mLeft, y, usableW, 12, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(255, 255, 255);
      doc.text('DISCIPLINA: Educacao Fisica', mLeft + 4, y + 8);
      y += 12;

      // Turma e periodo
      doc.setFillColor(cinzaClaro);
      doc.rect(mLeft, y, usableW, 9, 'F');
      doc.setDrawColor(cinzaBorda);
      doc.rect(mLeft, y, usableW, 9, 'S');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(textMedio);
      const periodoTexto = dataInicio && dataFim
        ? `Periodo: ${formatarData(dataInicio)} a ${formatarData(dataFim)}`
        : `Turma: ${turmaNome}`;
      doc.text(`Turma: ${turmaNome}     ${periodoTexto}`, mLeft + 4, y + 6);
      y += 9 + 4;

      // Registros
      const alturaLinha = 24;
      const colunaConteudo = usableW * 0.72;
      const colunaData = usableW * 0.28;

      // Header da tabela
      doc.setFillColor(azul);
      doc.rect(mLeft, y, colunaConteudo, 8, 'F');
      doc.rect(mLeft + colunaConteudo, y, colunaData, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text('Conteudo', mLeft + 4, y + 5.5);
      doc.text('Data', mLeft + colunaConteudo + 4, y + 5.5);
      y += 8;

      registrosFiltrados.forEach((reg, idx) => {
        // Verifica se precisa nova pagina
        if (y + alturaLinha > pH - mTop - 20) {
          doc.addPage();
          y = mTop;
          // Repete cabecalho simplificado
          doc.setFillColor(azul);
          doc.rect(mLeft, y, usableW, 8, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(255, 255, 255);
          doc.text('DISCIPLINA: Educacao Fisica', mLeft + 4, y + 5.5);
          y += 8 + 4;
          // Repete header
          doc.setFillColor(azul);
          doc.rect(mLeft, y, colunaConteudo, 8, 'F');
          doc.rect(mLeft + colunaConteudo, y, colunaData, 8, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(255, 255, 255);
          doc.text('Conteudo', mLeft + 4, y + 5.5);
          doc.text('Data', mLeft + colunaConteudo + 4, y + 5.5);
          y += 8;
        }

        const bg = idx % 2 === 0 ? '#FFFFFF' : cinzaClaro;
        doc.setFillColor(bg);
        doc.rect(mLeft, y, colunaConteudo, alturaLinha, 'F');
        doc.rect(mLeft + colunaConteudo, y, colunaData, alturaLinha, 'F');
        doc.setDrawColor(cinzaBorda);
        doc.rect(mLeft, y, colunaConteudo, alturaLinha, 'S');
        doc.rect(mLeft + colunaConteudo, y, colunaData, alturaLinha, 'S');

        // Conteudo (texto com wrap)
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(textEscuro);
        const linhas = doc.splitTextToSize(reg.conteudo, colunaConteudo - 8);
        doc.text(linhas.slice(0, 2), mLeft + 4, y + 8);

        // Data
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(textMedio);
        doc.text('Data:', mLeft + colunaConteudo + 4, y + 7);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(roxo);
        doc.text(formatarData(reg.data), mLeft + colunaConteudo + 4, y + 14);

        y += alturaLinha;
      });

      // Linhas em branco extras (igual ao PDF de modelo)
      const linhasExtras = Math.max(0, 8 - registrosFiltrados.length);
      for (let i = 0; i < linhasExtras && y + alturaLinha < pH - 30; i++) {
        if (y + alturaLinha > pH - mTop - 20) break;
        const bg = (registrosFiltrados.length + i) % 2 === 0 ? '#FFFFFF' : cinzaClaro;
        doc.setFillColor(bg);
        doc.rect(mLeft, y, colunaConteudo, alturaLinha, 'F');
        doc.rect(mLeft + colunaConteudo, y, colunaData, alturaLinha, 'F');
        doc.setDrawColor(cinzaBorda);
        doc.rect(mLeft, y, colunaConteudo, alturaLinha, 'S');
        doc.rect(mLeft + colunaConteudo, y, colunaData, alturaLinha, 'S');
        y += alturaLinha;
      }

      // Assinatura
      y += 8;
      if (y + 15 > pH - 10) {
        doc.addPage();
        y = mTop;
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(textEscuro);
      doc.text('Assinatura do professor: _____________________________________________', mLeft, y + 6);

      // Download
      const nomeArquivo = `conteudo_${turmaNome}_${format(new Date(), 'yyyy-MM')}.pdf`;
      doc.save(nomeArquivo);
    } catch (err) {
      alert('Erro ao gerar PDF.');
      console.error(err);
    } finally {
      setGerandoPdf(false);
    }
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 sticky top-0 bg-background/90 backdrop-blur-md z-10 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-2xl font-bold tracking-tight text-primary-dark">
            Conteudo das Aulas
          </h2>
          <button
            onClick={() => { setShowForm(v => !v); setShowListaSugestoes(false); }}
            className="flex items-center gap-1.5 bg-primary text-white text-sm font-semibold px-3 py-2 rounded-xl shadow hover:bg-primary-dark transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Nova aula
          </button>
        </div>

        {/* Formulario novo registro */}
        {showForm && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-3">
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs font-medium text-gray-600 mb-1 block">Data da aula</label>
                <input
                  type="date"
                  value={novaData}
                  onChange={e => setNovaData(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none"
                />
              </div>
            </div>

            {/* Selecionar conteudo anterior */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Conteudo</label>
              <div className="relative">
                <textarea
                  value={novoConteudo}
                  onChange={e => setNovoConteudo(e.target.value)}
                  placeholder="Digite o conteudo da aula..."
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none resize-none"
                />
                {conteudosAnteriores.length > 0 && (
                  <button
                    onClick={() => setShowListaSugestoes(v => !v)}
                    className="mt-1 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    <ChevronDown className="w-3 h-3" />
                    Selecionar conteudo anterior
                  </button>
                )}
              </div>

              {/* Lista de sugestoes */}
              {showListaSugestoes && conteudosAnteriores.length > 0 && (
                <div className="mt-1 border border-gray-200 rounded-lg bg-white shadow-lg max-h-48 overflow-y-auto">
                  {conteudosAnteriores.map((c, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setNovoConteudo(c);
                        setShowListaSugestoes(false);
                      }}
                      className="w-full text-left px-3 py-2.5 text-sm hover:bg-blue-50 border-b border-gray-100 last:border-0 text-gray-700"
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={salvar}
                disabled={saving || !novoConteudo.trim()}
                className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold text-sm py-2.5 rounded-xl transition-all active:scale-95"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
              <button
                onClick={() => { setShowForm(false); setNovoConteudo(''); setShowListaSugestoes(false); }}
                className="px-4 py-2.5 rounded-xl border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Lista de registros */}
      <div className="flex-1 overflow-y-auto p-4 pb-36 space-y-2">
        {loading ? (
          <div className="flex gap-2 items-center justify-center p-8 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Carregando...</span>
          </div>
        ) : registros.length === 0 ? (
          <div className="text-center text-gray-400 py-16">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhum conteudo registrado</p>
            <p className="text-sm mt-1">Clique em "Nova aula" para comecar</p>
          </div>
        ) : (
          registros.map(reg => (
            <div
              key={reg.id}
              className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm flex items-start justify-between gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-blue-600 mb-1">
                  {formatarDataExtenso(reg.data)}
                </p>
                <p className="text-sm text-gray-800 leading-relaxed">{reg.conteudo}</p>
              </div>
              <button
                onClick={() => excluir(reg.id)}
                className="shrink-0 p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Botao PDF fixo no rodape */}
      <div className="fixed bottom-20 left-4 right-4 max-w-md mx-auto z-20 space-y-2">
        {/* Filtros periodo */}
        <div className="bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm flex items-center gap-2">
          <span className="text-xs text-gray-500 font-medium whitespace-nowrap">Periodo:</span>
          <input
            type="date"
            value={dataInicio}
            onChange={e => setDataInicio(e.target.value)}
            className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-400"
          />
          <span className="text-xs text-gray-400">ate</span>
          <input
            type="date"
            value={dataFim}
            onChange={e => setDataFim(e.target.value)}
            className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>

        <button
          onClick={gerarPdf}
          disabled={gerandoPdf || registros.length === 0}
          className="w-full h-12 bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white font-bold text-sm rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95"
        >
          {gerandoPdf ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileDown className="w-5 h-5" />}
          {gerandoPdf ? 'Gerando PDF...' : 'Gerar Folha de Conteudo (PDF)'}
        </button>
      </div>
    </div>
  );
}
