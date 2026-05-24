import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
})

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
