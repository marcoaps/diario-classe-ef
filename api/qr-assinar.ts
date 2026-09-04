// ============================================================================
// Assina e verifica o payload do QR Code das folhas de resposta do Corretor
// de Provas. A assinatura HMAC-SHA256 usa um segredo que existe SOMENTE
// aqui no backend (variável de ambiente QR_SECRET, nunca enviada ao
// front-end) — isso é o que permite ao sistema rejeitar QR Codes
// adulterados: qualquer alteração no payload invalida a assinatura.
//
// Modo 1 (assinar): POST { acao: 'assinar', payload: {...} }
//   -> { payload, assinatura }
// Modo 2 (verificar): POST { acao: 'verificar', payload: {...}, assinatura }
//   -> { valido: boolean }
// ============================================================================
import crypto from 'crypto';

function assinar(payloadStr: string, segredo: string): string {
  return crypto.createHmac('sha256', segredo).update(payloadStr).digest('hex');
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const segredo = process.env.QR_SECRET;
  if (!segredo) {
    return res.status(500).json({ error: 'QR_SECRET não configurado no servidor. Defina essa variável de ambiente no Vercel antes de gerar ou ler folhas de resposta.' });
  }

  const { acao, payload, assinatura } = req.body || {};
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'payload é obrigatório' });
  }

  // Serialização estável (chaves ordenadas) para o hash bater sempre igual
  // independente da ordem em que o objeto foi montado no cliente.
  const payloadStr = JSON.stringify(payload, Object.keys(payload).sort());

  if (acao === 'assinar') {
    return res.status(200).json({ payload, assinatura: assinar(payloadStr, segredo) });
  }

  if (acao === 'verificar') {
    if (!assinatura) return res.status(400).json({ error: 'assinatura é obrigatória para verificar' });
    const esperada = assinar(payloadStr, segredo);
    const valido = esperada.length === String(assinatura).length
      && crypto.timingSafeEqual(Buffer.from(esperada), Buffer.from(String(assinatura)));
    return res.status(200).json({ valido });
  }

  return res.status(400).json({ error: 'acao deve ser "assinar" ou "verificar"' });
}
