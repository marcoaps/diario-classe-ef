import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {iniciarMonitoramento, opcoesRaizReact} from './monitoramento';
import {iniciarSincronizacaoAutomatica} from './data/offlineChamada';

iniciarMonitoramento();
// Envia as chamadas feitas sem internet assim que a conexão voltar.
iniciarSincronizacaoAutomatica();

createRoot(document.getElementById('root')!, opcoesRaizReact()).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
