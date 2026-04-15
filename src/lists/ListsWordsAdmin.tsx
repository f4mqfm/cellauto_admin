import { useEffect, useMemo, useRef, useState } from 'react'
import {
  createList,
  deleteList,
  listLists,
  listWords,
  replaceWordGenerations,
  updateList,
  type WordList,
} from '../lib/api'

type Props = {
  token: string
}

type GenerationDraft = {
  generation: number
  text: string
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
  const [renameListName, setRenameListName] = useState('')
  const [generationDrafts, setGenerationDrafts] = useState<GenerationDraft[]>([])
  const wordsLoadSeq = useRef(0)

  function isPublicFlag(value: WordList['public']): boolean {
    return value === true || value === 1
  }

  function toUiError(err: unknown, fallback: string): string {
    const msg = err instanceof Error ? err.message : fallback
    if (msg.includes("Unknown column 'generation'")) {
      return "A backend adatbázisban hiányzik a `words.generation` oszlop. Futtasd a migrációt, majd frissítsd az oldalt."
    }
    return msg
  }

  function parseWordsInput(raw: string): string[] {
    const parts = raw
      .trim()
      .split(/[\s,;]+/g)
      .map((w) => w.trim())
      .filter(Boolean)
      .filter((w) => w.length <= 255)
    return Array.from(new Set(parts))
  }

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
        setGenerationDrafts([])
      }
    } catch (err) {
      setError(toUiError(err, 'Sikertelen betöltés'))
    } finally {
      setBusy(false)
    }
  }

  async function refreshWords(listId: number) {
    const seq = ++wordsLoadSeq.current
    setError(null)
    setBusy(true)
    try {
      const data = await listWords(token, listId)
      // Ha közben másik lista lett kiválasztva, a régi válasz ne írja felül az állapotot.
      if (seq !== wordsLoadSeq.current || selectedListId !== listId) return
      const drafts = data.generations.map((g) => ({
        generation: g.generation,
        text: g.words.map((w) => w.word).join('\n'),
      }))
      setGenerationDrafts(
        drafts.length > 0
          ? drafts
          : [
              {
                generation: 1,
                text: '',
              },
            ],
      )
    } catch (err) {
      setError(toUiError(err, 'Sikertelen betöltés'))
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

  useEffect(() => {
    if (!selectedList) return
    setRenameListName(selectedList.name)
  }, [selectedList])

  function selectList(list: WordList) {
    wordsLoadSeq.current += 1
    setSelectedListId(list.id)
    setRenameListName(list.name)
    setError(null)
  }

  function addGeneration() {
    setGenerationDrafts((prev) => [...prev, { generation: prev.length + 1, text: '' }])
  }

  function removeLastGeneration() {
    setGenerationDrafts((prev) => {
      if (prev.length <= 1) return prev
      return prev.slice(0, -1)
    })
  }

  async function submitCreateList(e: React.FormEvent) {
    e.preventDefault()
    const name = createListName.trim()
    if (!name) return

    setError(null)
    setBusy(true)
    try {
      const created = await createList(token, { name })
      setCreateListName('')
      setLists((prev) => [created, ...prev])
      selectList(created)
    } catch (err) {
      setError(toUiError(err, 'Sikertelen létrehozás'))
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
      setError(toUiError(err, 'Sikertelen mentés'))
    } finally {
      setBusy(false)
    }
  }

  async function toggleListPublic(list: WordList) {
    setError(null)
    setBusy(true)
    try {
      const updated = await updateList(token, list.id, {
        name: list.name,
        public: !isPublicFlag(list.public),
      })
      setLists((prev) => prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l)))
    } catch (err) {
      setError(toUiError(err, 'Sikertelen public váltás'))
    } finally {
      setBusy(false)
    }
  }

  async function submitSaveGenerations(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedList) return

    const normalized = generationDrafts
      .slice()
      .sort((a, b) => a.generation - b.generation)
      .map((g, idx) => ({
        generation: idx + 1,
        words: parseWordsInput(g.text),
      }))

    if (normalized.length === 0) {
      setError('Legalább egy generáció szükséges.')
      return
    }
    const firstEmpty = normalized.find((g) => g.words.length === 0)
    if (firstEmpty) {
      setError(`A GEN${firstEmpty.generation} üres. Minden generációban legalább 1 szó szükséges.`)
      return
    }

    setError(null)
    setBusy(true)
    try {
      await replaceWordGenerations(token, selectedList.id, {
        generations: normalized,
      })
      await refreshWords(selectedList.id)
    } catch (err) {
      setError(toUiError(err, 'Sikertelen mentés'))
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
        setGenerationDrafts([])
      }
    } catch (err) {
      setError(toUiError(err, 'Sikertelen törlés'))
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
                  <th>Public</th>
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
                      <button
                        type="button"
                        className={isPublicFlag(l.public) ? 'menuItem menuItem--active' : 'menuItem'}
                        onClick={() => void toggleListPublic(l)}
                        disabled={busy}
                        title="Kattintással váltható"
                      >
                        {isPublicFlag(l.public) ? 'Publikus' : 'Nem publikus'}
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
                    <td colSpan={3}>Még nincs lista.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h3>Generációk{selectedList ? ` — ${selectedList.name}` : ''}</h3>

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

              <form onSubmit={submitSaveGenerations} className="panel">
                <div className="row">
                  <button type="button" className="counter" onClick={addGeneration} disabled={busy}>
                    Új generáció
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={removeLastGeneration}
                    disabled={busy || generationDrafts.length <= 1}
                  >
                    Utolsó generáció törlése
                  </button>
                  <button type="submit" className="primary" disabled={busy}>
                    {busy ? 'Mentés…' : 'Generációk mentése'}
                  </button>
                  <button
                    type="button"
                    className="counter"
                    onClick={() => void refreshWords(selectedList.id)}
                    disabled={busy}
                  >
                    Frissítés
                  </button>
                </div>

                {generationDrafts.map((g, idx) => (
                  <div className="panel" key={g.generation}>
                    <label className="field" style={{ marginBottom: 0 }}>
                      <span className="label">GEN{idx + 1} szavai (szóköz / vessző / Enter)</span>
                      <textarea
                        value={g.text}
                        onChange={(e) =>
                          setGenerationDrafts((prev) =>
                            prev.map((item, itemIdx) => (itemIdx === idx ? { ...item, text: e.target.value } : item)),
                          )
                        }
                        rows={5}
                        style={{ resize: 'vertical' }}
                        required
                      />
                    </label>
                  </div>
                ))}
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
