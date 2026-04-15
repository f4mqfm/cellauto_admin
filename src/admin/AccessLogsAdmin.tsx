import { useEffect, useMemo, useState } from 'react'
import { listAccessLogs, listUsers, type AccessLog, type AccessLogEventType, type EntryPoint, type User } from '../lib/api'

type Props = {
  token: string
}

type FilterState = {
  event_type: '' | AccessLogEventType
  entry_point: '' | EntryPoint
  user_id: string
  from: string
  to: string
}

function formatDateTime(value: string) {
  const dt = new Date(value)
  if (Number.isNaN(dt.getTime())) return value
  return dt.toLocaleString('hu-HU')
}

export function AccessLogsAdmin(props: Props) {
  const { token } = props
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<AccessLog[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [filter, setFilter] = useState<FilterState>({
    event_type: '',
    entry_point: '',
    user_id: '',
    from: '',
    to: '',
  })

  const userOptions = useMemo(() => users.slice().sort((a, b) => a.username.localeCompare(b.username)), [users])

  async function refresh() {
    setError(null)
    setBusy(true)
    try {
      const [logsRes, usersRes] = await Promise.all([
        listAccessLogs(token, {
          event_type: filter.event_type || undefined,
          entry_point: filter.entry_point || undefined,
          user_id: filter.user_id ? Number(filter.user_id) : undefined,
          from: filter.from || undefined,
          to: filter.to || undefined,
          per_page: 100,
        }),
        listUsers(token),
      ])
      setLogs(logsRes.data)
      setUsers(usersRes)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sikertelen betöltés')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  return (
    <div className="card">
      <div className="row row--spread">
        <h2>Access Logok</h2>
        <button className="counter" onClick={refresh} disabled={busy}>
          {busy ? 'Betöltés…' : 'Frissítés'}
        </button>
      </div>

      <form
        className="panel"
        onSubmit={(e) => {
          e.preventDefault()
          void refresh()
        }}
      >
        <div className="grid2">
          <label className="field">
            <span className="label">Esemény</span>
            <select
              value={filter.event_type}
              onChange={(e) =>
                setFilter((prev) => ({ ...prev, event_type: e.target.value as FilterState['event_type'] }))
              }
            >
              <option value="">Mind</option>
              <option value="visit">visit</option>
              <option value="login">login</option>
              <option value="logout">logout</option>
            </select>
          </label>
          <label className="field">
            <span className="label">Belépési felület</span>
            <select
              value={filter.entry_point}
              onChange={(e) =>
                setFilter((prev) => ({ ...prev, entry_point: e.target.value as FilterState['entry_point'] }))
              }
            >
              <option value="">Mind</option>
              <option value="admin">admin</option>
              <option value="www">www</option>
            </select>
          </label>
          <label className="field">
            <span className="label">Felhasználó</span>
            <select value={filter.user_id} onChange={(e) => setFilter((prev) => ({ ...prev, user_id: e.target.value }))}>
              <option value="">Mind</option>
              {userOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username} ({u.name})
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="label">Mettől</span>
            <input
              type="datetime-local"
              value={filter.from}
              onChange={(e) => setFilter((prev) => ({ ...prev, from: e.target.value }))}
            />
          </label>
          <label className="field">
            <span className="label">Meddig</span>
            <input type="datetime-local" value={filter.to} onChange={(e) => setFilter((prev) => ({ ...prev, to: e.target.value }))} />
          </label>
        </div>
        <div className="row">
          <button className="primary" disabled={busy}>
            Szűrés
          </button>
          <button
            type="button"
            className="danger"
            disabled={busy}
            onClick={() => {
              setFilter({ event_type: '', entry_point: '', user_id: '', from: '', to: '' })
            }}
          >
            Szűrők törlése
          </button>
        </div>
      </form>

      {error ? <p className="error">{error}</p> : null}

      <div className="tableWrap">
        <table className="table">
          <thead>
            <tr>
              <th>Időpont</th>
              <th>Esemény</th>
              <th>Felület</th>
              <th>Felhasználó</th>
              <th>IP</th>
              <th>Böngésző</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>{formatDateTime(log.occurred_at)}</td>
                <td>
                  <code>{log.event_type}</code>
                </td>
                <td>
                  <code>{log.entry_point}</code>
                </td>
                <td>{log.user ? `${log.user.username} (${log.user.name})` : 'anonim'}</td>
                <td>{log.ip_address}</td>
                <td title={log.user_agent}>{log.user_agent}</td>
              </tr>
            ))}
            {!busy && logs.length === 0 ? (
              <tr>
                <td colSpan={6}>Nincs találat.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
