import React from 'react';
import { supabase } from '../../data/supabase';

export function SystemReset() {
  async function limparHistorico() {
    const confirmar = window.confirm("ATENÇÃO: Apagar todo o histórico de frequência?\n\nTurmas e alunos NÃO serão afetados.");
    if (!confirmar) return;

    const resp = await fetch("https://rsifjxeqitgiecqwvien.supabase.co/rest/v1/frequencia?data=gte.2000-01-01", {
      method: "DELETE",
      headers: {
        "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzaWZqeGVxaXRnaWVjcXd2aWVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NDU3NjEsImV4cCI6MjA5MzUyMTc2MX0.MDZTmUKDNQgd_eNMBYcHw8wmoRTAeCgbmh6twOv4YRQ",
        "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzaWZqeGVxaXRnaWVjcXd2aWVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NDU3NjEsImV4cCI6MjA5MzUyMTc2MX0.MDZTmUKDNQgd_eNMBYcHw8wmoRTAeCgbmh6twOv4YRQ",
        "Content-Type": "application/json"
      }
    });

    if (resp.status === 204 || resp.ok) {
      alert("Histórico de frequência limpo com sucesso!");
    } else {
      const erro = await resp.text();
      alert("ERRO " + resp.status + ": " + erro);
    }
  }

  return (
    <div className="p-4 flex flex-col gap-6 font-sans">
      <div className="bg-surface border-b border-gray-200 -mx-4 -mt-4 px-4 py-4 mb-4">
         <h2 className="text-2xl font-bold tracking-tight text-primary-dark">Reset do Histórico</h2>
         <p className="text-sm text-gray-500 mt-1">Apague apenas o histórico de frequência do sistema.</p>
      </div>

      <div className="flex flex-col gap-4">
        <button 
          onClick={limparHistorico}
          className="w-full py-4 rounded-xl font-bold bg-white border-2 border-primary/20 text-primary shadow-sm active:scale-95 transition-all text-left px-5 flex flex-col justify-center"
        >
          <span className="text-lg">Limpar Histórico de Frequência</span>
          <span className="text-xs font-normal text-gray-500 mt-1">Apaga TODOS os registros da tabela "frequencia"</span>
        </button>
      </div>
    </div>
  );
}

