// Monitoramento de erros (Sentry, plano grátis).
// Só liga se a variável VITE_SENTRY_DSN estiver configurada na Vercel;
// sem ela, nada é enviado e o app funciona igual.
import * as Sentry from '@sentry/react';

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
export const monitoramentoAtivo = !!dsn;

export function iniciarMonitoramento() {
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // Só erros; sem medição de desempenho (economiza a cota grátis).
    tracesSampleRate: 0,
    beforeBreadcrumb(breadcrumb) {
      // Logs do console podem conter nomes de alunos: não vão para o Sentry.
      if (breadcrumb.category === 'console') return null;
      return breadcrumb;
    },
    ignoreErrors: [
      // Falhas de rede comuns em celular (sem sinal na quadra) não são bugs.
      'Failed to fetch',
      'NetworkError when attempting to fetch resource.',
      'Load failed',
    ],
  });
}

/** Handlers para o createRoot do React 19 (erros de renderização). */
export function opcoesRaizReact() {
  if (!dsn) return {};
  return {
    onUncaughtError: Sentry.reactErrorHandler(),
    onCaughtError: Sentry.reactErrorHandler(),
    onRecoverableError: Sentry.reactErrorHandler(),
  };
}
