import { useEffect, useMemo, useState } from 'react'
import type { User } from '../lib/api'
import {
  createUser,
  deleteUser,
  listUsers,
  suspendUser,
  unsuspendUser,
  updateUser,
} from '../lib/api'

type Props = {
  token: string
  currentUser: User
  onCurrentUserUpdated?: (user: User) => void
}

const ROLES: Array<User['role']> = ['vendeg', 'diak', 'tanar', 'admin']

export function UsersAdmin(props: Props) {
  const { token } = props

  const [users, setUsers] = useState<User[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    username: '',
    name: '',
    email: '',
    password: '',
    role: 'vendeg' as User['role'],
  })

  const [editId, setEditId] = useState<number | null>(null)
  const editUser = useMemo(
    () => users.find((u) => u.id === editId) ?? null,
    [users, editId],
  )
  const [editForm, setEditForm] = useState({
    username: '',
    name: '',
    email: '',
    password: '',
    role: 'vendeg' as User['role'],
  })

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return users
    return users.filter((u) => {
      const hay = `${u.id} ${u.username} ${u.name} ${u.email} ${u.role}`.toLowerCase()
      return hay.includes(q)
    })
  }, [users, query])

  async function refresh() {
    setError(null)
    setBusy(true)
    try {
      const data = await listUsers(token)
      setUsers(data)
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

  function openEdit(u: User) {
    setEditId(u.id)
    setEditForm({
      username: u.username,
      name: u.name,
      email: u.email,
      password: '',
      role: u.role,
    })
  }

  function closeEdit() {
    setEditId(null)
  }

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await createUser(token, {
        username: createForm.username.trim(),
        name: createForm.name.trim(),
        email: createForm.email.trim(),
        password: createForm.password,
        role: createForm.role,
      })
      setCreateOpen(false)
      setCreateForm({ username: '', name: '', email: '', password: '', role: 'vendeg' })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sikertelen létrehozás')
    } finally {
      setBusy(false)
    }
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editUser) return
    setError(null)
    setBusy(true)
    try {
      const payload: Record<string, unknown> = {
        username: editForm.username.trim(),
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        role: editForm.role,
      }
      if (editForm.password) payload.password = editForm.password
      const updated = await updateUser(token, editUser.id, payload)
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
      if (props.onCurrentUserUpdated && props.currentUser.id === updated.id) {
        props.onCurrentUserUpdated(updated)
      }
      closeEdit()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sikertelen mentés')
    } finally {
      setBusy(false)
    }
  }

  async function confirmAndDelete(u: User) {
    if (!confirm(`Biztosan törlöd? (${u.username} / ${u.email})`)) return
    setError(null)
    setBusy(true)
    try {
      await deleteUser(token, u.id)
      setUsers((prev) => prev.filter((x) => x.id !== u.id))
      if (editId === u.id) closeEdit()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sikertelen törlés')
    } finally {
      setBusy(false)
    }
  }

  async function toggleSuspend(u: User) {
    const wantsSuspend = u.active === 1 && u.suspended_at == null
    const actionLabel = wantsSuspend ? 'felfüggeszted' : 'visszaaktiválod'
    if (!confirm(`Biztosan ${actionLabel}? (${u.username})`)) return

    setError(null)
    setBusy(true)
    try {
      const updated = wantsSuspend ? await suspendUser(token, u.id) : await unsuspendUser(token, u.id)
      setUsers((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
      if (props.onCurrentUserUpdated && props.currentUser.id === updated.id) {
        props.onCurrentUserUpdated(updated)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sikertelen művelet')
    } finally {
      setBusy(false)
    }
  }

  if (props.currentUser.role !== 'admin') {
    return (
      <div className="card">
        <h2>Felhasználók</h2>
        <p>Nincs jogosultság (admin szükséges).</p>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="row row--spread">
        <h2>Felhasználók</h2>
        <div className="row">
          <button className="counter" onClick={refresh} disabled={busy}>
            {busy ? 'Betöltés…' : 'Frissítés'}
          </button>
          <button className="primary" onClick={() => setCreateOpen((v) => !v)} disabled={busy}>
            {createOpen ? 'Bezárás' : 'Új felhasználó'}
          </button>
        </div>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <label className="field">
        <span className="label">Keresés (id, username, név, email, role)</span>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="pl. admin" />
      </label>

      {createOpen ? (
        <form onSubmit={submitCreate} className="panel">
          <div className="grid2">
            <label className="field">
              <span className="label">Username</span>
              <input
                required
                value={createForm.username}
                onChange={(e) => setCreateForm((p) => ({ ...p, username: e.target.value }))}
              />
            </label>
            <label className="field">
              <span className="label">Név</span>
              <input
                required
                value={createForm.name}
                onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
              />
            </label>
            <label className="field">
              <span className="label">Email</span>
              <input
                type="email"
                required
                value={createForm.email}
                onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
              />
            </label>
            <label className="field">
              <span className="label">Jelszó</span>
              <input
                type="password"
                required
                value={createForm.password}
                onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))}
              />
            </label>
            <label className="field">
              <span className="label">Role</span>
              <select
                value={createForm.role}
                onChange={(e) =>
                  setCreateForm((p) => ({ ...p, role: e.target.value as User['role'] }))
                }
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="row">
            <button className="primary" disabled={busy}>
              {busy ? 'Mentés…' : 'Létrehozás'}
            </button>
          </div>
        </form>
      ) : null}

      {editUser ? (
        <form onSubmit={submitEdit} className="panel">
          <div className="row row--spread">
            <h3>Szerkesztés: {editUser.username}</h3>
            <button type="button" className="danger" onClick={closeEdit} disabled={busy}>
              Bezárás
            </button>
          </div>
          <div className="grid2">
            <label className="field">
              <span className="label">Username</span>
              <input
                required
                value={editForm.username}
                onChange={(e) => setEditForm((p) => ({ ...p, username: e.target.value }))}
              />
            </label>
            <label className="field">
              <span className="label">Név</span>
              <input
                required
                value={editForm.name}
                onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
              />
            </label>
            <label className="field">
              <span className="label">Email</span>
              <input
                type="email"
                required
                value={editForm.email}
                onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
              />
            </label>
            <label className="field">
              <span className="label">Role</span>
              <select
                value={editForm.role}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, role: e.target.value as User['role'] }))
                }
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="label">Új jelszó (opcionális)</span>
              <input
                type="password"
                value={editForm.password}
                onChange={(e) => setEditForm((p) => ({ ...p, password: e.target.value }))}
              />
            </label>
          </div>
          <div className="row">
            <button className="primary" disabled={busy}>
              {busy ? 'Mentés…' : 'Mentés'}
            </button>
          </div>
        </form>
      ) : null}

      <div className="tableWrap">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Username</th>
              <th>Név</th>
              <th>Email</th>
              <th>Role</th>
              <th>Állapot</th>
              <th>Műveletek</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id}>
                <td>{u.id}</td>
                <td>{u.username}</td>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>
                  <code>{u.role}</code>
                </td>
                <td>{u.active === 1 && u.suspended_at == null ? 'Aktív' : 'Felfüggesztett'}</td>
                <td>
                  <div className="row">
                    <button className="counter" onClick={() => openEdit(u)} disabled={busy}>
                      Szerkesztés
                    </button>
                    <button className="counter" onClick={() => toggleSuspend(u)} disabled={busy}>
                      {u.active === 1 && u.suspended_at == null ? 'Felfüggeszt' : 'Aktivál'}
                    </button>
                    <button className="danger" onClick={() => confirmAndDelete(u)} disabled={busy}>
                      Törlés
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!busy && filtered.length === 0 ? (
              <tr>
                <td colSpan={7}>Nincs találat.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}

