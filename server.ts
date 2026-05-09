import 'dotenv/config';
import dotenv from 'dotenv';
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

// Carrega .env.local primeiro, depois .env
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // ── Rota proxy para Claude AI ─────────────────────────────────────────────
  app.post("/api/claude", async (req, res) => {
    try {
      const apiKey = process.env.VITE_ANTHROPIC_API_KEY || '';

      if (!apiKey || apiKey === 'SUA_CHAVE_AQUI') {
        console.error('VITE_ANTHROPIC_API_KEY não configurada!');
        return res.status(500).json({ error: 'API key não configurada' });
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(req.body),
      });

      const data = await response.json();
      console.log('Claude API status:', response.status);
      if (!response.ok) {
        console.error('Claude API error:', JSON.stringify(data));
      }
      return res.status(response.status).json(data);
    } catch (e: any) {
      console.error('Erro na rota /api/claude:', e.message);
      return res.status(500).json({ error: 'Falha ao chamar Claude API: ' + e.message });
    }
  });

  // ── Vite middleware (dev) ou arquivos estáticos (prod) ────────────────────
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('API Key configurada:', !!process.env.VITE_ANTHROPIC_API_KEY);
  });
}

startServer();
