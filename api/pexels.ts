import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { query, imageUrl } = req.query;

  // Modo 1: buscar imagem por query no Pexels
  if (query) {
    try {
      const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(String(query))}&per_page=1&orientation=landscape`;
      const response = await fetch(url, {
        headers: { Authorization: process.env.PEXELS_API_KEY || '' },
      });
      const data = await response.json();
      return res.status(200).json(data);
    } catch (e) {
      return res.status(500).json({ error: String(e) });
    }
  }

  // Modo 2: baixar imagem e retornar base64 (para embutir no Word)
  if (imageUrl) {
    try {
      const response = await fetch(String(imageUrl));
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      return res.status(200).json({ base64, contentType });
    } catch (e) {
      return res.status(500).json({ error: String(e) });
    }
  }

  return res.status(400).json({ error: 'Parâmetro query ou imageUrl obrigatório' });
}
