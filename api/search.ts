export const config = { runtime: 'edge' }

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const { query, memos } = await request.json() as {
    query: string
    memos: Array<{ id: string; title: string; tags: string[] }>
  }

  const list = memos
    .map(m => `ID:${m.id} タイトル:${m.title} タグ:${m.tags.join(',')}`)
    .join('\n')

  const prompt = `以下のメモ一覧から「${query}」に意味的に関連するものを選び、関連度が高い順にIDをJSON配列で返してください。
キーワードが完全一致しなくても、意味や文脈が近いものを含めてください。
関連するものがなければ空配列[]を返してください。
JSONのみ返してください。例：["id1","id2","id3"]

メモ一覧：
${list}`

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

  const ids = JSON.parse(text) as string[]
  return new Response(JSON.stringify({ ids }), { headers: { 'Content-Type': 'application/json' } })
}
