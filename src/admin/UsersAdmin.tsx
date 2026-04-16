import { useEffect, useMemo, useState } from 'react'
import { AlertBanner } from '../components/AlertBanner'
import { ConfirmModal } from '../components/ConfirmModal'
import type { User } from '../lib/api'
import {
  createUser,
  deleteUser,
  listUsersOnlineStatus,
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

function canDeleteUser(target: User, actor: User): boolean {
  if (target.id === actor.id) return false
  if (target.role === 'admin') return false
  return true
}

/** API: active néha 1/0 (lista a DB-ből), néha true/false (Laravel modell JSON után mentés) */
function accountIsActive(u: Pick<User, 'active' | 'suspended_at'>): boolean {
  const on = u.active === 1 || u.active === true
  return on && u.suspended_at == null
}

export function UsersAdmin(props: Props) {
  const { token } = props

  const [users, setUsers] = useState<User[]>([])
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState<{ variant: 'error' | 'info' | 'success'; message: string } | null>(null)
  const [pendingDelete, setPendingDelete] = useState<User | null>(null)
  const [pendingSuspend, setPendingSuspend] = useState<{ user: User; suspend: boolean } | null>(null)
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
    setFlash(null)
    setBusy(true)
    try {
      const data = await listUsersOnlineStatus(token)
      setUsers(data)
    } catch (err) {
      setFlash({
        variant: 'error',
        message: err instanceof Error ? err.message : 'Sikertelen betöltés',
      })
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
    setFlash(null)
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
      setFlash({
        variant: 'error',
        message: err instanceof Error ? err.message : 'Sikertelen létrehozás',
      })
    } finally {
      setBusy(false)
    }
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editUser) return
    setFlash(null)
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
      setFlash({
        variant: 'error',
        message: err instanceof Error ? err.message : 'Sikertelen mentés',
      })
    } finally {
      setBusy(false)
    }
  }

  function requestDelete(u: User) {
    setFlash(null)
    if (!canDeleteUser(u, props.currentUser)) {
      setFlash({
        variant: 'error',
        message:
          u.id === props.currentUser.id
            ? 'Saját fiókodat nem törölheted.'
            : 'Admin szerepkörű felhasználó nem törölhető.',
      })
      return
    }
    setPendingDelete(u)
  }

  async function executeDelete() {
    const u = pendingDelete
    if (!u) return
    setFlash(null)
    setBusy(true)
    try {
      await deleteUser(token, u.id)
      setUsers((prev) => prev.filter((x) => x.id !== u.id))
      if (editId === u.id) closeEdit()
      setPendingDelete(null)
      setFlash({ variant: 'success', message: `A(z) ${u.username} felhasználó törölve.` })
    } catch (err) {
      setFlash({
        variant: 'error',
        message: err instanceof Error ? err.message : 'Sikertelen törlés',
      })
    } finally {
      setBusy(false)
    }
  }

  function requestSuspendToggle(u: User) {
    setFlash(null)
    const wantsSuspend = accountIsActive(u)
    setPendingSuspend({ user: u, suspend: wantsSuspend })
  }

  async function executeSuspendToggle() {
    const ctx = pendingSuspend
    if (!ctx) return
    const { user: u, suspend: wantsSuspend } = ctx
    setFlash(null)
    setBusy(true)
    try {
      const updated = wantsSuspend ? await suspendUser(token, u.id) : await unsuspendUser(token, u.id)
      setUsers((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
      if (props.onCurrentUserUpdated && props.currentUser.id === updated.id) {
        props.onCurrentUserUpdated(updated)
      }
      setPendingSuspend(null)
      setFlash({
        variant: 'success',
        message: wantsSuspend ? `${u.username} felfüggesztve.` : `${u.username} újra aktiválva.`,
      })
    } catch (err) {
      setFlash({
        variant: 'error',
        message: err instanceof Error ? err.message : 'Sikertelen művelet',
      })
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
          <button
            type="button"
            className="primary"
            onClick={() => {
              if (createOpen) {
                setCreateOpen(false)
              } else {
                setCreateForm({ username: '', name: '', email: '', password: '', role: 'vendeg' })
                setCreateOpen(true)
              }
            }}
            disabled={busy}
          >
            {createOpen ? 'Bezárás' : 'Új felhasználó'}
          </button>
        </div>
      </div>

      {flash ? (
        <AlertBanner variant={flash.variant} onDismiss={() => setFlash(null)}>
          {flash.message}
        </AlertBanner>
      ) : null}

      <ConfirmModal
        open={pendingDelete !== null}
        title="Felhasználó törlése"
        tone="danger"
        confirmLabel="Törlés"
        busy={busy}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void executeDelete()}
      >
        {pendingDelete ? (
          <p className="muted" style={{ margin: 0 }}>
            Biztosan törlöd{' '}
            <strong>
              {pendingDelete.username}
            </strong>{' '}
            <span style={{ wordBreak: 'break-all' }}>({pendingDelete.email})</span> fiókját? Ez nem vonható
            vissza.
          </p>
        ) : null}
      </ConfirmModal>

      <ConfirmModal
        open={pendingSuspend !== null}
        title={pendingSuspend?.suspend ? 'Felfüggesztés' : 'Újraaktiválás'}
        tone="primary"
        confirmLabel={pendingSuspend?.suspend ? 'Felfüggeszt' : 'Aktivál'}
        busy={busy}
        onCancel={() => setPendingSuspend(null)}
        onConfirm={() => void executeSuspendToggle()}
      >
        {pendingSuspend ? (
          <p className="muted" style={{ margin: 0 }}>
            {pendingSuspend.suspend ? (
              <>
                Biztosan felfüggeszted <strong>{pendingSuspend.user.username}</strong> felhasználót? Nem fog
                tudni bejelentkezni.
              </>
            ) : (
              <>
                Biztosan visszaaktiválod <strong>{pendingSuspend.user.username}</strong> felhasználót?
              </>
            )}
          </p>
        ) : null}
      </ConfirmModal>

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
                <td>
                  {(() => {
                    const online =
                      u.is_logged_in === true || u.is_logged_in === 1 || u.is_online === true || u.is_online === 1
                    return (
                      <span
                        style={{
                          display: 'inline-block',
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          marginRight: 8,
                          background: online ? '#16a34a' : '#9ca3af',
                        }}
                        title={online ? 'Online' : 'Offline'}
                      />
                    )
                  })()}
                  {u.username}
                </td>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>
                  <code>{u.role}</code>
                </td>
                <td>{accountIsActive(u) ? 'Aktív' : 'Felfüggesztett'}</td>
                <td>
                  <div className="row">
                    <button className="counter" onClick={() => openEdit(u)} disabled={busy}>
                      Szerkesztés
                    </button>
                    <button className="counter" onClick={() => requestSuspendToggle(u)} disabled={busy}>
                      {accountIsActive(u) ? 'Felfüggeszt' : 'Aktivál'}
                    </button>
                    <button
                      className="danger"
                      title={
                        !canDeleteUser(u, props.currentUser)
                          ? u.id === props.currentUser.id
                            ? 'Önmagadat nem törölheted.'
                            : 'Admin szerepkörű felhasználó nem törölhető.'
                          : undefined
                      }
                      onClick={() => requestDelete(u)}
                      disabled={busy}
                    >
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

