import { Router } from 'express';
import { z } from 'zod';

const r = Router();

const MsgSchema = z.object({
  role: z.enum(['user','assistant','system']),
  content: z.string().min(1)
});
const BodySchema = z.object({
  messages: z.array(MsgSchema).min(1),
});

r.post('/chat', async (req, res) => {
  const parse = BodySchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ success: false, error: 'Invalid payload' });

  const messages = parse.data.messages;
  const lastUser = [...messages].reverse().find(m => m.role === 'user')?.content || '';

  // If OPENAI_API_KEY is present, try a short completion; else echo
  const key = (process.env.OPENAI_API_KEY || '').trim();
  let reply = `Echo: ${lastUser}`;
  if (key) {
    try {
      // Lazy import to avoid hard dep if key is missing
      const fetch = (await import('node-fetch')).default as any;
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-4o-mini', messages })
      });
      const json = await resp.json();
      reply = json?.choices?.[0]?.message?.content || reply;
    } catch (e: any) {
      reply = `Assistant: ${lastUser}`; // graceful fallback
    }
  }

  res.json({ success: true, data: { reply } });
});

export default r;
