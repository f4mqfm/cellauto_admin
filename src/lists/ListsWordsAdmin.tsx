import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertBanner } from '../components/AlertBanner'
import { ConfirmModal } from '../components/ConfirmModal'
import {
  createList,
  deleteList,
  deleteWordRelation,
  getList,
  listLists,
  listWordGenMessages,
  listWordRelations,
  listWords,
  putWordGenMessages,
  replaceWordRelationsForFromWord,
  replaceWordGenerations,
  updateList,
  type WordGenMessageRow,
  type WordGenerationsResponse,
  type WordList,
  type WordRelation,
} from '../lib/api'

type Props = {
  token: string
}

type GenerationDraft = {
  generation: number
  text: string
}

type ParsedWordlist = {
  generations: { generation: number; words: string[] }[]
  edges: Array<{ fromGen: number; fromWord: string; toWord: string }>
}

/** Egyező szó többféle írásmód / whitespace – egy generáción belül egy token lesz belőlük (API distinct miatt). */
function normalizeWordToken(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFC')
}

/** Generációnként sorrendet megtartva kiszűrjük a duplikátumokat (backend `distinct` / UNIQUE). */
function dedupeGenerationsForApi(
  generations: { generation: number; words: string[] }[],
): { generation: number; words: string[] }[] {
  return generations.map((g) => {
    const seen = new Set<string>()
    const words: string[] = []
    for (const raw of g.words) {
      const w = normalizeWordToken(raw)
      if (!w) continue
      if (w.length > 255) {
        throw new Error(`Túl hosszú szó (max 255 karakter): "${w.slice(0, 40)}…"`)
      }
      if (seen.has(w)) continue
      seen.add(w)
      words.push(w)
    }
    return { generation: g.generation, words }
  })
}

/** Wordlist szöveg: `;` = oszlop / GEN; normál sor = relációs lánc is; `*`-s sor csak szókészlet, nem alkot relációt. */
function parseWordlistText(raw: string): ParsedWordlist {
  const lines = raw.split(/\r?\n/)
  const wordsByGen = new Map<number, Set<string>>()
  const edges: ParsedWordlist['edges'] = []
  const edgeSeen = new Set<string>()

  for (const lineRaw of lines) {
    let line = lineRaw.trim()
    if (!line) continue

    const isStarLine = line.startsWith('*')
    if (isStarLine) {
      line = line.slice(1).trimStart()
    }

    const parts = line.split(';').map((p) => normalizeWordToken(p))
    for (let col = 0; col < parts.length; col++) {
      const w = parts[col]
      if (!w) continue
      const gen = col + 1
      if (!wordsByGen.has(gen)) wordsByGen.set(gen, new Set())
      wordsByGen.get(gen)!.add(w)
    }

    if (!isStarLine) {
      for (let col = 0; col < parts.length - 1; col++) {
        const a = parts[col]
        const b = parts[col + 1]
        if (!a || !b) continue
        const fromGen = col + 1
        const key = `${fromGen}:${a}->${b}`
        if (!edgeSeen.has(key)) {
          edgeSeen.add(key)
          edges.push({ fromGen, fromWord: a, toWord: b })
        }
      }
    }
  }

  if (wordsByGen.size === 0) {
    throw new Error('Üres a wordlist: nincs egyetlen nem üres cella sem.')
  }

  const maxGenNum = Math.max(...wordsByGen.keys())
  for (let g = 1; g <= maxGenNum; g++) {
    const set = wordsByGen.get(g)
    if (!set || set.size === 0) {
      throw new Error(
        `A GEN${g} üres: minden generációhoz legalább egy szó kell a nem üres cellákból (oszlop ${g}).`,
      )
    }
  }

  const generations: ParsedWordlist['generations'] = []
  for (let g = 1; g <= maxGenNum; g++) {
    const words = Array.from(wordsByGen.get(g)!).sort((a, b) => a.localeCompare(b, 'hu'))
    generations.push({ generation: g, words })
  }

  return { generations, edges }
}

/** Minden olyan útvonal (GEN1 → … → utolsó generáció), ami a relációkkal összerakható; duplikátum mentes. */
function enumerateFullRelationPaths(
  wordsData: WordGenerationsResponse,
  relations: WordRelation[],
): string[][] {
  const gens = wordsData.generations
  if (gens.length === 0) return []

  const maxGen = Math.max(...gens.map((g) => g.generation))

  const wordById = new Map<number, { word: string; generation: number }>()
  for (const g of gens) {
    for (const w of g.words) {
      wordById.set(w.id, { word: w.word, generation: g.generation })
    }
  }

  const adj = new Map<number, number[]>()
  for (const r of relations) {
    const from = wordById.get(r.from_word_id)
    const to = wordById.get(r.to_word_id)
    if (!from || !to) continue
    if (to.generation !== from.generation + 1) continue
    if (!adj.has(r.from_word_id)) adj.set(r.from_word_id, [])
    adj.get(r.from_word_id)!.push(r.to_word_id)
  }
  for (const arr of adj.values()) arr.sort((a, b) => a - b)

  const gen1Words = gens.find((g) => g.generation === 1)?.words ?? []
  if (gen1Words.length === 0) return []

  const collected: string[][] = []
  const seenKeys = new Set<string>()

  function recordPath(ids: number[]) {
    const key = ids.join('\x1e')
    if (seenKeys.has(key)) return
    seenKeys.add(key)
    collected.push(ids.map((id) => wordById.get(id)!.word))
  }

  function dfs(currentId: number, pathIds: number[]) {
    const cur = wordById.get(currentId)!
    if (cur.generation === maxGen) {
      recordPath(pathIds)
      return
    }
    for (const nextId of adj.get(currentId) ?? []) {
      dfs(nextId, [...pathIds, nextId])
    }
  }

  for (const w of gen1Words) {
    dfs(w.id, [w.id])
  }

  collected.sort((a, b) => {
    const sa = a.join('\u0000')
    const sb = b.join('\u0000')
    return sa.localeCompare(sb, 'hu')
  })
  return collected
}

/** Wordlist szöveg sorokra bontva: nem * → fő tábla; * → kakuktojás tábla (a * nélkül). */
function parseWordlistToGrids(raw: string): { main: string[][]; star: string[][] } {
  const main: string[][] = []
  const star: string[][] = []
  for (const lineRaw of raw.split(/\r?\n/)) {
    const line = lineRaw.trim()
    if (!line) continue
    const isStar = line.startsWith('*')
    const body = isStar ? line.slice(1).trimStart() : line
    const cells = body.split(';').map((c) => c.trim())
    if (isStar) star.push(cells)
    else main.push(cells)
  }
  return { main, star }
}

function inferMaxCols(main: string[][], star: string[][]): number {
  let m = 0
  for (const r of main) m = Math.max(m, r.length)
  for (const r of star) m = Math.max(m, r.length)
  return m
}

function padMatrixToCols(rows: string[][], cols: number): string[][] {
  return rows.map((row) => {
    const copy = [...row]
    while (copy.length < cols) copy.push('')
    return copy.slice(0, cols)
  })
}

/** Ugyanaz a `;` / `*` formátum, mint a Wordlist (szöveg) mezőben. */
function serializeWordlistFromGrids(mainRows: string[][], starRows: string[][]): string {
  const trimTrailing = (cells: string[]): string[] => {
    const t = cells.map((c) => normalizeWordToken(c))
    while (t.length > 0 && !t[t.length - 1]) t.pop()
    return t
  }
  const lines: string[] = []
  for (const row of mainRows) {
    const t = trimTrailing([...row])
    if (t.length === 0) continue
    lines.push(t.join(';'))
  }
  for (const row of starRows) {
    const t = trimTrailing([...row])
    if (t.length === 0) continue
    lines.push(`*${t.join(';')}`)
  }
  return lines.join('\n')
}

async function buildFriendlyWordlistInitial(args: {
  token: string
  listId: number
  wordlistDraft: string
  wordsData: WordGenerationsResponse | null
}): Promise<{ cols: number; mainRows: string[][]; starRows: string[][] }> {
  const raw = args.wordlistDraft.trim()

  if (raw) {
    const { main, star } = parseWordlistToGrids(raw)
    let cols = inferMaxCols(main, star)
    if (cols === 0) cols = 3
    const mainRows = padMatrixToCols(main.length > 0 ? main : [Array(cols).fill('')], cols)
    const starRows = padMatrixToCols(star.length > 0 ? star : [Array(cols).fill('')], cols)
    return { cols, mainRows, starRows }
  }

  const wd = args.wordsData
  const hasWords = wd ? wd.generations.some((g) => g.words.length > 0) : false

  if (wd && hasWords) {
    const rels = await listWordRelations(args.token, args.listId)
    const paths = enumerateFullRelationPaths(wd, rels)
    const maxG = wd.generations.length > 0 ? Math.max(...wd.generations.map((g) => g.generation)) : 0
    let cols = Math.max(3, maxG)

    let mainRows: string[][]
    if (paths.length > 0) {
      cols = Math.max(cols, paths[0].length)
      mainRows = paths.map((p) => {
        const r = [...p]
        while (r.length < cols) r.push('')
        return r.slice(0, cols)
      })
    } else {
      mainRows = [Array(cols).fill('')]
    }

    return {
      cols,
      mainRows: padMatrixToCols(mainRows, cols),
      starRows: padMatrixToCols([Array(cols).fill('')], cols),
    }
  }

  const cols = 3
  return {
    cols,
    mainRows: [Array(3).fill('')],
    starRows: [Array(3).fill('')],
  }
}

type WordlistFriendlyPayload = {
  cols: number
  mainRows: string[][]
  starRows: string[][]

}

function WordlistFriendlyModal(props: {
  open: boolean
  payload: WordlistFriendlyPayload | null
  onClose: () => void
  onApply: (text: string) => void
}) {
  const { open, payload, onClose, onApply } = props
  const [cols, setCols] = useState(3)
  const [mainRows, setMainRows] = useState<string[][]>([])
  const [starRows, setStarRows] = useState<string[][]>([])

  useLayoutEffect(() => {
    if (!open || !payload) return
    setCols(payload.cols)
    setMainRows(payload.mainRows.map((r) => [...r]))
    setStarRows(payload.starRows.map((r) => [...r]))
  }, [open, payload])

  function addColumn() {
    setCols((c) => c + 1)
    setMainRows((prev) => prev.map((r) => [...r, '']))
    setStarRows((prev) => prev.map((r) => [...r, '']))
  }

  function removeLastColumn() {
    if (cols <= 1) return
    const n = cols - 1
    setCols(n)
    setMainRows((prev) => prev.map((r) => r.slice(0, n)))
    setStarRows((prev) => prev.map((r) => r.slice(0, n)))
  }

  function addMainRow() {
    setMainRows((prev) => {
      const w = prev.length > 0 ? prev[0].length : cols
      return [...prev, Array(w).fill('')]
    })
  }

  function addStarRow() {
    setStarRows((prev) => {
      const w = prev.length > 0 ? prev[0].length : cols
      return [...prev, Array(w).fill('')]
    })
  }

  function removeMainRow(idx: number) {
    setMainRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)))
  }

  function removeStarRow(idx: number) {
    setStarRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)))
  }

  if (!open || !payload) return null

  return (
    <div
      className="confirmModal__root"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="confirmModal__backdrop" aria-hidden />
      <div
        className="confirmModal__panel wordlistFriendlyModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wordlistFriendlyTitle"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="row row--spread" style={{ marginBottom: 10 }}>
          <h3 id="wordlistFriendlyTitle" className="confirmModal__title" style={{ margin: 0 }}>
            Wordlist felhasználóbarát szerkesztő
          </h3>
          <button type="button" className="danger" onClick={onClose}>
            × Bezárás
          </button>
        </div>

        <p className="muted" style={{ margin: '0 0 12px', fontSize: 13 }}>
          Oszlopok = generációk (<code>;</code> elválasztó a szöveg mezőben). A második táblában a <code>*</code>{' '}
          (kakuktojás) sorok adhatók meg — ezek nem alkotnak relációt.
        </p>

        <div className="wordlistFriendlyToolbar row" style={{ flexWrap: 'wrap', marginBottom: 8 }}>
          <button type="button" className="counter" onClick={addMainRow}>
            + Új sor (relációs sorok)
          </button>
          <button type="button" className="counter" onClick={addColumn}>
            + Új GEN (oszlop)
          </button>
          <button type="button" className="counter" onClick={removeLastColumn} disabled={cols <= 1}>
            Utolsó GEN törlése
          </button>
          <button type="button" className="counter" onClick={addStarRow}>
            + Új kakuktojás sor
          </button>
        </div>

        <div className="wordlistFriendlySectionLabel">Relációs sorok (nem * — élek ezekből)</div>
        <div className="wordlistFriendlyTableWrap">
          <table className="table wordlistFriendlyTable">
            <thead>
              <tr>
                <th style={{ width: 36 }}>#</th>
                {Array.from({ length: cols }, (_, i) => (
                  <th key={`mh-${i}`}>GEN{i + 1}</th>
                ))}
                <th style={{ width: 44 }} />
              </tr>
            </thead>
            <tbody>
              {mainRows.map((row, ri) => (
                <tr key={`mr-${ri}`}>
                  <td className="muted">{ri + 1}</td>
                  {Array.from({ length: cols }, (_, ci) => (
                    <td key={`mc-${ri}-${ci}`}>
                      <input
                        type="text"
                        value={row[ci] ?? ''}
                        onChange={(e) => {
                          const v = e.target.value
                          setMainRows((prev) =>
                            prev.map((r, rIdx) => {
                              if (rIdx !== ri) return r
                              const next = padMatrixToCols([r], cols)[0]
                              next[ci] = v
                              return next
                            }),
                          )
                        }}
                        className="wordlistFriendlyCell"
                        autoComplete="off"
                        spellCheck={false}
                        aria-label={`Relációs sor ${ri + 1}, GEN${ci + 1}`}
                      />
                    </td>
                  ))}
                  <td>
                    <button
                      type="button"
                      className="counter"
                      disabled={mainRows.length <= 1}
                      title="Sor törlése"
                      onClick={() => removeMainRow(ri)}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="wordlistFriendlySectionLabel" style={{ marginTop: 14 }}>
          Kakuktojás sorok (<code>*</code> — csak szókészlet, nem alkot relációt)
        </div>
        <div className="wordlistFriendlyTableWrap">
          <table className="table wordlistFriendlyTable">
            <thead>
              <tr>
                <th style={{ width: 36 }}>#</th>
                {Array.from({ length: cols }, (_, i) => (
                  <th key={`sh-${i}`}>GEN{i + 1}</th>
                ))}
                <th style={{ width: 44 }} />
              </tr>
            </thead>
            <tbody>
              {starRows.map((row, ri) => (
                <tr key={`sr-${ri}`}>
                  <td className="muted">{ri + 1}</td>
                  {Array.from({ length: cols }, (_, ci) => (
                    <td key={`sc-${ri}-${ci}`}>
                      <input
                        type="text"
                        value={row[ci] ?? ''}
                        onChange={(e) => {
                          const v = e.target.value
                          setStarRows((prev) =>
                            prev.map((r, rIdx) => {
                              if (rIdx !== ri) return r
                              const next = padMatrixToCols([r], cols)[0]
                              next[ci] = v
                              return next
                            }),
                          )
                        }}
                        className="wordlistFriendlyCell"
                        autoComplete="off"
                        spellCheck={false}
                        aria-label={`Kakuktojás sor ${ri + 1}, GEN${ci + 1}`}
                      />
                    </td>
                  ))}
                  <td>
                    <button
                      type="button"
                      className="counter"
                      disabled={starRows.length <= 1}
                      title="Sor törlése"
                      onClick={() => removeStarRow(ri)}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="confirmModal__actions" style={{ marginTop: 16 }}>
          <button type="button" className="counter" onClick={onClose}>
            Mégse
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => {
              onApply(serializeWordlistFromGrids(mainRows, starRows))
              onClose()
            }}
          >
            Mentés a Wordlist mezőbe
          </button>
        </div>
      </div>
    </div>
  )
}

function emptyGenMessageRows(maxGen: number): WordGenMessageRow[] {
  return Array.from({ length: maxGen }, (_, i) => ({
    generation: i + 1,
    correct_answer_message: null,
    incorrect_answer_message: null,
  }))
}

type GenMessageDraft = {
  generation: number
  correct_answer_message: string
  incorrect_answer_message: string
}

function rowsToDrafts(rows: WordGenMessageRow[]): GenMessageDraft[] {
  return rows.map((r) => ({
    generation: r.generation,
    correct_answer_message: r.correct_answer_message ?? '',
    incorrect_answer_message: r.incorrect_answer_message ?? '',
  }))
}

function SentenceModalContent(props: {
  token: string
  listId: number
  sentencesBusy: boolean
  sentencesError: string | null
  sentencesMaxGen: number
  sentencesPaths: string[][]
  genMsgLoadError: string | null
  genMessageRows: WordGenMessageRow[] | null
  onDismissError: () => void
  onDismissGenMsgError: () => void
  onGenMessagesSaved: (rows: WordGenMessageRow[]) => void
  toUiError: (err: unknown, fallback: string) => string
}) {
  const {
    token,
    listId,
    sentencesBusy,
    sentencesError,
    sentencesMaxGen,
    sentencesPaths,
    genMsgLoadError,
    genMessageRows,
    onDismissError,
    onDismissGenMsgError,
    onGenMessagesSaved,
    toUiError,
  } = props

  const [filters, setFilters] = useState<string[]>([])
  const [genMsgPanelOpen, setGenMsgPanelOpen] = useState(false)
  const [msgDrafts, setMsgDrafts] = useState<GenMessageDraft[]>([])
  const [msgSaveBusy, setMsgSaveBusy] = useState(false)
  const [msgSaveError, setMsgSaveError] = useState<string | null>(null)
  const [msgSaveOk, setMsgSaveOk] = useState(false)
  const [focusedMsgGen, setFocusedMsgGen] = useState<number | null>(null)

  useLayoutEffect(() => {
    setFilters(Array(Math.max(0, sentencesMaxGen)).fill(''))
  }, [sentencesMaxGen, sentencesPaths])

  useLayoutEffect(() => {
    if (genMessageRows == null) {
      setMsgDrafts([])
      return
    }
    setMsgDrafts(rowsToDrafts(genMessageRows))
    setMsgSaveOk(false)
    setMsgSaveError(null)
  }, [genMessageRows])

  useLayoutEffect(() => {
    if (!genMsgPanelOpen) setFocusedMsgGen(null)
  }, [genMsgPanelOpen])

  const filteredPaths = useMemo(() => {
    if (sentencesPaths.length === 0) return []
    return sentencesPaths.filter((path) => {
      for (let col = 0; col < sentencesMaxGen; col++) {
        const q = (filters[col] ?? '').trim().toLowerCase()
        if (!q) continue
        const cell = (path[col] ?? '').toLowerCase()
        if (!cell.includes(q)) return false
      }
      return true
    })
  }, [sentencesPaths, filters, sentencesMaxGen])

  async function saveGenMessages() {
    if (sentencesMaxGen === 0) return
    setMsgSaveBusy(true)
    setMsgSaveError(null)
    setMsgSaveOk(false)
    try {
      const generations = msgDrafts.map((d) => ({
        generation: d.generation,
        correct_answer_message: d.correct_answer_message.trim() ? d.correct_answer_message.trim() : null,
        incorrect_answer_message: d.incorrect_answer_message.trim()
          ? d.incorrect_answer_message.trim()
          : null,
      }))
      const res = await putWordGenMessages(token, listId, { generations })
      onGenMessagesSaved(res.generations)
      setMsgSaveOk(true)
    } catch (err) {
      setMsgSaveError(toUiError(err, 'Üzenetek mentése sikertelen'))
    } finally {
      setMsgSaveBusy(false)
    }
  }

  const sentencesBlock =
    sentencesBusy ? (
      <p className="muted">Betöltés…</p>
    ) : sentencesMaxGen === 0 ? (
      <p className="muted">Nincs generációs adat ehhez a listához.</p>
    ) : sentencesPaths.length === 0 ? (
      <p className="muted">
        {sentencesMaxGen >= 2
          ? `Nincs egyetlen teljes lánc sem GEN1 → GEN${sentencesMaxGen} irányban a megadott relációkkal.`
          : 'Nincs GEN1 szó ehhez a listához.'}
      </p>
    ) : (
      <>
        <div className="sentenceFiltersBar">
          <span className="sentenceFiltersBar__title muted">Oszlopszűrő (gépelésre azonnal szűkül)</span>
          <button
            type="button"
            className="counter sentenceFiltersBar__clear"
            onClick={() => setFilters(Array(sentencesMaxGen).fill(''))}
          >
            Törlés
          </button>
        </div>
        <div className="sentenceFiltersGrid" style={{ marginBottom: 10 }}>
          {Array.from({ length: sentencesMaxGen }, (_, i) => i + 1).map((gen) => (
            <label key={`sf-gen-${gen}`} className="field sentenceFilterField">
              <span className="label">GEN{gen}</span>
              <input
                type="text"
                inputMode="search"
                enterKeyHint="search"
                value={filters[gen - 1] ?? ''}
                onChange={(e) => {
                  const v = e.target.value
                  setFilters((prev) => {
                    const next = [...prev]
                    while (next.length < sentencesMaxGen) next.push('')
                    next[gen - 1] = v
                    return next
                  })
                }}
                placeholder="szűrő…"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
          ))}
        </div>
        <p className="muted" style={{ margin: '0 0 8px', fontSize: 13 }}>
          Megjelenítve <strong>{filteredPaths.length}</strong> / {sentencesPaths.length} mondat.
        </p>
        <div className="sentencesScroll">
          {filteredPaths.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              Nincs a szűrőnek megfelelő mondat.
            </p>
          ) : (
            filteredPaths.map((words, idx) => (
              <div className="sentenceRow" key={`sent-${idx}-${words.join('\u0000')}`}>
                {words.map((w, i) => {
                  const genNum = i + 1
                  const pillClass =
                    focusedMsgGen != null
                      ? focusedMsgGen === genNum
                        ? 'sentenceWordPill sentenceWordPill--genFocus'
                        : 'sentenceWordPill sentenceWordPill--genMuted'
                      : 'sentenceWordPill'
                  return (
                    <span key={`sent-${idx}-g${i}`} className={pillClass} title={`GEN${genNum}`}>
                      {w}
                    </span>
                  )
                })}
              </div>
            ))
          )}
        </div>
      </>
    )

  const genAside =
    sentencesBusy || sentencesMaxGen === 0 ? null : (
      <aside className="sentenceModalGenAside">
        {!genMsgPanelOpen ? (
          <button type="button" className="counter sentenceGenMsgToggle" onClick={() => setGenMsgPanelOpen(true)}>
            GEN üzenetek szerkesztése
          </button>
        ) : (
          <div className="sentenceGenMsgPanel">
            <div className="sentenceGenMsgPanel__head">
              <span className="muted" style={{ fontSize: 13 }}>
                Generációnként helyes / helytelen válasz szöveg
              </span>
              <button
                type="button"
                className="counter sentenceGenMsgToggle"
                onClick={() => setGenMsgPanelOpen(false)}
              >
                Elrejtés
              </button>
            </div>
            {genMsgLoadError ? (
              <AlertBanner variant="error" onDismiss={onDismissGenMsgError}>
                {genMsgLoadError}
              </AlertBanner>
            ) : null}
            {msgSaveError ? (
              <AlertBanner variant="error" onDismiss={() => setMsgSaveError(null)}>
                {msgSaveError}
              </AlertBanner>
            ) : null}
            {msgSaveOk ? (
              <AlertBanner variant="success" onDismiss={() => setMsgSaveOk(false)}>
                GEN üzenetek elmentve.
              </AlertBanner>
            ) : null}
            <div className="sentenceGenMsgBlocks">
              {msgDrafts.map((d) => (
                <div
                  key={`gmsg-${d.generation}`}
                  className="sentenceGenMsgBlock"
                  onFocus={() => setFocusedMsgGen(d.generation)}
                  onBlur={(e) => {
                    const next = e.relatedTarget as Node | null
                    if (!e.currentTarget.contains(next)) setFocusedMsgGen(null)
                  }}
                >
                  <div className="sentenceGenMsgBlock__title">GEN{d.generation}</div>
                  <label className="field sentenceGenMsgField">
                    <span className="label">Helyes válasz üzenet</span>
                    <textarea
                      value={d.correct_answer_message}
                      onChange={(e) => {
                        const v = e.target.value
                        setMsgDrafts((prev) =>
                          prev.map((x) => (x.generation === d.generation ? { ...x, correct_answer_message: v } : x)),
                        )
                      }}
                      rows={2}
                      spellCheck
                      placeholder="opcionális"
                    />
                  </label>
                  <label className="field sentenceGenMsgField">
                    <span className="label">Helytelen válasz üzenet</span>
                    <textarea
                      value={d.incorrect_answer_message}
                      onChange={(e) => {
                        const v = e.target.value
                        setMsgDrafts((prev) =>
                          prev.map((x) =>
                            x.generation === d.generation ? { ...x, incorrect_answer_message: v } : x,
                          ),
                        )
                      }}
                      rows={2}
                      spellCheck
                      placeholder="opcionális"
                    />
                  </label>
                </div>
              ))}
            </div>
            <div className="sentenceGenMsgActions">
              <button type="button" className="primary" disabled={msgSaveBusy} onClick={() => void saveGenMessages()}>
                {msgSaveBusy ? 'Mentés…' : 'Mentés'}
              </button>
            </div>
          </div>
        )}
      </aside>
    )

  return (
    <>
      <p className="muted" style={{ margin: '0 0 10px', fontSize: 13 }}>
        Teljes láncok GEN1-től az utolsó generációig, minden engedélyezett relációs ágon végig (ismétlés nélkül).
      </p>

      {sentencesError ? (
        <AlertBanner variant="error" onDismiss={onDismissError}>
          {sentencesError}
        </AlertBanner>
      ) : null}

      <div className="sentenceModalLayout">
        <div className="sentenceModalMainCol">{sentencesBlock}</div>
        {genAside}
      </div>
    </>
  )
}

export function ListsWordsAdmin(props: Props) {
  const { token } = props

  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState<{ variant: 'error' | 'info' | 'success'; message: string } | null>(null)

  const [lists, setLists] = useState<WordList[]>([])
  const [selectedListId, setSelectedListId] = useState<number | null>(null)
  const selectedList = useMemo(
    () => lists.find((l) => l.id === selectedListId) ?? null,
    [lists, selectedListId],
  )

  const [createListName, setCreateListName] = useState('')
  const [renameListName, setRenameListName] = useState('')
  const [listNotesDraft, setListNotesDraft] = useState('')
  const [listWordlistDraft, setListWordlistDraft] = useState('')
  const [generationDrafts, setGenerationDrafts] = useState<GenerationDraft[]>([])
  const [wordsData, setWordsData] = useState<WordGenerationsResponse | null>(null)
  const wordsLoadSeq = useRef(0)

  const [relFromGen, setRelFromGen] = useState(1)
  const [relFromQuery, setRelFromQuery] = useState('')
  const [relToQuery, setRelToQuery] = useState('')
  const [selectedFromWordId, setSelectedFromWordId] = useState<number | null>(null)
  const [relationsByFrom, setRelationsByFrom] = useState<Record<number, number[]>>({})
  const [relDraftToIds, setRelDraftToIds] = useState<number[]>([])
  const [relDirty, setRelDirty] = useState(false)
  const [treeOpen, setTreeOpen] = useState(false)
  const [treeBusy, setTreeBusy] = useState(false)
  const [treeError, setTreeError] = useState<string | null>(null)
  const [treeListId, setTreeListId] = useState<number | null>(null)
  const [treeListName, setTreeListName] = useState('')
  const [treeWordsData, setTreeWordsData] = useState<WordGenerationsResponse | null>(null)
  const [treeRelations, setTreeRelations] = useState<WordRelation[]>([])
  const [treeDragFromId, setTreeDragFromId] = useState<number | null>(null)
  const [treeDragTargetId, setTreeDragTargetId] = useState<number | null>(null)
  const [treeDragCursor, setTreeDragCursor] = useState<{ x: number; y: number } | null>(null)
  const [treeNotice, setTreeNotice] = useState<string | null>(null)
  const [treeLineDeletePending, setTreeLineDeletePending] = useState<{
    relationId: number
    fromLabel: string
    toLabel: string
  } | null>(null)

  const [wordlistGenConfirm, setWordlistGenConfirm] = useState<{
    listId: number
    generationsPayload: { generation: number; words: string[] }[]
    parsed: ParsedWordlist
    relationsNote: string
  } | null>(null)

  const [sentencesOpen, setSentencesOpen] = useState(false)
  const [sentencesBusy, setSentencesBusy] = useState(false)
  const [sentencesError, setSentencesError] = useState<string | null>(null)
  const [sentencesListName, setSentencesListName] = useState('')
  const [sentencesPaths, setSentencesPaths] = useState<string[][]>([])
  const [sentencesMaxGen, setSentencesMaxGen] = useState(0)
  const [sentencesListId, setSentencesListId] = useState<number | null>(null)
  const [sentencesGenMessages, setSentencesGenMessages] = useState<WordGenMessageRow[] | null>(null)
  const [sentencesGenMsgLoadError, setSentencesGenMsgLoadError] = useState<string | null>(null)
  const [pendingDeleteList, setPendingDeleteList] = useState<WordList | null>(null)
  const [deletePreview, setDeletePreview] = useState<{
    generationCount: number
    wordCount: number
    relationCount: number
    genMessageGensWithText: number
    hasWordlist: boolean
    hasNotes: boolean
  } | null>(null)
  const [deletePreviewLoading, setDeletePreviewLoading] = useState(false)
  const [deletePreviewError, setDeletePreviewError] = useState<string | null>(null)
  const [wordlistFriendlyOpen, setWordlistFriendlyOpen] = useState(false)
  const [wordlistFriendlyPayload, setWordlistFriendlyPayload] = useState<WordlistFriendlyPayload | null>(null)
  const [wordlistFriendlyPrepBusy, setWordlistFriendlyPrepBusy] = useState(false)

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
      .map((w) => normalizeWordToken(w))
      .filter(Boolean)
      .filter((w) => w.length <= 255)
    const seen = new Set<string>()
    const out: string[] = []
    for (const w of parts) {
      if (seen.has(w)) continue
      seen.add(w)
      out.push(w)
    }
    return out
  }

  async function refreshLists(keepSelection = true) {
    setFlash(null)
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
      setFlash({ variant: 'error', message: toUiError(err, 'Sikertelen betöltés') })
    } finally {
      setBusy(false)
    }
  }

  async function refreshWords(listId: number) {
    const seq = ++wordsLoadSeq.current
    setFlash(null)
    setBusy(true)
    try {
      const data = await listWords(token, listId)
      // Ha közben másik lista lett kiválasztva, a régi válasz ne írja felül az állapotot.
      if (seq !== wordsLoadSeq.current || selectedListId !== listId) return
      setWordsData(data)
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
      setWordsData(null)
      setFlash({ variant: 'error', message: toUiError(err, 'Sikertelen betöltés') })
    } finally {
      setBusy(false)
    }
  }

  function buildRelationsIndex(rows: WordRelation[]): Record<number, number[]> {
    const out: Record<number, number[]> = {}
    for (const r of rows) {
      const fromId = r.from_word_id
      const toId = r.to_word_id
      if (!out[fromId]) out[fromId] = [toId]
      else if (!out[fromId].includes(toId)) out[fromId].push(toId)
    }
    Object.values(out).forEach((arr) => arr.sort((a, b) => a - b))
    return out
  }

  async function refreshRelations(listId: number, fromGen: number) {
    setFlash(null)
    setBusy(true)
    try {
      const rows = await listWordRelations(token, listId, { from_generation: fromGen })
      const idx = buildRelationsIndex(rows)
      setRelationsByFrom(idx)

      // ha jelenleg kijelölt from szó nem ebben a GEN-ben van, reset
      setSelectedFromWordId((prev) => {
        if (!prev) return prev
        const fromWords = wordsData?.generations.find((g) => g.generation === fromGen)?.words ?? []
        return fromWords.some((w) => w.id === prev) ? prev : null
      })
    } catch (err) {
      setFlash({ variant: 'error', message: toUiError(err, 'Sikertelen reláció betöltés') })
      setRelationsByFrom({})
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
    if (!selectedListId) return
    if (!wordsData) return
    const maxGen = wordsData.generations.length
    if (maxGen < 2) return
    // clamp
    const fromGen = Math.min(Math.max(1, relFromGen), maxGen - 1)
    if (fromGen !== relFromGen) setRelFromGen(fromGen)
    void refreshRelations(selectedListId, fromGen)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedListId, token, wordsData, relFromGen])

  useEffect(() => {
    if (!selectedList) {
      setRenameListName('')
      setListNotesDraft('')
      setListWordlistDraft('')
      return
    }
    setRenameListName(selectedList.name)
    setListNotesDraft(selectedList.notes ?? '')
    setListWordlistDraft(selectedList.wordlist ?? '')
  }, [selectedList])

  function selectList(list: WordList) {
    wordsLoadSeq.current += 1
    setSelectedListId(list.id)
    setFlash(null)
    setWordsData(null)
    setRelFromGen(1)
    setRelFromQuery('')
    setRelToQuery('')
    setSelectedFromWordId(null)
    setRelationsByFrom({})
    setRelDraftToIds([])
    setRelDirty(false)
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

    setFlash(null)
    setBusy(true)
    try {
      const created = await createList(token, { name })
      setCreateListName('')
      setLists((prev) => [created, ...prev])
      selectList(created)
    } catch (err) {
      setFlash({ variant: 'error', message: toUiError(err, 'Sikertelen létrehozás') })
    } finally {
      setBusy(false)
    }
  }

  async function submitRenameList(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedList) return
    const name = renameListName.trim()
    if (!name) return
    setFlash(null)
    setBusy(true)
    try {
      const updated = await updateList(token, selectedList.id, {
        name,
        notes: listNotesDraft,
        wordlist: listWordlistDraft,
      })
      setLists((prev) => prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l)))
    } catch (err) {
      setFlash({ variant: 'error', message: toUiError(err, 'Sikertelen mentés') })
    } finally {
      setBusy(false)
    }
  }

  async function toggleListPublic(list: WordList) {
    setFlash(null)
    setBusy(true)
    try {
      const updated = await updateList(token, list.id, {
        name: list.name,
        public: !isPublicFlag(list.public),
      })
      setLists((prev) => prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l)))
    } catch (err) {
      setFlash({ variant: 'error', message: toUiError(err, 'Sikertelen public váltás') })
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
      setFlash({ variant: 'error', message: 'Legalább egy generáció szükséges.' })
      return
    }
    let payload: { generation: number; words: string[] }[]
    try {
      payload = dedupeGenerationsForApi(normalized)
    } catch (err) {
      setFlash({ variant: 'error', message: err instanceof Error ? err.message : 'Érvénytelen szó' })
      return
    }

    const firstEmpty = payload.find((g) => g.words.length === 0)
    if (firstEmpty) {
      setFlash({
        variant: 'error',
        message: `A GEN${firstEmpty.generation} üres. Minden generációban legalább 1 szó szükséges.`,
      })
      return
    }

    setFlash(null)
    setBusy(true)
    try {
      await replaceWordGenerations(token, selectedList.id, {
        generations: payload,
      })
      await refreshWords(selectedList.id)
      setFlash({ variant: 'success', message: 'Generációk elmentve.' })
    } catch (err) {
      setFlash({ variant: 'error', message: toUiError(err, 'Sikertelen mentés') })
    } finally {
      setBusy(false)
    }
  }

  async function executeWordlistGenerateFromParsed(
    listId: number,
    generationsPayload: { generation: number; words: string[] }[],
    parsed: ParsedWordlist,
  ) {
    setFlash(null)
    setBusy(true)
    try {
      await replaceWordGenerations(token, listId, { generations: generationsPayload })
      const data = await listWords(token, listId)
      if (selectedListId !== listId) return

      setWordsData(data)
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

      const idByGenWord = new Map<string, number>()
      for (const g of data.generations) {
        for (const w of g.words) {
          idByGenWord.set(`${g.generation}:${w.word}`, w.id)
        }
      }

      const byFrom = new Map<number, Set<number>>()
      for (const e of parsed.edges) {
        const fromId = idByGenWord.get(`${e.fromGen}:${e.fromWord}`)
        const toId = idByGenWord.get(`${e.fromGen + 1}:${e.toWord}`)
        if (fromId == null || toId == null) continue
        if (!byFrom.has(fromId)) byFrom.set(fromId, new Set())
        byFrom.get(fromId)!.add(toId)
      }

      for (const [fromId, toSet] of byFrom) {
        await replaceWordRelationsForFromWord(token, listId, fromId, {
          to_word_ids: Array.from(toSet).sort((a, b) => a - b),
        })
      }

      const maxG = data.generations.length
      if (maxG >= 2) {
        const clamped = Math.min(Math.max(1, relFromGen), maxG - 1)
        if (clamped !== relFromGen) setRelFromGen(clamped)
        const rows = await listWordRelations(token, listId, { from_generation: clamped })
        setRelationsByFrom(buildRelationsIndex(rows))
        setSelectedFromWordId(null)
        setRelDraftToIds([])
        setRelDirty(false)
      } else {
        setRelationsByFrom({})
        setSelectedFromWordId(null)
        setRelDraftToIds([])
        setRelDirty(false)
      }

      setFlash({
        variant: 'success',
        message: `Wordlist alapján generálva: ${parsed.generations.length} generáció, ${parsed.edges.length} relációs él.`,
      })
    } catch (err) {
      setFlash({ variant: 'error', message: toUiError(err, 'Sikertelen wordlist generálás') })
    } finally {
      setBusy(false)
    }
  }

  async function generateFromWordlistFromDraft() {
    if (!selectedList) return
    const listId = selectedList.id

    let parsed: ParsedWordlist
    try {
      parsed = parseWordlistText(listWordlistDraft)
    } catch (e) {
      setFlash({ variant: 'error', message: e instanceof Error ? e.message : 'Érvénytelen wordlist' })
      return
    }

    let generationsPayload: { generation: number; words: string[] }[]
    try {
      generationsPayload = dedupeGenerationsForApi(parsed.generations)
    } catch (err) {
      setFlash({ variant: 'error', message: err instanceof Error ? err.message : 'Érvénytelen szó' })
      return
    }

    const emptyAfterDedupe = generationsPayload.find((g) => g.words.length === 0)
    if (emptyAfterDedupe) {
      setFlash({
        variant: 'error',
        message: `A GEN${emptyAfterDedupe.generation} üres maradt a duplikátumok összevonása után. Győződj meg róla, hogy minden generációhoz marad legalább egy különböző szó.`,
      })
      return
    }

    const hasWords = (wordsData?.generations ?? []).some((g) => g.words.length > 0)
    if (hasWords) {
      let relationsNote = ''
      try {
        const rels = await listWordRelations(token, listId)
        if (rels.length > 0) relationsNote = ' Relációk is vannak — ezek is törlődnek és újraépülnek.'
      } catch {
        /* ignore */
      }
      setWordlistGenConfirm({ listId, generationsPayload, parsed, relationsNote })
      return
    }

    await executeWordlistGenerateFromParsed(listId, generationsPayload, parsed)
  }

  function confirmWordlistGenerateOverwrite() {
    const p = wordlistGenConfirm
    if (!p) return
    setWordlistGenConfirm(null)
    void executeWordlistGenerateFromParsed(p.listId, p.generationsPayload, p.parsed)
  }

  async function beginDeleteList(list: WordList) {
    setPendingDeleteList(list)
    setDeletePreview(null)
    setDeletePreviewError(null)
    setDeletePreviewLoading(true)
    try {
      const [wordsRes, rels, msgRes, fullList] = await Promise.all([
        listWords(token, list.id),
        listWordRelations(token, list.id),
        listWordGenMessages(token, list.id).catch(() => ({
          list_id: list.id,
          generations: [] as WordGenMessageRow[],
        })),
        getList(token, list.id),
      ])
      const generationCount = wordsRes.generations.length
      const wordCount = wordsRes.generations.reduce((acc, g) => acc + g.words.length, 0)
      let genMessageGensWithText = 0
      for (const row of msgRes.generations) {
        const c = (row.correct_answer_message ?? '').trim()
        const i = (row.incorrect_answer_message ?? '').trim()
        if (c || i) genMessageGensWithText++
      }
      const wl = (fullList.wordlist ?? '').trim()
      const notes = (fullList.notes ?? '').trim()
      setDeletePreview({
        generationCount,
        wordCount,
        relationCount: rels.length,
        genMessageGensWithText,
        hasWordlist: wl.length > 0,
        hasNotes: notes.length > 0,
      })
    } catch (err) {
      setDeletePreviewError(toUiError(err, 'Az előnézet betöltése sikertelen'))
    } finally {
      setDeletePreviewLoading(false)
    }
  }

  function cancelDeleteList() {
    setPendingDeleteList(null)
    setDeletePreview(null)
    setDeletePreviewError(null)
    setDeletePreviewLoading(false)
  }

  async function executeDeleteList() {
    const list = pendingDeleteList
    if (!list) return
    setFlash(null)
    setBusy(true)
    try {
      await deleteList(token, list.id)
      setLists((prev) => prev.filter((l) => l.id !== list.id))
      if (selectedListId === list.id) {
        setSelectedListId(null)
        setGenerationDrafts([])
        setWordsData(null)
      }
      cancelDeleteList()
      setFlash({ variant: 'success', message: `A(z) „${list.name}” lista törölve.` })
    } catch (err) {
      setFlash({ variant: 'error', message: toUiError(err, 'Sikertelen törlés') })
    } finally {
      setBusy(false)
    }
  }

  const maxGen = wordsData?.generations.length ?? generationDrafts.length
  const relFromWords =
    wordsData?.generations.find((g) => g.generation === relFromGen)?.words ?? ([] as WordGenerationsResponse['generations'][number]['words'])
  const relToWords =
    wordsData?.generations.find((g) => g.generation === relFromGen + 1)?.words ?? ([] as WordGenerationsResponse['generations'][number]['words'])

  const filteredFromWords = useMemo(() => {
    const q = relFromQuery.trim().toLowerCase()
    if (!q) return relFromWords
    return relFromWords.filter((w) => w.word.toLowerCase().includes(q))
  }, [relFromQuery, relFromWords])

  const filteredToWords = useMemo(() => {
    const q = relToQuery.trim().toLowerCase()
    if (!q) return relToWords
    return relToWords.filter((w) => w.word.toLowerCase().includes(q))
  }, [relToQuery, relToWords])

  function selectFromWord(wordId: number) {
    setSelectedFromWordId(wordId)
    const current = relationsByFrom[wordId] ?? []
    setRelDraftToIds(current)
    setRelDirty(false)
  }

  function toggleToWord(toWordId: number) {
    setRelDraftToIds((prev) => {
      const has = prev.includes(toWordId)
      const next = has ? prev.filter((x) => x !== toWordId) : [...prev, toWordId]
      next.sort((a, b) => a - b)
      return next
    })
    setRelDirty(true)
  }

  async function saveRelationsForSelected() {
    if (!selectedList || !selectedFromWordId) return
    setFlash(null)
    setBusy(true)
    try {
      await replaceWordRelationsForFromWord(token, selectedList.id, selectedFromWordId, {
        to_word_ids: relDraftToIds,
      })
      setRelationsByFrom((prev) => ({ ...prev, [selectedFromWordId]: relDraftToIds }))
      setRelDirty(false)
      const fromLabel = relFromWords.find((w) => w.id === selectedFromWordId)?.word ?? `#${selectedFromWordId}`
      setFlash({ variant: 'success', message: `Relációk elmentve: ${fromLabel} → ${relDraftToIds.length} cél.` })
    } catch (err) {
      setFlash({ variant: 'error', message: toUiError(err, 'Sikertelen reláció mentés') })
    } finally {
      setBusy(false)
    }
  }

  function closeTreeModal() {
    setTreeOpen(false)
    setTreeLineDeletePending(null)
    setTreeNotice(null)
  }

  function closeSentencesModal() {
    setSentencesOpen(false)
    setSentencesError(null)
    setSentencesPaths([])
    setSentencesMaxGen(0)
    setSentencesListId(null)
    setSentencesGenMessages(null)
    setSentencesGenMsgLoadError(null)
  }

  async function openSentencesView(list: WordList) {
    setSentencesOpen(true)
    setSentencesBusy(true)
    setSentencesError(null)
    setSentencesListName(list.name)
    setSentencesListId(list.id)
    setSentencesPaths([])
    setSentencesMaxGen(0)
    setSentencesGenMessages(null)
    setSentencesGenMsgLoadError(null)
    try {
      const [words, rels] = await Promise.all([listWords(token, list.id), listWordRelations(token, list.id)])
      const maxG = words.generations.length > 0 ? Math.max(...words.generations.map((g) => g.generation)) : 0
      setSentencesMaxGen(maxG)
      setSentencesPaths(enumerateFullRelationPaths(words, rels))
      if (maxG === 0) {
        setSentencesGenMessages([])
        setSentencesGenMsgLoadError(null)
      } else {
        try {
          const msgRes = await listWordGenMessages(token, list.id)
          setSentencesGenMessages(msgRes.generations)
          setSentencesGenMsgLoadError(null)
        } catch (msgErr) {
          setSentencesGenMsgLoadError(toUiError(msgErr, 'GEN üzenetek betöltése sikertelen'))
          setSentencesGenMessages(emptyGenMessageRows(maxG))
        }
      }
    } catch (err) {
      setSentencesError(toUiError(err, 'Sikertelen mondatok betöltés'))
      setSentencesPaths([])
      setSentencesGenMessages(null)
      setSentencesGenMsgLoadError(null)
    } finally {
      setSentencesBusy(false)
    }
  }

  async function openTreeView(list: WordList) {
    setTreeOpen(true)
    setTreeBusy(true)
    setTreeError(null)
    setTreeNotice(null)
    setTreeLineDeletePending(null)
    setTreeListId(list.id)
    setTreeListName(list.name)
    setTreeWordsData(null)
    setTreeRelations([])
    try {
      const [words, relations] = await Promise.all([
        listWords(token, list.id),
        listWordRelations(token, list.id),
      ])
      setTreeWordsData(words)
      setTreeRelations(relations)
    } catch (err) {
      setTreeError(toUiError(err, 'Sikertelen fa nézet betöltés'))
    } finally {
      setTreeBusy(false)
    }
  }

  function relationExists(fromId: number, toId: number): boolean {
    return treeRelations.some((r) => r.from_word_id === fromId && r.to_word_id === toId)
  }

  function getNodeById(wordId: number) {
    return treeLayout.nodes.find((n) => n.id === wordId) ?? null
  }

  function canLinkByRule(fromId: number, toId: number): boolean {
    const from = getNodeById(fromId)
    const to = getNodeById(toId)
    if (!from || !to) return false
    return to.generation === from.generation + 1
  }

  async function toggleTreeRelation(fromId: number, toId: number) {
    if (!treeListId) return
    if (!canLinkByRule(fromId, toId)) return

    const hadRelation = relationExists(fromId, toId)
    const currentToIds = treeRelations.filter((r) => r.from_word_id === fromId).map((r) => r.to_word_id)
    const nextToIds = hadRelation ? currentToIds.filter((id) => id !== toId) : [...currentToIds, toId]

    setTreeBusy(true)
    setTreeError(null)
    try {
      await replaceWordRelationsForFromWord(token, treeListId, fromId, {
        to_word_ids: Array.from(new Set(nextToIds)).sort((a, b) => a - b),
      })
      if (hadRelation) {
        setTreeRelations((prev) => prev.filter((r) => !(r.from_word_id === fromId && r.to_word_id === toId)))
      } else {
        const refreshed = await listWordRelations(token, treeListId)
        setTreeRelations(refreshed)
      }
      setTreeNotice(hadRelation ? 'Reláció törölve.' : 'Reláció létrehozva.')
    } catch (err) {
      setTreeError(toUiError(err, 'Sikertelen reláció mentés (fa nézet)'))
    } finally {
      setTreeBusy(false)
    }
  }

  async function confirmTreeLineDelete() {
    if (!treeListId || !treeLineDeletePending) return
    setTreeBusy(true)
    setTreeError(null)
    try {
      const rid = treeLineDeletePending.relationId
      await deleteWordRelation(token, treeListId, rid)
      setTreeRelations((prev) => prev.filter((r) => r.id !== rid))
      setTreeLineDeletePending(null)
      setTreeNotice('Reláció törölve.')
    } catch (err) {
      setTreeError(toUiError(err, 'Sikertelen reláció törlés'))
    } finally {
      setTreeBusy(false)
    }
  }

  useEffect(() => {
    if (!treeOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (treeLineDeletePending) return
      setTreeOpen(false)
      setTreeLineDeletePending(null)
      setTreeNotice(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [treeOpen, treeLineDeletePending])

  useEffect(() => {
    if (!sentencesOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setSentencesOpen(false)
      setSentencesError(null)
      setSentencesPaths([])
      setSentencesMaxGen(0)
      setSentencesListId(null)
      setSentencesGenMessages(null)
      setSentencesGenMsgLoadError(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sentencesOpen])

  useEffect(() => {
    if (!wordlistFriendlyOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setWordlistFriendlyOpen(false)
      setWordlistFriendlyPayload(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [wordlistFriendlyOpen])

  function closeWordlistFriendlyModal() {
    setWordlistFriendlyOpen(false)
    setWordlistFriendlyPayload(null)
  }

  async function openWordlistFriendlyModal() {
    if (!selectedList) return
    setWordlistFriendlyPrepBusy(true)
    try {
      const payload = await buildFriendlyWordlistInitial({
        token,
        listId: selectedList.id,
        wordlistDraft: listWordlistDraft,
        wordsData: wordsData,
      })
      setWordlistFriendlyPayload(payload)
      setWordlistFriendlyOpen(true)
    } catch (err) {
      setFlash({ variant: 'error', message: toUiError(err, 'Nem sikerült előkészíteni a táblázatot') })
    } finally {
      setWordlistFriendlyPrepBusy(false)
    }
  }

  const treeLayout = useMemo(() => {
    const generations = treeWordsData?.generations ?? []
    const genCount = generations.length
    if (genCount === 0) {
      return {
        width: 900,
        height: 320,
        lines: [] as Array<{
          key: string
          relationId: number
          fromId: number
          toId: number
          x1: number
          y1: number
          x2: number
          y2: number
        }>,
        nodes: [] as Array<{ id: number; generation: number; word: string; x: number; y: number; rx: number; related: boolean }>,
      }
    }

    const colGap = 290
    const rowGap = 72
    const padX = 120
    const padY = 100
    const maxWords = Math.max(...generations.map((g) => g.words.length), 1)
    const width = Math.max(960, padX * 2 + (genCount - 1) * colGap + 240)
    const height = Math.max(360, padY * 2 + (maxWords - 1) * rowGap + 60)

    const relatedWordIds = new Set<number>()
    treeRelations.forEach((r) => {
      relatedWordIds.add(r.from_word_id)
      relatedWordIds.add(r.to_word_id)
    })

    const posByWordId = new Map<number, { x: number; y: number }>()
    const nodes: Array<{
      id: number
      generation: number
      word: string
      x: number
      y: number
      rx: number
      related: boolean
    }> = []

    generations.forEach((g, gIdx) => {
      const x = padX + gIdx * colGap
      g.words.forEach((w, wIdx) => {
        const y = padY + wIdx * rowGap
        const rx = Math.max(34, Math.min(130, 18 + w.word.length * 4.8))
        posByWordId.set(w.id, { x, y })
        nodes.push({
          id: w.id,
          generation: g.generation,
          word: w.word,
          x,
          y,
          rx,
          related: relatedWordIds.has(w.id),
        })
      })
    })

    const lines = treeRelations
      .map((r) => {
        const from = posByWordId.get(r.from_word_id)
        const to = posByWordId.get(r.to_word_id)
        if (!from || !to) return null
        return {
          key: `${r.from_word_id}-${r.to_word_id}-${r.id}`,
          relationId: r.id,
          fromId: r.from_word_id,
          toId: r.to_word_id,
          x1: from.x,
          y1: from.y,
          x2: to.x,
          y2: to.y,
        }
      })
      .filter(
        (
          item,
        ): item is {
          key: string
          relationId: number
          fromId: number
          toId: number
          x1: number
          y1: number
          x2: number
          y2: number
        } => item !== null,
      )

    return { width, height, lines, nodes }
  }, [treeWordsData, treeRelations])

  const treeDragPreview = useMemo(() => {
    if (!treeDragFromId || !treeDragCursor) return null
    const from = treeLayout.nodes.find((n) => n.id === treeDragFromId)
    if (!from) return null
    return {
      x1: from.x,
      y1: from.y,
      x2: treeDragCursor.x,
      y2: treeDragCursor.y,
      ok: treeDragTargetId != null && canLinkByRule(treeDragFromId, treeDragTargetId),
    }
  }, [treeDragFromId, treeDragCursor, treeDragTargetId, treeLayout.nodes])

  function mapClientToSvg(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const sx = treeLayout.width / Math.max(1, rect.width)
    const sy = treeLayout.height / Math.max(1, rect.height)
    return {
      x: (e.clientX - rect.left) * sx,
      y: (e.clientY - rect.top) * sy,
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

      {flash ? (
        <AlertBanner variant={flash.variant} onDismiss={() => setFlash(null)}>
          {flash.message}
        </AlertBanner>
      ) : null}

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
                  <tr
                    key={l.id}
                    className={selectedListId === l.id ? 'listPickRow listPickRow--selected' : 'listPickRow'}
                    aria-current={selectedListId === l.id ? true : undefined}
                  >
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
                      <div className="row" style={{ flexWrap: 'wrap' }}>
                        <button type="button" className="counter" onClick={() => void openTreeView(l)} disabled={busy}>
                          Fa nézet
                        </button>
                        <button type="button" className="counter" onClick={() => void openSentencesView(l)} disabled={busy}>
                          GEN üzenetek / mondatok
                        </button>
                        <button
                          className="danger"
                          onClick={() => void beginDeleteList(l)}
                          disabled={busy || pendingDeleteList !== null}
                        >
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
                <label className="field">
                  <span className="label">Megjegyzés (notes)</span>
                  <textarea
                    value={listNotesDraft}
                    onChange={(e) => setListNotesDraft(e.target.value)}
                    rows={3}
                    placeholder="Többsoros megjegyzés a listához…"
                    className="listNotesArea"
                  />
                </label>
                <div className="field">
                  <div className="row row--spread" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <span className="label" style={{ marginBottom: 0 }}>
                      Wordlist (szöveg)
                    </span>
                    <button
                      type="button"
                      className="counter"
                      disabled={busy || wordlistFriendlyPrepBusy}
                      onClick={() => void openWordlistFriendlyModal()}
                    >
                      {wordlistFriendlyPrepBusy ? 'Táblázat…' : 'Felhasználóbarát'}
                    </button>
                  </div>
                  <p className="muted" style={{ margin: '0 0 6px', fontSize: 13, lineHeight: 1.4 }}>
                    A <code>;</code> a GEN elválasztó. A <code>*</code>-gal kezdődő sor csak szavakat vesz fel a generációkba (kakuktojás),{' '}
                    <strong>relációt nem alkot</strong> — élek csak a * nélküli sorokból.
                  </p>
                  <textarea
                    id="adminListWordlistDraft"
                    value={listWordlistDraft}
                    onChange={(e) => setListWordlistDraft(e.target.value)}
                    rows={6}
                    placeholder="pl. door;world;sun;…"
                    className="listWordlistArea"
                    aria-label="Wordlist szöveg"
                  />
                  <div className="row" style={{ marginTop: 8, flexWrap: 'wrap', gap: 8 }}>
                    <button
                      type="button"
                      className="primary"
                      disabled={busy}
                      onClick={() => void generateFromWordlistFromDraft()}
                    >
                      Szavak és relációk generálása a wordlistből
                    </button>
                  </div>
                </div>
                <div className="row">
                  <button className="primary" disabled={busy}>
                    {busy ? 'Mentés…' : 'Lista adatainak mentése'}
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

              <div className="panel">
                <h3 style={{ marginTop: 0 }}>Relációk (GENn → GENn+1)</h3>
                {maxGen < 2 ? (
                  <p className="muted">Legalább 2 generáció kell a relációkhoz.</p>
                ) : (
                  <>
                    <div className="grid2">
                      <label className="field">
                        <span className="label">Pár</span>
                        <select
                          value={relFromGen}
                          onChange={(e) => {
                            const v = Number(e.target.value)
                            setRelFromGen(v)
                            setSelectedFromWordId(null)
                            setRelDraftToIds([])
                            setRelDirty(false)
                          }}
                          disabled={busy}
                        >
                          {Array.from({ length: Math.max(1, maxGen - 1) }, (_, i) => i + 1).map((g) => (
                            <option key={g} value={g}>
                              GEN{g} → GEN{g + 1}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="row" style={{ justifyContent: 'flex-end', alignItems: 'end' }}>
                        <button
                          type="button"
                          className="primary"
                          onClick={() => void saveRelationsForSelected()}
                          disabled={busy || !selectedFromWordId}
                          title={!selectedFromWordId ? 'Válassz egy GEN' + relFromGen + ' szót.' : undefined}
                        >
                          {busy ? 'Mentés…' : relDirty ? 'Relációk mentése*' : 'Relációk mentése'}
                        </button>
                      </div>
                    </div>

                    <div className="grid2" style={{ alignItems: 'start' }}>
                      <div className="panel" style={{ margin: 0 }}>
                        <h4 style={{ marginTop: 0 }}>GEN{relFromGen} (forrás)</h4>
                        <label className="field">
                          <span className="label">Keresés</span>
                          <input
                            value={relFromQuery}
                            onChange={(e) => setRelFromQuery(e.target.value)}
                            placeholder="pl. one"
                            disabled={busy}
                          />
                        </label>
                        <div className="tableWrap" style={{ maxHeight: 280 }}>
                          <table className="table">
                            <thead>
                              <tr>
                                <th>Szó</th>
                                <th>Célok</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredFromWords.map((w) => (
                                <tr key={w.id}>
                                  <td>
                                    <button
                                      type="button"
                                      className={selectedFromWordId === w.id ? 'menuItem menuItem--active' : 'menuItem'}
                                      style={{ textAlign: 'left', width: '100%' }}
                                      onClick={() => selectFromWord(w.id)}
                                      disabled={busy}
                                    >
                                      {w.word}
                                    </button>
                                  </td>
                                  <td>{(relationsByFrom[w.id] ?? []).length}</td>
                                </tr>
                              ))}
                              {!busy && filteredFromWords.length === 0 ? (
                                <tr>
                                  <td colSpan={2}>Nincs találat.</td>
                                </tr>
                              ) : null}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="panel" style={{ margin: 0 }}>
                        <h4 style={{ marginTop: 0 }}>GEN{relFromGen + 1} (cél)</h4>
                        {!selectedFromWordId ? (
                          <p className="muted">Válassz egy forrás szót bal oldalt.</p>
                        ) : (
                          <>
                            <label className="field">
                              <span className="label">Keresés</span>
                              <input
                                value={relToQuery}
                                onChange={(e) => setRelToQuery(e.target.value)}
                                placeholder="pl. sleep"
                                disabled={busy}
                              />
                            </label>

                            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
                              <span className="muted">
                                Kijelölve: <strong>{relDraftToIds.length}</strong>
                              </span>
                              <div className="row">
                                <button
                                  type="button"
                                  className="counter"
                                  onClick={() => {
                                    setRelDraftToIds(relToWords.map((w) => w.id))
                                    setRelDirty(true)
                                  }}
                                  disabled={busy || relToWords.length === 0}
                                >
                                  Összes
                                </button>
                                <button
                                  type="button"
                                  className="counter"
                                  onClick={() => {
                                    setRelDraftToIds([])
                                    setRelDirty(true)
                                  }}
                                  disabled={busy}
                                >
                                  Semmi
                                </button>
                              </div>
                            </div>

                            <div className="relChips" style={{ marginBottom: 12 }}>
                              {relDraftToIds.slice(0, 24).map((id) => {
                                const w = relToWords.find((x) => x.id === id)
                                return (
                                  <span key={id} className="chip">
                                    {w?.word ?? `#${id}`}
                                  </span>
                                )
                              })}
                              {relDraftToIds.length > 24 ? (
                                <span className="chip chip--muted">+{relDraftToIds.length - 24}…</span>
                              ) : null}
                            </div>

                            <div className="tableWrap" style={{ maxHeight: 280 }}>
                              <table className="table">
                                <thead>
                                  <tr>
                                    <th> </th>
                                    <th>Szó</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {filteredToWords.map((w) => (
                                    <tr key={w.id}>
                                      <td style={{ width: 40 }}>
                                        <input
                                          type="checkbox"
                                          checked={relDraftToIds.includes(w.id)}
                                          onChange={() => toggleToWord(w.id)}
                                          disabled={busy}
                                        />
                                      </td>
                                      <td>{w.word}</td>
                                    </tr>
                                  ))}
                                  {!busy && filteredToWords.length === 0 ? (
                                    <tr>
                                      <td colSpan={2}>Nincs találat.</td>
                                    </tr>
                                  ) : null}
                                </tbody>
                              </table>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {createPortal(
        <>
          <ConfirmModal
            open={pendingDeleteList !== null}
            title="Lista törlése"
            tone="danger"
            confirmLabel="Törlés"
            busy={busy || deletePreviewLoading}
            onCancel={cancelDeleteList}
            onConfirm={() => void executeDeleteList()}
          >
            {pendingDeleteList ? (
              <>
                <p className="muted" style={{ margin: '0 0 12px' }}>
                  Biztosan törlöd a <strong>{pendingDeleteList.name}</strong> szólistát? Ez nem vonható vissza.
                </p>
                <p className="muted" style={{ margin: '0 0 10px', fontSize: 14 }}>
                  A szerver a listával együtt törli a szavakat, a relációkat és a generációs üzeneteket is (lásd API).
                  A lista rekordhoz tartozó megjegyzés és wordlist szöveg is elvész.
                </p>
                {deletePreviewLoading ? (
                  <p className="muted" style={{ margin: 0 }}>
                    Adatok betöltése a figyelmeztetéshez…
                  </p>
                ) : null}
                {deletePreviewError ? (
                  <p className="muted" style={{ margin: '10px 0 0', color: 'var(--text-h)' }}>
                    {deletePreviewError} — a törlés ettől még végrehajtható.
                  </p>
                ) : null}
                {!deletePreviewLoading && deletePreview ? (
                  <div className="deleteListPreview">
                    <div className="deleteListPreview__title">Ehhez a listához tartozó adatok (törlődnek):</div>
                    <ul className="deleteListPreview__list">
                      <li>
                        Generációk és szavak: <strong>{deletePreview.generationCount}</strong> generáció,{' '}
                        <strong>{deletePreview.wordCount}</strong> szó
                      </li>
                      {deletePreview.relationCount > 0 ? (
                        <li>
                          Relációk: <strong>{deletePreview.relationCount}</strong> db
                        </li>
                      ) : (
                        <li className="muted">Relációk: nincs</li>
                      )}
                      {deletePreview.genMessageGensWithText > 0 ? (
                        <li>
                          Generációs üzenetek: <strong>{deletePreview.genMessageGensWithText}</strong> generációnál van
                          kitöltött szöveg
                        </li>
                      ) : (
                        <li className="muted">Generációs üzenetek: nincs kitöltött mező</li>
                      )}
                      {deletePreview.hasWordlist ? (
                        <li>
                          Wordlist (szöveg): <strong>van tárolt tartalom</strong> — törlődik
                        </li>
                      ) : (
                        <li className="muted">Wordlist (szöveg): üres</li>
                      )}
                      {deletePreview.hasNotes ? (
                        <li>
                          Megjegyzés (notes): <strong>van tartalom</strong> — törlődik
                        </li>
                      ) : (
                        <li className="muted">Megjegyzés (notes): üres</li>
                      )}
                    </ul>
                  </div>
                ) : null}
              </>
            ) : null}
          </ConfirmModal>

          {wordlistFriendlyOpen && wordlistFriendlyPayload ? (
            <WordlistFriendlyModal
              open
              payload={wordlistFriendlyPayload}
              onClose={closeWordlistFriendlyModal}
              onApply={(text) => setListWordlistDraft(text)}
            />
          ) : null}

          {treeOpen ? (
            <div
              className="confirmModal__root"
              role="presentation"
              onMouseDown={(e) => e.target === e.currentTarget && closeTreeModal()}
            >
              <div className="confirmModal__backdrop" aria-hidden />
              <div
                className="confirmModal__panel treeModal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="treeModalTitle"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="row row--spread" style={{ marginBottom: 10 }}>
                  <h3 id="treeModalTitle" className="confirmModal__title" style={{ margin: 0 }}>
                    Fa nézet — {treeListName}
                  </h3>
                  <button type="button" className="danger" onClick={closeTreeModal} disabled={treeBusy}>
                    × Bezárás
                  </button>
                </div>

                {treeNotice ? (
                  <p className="muted" style={{ marginBottom: 10, marginTop: 0 }}>
                    {treeNotice}
                  </p>
                ) : null}

                {treeError ? (
                  <AlertBanner variant="error" onDismiss={() => setTreeError(null)}>
                    {treeError}
                  </AlertBanner>
                ) : null}

                {treeBusy ? (
                  <p className="muted">Betöltés...</p>
                ) : treeWordsData == null || treeWordsData.generations.length === 0 ? (
                  <p className="muted">Nincs megjeleníthető adat.</p>
                ) : (
                  <div className="treeCanvasWrap">
                    <svg
                      width={treeLayout.width}
                      height={treeLayout.height}
                      className="treeCanvas"
                      viewBox={`0 0 ${treeLayout.width} ${treeLayout.height}`}
                      onMouseMove={(e) => {
                        e.preventDefault()
                        if (!treeDragFromId) return
                        setTreeDragCursor(mapClientToSvg(e))
                      }}
                      onMouseUp={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setTreeDragFromId(null)
                        setTreeDragTargetId(null)
                        setTreeDragCursor(null)
                      }}
                      onMouseLeave={() => {
                        if (!treeDragFromId) return
                        setTreeDragTargetId(null)
                      }}
                    >
                      {treeLayout.lines.map((ln) => {
                        const fromLabel = treeLayout.nodes.find((n) => n.id === ln.fromId)?.word ?? `#${ln.fromId}`
                        const toLabel = treeLayout.nodes.find((n) => n.id === ln.toId)?.word ?? `#${ln.toId}`
                        return (
                          <g key={ln.key}>
                            <line
                              x1={ln.x1}
                              y1={ln.y1}
                              x2={ln.x2}
                              y2={ln.y2}
                              className="treeLine"
                              pointerEvents="none"
                            />
                            <line
                              x1={ln.x1}
                              y1={ln.y1}
                              x2={ln.x2}
                              y2={ln.y2}
                              className="treeLine treeLine--hit"
                              pointerEvents="stroke"
                              onDoubleClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                if (treeBusy || treeDragFromId) return
                                setTreeLineDeletePending({
                                  relationId: ln.relationId,
                                  fromLabel,
                                  toLabel,
                                })
                              }}
                            />
                          </g>
                        )
                      })}

                  {treeDragPreview ? (
                    <line
                      x1={treeDragPreview.x1}
                      y1={treeDragPreview.y1}
                      x2={treeDragPreview.x2}
                      y2={treeDragPreview.y2}
                      className={treeDragPreview.ok ? 'treeLine treeLine--preview' : 'treeLine treeLine--invalid'}
                    />
                  ) : null}

                  {treeWordsData.generations.map((g, gIdx) => (
                    <text
                      key={`gen-${g.generation}`}
                      x={120 + gIdx * 290}
                      y={44}
                      textAnchor="middle"
                      className="treeGenLabel"
                    >
                      GEN{g.generation}
                    </text>
                  ))}

                  {treeLayout.nodes.map((n) => (
                    <g
                      key={`node-${n.id}`}
                      transform={`translate(${n.x}, ${n.y})`}
                      className={treeDragFromId === n.id ? 'treeNodeGroup treeNodeGroup--dragging' : 'treeNodeGroup'}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        if (treeBusy) return
                        if (!treeWordsData) return
                        const hasNextGen = treeWordsData.generations.some((g) => g.generation === n.generation + 1)
                        if (!hasNextGen) return
                        setTreeDragFromId(n.id)
                        setTreeDragTargetId(null)
                        setTreeDragCursor({ x: n.x, y: n.y })
                      }}
                      onMouseEnter={() => {
                        if (!treeDragFromId) return
                        if (treeDragFromId === n.id) return
                        setTreeDragTargetId(n.id)
                      }}
                      onMouseUp={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        if (!treeDragFromId) return
                        if (treeDragFromId === n.id) {
                          setTreeDragFromId(null)
                          setTreeDragTargetId(null)
                          setTreeDragCursor(null)
                          return
                        }
                        const fromId = treeDragFromId
                        setTreeDragFromId(null)
                        setTreeDragTargetId(null)
                        setTreeDragCursor(null)
                        void toggleTreeRelation(fromId, n.id)
                      }}
                    >
                      <ellipse
                        cx={0}
                        cy={0}
                        rx={n.rx}
                        ry={22}
                        className={
                          n.related
                            ? treeDragTargetId === n.id && treeDragFromId != null && canLinkByRule(treeDragFromId, n.id)
                              ? 'treeNode treeNode--related treeNode--target'
                              : 'treeNode treeNode--related'
                            : treeDragTargetId === n.id && treeDragFromId != null && canLinkByRule(treeDragFromId, n.id)
                              ? 'treeNode treeNode--target'
                              : 'treeNode'
                        }
                      />
                      <text x={0} y={5} textAnchor="middle" className="treeNodeLabel">
                        {n.word}
                      </text>
                    </g>
                  ))}
                    </svg>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {sentencesOpen ? (
            <div
              className="confirmModal__root"
              role="presentation"
              onMouseDown={(e) => e.target === e.currentTarget && closeSentencesModal()}
            >
              <div className="confirmModal__backdrop" aria-hidden />
              <div
                className="confirmModal__panel sentenceModal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="sentencesModalTitle"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="row row--spread" style={{ marginBottom: 10 }}>
                  <h3 id="sentencesModalTitle" className="confirmModal__title" style={{ margin: 0 }}>
                    GEN üzenetek / mondatok — {sentencesListName}
                  </h3>
                  <button type="button" className="danger" onClick={closeSentencesModal}>
                    × Bezárás
                  </button>
                </div>

                <SentenceModalContent
                  token={token}
                  listId={sentencesListId ?? 0}
                  sentencesBusy={sentencesBusy}
                  sentencesError={sentencesError}
                  sentencesMaxGen={sentencesMaxGen}
                  sentencesPaths={sentencesPaths}
                  genMsgLoadError={sentencesGenMsgLoadError}
                  genMessageRows={sentencesBusy ? null : sentencesGenMessages}
                  onDismissError={() => setSentencesError(null)}
                  onDismissGenMsgError={() => setSentencesGenMsgLoadError(null)}
                  onGenMessagesSaved={(rows) => setSentencesGenMessages(rows)}
                  toUiError={toUiError}
                />
              </div>
            </div>
          ) : null}

          <ConfirmModal
            open={treeLineDeletePending != null}
            title="Reláció törlése?"
            tone="danger"
            confirmLabel="Törlés"
            busy={treeBusy}
            onConfirm={() => void confirmTreeLineDelete()}
            onCancel={() => setTreeLineDeletePending(null)}
          >
            {treeLineDeletePending ? (
              <>
                Biztosan törlöd a <strong>{treeLineDeletePending.fromLabel}</strong> →{' '}
                <strong>{treeLineDeletePending.toLabel}</strong> relációt?
              </>
            ) : null}
          </ConfirmModal>

          <ConfirmModal
            open={wordlistGenConfirm !== null}
            title="Wordlist alapú generálás"
            tone="primary"
            confirmLabel="Generálás"
            busy={busy}
            onCancel={() => setWordlistGenConfirm(null)}
            onConfirm={() => confirmWordlistGenerateOverwrite()}
          >
            {wordlistGenConfirm ? (
              <p className="muted" style={{ margin: 0 }}>
                Már vannak szavak a generációknál.{wordlistGenConfirm.relationsNote} A generálás felülírja a
                szavakat és a relációkat a wordlist alapján.
              </p>
            ) : null}
          </ConfirmModal>
        </>,
        document.body,
      )}

    </div>
  )
}
