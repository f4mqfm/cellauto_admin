import type { CSSProperties, ReactNode } from 'react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import {
  getStaffTaskEvaluation,
  listStaffTaskEvaluations,
  listUsers,
  type TaskEvaluationDetail,
  type TaskEvaluationSummary,
  type User,
} from '../lib/api'

type Props = {
  token: string
}

type ColumnFilters = {
  from: string
  to: string
  user_id: string
  task_name: string
  note: string
}

/**
 * `task_evaluations.date` feldolgozása (időzóna):
 * - **ISO / Z / offset**: egyértelmű pillanat → `toLocaleString` a böngésző helyi idejére vált.
 * - **`Y-m-d H:i:s` időzóna nélkül** (tipikusan így látszik phpMyAdminban): nem UTC-hez hasonlítjuk,
 *   hanem a számjegyeket **lokális falidőként** építjük össze (`new Date(y, m-1, d, …)`).
 *   Így a felületen ugyanaz az óra:perc másodperc jelenik meg, mint a táblában — nem tolódik el
 *   pár órával azért, mert naív stringet tévesen UTC-nek vettük volna.
 */
function parseTaskEvaluationDate(raw: string): Date {
  const s = raw.trim()
  if (!s) return new Date(Number.NaN)

  /* Z / ±offset → abszolút pillanat */
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) {
    const dt = new Date(s)
    if (!Number.isNaN(dt.getTime())) return dt
  }

  /* ISO T-vel */
  if (/^\d{4}-\d{2}-\d{2}T\d/.test(s)) {
    const dt = new Date(s)
    if (!Number.isNaN(dt.getTime())) return dt
  }

  /* Naív MySQL / Laravel string: ugyanaz a „falióra”, mint phpMyAdmin cellában */
  const naive = s.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})(\.\d+)?$/)
  if (naive) {
    const y = Number(naive[1])
    const mo = Number(naive[2])
    const d = Number(naive[3])
    const h = Number(naive[4])
    const mi = Number(naive[5])
    const sec = Number(naive[6])
    return new Date(y, mo - 1, d, h, mi, sec)
  }

  return new Date(s)
}

function formatTaskEvaluationDateDisplay(raw: string): string {
  const dt = parseTaskEvaluationDate(raw)
  if (Number.isNaN(dt.getTime())) return raw
  return dt.toLocaleString('hu-HU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function taskEvaluationDateIsoAttr(raw: string): string {
  const dt = parseTaskEvaluationDate(raw)
  if (Number.isNaN(dt.getTime())) return raw
  return dt.toISOString()
}

function lineLooksLikeChain(s: string) {
  return s.includes('->') || s.includes('→') || s.includes('⇒')
}

/**
 * Mondat eredmény: minden `:`-ra végződő sor új szakasz címe (nem listaelem).
 * Így a „Helytelen mondatok listája:” nem kerül bullet alá az „Egyedi mondatok:” alatt.
 */
function FormattedSentenceResult({ text }: { text: string }) {
  const raw = text.trim()
  if (!raw) return null

  const lines = raw.split('\n').map((l) => l.trimEnd())
  const sections: ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i].trim()
    if (!line) {
      i += 1
      continue
    }

    if (line.endsWith(':')) {
      const title = line
      const items: string[] = []
      i += 1
      while (i < lines.length) {
        const next = lines[i].trim()
        if (!next) {
          i += 1
          continue
        }
        if (next.endsWith(':')) {
          break
        }
        items.push(lines[i])
        i += 1
      }

      sections.push(
        <div key={`sec-${sections.length}-${title.slice(0, 24)}`} className="examDetailModal__sentenceBlock">
          <div className="examDetailModal__sentenceBlockTitle">{title}</div>
          {items.length > 0 ? (
            <ul className="examDetailModal__sentenceList">
              {items.map((item, li) => (
                <li
                  key={`item-${li}`}
                  className={lineLooksLikeChain(item) ? 'examDetailModal__sentenceChain' : undefined}
                >
                  {item.trim()}
                </li>
              ))}
            </ul>
          ) : null}
        </div>,
      )
      continue
    }

    sections.push(
      <p key={`free-${i}`} className={lineLooksLikeChain(line) ? 'examDetailModal__sentenceChainLine' : undefined}>
        {line}
      </p>,
    )
    i += 1
  }

  return <div className="examDetailModal__sentenceFormatted">{sections}</div>
}

/** Cella %: (jó − rossz − üres) / összes_jó_cellára × 100 */
function cellaPercent(row: TaskEvaluationSummary): string {
  if (row.total_good_cell === 0) return '—'
  const n = ((row.good_cell - row.bad_cell - row.unfilled_cell) / row.total_good_cell) * 100
  if (!Number.isFinite(n)) return '—'
  return `${n.toFixed(1)} %`
}

/** Mondat %: jó / lehetséges × 100 (a leírásban a /100 valószínű elírás) */
function mondatPercent(row: TaskEvaluationSummary): string {
  if (row.possible_sentence === 0) return '—'
  const n = (row.good_sentence / row.possible_sentence) * 100
  if (!Number.isFinite(n)) return '—'
  return `${n.toFixed(1)} %`
}

function filterInputStyle(): CSSProperties {
  return {
    width: '100%',
    maxWidth: '100%',
    boxSizing: 'border-box',
    fontSize: 13,
    padding: '6px 8px',
    marginTop: 6,
    font: 'inherit',
  }
}

/** datetime-local mezők ne nyúljanak szét a táblában */
const dateFilterColumnStyle: CSSProperties = {
  verticalAlign: 'top',
  fontWeight: 400,
  width: '12rem',
  maxWidth: '13rem',
}

function dateFilterInputStyle(): CSSProperties {
  return {
    ...filterInputStyle(),
    display: 'block',
    width: '100%',
    maxWidth: '100%',
    boxSizing: 'border-box',
  }
}

export function TaskEvaluationsAdmin(props: Props) {
  const { token } = props
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<TaskEvaluationSummary[]>([])
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [perPage] = useState(10)
  const [users, setUsers] = useState<User[]>([])
  const [colFilters, setColFilters] = useState<ColumnFilters>({
    from: '',
    to: '',
    user_id: '',
    task_name: '',
    note: '',
  })
  const [debouncedText, setDebouncedText] = useState({ task_name: '', note: '' })

  const [modalId, setModalId] = useState<number | null>(null)
  const [modalDetail, setModalDetail] = useState<TaskEvaluationDetail | null>(null)
  const [modalBusy, setModalBusy] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)

  const closeModal = useCallback(() => {
    setModalId(null)
    setModalDetail(null)
    setModalError(null)
  }, [])

  const userOptions = useMemo(() => users.slice().sort((a, b) => a.username.localeCompare(b.username)), [users])

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedText({ task_name: colFilters.task_name.trim(), note: colFilters.note.trim() })
    }, 400)
    return () => window.clearTimeout(t)
  }, [colFilters.task_name, colFilters.note])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const usersRes = await listUsers(token)
        if (!cancelled) setUsers(usersRes)
      } catch {
        /* szűrő opcionális */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  const filterKey = useMemo(
    () =>
      [
        colFilters.from,
        colFilters.to,
        colFilters.user_id,
        debouncedText.task_name,
        debouncedText.note,
      ].join('|'),
    [
      colFilters.from,
      colFilters.to,
      colFilters.user_id,
      debouncedText.task_name,
      debouncedText.note,
    ],
  )

  useLayoutEffect(() => {
    setPage(1)
  }, [filterKey])

  useEffect(() => {
    closeModal()
  }, [filterKey, page, closeModal])

  const loadList = useCallback(async () => {
    setError(null)
    setBusy(true)
    try {
      const listRes = await listStaffTaskEvaluations(token, {
        page,
        per_page: perPage,
        user_id: colFilters.user_id ? Number(colFilters.user_id) : undefined,
        from: colFilters.from || undefined,
        to: colFilters.to || undefined,
        task_name: debouncedText.task_name || undefined,
        note: debouncedText.note || undefined,
      })
      setRows(listRes.data)
      setLastPage(listRes.last_page)
      setTotal(listRes.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sikertelen betöltés')
    } finally {
      setBusy(false)
    }
  }, [
    token,
    page,
    perPage,
    colFilters.from,
    colFilters.to,
    colFilters.user_id,
    debouncedText.task_name,
    debouncedText.note,
  ])

  useEffect(() => {
    void loadList()
  }, [loadList])

  useEffect(() => {
    if (!modalId) return
    let cancelled = false
    setModalBusy(true)
    setModalError(null)
    setModalDetail(null)
    void (async () => {
      try {
        const d = await getStaffTaskEvaluation(token, modalId)
        if (!cancelled) setModalDetail(d)
      } catch (err) {
        if (!cancelled) setModalError(err instanceof Error ? err.message : 'Betöltés sikertelen')
      } finally {
        if (!cancelled) setModalBusy(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [modalId, token])

  useEffect(() => {
    if (!modalId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modalId, closeModal])

  function openModal(id: number) {
    setModalId(id)
  }

  return (
    <div className="card">
      <div className="row row--spread">
        <h2>Vizsgák megtekintése</h2>
        <button className="counter" onClick={() => void loadList()} disabled={busy}>
          {busy ? 'Betöltés…' : 'Frissítés'}
        </button>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <div className="row row--spread" style={{ marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
        <span className="muted" style={{ fontSize: 14 }}>
          Összesen <strong>{total}</strong> · Oldal <strong>{page}</strong> / <strong>{lastPage}</strong>
        </span>
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="counter" disabled={busy || page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Előző
          </button>
          <button type="button" className="counter" disabled={busy || page >= lastPage} onClick={() => setPage((p) => p + 1)}>
            Következő
          </button>
        </div>
      </div>

      <div className="tableWrap">
        <table className="table">
          <colgroup>
            <col style={{ width: '12rem' }} />
          </colgroup>
          <thead>
            <tr>
              <th style={{ width: '12rem', maxWidth: '13rem' }}>Dátum</th>
              <th>Tanuló</th>
              <th>Feladat</th>
              <th>Cella</th>
              <th>Mondat</th>
              <th>Megjegyzés</th>
            </tr>
            <tr>
              <th style={dateFilterColumnStyle}>
                <label htmlFor="task-eval-filter-from" className="muted" style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
                  Mettől
                </label>
                <input
                  id="task-eval-filter-from"
                  type="datetime-local"
                  aria-label="Mettől"
                  value={colFilters.from}
                  onChange={(e) => setColFilters((p) => ({ ...p, from: e.target.value }))}
                  style={dateFilterInputStyle()}
                />
                <label htmlFor="task-eval-filter-to" className="muted" style={{ display: 'block', fontSize: 12, marginTop: 10, marginBottom: 4 }}>
                  Meddig
                </label>
                <input
                  id="task-eval-filter-to"
                  type="datetime-local"
                  aria-label="Meddig"
                  value={colFilters.to}
                  onChange={(e) => setColFilters((p) => ({ ...p, to: e.target.value }))}
                  style={dateFilterInputStyle()}
                />
              </th>
              <th style={{ verticalAlign: 'top', fontWeight: 400 }}>
                <select
                  aria-label="Tanuló szűrő"
                  value={colFilters.user_id}
                  onChange={(e) => setColFilters((p) => ({ ...p, user_id: e.target.value }))}
                  style={filterInputStyle()}
                >
                  <option value="">Mind</option>
                  {userOptions.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.username}
                    </option>
                  ))}
                </select>
              </th>
              <th style={{ verticalAlign: 'top', fontWeight: 400 }}>
                <input
                  type="search"
                  placeholder="Feladat neve…"
                  value={colFilters.task_name}
                  onChange={(e) => setColFilters((p) => ({ ...p, task_name: e.target.value }))}
                  style={filterInputStyle()}
                  autoComplete="off"
                />
              </th>
              <th style={{ verticalAlign: 'top', fontWeight: 400 }} aria-hidden />
              <th style={{ verticalAlign: 'top', fontWeight: 400 }} aria-hidden />
              <th style={{ verticalAlign: 'top', fontWeight: 400 }}>
                <input
                  type="search"
                  placeholder="Szöveg…"
                  value={colFilters.note}
                  onChange={(e) => setColFilters((p) => ({ ...p, note: e.target.value }))}
                  style={filterInputStyle()}
                  autoComplete="off"
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className={modalId === row.id ? 'listPickRow listPickRow--selected' : undefined}
                onClick={() => openModal(row.id)}
                style={{ cursor: 'pointer' }}
              >
                <td>{formatTaskEvaluationDateDisplay(row.date)}</td>
                <td>{row.user ? `${row.user.name} (${row.user.username})` : `#${row.user_id}`}</td>
                <td>{row.task_save?.name ?? `task_save #${row.task_save_id}`}</td>
                <td>{cellaPercent(row)}</td>
                <td>{mondatPercent(row)}</td>
                <td title={row.note ?? undefined}>
                  {row.note ? (row.note.length > 80 ? `${row.note.slice(0, 77)}…` : row.note) : '—'}
                </td>
              </tr>
            ))}
            {!busy && rows.length === 0 ? (
              <tr>
                <td colSpan={6}>Nincs találat.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {modalId ? (
        <div
          className="confirmModal__root"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModal()
          }}
        >
          <div className="confirmModal__backdrop" aria-hidden />
          <div
            className="confirmModal__panel confirmModal__panel--examDetail"
            role="dialog"
            aria-modal="true"
            aria-labelledby="examEvalModalTitle"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 id="examEvalModalTitle" className="confirmModal__title">
              Vizsga részletei
            </h3>

            <div className="confirmModal__body" style={{ textAlign: 'left' }}>
              {modalBusy ? <p className="muted">Betöltés…</p> : null}
              {modalError ? <p className="error">{modalError}</p> : null}

              {modalDetail ? (
                <div className="examDetailModal">
                  <div className="examDetailModal__header">
                    <div className="examDetailModal__headerRow">
                      <p className="examDetailModal__headerIdentity">
                        {modalDetail.user
                          ? `${modalDetail.user.name} (${modalDetail.user.username}), ${modalDetail.user.email}`
                          : `Felhasználó #${modalDetail.user_id}`}
                      </p>
                      <p className="examDetailModal__headerExamTime">
                        Vizsga ideje:{' '}
                        <time dateTime={taskEvaluationDateIsoAttr(modalDetail.date)}>
                          {formatTaskEvaluationDateDisplay(modalDetail.date)}
                        </time>
                      </p>
                    </div>
                  </div>

                  <h4 className="examDetailModal__secTitle">Összegző</h4>
                  <div className="examDetailModal__summaryRow">
                    <div className="examDetailModal__summaryCard">
                      <span className="examDetailModal__summaryLabel">Beküldött idő</span>
                      <span className="examDetailModal__summaryVal">{modalDetail.completed_time} mp</span>
                    </div>
                    <div className="examDetailModal__summaryCard">
                      <span className="examDetailModal__summaryLabel">Cella %</span>
                      <span className="examDetailModal__summaryVal">{cellaPercent(modalDetail)}</span>
                    </div>
                    <div className="examDetailModal__summaryCard">
                      <span className="examDetailModal__summaryLabel">Mondat %</span>
                      <span className="examDetailModal__summaryVal">{mondatPercent(modalDetail)}</span>
                    </div>
                  </div>

                  <h4 className="examDetailModal__secTitle">Cellák számai</h4>
                  <div className="examDetailModal__miniStatWrap">
                    <table className="examDetailModal__miniStat">
                      <thead>
                        <tr>
                          <th scope="col">Összes ref.</th>
                          <th scope="col">Jó</th>
                          <th scope="col">Rossz</th>
                          <th scope="col">Nem kitöltött</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>{modalDetail.total_good_cell}</td>
                          <td>{modalDetail.good_cell}</td>
                          <td>{modalDetail.bad_cell}</td>
                          <td>{modalDetail.unfilled_cell}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <h4 className="examDetailModal__secTitle">Mondatok számai</h4>
                  <div className="examDetailModal__miniStatWrap">
                    <table className="examDetailModal__miniStat">
                      <thead>
                        <tr>
                          <th scope="col">Lehetséges</th>
                          <th scope="col">Jó</th>
                          <th scope="col">Rossz</th>
                          <th scope="col">Duplikált</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>{modalDetail.possible_sentence}</td>
                          <td>{modalDetail.good_sentence}</td>
                          <td>{modalDetail.bad_sentence}</td>
                          <td>{modalDetail.duplicate_sentence}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {modalDetail.note ? (
                    <>
                      <h4 className="examDetailModal__secTitle">Megjegyzés</h4>
                      <div className="examDetailModal__note">{modalDetail.note}</div>
                    </>
                  ) : null}

                  {modalDetail.sentence_result ? (
                    <>
                      <h4 className="examDetailModal__secTitle">Mondat eredmény</h4>
                      <FormattedSentenceResult text={modalDetail.sentence_result} />
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="confirmModal__actions">
              <button type="button" className="primary" onClick={closeModal}>
                Bezárás
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
