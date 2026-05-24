import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
})

export async function semanticSearch(
  query: string,
  memos: Array<{ id: string; title: string; tags: string[] }>
): Promise<string[]> {
  const list = memos
    .map(m => `ID:${m.id} タイトル:${m.title} タグ:${m.tags.join(',')}`)
    .join('\n')

  const prompt = `以下のメモ一覧から「${query}」に意味的に関連するものを選び、関連度が高い順にIDをJSON配列で返してください。
キーワードが完全一致しなくても、意味や文脈が近いものを含めてください。
関連するものがなければ空配列[]を返してください。
JSONのみ返してください。例：["id1","id2","id3"]

メモ一覧：
${list}`

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 256,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content
    .filter(b => b.type === 'text')
    .map(b => (b as Anthropic.TextBlock).text)
    .join('')
    .trim()

  return JSON.parse(text) as string[]
}

export async function generateTags(title: string, content: string): Promise<string[]> {
  const prompt = `以下のメモに最適な日本語タグを5〜8個生成してください。
タグはキーワードレベルで短く、内容を的確に表すものにしてください。
JSON配列の文字列のみで返してください。例：["リライト","Pietro","補助金"]

タイトル：${title}
内容：${content}`

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 256,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content
    .filter(b => b.type === 'text')
    .map(b => (b as Anthropic.TextBlock).text)
    .join('')
    .trim()

  return JSON.parse(text) as string[]
}
