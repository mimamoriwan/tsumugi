import { useState, useEffect, useCallback } from 'react'
import { supabase, type Memo } from './lib/supabase'
import { generateTags } from './lib/tagger'
import './App.css'

type Tab = 'write' | 'list' | 'search'

function todayPrefix(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}_`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function App() {
  const [tab, setTab] = useState<Tab>('write')

  // --- 書くタブ ---
  const [title, setTitle] = useState(todayPrefix())
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  async function handleSave() {
    if (!title.trim() || !content.trim()) {
      setSaveMsg('タイトルと本文を入力してください')
      return
    }
    setSaving(true)
    setSaveMsg('')

    // 1. Supabase に保存して id を取得
    const { data: inserted, error } = await supabase
      .from('memos')
      .insert({ title: title.trim(), content: content.trim() })
      .select('id')
      .single()

    if (error || !inserted) {
      setSaving(false)
      setSaveMsg('保存に失敗しました: ' + (error?.message ?? ''))
      return
    }

    setSaveMsg('タグを生成中...')

    // 2. Claude API でタグ生成
    try {
      const tags = await generateTags(title.trim(), content.trim())
      await supabase.from('memos').update({ tags }).eq('id', inserted.id)
      setSaveMsg('保存しました（タグ付け完了）')
    } catch {
      setSaveMsg('保存しました（タグ生成に失敗）')
    }

    setSaving(false)
    setTitle(todayPrefix())
    setContent('')
  }

  // --- 一覧タブ ---
  const [memos, setMemos] = useState<Memo[]>([])
  const [loadingList, setLoadingList] = useState(false)

  const fetchMemos = useCallback(async () => {
    setLoadingList(true)
    const { data, error } = await supabase
      .from('memos')
      .select('*')
      .order('created_at', { ascending: false })
    setLoadingList(false)
    if (!error && data) setMemos(data as Memo[])
  }, [])

  useEffect(() => {
    if (tab === 'list') fetchMemos()
  }, [tab, fetchMemos])

  const [retagStatus, setRetagStatus] = useState<string | null>(null)

  useEffect(() => {
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
    if (!apiKey) return

    const retagUntagged = async () => {
      const { data: untagged, error } = await supabase
        .from('memos')
        .select('*')
        .eq('tags', '{}')
        .order('created_at', { ascending: false })

      if (error || !untagged || untagged.length === 0) return

      setRetagStatus(`タグなしメモ ${untagged.length} 件を自動タグ付け中...`)

      let done = 0
      for (const memo of untagged as Memo[]) {
        try {
          const tags = await generateTags(memo.title, memo.content)
          await supabase.from('memos').update({ tags }).eq('id', memo.id)
          done++
          setRetagStatus(`タグ付け中... ${done}/${untagged.length} 件完了`)
          setMemos(prev =>
            prev.map(m => m.id === memo.id ? { ...m, tags } : m)
          )
        } catch {
          // 1件失敗しても続行
        }
      }

      setRetagStatus(`✓ ${done} 件のタグ付けが完了しました`)
      setTimeout(() => setRetagStatus(null), 4000)
    }

    retagUntagged()
  }, [])

  // --- 探すタブ ---
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<Memo[]>([])
  const [searching, setSearching] = useState(false)

  async function handleSearch() {
    if (!keyword.trim()) return
    setSearching(true)
    const q = `%${keyword.trim()}%`
    const { data, error } = await supabase
      .from('memos')
      .select('*')
      .or(`title.ilike.${q},content.ilike.${q}`)
      .order('created_at', { ascending: false })
    setSearching(false)
    if (!error && data) setResults(data as Memo[])
  }

  return (
    <div className="app">
      <header className="header">
        <h1 className="logo">Tsumugi</h1>
        <nav className="tabs">
          <button className={tab === 'write' ? 'tab active' : 'tab'} onClick={() => setTab('write')}>書く</button>
          <button className={tab === 'list' ? 'tab active' : 'tab'} onClick={() => setTab('list')}>一覧</button>
          <button className={tab === 'search' ? 'tab active' : 'tab'} onClick={() => setTab('search')}>探す</button>
        </nav>
      </header>

      <main className="main">
        {tab === 'write' && (
          <div className="pane">
            <input
              className="title-input"
              type="text"
              placeholder="タイトル"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
            <textarea
              className="content-input"
              placeholder="ここに書く..."
              value={content}
              onChange={e => setContent(e.target.value)}
            />
            <div className="save-row">
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? '保存中...' : '保存'}
              </button>
              {saveMsg && <span className={saveMsg.startsWith('保存しました') ? 'msg ok' : 'msg err'}>{saveMsg}</span>}
            </div>
          </div>
        )}

        {tab === 'list' && (
          <div className="pane">
            {retagStatus && (
              <div className="retag-status">{retagStatus}</div>
            )}
            <div className="list-header">
              <span className="list-count">{memos.length} 件</span>
              <button className="btn-secondary" onClick={fetchMemos} disabled={loadingList}>
                {loadingList ? '読込中...' : '更新'}
              </button>
            </div>
            {loadingList && <p className="loading">読み込み中...</p>}
            {!loadingList && memos.length === 0 && <p className="empty">メモがありません</p>}
            <ul className="memo-list">
              {memos.map(m => (
                <li key={m.id} className="memo-item">
                  <div className="memo-title">{m.title}</div>
                  <div className="memo-meta">
                    <span className="memo-date">{formatDate(m.created_at)}</span>
                    {m.tags.length > 0 && (
                      <span className="memo-tags">
                        {m.tags.map(t => <span key={t} className="tag">{t}</span>)}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === 'search' && (
          <div className="pane">
            <div className="search-row">
              <input
                className="search-input"
                type="text"
                placeholder="キーワードを入力..."
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
              <button className="btn-primary" onClick={handleSearch} disabled={searching}>
                {searching ? '検索中...' : '検索'}
              </button>
            </div>
            {results.length > 0 && <p className="result-count">{results.length} 件見つかりました</p>}
            <ul className="memo-list">
              {results.map(m => (
                <li key={m.id} className="memo-item">
                  <div className="memo-title">{m.title}</div>
                  <div className="memo-meta">
                    <span className="memo-date">{formatDate(m.created_at)}</span>
                    {m.tags.length > 0 && (
                      <span className="memo-tags">
                        {m.tags.map(t => <span key={t} className="tag">{t}</span>)}
                      </span>
                    )}
                  </div>
                  <p className="memo-preview">{m.content.slice(0, 100)}{m.content.length > 100 ? '...' : ''}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  )
}
