import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, type Memo } from './lib/supabase'
import { generateTags, semanticSearch } from './lib/tagger'
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
  const [filterTag, setFilterTag] = useState<string | null>(null)
  const displayedMemos = filterTag ? memos.filter(m => m.tags.includes(filterTag)) : memos

  // --- 詳細モーダル ---
  const [selectedMemo, setSelectedMemo] = useState<Memo | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isModalFirstRender = useRef(false)

  function openModal(memo: Memo) {
    isModalFirstRender.current = true
    setSelectedMemo(memo)
    setEditTitle(memo.title)
    setEditContent(memo.content)
    setAutoSaveStatus('idle')
  }

  function closeModal() {
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current)
      autoSaveTimer.current = null
    }
    setSelectedMemo(null)
    setAutoSaveStatus('idle')
  }

  async function handleModalDelete() {
    if (!selectedMemo) return
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    await supabase.from('memos').delete().eq('id', selectedMemo.id)
    closeModal()
    fetchMemos()
  }

  useEffect(() => {
    if (!selectedMemo) return
    if (isModalFirstRender.current) {
      isModalFirstRender.current = false
      return
    }

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    const memoId = selectedMemo.id
    const titleToSave = editTitle
    const contentToSave = editContent

    autoSaveTimer.current = setTimeout(async () => {
      setAutoSaveStatus('saving')
      await supabase
        .from('memos')
        .update({ title: titleToSave.trim(), content: contentToSave.trim(), updated_at: new Date().toISOString() })
        .eq('id', memoId)
      setAutoSaveStatus('saved')
      fetchMemos()
      setTimeout(() => setAutoSaveStatus(s => s === 'saved' ? 'idle' : s), 2000)
    }, 1500)

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    }
  }, [editTitle, editContent, selectedMemo])

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
  const [searchMode, setSearchMode] = useState<'keyword' | 'ai'>('keyword')

  const hasApiKey = !!import.meta.env.VITE_ANTHROPIC_API_KEY

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

  async function handleAiSearch() {
    if (!keyword.trim()) return
    setSearching(true)
    const { data, error } = await supabase
      .from('memos')
      .select('id, title, tags')
      .order('created_at', { ascending: false })
    if (error || !data) { setSearching(false); return }

    const ids = await semanticSearch(keyword.trim(), data as Array<{ id: string; title: string; tags: string[] }>)

    const { data: allMemos } = await supabase.from('memos').select('*')
    setSearching(false)
    if (!allMemos) return
    const memoMap = new Map((allMemos as Memo[]).map(m => [m.id, m]))
    setResults(ids.flatMap(id => memoMap.has(id) ? [memoMap.get(id)!] : []))
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
            {filterTag && (
              <div className="tag-filter-bar">
                <span># {filterTag} で絞り込み中</span>
                <button className="tag-filter-clear" onClick={() => setFilterTag(null)}>× クリア</button>
              </div>
            )}
            <div className="list-header">
              <span className="list-count">{displayedMemos.length} 件</span>
              <button className="btn-secondary" onClick={fetchMemos} disabled={loadingList}>
                {loadingList ? '読込中...' : '更新'}
              </button>
            </div>
            {loadingList && <p className="loading">読み込み中...</p>}
            {!loadingList && displayedMemos.length === 0 && <p className="empty">メモがありません</p>}
            <ul className="memo-list">
              {displayedMemos.map(m => (
                <li key={m.id} className="memo-item memo-item-clickable" onClick={() => openModal(m)}>
                  <div className="memo-title">{m.title}</div>
                  <div className="memo-meta">
                    <span className="memo-date">{formatDate(m.created_at)}</span>
                    {m.tags.length > 0 && (
                      <span className="memo-tags">
                        {m.tags.map(t => (
                          <span
                            key={t}
                            className={`tag tag-clickable${filterTag === t ? ' tag-active' : ''}`}
                            onClick={e => { e.stopPropagation(); setFilterTag(t) }}
                          >{t}</span>
                        ))}
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
            <div className="search-mode-row">
              <button
                className={searchMode === 'keyword' ? 'mode-btn active' : 'mode-btn'}
                onClick={() => setSearchMode('keyword')}
              >キーワード</button>
              <button
                className={searchMode === 'ai' ? 'mode-btn active' : 'mode-btn'}
                onClick={() => setSearchMode('ai')}
                disabled={!hasApiKey}
                title={!hasApiKey ? '（PCでのみ利用可）' : undefined}
              >AIで探す</button>
              {!hasApiKey && <span className="mode-hint">（PCでのみ利用可）</span>}
            </div>
            <div className="search-row">
              <input
                className="search-input"
                type="text"
                placeholder="キーワードを入力..."
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (searchMode === 'ai' ? handleAiSearch() : handleSearch())}
              />
              <button
                className="btn-primary"
                onClick={searchMode === 'ai' ? handleAiSearch : handleSearch}
                disabled={searching}
              >
                {searching ? '検索中...' : searchMode === 'ai' ? 'AIで探す' : '検索'}
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

      {selectedMemo && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <input
                className="modal-title-input"
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
              />
              {autoSaveStatus === 'saving' && <span className="autosave-status saving">保存中...</span>}
              {autoSaveStatus === 'saved' && <span className="autosave-status saved">✓ 保存済み</span>}
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <div className="modal-meta">
              <span className="memo-date">{formatDate(selectedMemo.created_at)}</span>
              {selectedMemo.tags.length > 0 && (
                <span className="memo-tags">
                  {selectedMemo.tags.map(t => <span key={t} className="tag">{t}</span>)}
                </span>
              )}
            </div>
            <textarea
              className="modal-content-input"
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
            />
            <div className="modal-footer">
              <button className="btn-danger" onClick={handleModalDelete}>削除</button>
              <button className="btn-secondary" onClick={closeModal}>閉じる</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
