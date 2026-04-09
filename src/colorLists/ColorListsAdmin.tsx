import { useEffect, useMemo, useState } from 'react'
import {
  createColorList,
  createPaletteColor,
  deleteColorList,
  deletePaletteColor,
  getColorList,
  listColorLists,
  listPaletteColors,
  updateColorList,
  updatePaletteColor,
  type ColorList,
  type PaletteColor,
} from '../lib/api'

type Props = { token: string }

/** Előre meghatározott színek (hex a backendnek); felhasználó nem gépel, csak kattint. */
const PRESET_COLORS: ReadonlyArray<{ hex: string; name: string }> = [
  /* Pixel minta (felhasználói képről mintavételezve) */
  { hex: '#e81820', name: 'Minta — piros' },
  { hex: '#00a0e0', name: 'Minta — ciánkék' },
  { hex: '#f8f000', name: 'Minta — sárga' },
  { hex: '#20a848', name: 'Minta — zöld' },
  { hex: '#f8c008', name: 'Minta — arany' },
  { hex: '#b87850', name: 'Minta — barna' },
  { hex: '#d0d0d0', name: 'Minta — rácsszürke' },
  { hex: '#0f172a', name: 'Palásfekete' },
  { hex: '#1e293b', name: 'Kőszürke' },
  { hex: '#334155', name: 'Acélkék szürke' },
  { hex: '#475569', name: 'Pala' },
  { hex: '#64748b', name: 'Ködös szürke' },
  { hex: '#78716c', name: 'Kő' },
  { hex: '#b91c1c', name: 'Mély piros' },
  { hex: '#dc2626', name: 'Piros' },
  { hex: '#ea580c', name: 'Narancs' },
  { hex: '#d97706', name: 'Okker' },
  { hex: '#ca8a04', name: 'Aranysárga' },
  { hex: '#84cc16', name: 'Lime' },
  { hex: '#16a34a', name: 'Zöld' },
  { hex: '#15803d', name: 'Fenyőzöld' },
  { hex: '#0d9488', name: 'Türkiz' },
  { hex: '#0891b2', name: 'Cián' },
  { hex: '#2563eb', name: 'Királykék' },
  { hex: '#1d4ed8', name: 'Intenzív kék' },
  { hex: '#4338ca', name: 'Indigó' },
  { hex: '#7c3aed', name: 'Lila' },
  { hex: '#9333ea', name: 'Ibolya' },
  { hex: '#c026d3', name: 'Magenta' },
  { hex: '#db2777', name: 'Rózsaszín' },
  { hex: '#f43f5e', name: 'Korall' },
  { hex: '#fda4af', name: 'Pasztell rózsa' },
  { hex: '#fcd34d', name: 'Vanília' },
  { hex: '#fef3c7', name: 'Krémsárga' },
  { hex: '#ffffff', name: 'Fehér' },
  { hex: '#e5e7eb', name: 'Világosszürke' },
  { hex: '#9ca3af', name: 'Szürke' },
  { hex: '#6b7280', name: 'Közép szürke' },
  { hex: '#374151', name: 'Grafit' },
  { hex: '#451a03', name: 'Csokoládé' },
  { hex: '#78350f', name: 'Barna' },
  { hex: '#000000', name: 'Fekete' },
]

function SwatchGrid(props: { disabled: boolean; onPick: (hex: string) => void }) {
  const { disabled, onPick } = props
  return (
    <div className="swatchGrid">
      {PRESET_COLORS.map(({ hex, name }) => (
        <button
          key={hex + name}
          type="button"
          className="swatchBtn"
          disabled={disabled}
          title={name}
          aria-label={name}
          onClick={() => onPick(hex)}
          style={{ backgroundColor: hex }}
        />
      ))}
    </div>
  )
}

function ColorQueuePreview(props: { items: string[] }) {
  if (props.items.length === 0) return null
  return (
    <div className="swatchQueue">
      {props.items.map((hex, i) => (
        <span key={`${hex}-${i}`} className="swatchQueue__chip" title={hex}>
          <span className="swatchQueue__dot" style={{ backgroundColor: hex }} />
          <span>
            {i + 1}. {hex}
          </span>
        </span>
      ))}
    </div>
  )
}

function sortColorsByPosition(items: PaletteColor[]): PaletteColor[] {
  return [...items].sort((a, b) => a.position - b.position || a.id - b.id)
}

export function ColorListsAdmin(props: Props) {
  const { token } = props

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [lists, setLists] = useState<ColorList[]>([])
  const [selectedListId, setSelectedListId] = useState<number | null>(null)
  const selectedList = useMemo(
    () => lists.find((l) => l.id === selectedListId) ?? null,
    [lists, selectedListId],
  )

  const [createListName, setCreateListName] = useState('')
  /** Kattintási sorrendben választott hex értékek (új lista létrehozásakor). */
  const [createPickOrder, setCreatePickOrder] = useState<string[]>([])
  const [renameListName, setRenameListName] = useState('')

  const [colors, setColors] = useState<PaletteColor[]>([])
  const [colorQuery, setColorQuery] = useState('')
  /** Hozzáadás sorba téve (kiválasztott lista). */
  const [addPickOrder, setAddPickOrder] = useState<string[]>([])

  const [editColorId, setEditColorId] = useState<number | null>(null)
  const [draggingId, setDraggingId] = useState<number | null>(null)
  const [dragOverId, setDragOverId] = useState<number | null>(null)

  const filteredColors = useMemo(() => {
    const q = colorQuery.trim().toLowerCase()
    if (!q) return colors
    return colors.filter((c) => c.color.toLowerCase().includes(q))
  }, [colors, colorQuery])

  const canReorder = useMemo(
    () => colorQuery.trim().length === 0 && !busy && editColorId == null,
    [colorQuery, busy, editColorId],
  )

  async function refreshLists(keepSelection = true) {
    setError(null)
    setBusy(true)
    try {
      const data = await listColorLists(token)
      setLists(data)
      if (!keepSelection) return
      if (selectedListId == null) return
      if (!data.some((l) => l.id === selectedListId)) {
        setSelectedListId(null)
        setColors([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sikertelen betöltés')
    } finally {
      setBusy(false)
    }
  }

  async function refreshColors(listId: number) {
    setError(null)
    setBusy(true)
    try {
      const data = await listPaletteColors(token, listId).catch(async () => {
        const full = await getColorList(token, listId)
        return full.colors ?? []
      })
      setColors(sortColorsByPosition(data))
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
    void refreshColors(selectedListId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedListId, token])

  function selectList(list: ColorList) {
    setSelectedListId(list.id)
    setRenameListName(list.name)
    setEditColorId(null)
    setColorQuery('')
    setAddPickOrder([])
  }

  function nextPosition(list: PaletteColor[]): number {
    if (list.length === 0) return 0
    return Math.max(...list.map((c) => c.position)) + 1
  }

  /** Two-phase position update to avoid UNIQUE(list_id, position) clashes when reordering. */
  async function persistOrder(listId: number, ordered: PaletteColor[]) {
    const BASE = 100_000
    for (let i = 0; i < ordered.length; i++) {
      await updatePaletteColor(token, listId, ordered[i].id, { position: BASE + i })
    }
    for (let i = 0; i < ordered.length; i++) {
      await updatePaletteColor(token, listId, ordered[i].id, { position: i })
    }
  }

  async function submitCreateList(e: React.FormEvent) {
    e.preventDefault()
    const name = createListName.trim()
    if (!name) return
    const tokens = createPickOrder
    setError(null)
    setBusy(true)
    try {
      const created = await createColorList(token, { name })
      if (tokens.length > 0) {
        const failed: string[] = []
        for (let i = 0; i < tokens.length; i++) {
          try {
            await createPaletteColor(token, created.id, { color: tokens[i], position: i })
          } catch {
            failed.push(tokens[i])
          }
        }
        if (failed.length > 0) {
          setError(
            `A lista létrejött, de néhány szín nem menthető: ${failed.slice(0, 8).join(', ')}${failed.length > 8 ? '…' : ''}`,
          )
        }
      }
      setCreateListName('')
      setCreatePickOrder([])
      setLists((prev) => [created, ...prev])
      selectList(created)
      await refreshColors(created.id)
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
      const updated = await updateColorList(token, selectedList.id, { name })
      setLists((prev) => prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sikertelen mentés')
    } finally {
      setBusy(false)
    }
  }

  async function confirmDeleteList(list: ColorList) {
    if (!confirm(`Biztosan törlöd? (${list.name})`)) return
    setError(null)
    setBusy(true)
    try {
      await deleteColorList(token, list.id)
      setLists((prev) => prev.filter((l) => l.id !== list.id))
      if (selectedListId === list.id) {
        setSelectedListId(null)
        setColors([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sikertelen törlés')
    } finally {
      setBusy(false)
    }
  }

  async function flushAddColorQueue() {
    if (!selectedList) return
    const tokens = addPickOrder
    if (tokens.length === 0) {
      setError('Válassz legalább egy színt a palettáról.')
      return
    }
    setError(null)
    setBusy(true)
    try {
      let pos = nextPosition(colors)
      const failed: string[] = []
      const created: PaletteColor[] = []
      for (const color of tokens) {
        try {
          const c = await createPaletteColor(token, selectedList.id, { color, position: pos })
          created.push(c)
          pos += 1
        } catch {
          failed.push(color)
        }
      }
      if (created.length > 0) {
        setColors((prev) => sortColorsByPosition([...prev, ...created]))
      }
      if (failed.length > 0) {
        setError(`Néhány szín nem menthető: ${failed.slice(0, 10).join(', ')}${failed.length > 10 ? '…' : ''}`)
      } else {
        setError(null)
      }
      setAddPickOrder([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sikertelen hozzáadás')
    } finally {
      setBusy(false)
    }
  }

  function openEdit(c: PaletteColor) {
    setEditColorId(c.id)
  }

  function cancelEdit() {
    setEditColorId(null)
  }

  async function applyEditPreset(hex: string) {
    if (!selectedList || editColorId == null) return
    if (hex.length > 50) return
    setError(null)
    setBusy(true)
    try {
      const updated = await updatePaletteColor(token, selectedList.id, editColorId, { color: hex })
      setColors((prev) => sortColorsByPosition(prev.map((x) => (x.id === updated.id ? updated : x))))
      cancelEdit()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sikertelen mentés')
    } finally {
      setBusy(false)
    }
  }

  async function confirmDeleteColor(c: PaletteColor) {
    if (!selectedList) return
    if (!confirm(`Biztosan törlöd? (${c.color})`)) return
    setError(null)
    setBusy(true)
    try {
      await deletePaletteColor(token, selectedList.id, c.id)
      if (editColorId === c.id) cancelEdit()
      const remaining = sortColorsByPosition(colors.filter((x) => x.id !== c.id))
      if (remaining.length > 0) await persistOrder(selectedList.id, remaining)
      await refreshColors(selectedList.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sikertelen törlés')
    } finally {
      setBusy(false)
    }
  }

  async function onDropReorder(fromId: number, toId: number) {
    if (!selectedList || fromId === toId) return
    const copy = sortColorsByPosition(colors.slice())
    const fromIdx = copy.findIndex((c) => c.id === fromId)
    const toIdx = copy.findIndex((c) => c.id === toId)
    if (fromIdx < 0 || toIdx < 0) return
    const [moved] = copy.splice(fromIdx, 1)
    copy.splice(toIdx, 0, moved)

    setBusy(true)
    try {
      await persistOrder(selectedList.id, copy)
      await refreshColors(selectedList.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sikertelen sorrend mentés')
      await refreshColors(selectedList.id)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <div className="row row--spread">
        <h2>Színlisták</h2>
        <button className="counter" onClick={() => void refreshLists(true)} disabled={busy}>
          {busy ? 'Betöltés…' : 'Frissítés'}
        </button>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <div className="grid2">
        <div>
          <h3>Paletták</h3>
          <form onSubmit={submitCreateList} className="panel">
            <label className="field">
              <span className="label">Új lista neve</span>
              <input
                value={createListName}
                onChange={(e) => setCreateListName(e.target.value)}
                placeholder="pl. Alapértelmezett"
                maxLength={255}
                required
              />
            </label>
            <div className="field">
              <span className="label">Színek — kattints a sorrendnek megfelelően</span>
              <SwatchGrid disabled={busy} onPick={(hex) => setCreatePickOrder((p) => [...p, hex])} />
              <ColorQueuePreview items={createPickOrder} />
              {createPickOrder.length > 0 ? (
                <div className="row" style={{ marginTop: 10 }}>
                  <button type="button" className="danger" disabled={busy} onClick={() => setCreatePickOrder([])}>
                    Színlista törlése
                  </button>
                  <button
                    type="button"
                    className="counter"
                    disabled={busy}
                    onClick={() => setCreatePickOrder((p) => p.slice(0, -1))}
                  >
                    Utolsó törlése
                  </button>
                </div>
              ) : null}
            </div>
            <button className="primary" disabled={busy}>
              {busy ? 'Mentés…' : 'Létrehozás'}
            </button>
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
                      <button className="danger" onClick={() => void confirmDeleteList(l)} disabled={busy}>
                        Törlés
                      </button>
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
          <h3>Színek{selectedList ? ` — ${selectedList.name}` : ''}</h3>

          {!selectedList ? (
            <div className="panel">
              <p>Válassz palettát bal oldalt.</p>
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
                <button className="primary" disabled={busy}>
                  {busy ? 'Mentés…' : 'Átnevezés'}
                </button>
              </form>

              <div className="panel">
                <div className="field">
                  <span className="label">Új színek — kattintás sorrendben, majd „Hozzáadás a listához”</span>
                  <SwatchGrid disabled={busy} onPick={(hex) => setAddPickOrder((p) => [...p, hex])} />
                  <ColorQueuePreview items={addPickOrder} />
                  {addPickOrder.length > 0 ? (
                    <div className="row" style={{ marginTop: 10 }}>
                      <button type="button" className="danger" disabled={busy} onClick={() => setAddPickOrder([])}>
                        Várakozó lista törlése
                      </button>
                      <button
                        type="button"
                        className="counter"
                        disabled={busy}
                        onClick={() => setAddPickOrder((p) => p.slice(0, -1))}
                      >
                        Utolsó törlése
                      </button>
                    </div>
                  ) : null}
                </div>
                <label className="field">
                  <span className="label">Keresés a táblázatban</span>
                  <input
                    value={colorQuery}
                    onChange={(e) => setColorQuery(e.target.value)}
                    placeholder="pl. #ff vagy pal"
                  />
                </label>
                <div className="row">
                  <button type="button" className="primary" disabled={busy} onClick={() => void flushAddColorQueue()}>
                    Hozzáadás a listához
                  </button>
                  <button type="button" className="counter" onClick={() => void refreshColors(selectedList.id)} disabled={busy}>
                    Frissítés
                  </button>
                </div>
              </div>

              <div className="tableWrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th />
                      <th>Gen</th>
                      <th>Minta</th>
                      <th>Érték</th>
                      <th>Műveletek</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredColors.map((c) => (
                      <tr
                        key={c.id}
                        draggable={Boolean(selectedList && canReorder)}
                        onDragStart={(e) => {
                          if (!selectedList || !canReorder) return
                          setDraggingId(c.id)
                          setDragOverId(null)
                          try {
                            e.dataTransfer.effectAllowed = 'move'
                            e.dataTransfer.setData('text/plain', String(c.id))
                          } catch {
                            // ignore
                          }
                        }}
                        onDragOver={(e) => {
                          if (!selectedList || !canReorder) return
                          e.preventDefault()
                          setDragOverId(c.id)
                          try {
                            e.dataTransfer.dropEffect = 'move'
                          } catch {
                            // ignore
                          }
                        }}
                        onDragLeave={() => {
                          if (!selectedList || !canReorder) return
                          setDragOverId((cur) => (cur === c.id ? null : cur))
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
                          void onDropReorder(fromId, c.id)
                          setDraggingId(null)
                          setDragOverId(null)
                        }}
                        onDragEnd={() => {
                          setDraggingId(null)
                          setDragOverId(null)
                        }}
                        style={{
                          background:
                            dragOverId === c.id && draggingId != null && draggingId !== c.id
                              ? 'color-mix(in srgb, var(--accent-bg) 70%, transparent)'
                              : undefined,
                          opacity: draggingId === c.id ? 0.65 : undefined,
                        }}
                      >
                        <td style={{ width: 28 }}>
                          <span
                            title={canReorder ? 'Húzd a sorrendhez' : 'Rendezéshez ürítsd a keresőt'}
                            style={{
                              cursor: canReorder ? 'grab' : 'not-allowed',
                              userSelect: 'none',
                              opacity: canReorder ? 0.9 : 0.35,
                              display: 'inline-block',
                              padding: '4px 6px',
                              borderRadius: 6,
                              border: '1px solid var(--border)',
                              background: 'color-mix(in srgb, var(--bg) 92%, var(--code-bg))',
                            }}
                          >
                            ⋮⋮
                          </span>
                        </td>
                        <td>
                          <code>
                            Gen {colors.findIndex((x) => x.id === c.id) + 1}
                          </code>
                          <span className="muted"> (pos {c.position})</span>
                        </td>
                        <td>
                          <span
                            style={{
                              display: 'inline-block',
                              width: 36,
                              height: 24,
                              borderRadius: 6,
                              border: '1px solid var(--border)',
                              background: c.color,
                              verticalAlign: 'middle',
                            }}
                            title={c.color}
                          />
                        </td>
                        <td>
                          {editColorId === c.id ? (
                            <div className="field" style={{ marginBottom: 0 }}>
                              <span className="label">Új szín — kattints egy négyzetre (azonnal ment)</span>
                              <SwatchGrid disabled={busy} onPick={(hex) => void applyEditPreset(hex)} />
                            </div>
                          ) : (
                            <code>{c.color}</code>
                          )}
                        </td>
                        <td>
                          <div className="row">
                            {editColorId === c.id ? (
                              <button type="button" className="danger" onClick={cancelEdit} disabled={busy}>
                                Mégse
                              </button>
                            ) : (
                              <button className="counter" onClick={() => openEdit(c)} disabled={busy}>
                                Szerkesztés
                              </button>
                            )}
                            <button className="danger" onClick={() => void confirmDeleteColor(c)} disabled={busy}>
                              Törlés
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!busy && filteredColors.length === 0 ? (
                      <tr>
                        <td colSpan={5}>Nincs szín.</td>
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
