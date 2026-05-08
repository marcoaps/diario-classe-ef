import type { VercelRequest, VercelResponse } from `@vercel/node`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.ANTHROPIC_API_KEY || '',
                'anthropic-version': '2023-06-01',
                'anthropic-beta': 'pdfs-2024-09-25'
            },
            body: JSON.stringify(req.body)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Anthropic API error:', response.status, data);
        }

        return res.status(response.status).json(data);

    } catch (e) {
        console.error('Proxy error:', e);
        return res.status(500).json({ error: String(e) });
    }
}
