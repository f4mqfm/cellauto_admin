import { useEffect, useMemo, useState } from 'react'
import {
  createList,
  createWord,
  deleteList,
  deleteWord,
  getList,
  listLists,
  listWords,
  updateList,
  updateWord,
  type WordItem,
  type WordList,
} from '../lib/api'

type Props = {
  token: string
}

export function ListsWordsAdmin(props: Props) {
  const { token } = props

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [lists, setLists] = useState<WordList[]>([])
  const [selectedListId, setSelectedListId] = useState<number | null>(null)
  const selectedList = useMemo(
    () => lists.find((l) => l.id === selectedListId) ?? null,
    [lists, selectedListId],
  )

  const [createListName, setCreateListName] = useState('')
  const [createListWords, setCreateListWords] = useState('')
  const [renameListName, setRenameListName] = useState('')

  const [words, setWords] = useState<WordItem[]>([])
  const [wordQuery, setWordQuery] = useState('')
  const [bulkWords, setBulkWords] = useState('')

  const [editWordId, setEditWordId] = useState<number | null>(null)
  const editWord = useMemo(() => words.find((w) => w.id === editWordId) ?? null, [words, editWordId])
  const [editWordValue, setEditWordValue] = useState('')
  const [draggingWordId, setDraggingWordId] = useState<number | null>(null)
  const [dragOverWordId, setDragOverWordId] = useState<number | null>(null)

  /** API: `position` majd `id` szerint. */
  function sortWords(items: WordItem[]): WordItem[] {
    return [...items].sort((a, b) => {
      const pa = typeof a.position === 'number' ? a.position : a.id
      const pb = typeof b.position === 'number' ? b.position : b.id
      if (pa !== pb) return pa - pb
      return a.id - b.id
    })
  }

  function nextWordPosition(list: WordItem[]): number {
    if (list.length === 0) return 0
    return Math.max(...list.map((w) => (typeof w.position === 'number' ? w.position : 0))) + 1
  }

  /** Kétlépcsős position frissítés — `UNIQUE(list_id, position)` ütközés elkerülése. */
  async function persistWordOrder(listId: number, ordered: WordItem[]) {
    const BASE = 100_000
    for (let i = 0; i < ordered.length; i++) {
      await updateWord(token, listId, ordered[i].id, { position: BASE + i })
    }
    for (let i = 0; i < ordered.length; i++) {
      await updateWord(token, listId, ordered[i].id, { position: i })
    }
  }

  const filteredWords = useMemo(() => {
    const q = wordQuery.trim().toLowerCase()
    if (!q) return words
    return words.filter((w) => w.word.toLowerCase().includes(q))
  }, [words, wordQuery])

  const canReorder = useMemo(
    () => wordQuery.trim().length === 0 && !busy && editWordId == null,
    [wordQuery, busy, editWordId],
  )

  async function refreshLists(keepSelection = true) {
    setError(null)
    setBusy(true)
    try {
      const data = await listLists(token)
      setLists(data)
      if (!keepSelection) return
      if (selectedListId == null) return
      if (!data.some((l) => l.id === selectedListId)) {
        setSelectedListId(null)
        setWords([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sikertelen betöltés')
    } finally {
      setBusy(false)
    }
  }

  async function refreshWords(listId: number) {
    setError(null)
    setBusy(true)
    try {
      // Prefer the dedicated endpoint, but tolerate the /lists/{id} response shape too.
      const data = await listWords(token, listId).catch(async () => {
        const full = await getList(token, listId)
        return full.words ?? []
      })
      setWords(sortWords(data))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sikertelen betöltés')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    void refreshLists(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    if (selectedListId == null) return
    void refreshWords(selectedListId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedListId, token])

  function parseWordsInput(raw: string): string[] {
    const parts = raw
      .trim()
      .split(/\s+/g)
      .map((w) => w.trim())
      .filter(Boolean)
      .filter((w) => w.length <= 255)
    return Array.from(new Set(parts))
  }

  function selectList(list: WordList) {
    setSelectedListId(list.id)
    setRenameListName(list.name)
    setEditWordId(null)
    setWordQuery('')
    setBulkWords('')
  }

  async function onDropReorder(fromId: number, toId: number) {
    if (!selectedList || fromId === toId) return
    const copy = sortWords(words.slice())
    const fromIdx = copy.findIndex((w) => w.id === fromId)
    const toIdx = copy.findIndex((w) => w.id === toId)
    if (fromIdx < 0 || toIdx < 0) return
    const [moved] = copy.splice(fromIdx, 1)
    copy.splice(toIdx, 0, moved)

    setBusy(true)
    try {
      await persistWordOrder(selectedList.id, copy)
      await refreshWords(selectedList.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sikertelen sorrend mentés')
      await refreshWords(selectedList.id)
    } finally {
      setBusy(false)
    }
  }

  async function submitCreateList(e: React.FormEvent) {
    e.preventDefault()
    const name = createListName.trim()
    if (!name) return
    const initialWords = parseWordsInput(createListWords)
    setError(null)
    setBusy(true)
    try {
      const created = await createList(token, { name })
      if (initialWords.length > 0) {
        const failed: string[] = []
        for (let i = 0; i < initialWords.length; i++) {
          const word = initialWords[i]
          try {
            await createWord(token, created.id, { word, position: i })
          } catch (err) {
            failed.push(word)
            void err
          }
        }
        if (failed.length > 0) {
          setError(
            `A lista létrejött, de néhány szó nem menthető (valószínű duplikátum vagy validáció): ${failed
              .slice(0, 12)
              .join(', ')}${failed.length > 12 ? '…' : ''}`,
          )
        }
      }

      setCreateListName('')
      setCreateListWords('')
      setLists((prev) => [created, ...prev])
      selectList(created)
      await refreshWords(created.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sikertelen létrehozás')
    } finally {
      setBusy(false)
    }
  }

  async function submitRenameList(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedList) return
    const name = renameListName.trim()
    if (!name) return
    setError(null)
    setBusy(true)
    try {
      const updated = await updateList(token, selectedList.id, { name })
      setLists((prev) => prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sikertelen mentés')
    } finally {
      setBusy(false)
    }
  }

  async function confirmAndDeleteList(list: WordList) {
    if (!confirm(`Biztosan törlöd a listát? (${list.name})`)) return
    setError(null)
    setBusy(true)
    try {
      await deleteList(token, list.id)
      setLists((prev) => prev.filter((l) => l.id !== list.id))
      if (selectedListId === list.id) {
        setSelectedListId(null)
        setWords([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sikertelen törlés')
    } finally {
      setBusy(false)
    }
  }

  async function submitAddWords(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedList) return
    const raw = bulkWords.trim()
    if (!raw) return
    const unique = parseWordsInput(raw)
    if (unique.length === 0) return

    setError(null)
    setBusy(true)
    try {
      const failed: string[] = []

      let pos = nextWordPosition(words)
      for (const word of unique) {
        try {
          await createWord(token, selectedList.id, { word, position: pos })
          pos += 1
        } catch (err) {
          failed.push(word)
          void err
        }
      }

      if (failed.length > 0) {
        setError(`Néhány szó nem menthető (valószínű duplikátum vagy validáció): ${failed.slice(0, 12).join(', ')}${failed.length > 12 ? '…' : ''}`)
      } else {
        setError(null)
      }

      setBulkWords('')
      await refreshWords(selectedList.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sikertelen hozzáadás')
    } finally {
      setBusy(false)
    }
  }

  function openEditWord(w: WordItem) {
    setEditWordId(w.id)
    setEditWordValue(w.word)
  }

  function closeEditWord() {
    setEditWordId(null)
  }

  function cancelEditWord() {
    setEditWordId(null)
    setEditWordValue('')
  }

  async function submitEditWord(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedList || !editWord) return
    const word = editWordValue.trim()
    if (!word) return
    setError(null)
    setBusy(true)
    try {
      const updated = await updateWord(token, selectedList.id, editWord.id, { word })
      setWords((prev) => sortWords(prev.map((x) => (x.id === updated.id ? updated : x))))
      cancelEditWord()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sikertelen mentés')
    } finally {
      setBusy(false)
    }
  }

  async function confirmAndDeleteWord(w: WordItem) {
    if (!selectedList) return
    if (!confirm(`Biztosan törlöd? (${w.word})`)) return
    setError(null)
    setBusy(true)
    try {
      await deleteWord(token, selectedList.id, w.id)
      if (editWordId === w.id) closeEditWord()
      const remaining = sortWords(words.filter((x) => x.id !== w.id))
      if (remaining.length > 0) await persistWordOrder(selectedList.id, remaining)
      await refreshWords(selectedList.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sikertelen törlés')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <div className="row row--spread">
        <h2>Szólisták</h2>
        <div className="row">
          <button className="counter" onClick={() => void refreshLists(true)} disabled={busy}>
            {busy ? 'Betöltés…' : 'Frissítés'}
          </button>
        </div>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <div className="grid2">
        <div>
          <h3>Listák</h3>

          <form onSubmit={submitCreateList} className="panel">
            <label className="field">
              <span className="label">Új lista neve</span>
              <input
                value={createListName}
                onChange={(e) => setCreateListName(e.target.value)}
                placeholder="pl. angol szavak"
                maxLength={255}
                required
              />
            </label>
            <label className="field">
              <span className="label">Szavak (szóköz vagy Enter elválasztó)</span>
              <textarea
                value={createListWords}
                onChange={(e) => setCreateListWords(e.target.value)}
                placeholder={'pl.\napple\nbanana orange\n\ncar'}
                rows={7}
                style={{ resize: 'vertical' }}
              />
            </label>
            <div className="row">
              <button className="primary" disabled={busy}>
                {busy ? 'Mentés…' : 'Létrehozás'}
              </button>
            </div>
          </form>

          <div className="tableWrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Név</th>
                  <th>Műveletek</th>
                </tr>
              </thead>
              <tbody>
                {lists.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <button
                        className={selectedListId === l.id ? 'menuItem menuItem--active' : 'menuItem'}
                        onClick={() => selectList(l)}
                        disabled={busy}
                        style={{ textAlign: 'left', width: '100%' }}
                      >
                        {l.name}
                      </button>
                    </td>
                    <td>
                      <div className="row">
                        <button className="danger" onClick={() => void confirmAndDeleteList(l)} disabled={busy}>
                          Törlés
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!busy && lists.length === 0 ? (
                  <tr>
                    <td colSpan={2}>Még nincs lista.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h3>Szavak{selectedList ? ` — ${selectedList.name}` : ''}</h3>

          {!selectedList ? (
            <div className="panel">
              <p>Válassz listát bal oldalt.</p>
            </div>
          ) : (
            <>
              <form onSubmit={submitRenameList} className="panel">
                <label className="field">
                  <span className="label">Lista neve</span>
                  <input
                    value={renameListName}
                    onChange={(e) => setRenameListName(e.target.value)}
                    maxLength={255}
                    required
                  />
                </label>
                <div className="row">
                  <button className="primary" disabled={busy}>
                    {busy ? 'Mentés…' : 'Átnevezés'}
                  </button>
                </div>
              </form>

              <form onSubmit={submitAddWords} className="panel">
                <label className="field">
                  <span className="label">Új szavak (szóköz vagy Enter elválasztó)</span>
                  <textarea
                    value={bulkWords}
                    onChange={(e) => setBulkWords(e.target.value)}
                    placeholder={'pl.\napple\nbanana orange\n\ncar'}
                    rows={7}
                    required
                    style={{ resize: 'vertical' }}
                  />
                </label>

                <label className="field">
                  <span className="label">Keresés a listában</span>
                  <input value={wordQuery} onChange={(e) => setWordQuery(e.target.value)} placeholder="pl. app" />
                </label>
                <div className="row">
                  <button className="primary" disabled={busy}>
                    {busy ? 'Mentés…' : 'Hozzáadás'}
                  </button>
                  <button
                    type="button"
                    className="counter"
                    onClick={() => void refreshWords(selectedList.id)}
                    disabled={busy}
                  >
                    {busy ? 'Betöltés…' : 'Szavak frissítése'}
                  </button>
                </div>
              </form>

              <div className="tableWrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th />
                      <th>Gen</th>
                      <th>Szó</th>
                      <th>Műveletek</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredWords.map((w) => (
                      <tr
                        key={w.id}
                        draggable={Boolean(selectedList && canReorder)}
                        onDragStart={(e) => {
                          if (!selectedList || !canReorder) return
                          setDraggingWordId(w.id)
                          setDragOverWordId(null)
                          try {
                            e.dataTransfer.effectAllowed = 'move'
                            e.dataTransfer.setData('text/plain', String(w.id))
                          } catch {
                            // ignore
                          }
                        }}
                        onDragOver={(e) => {
                          if (!selectedList || !canReorder) return
                          e.preventDefault()
                          setDragOverWordId(w.id)
                          try {
                            e.dataTransfer.dropEffect = 'move'
                          } catch {
                            // ignore
                          }
                        }}
                        onDragLeave={() => {
                          if (!selectedList || !canReorder) return
                          setDragOverWordId((cur) => (cur === w.id ? null : cur))
                        }}
                        onDrop={(e) => {
                          if (!selectedList || !canReorder) return
                          e.preventDefault()
                          const raw = (() => {
                            try {
                              return e.dataTransfer.getData('text/plain')
                            } catch {
                              return ''
                            }
                          })()
                          const fromId = Number(raw)
                          if (!Number.isFinite(fromId)) return
                          void onDropReorder(fromId, w.id)
                          setDraggingWordId(null)
                          setDragOverWordId(null)
                        }}
                        onDragEnd={() => {
                          setDraggingWordId(null)
                          setDragOverWordId(null)
                        }}
                        style={{
                          background:
                            dragOverWordId === w.id && draggingWordId != null && draggingWordId !== w.id
                              ? 'color-mix(in srgb, var(--accent-bg) 70%, transparent)'
                              : undefined,
                          opacity: draggingWordId === w.id ? 0.65 : undefined,
                        }}
                      >
                        <td style={{ width: 24 }}>
                          <span
                            title={canReorder ? 'Húzd fel/le a sorrendhez' : 'Rendezéshez töröld a keresőt'}
                            style={{
                              cursor: canReorder ? 'grab' : 'not-allowed',
                              userSelect: 'none',
                              opacity: canReorder ? 0.9 : 0.35,
                              display: 'inline-block',
                              padding: '4px 6px',
                              borderRadius: 6,
                              border: '1px solid var(--border)',
                              background: 'color-mix(in srgb, var(--bg) 92%, var(--code-bg))',
                              lineHeight: 1,
                            }}
                          >
                            ⋮⋮
                          </span>
                        </td>
                        <td>
                          <code>Gen {words.findIndex((x) => x.id === w.id) + 1}</code>
                        </td>
                        <td>
                          {editWordId === w.id ? (
                            <form onSubmit={submitEditWord} className="row" style={{ gap: 8 }}>
                              <input
                                value={editWordValue}
                                onChange={(e) => setEditWordValue(e.target.value)}
                                maxLength={255}
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Escape') cancelEditWord()
                                }}
                                style={{ width: 'min(520px, 100%)' }}
                                required
                              />
                            </form>
                          ) : (
                            w.word
                          )}
                        </td>
                        <td>
                          <div className="row">
                            {editWordId === w.id ? (
                              <>
                                <button className="primary" onClick={submitEditWord} disabled={busy}>
                                  {busy ? 'Mentés…' : 'Mentés'}
                                </button>
                                <button className="danger" type="button" onClick={cancelEditWord} disabled={busy}>
                                  Mégse
                                </button>
                              </>
                            ) : (
                              <button className="counter" onClick={() => openEditWord(w)} disabled={busy}>
                                Szerkesztés
                              </button>
                            )}
                            <button className="danger" onClick={() => void confirmAndDeleteWord(w)} disabled={busy}>
                              Törlés
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!busy && filteredWords.length === 0 ? (
                      <tr>
                        <td colSpan={4}>Nincs szó.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

