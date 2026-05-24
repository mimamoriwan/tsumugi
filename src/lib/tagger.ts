export async function semanticSearch(
  query: string,
  memos: Array<{ id: string; title: string; tags: string[] }>
): Promise<string[]> {
  const res = await fetch('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, memos }),
  })
  if (!res.ok) throw new Error(`search API error: ${res.status}`)
  const { ids } = await res.json()
  return ids as string[]
}

export async function generateTags(title: string, content: string): Promise<string[]> {
  const res = await fetch('/api/tag', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content }),
  })
  if (!res.ok) throw new Error(`tag API error: ${res.status}`)
  const { tags } = await res.json()
  return tags as string[]
}
