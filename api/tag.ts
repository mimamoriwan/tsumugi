export const config = { runtime: 'edge' }

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const { title, content } = await request.json()

  const prompt = `以下のメモに最適な日本語タグを5〜8個生成してください。
タグはキーワードレベルで短く、内容を的確に表すものにしてください。
JSON配列の文字列のみで返してください。例：["リライト","Pietro","補助金"]

タイトル：${title}
内容：${content}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return new Response(JSON.stringify({ error: err }), { status: 502, headers: { 'Content-Type': 'application/json' } })
  }

  const data = await res.json()
  const text = (data.content as Array<{ type: string; text: string }>)
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('')
    .trim()

  const tags = JSON.parse(text) as string[]
  return new Response(JSON.stringify({ tags }), { headers: { 'Content-Type': 'application/json' } })
}
