import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { getCurrentUser, login, type User } from './lib/api'
import { clearAuth, loadAuth, saveAuth } from './lib/auth'
import { UsersAdmin } from './admin/UsersAdmin'

function App() {
  const [loginValue, setLoginValue] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [activePage, setActivePage] = useState<'users' | null>(null)

  useEffect(() => {
    const auth = loadAuth()
    if (!auth) return
    setToken(auth.token)
    setUser(auth.user)
  }, [])

  const isAuthed = useMemo(() => Boolean(token && user), [token, user])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const res = await login({ login: loginValue.trim(), password })
      setToken(res.token)
      setUser(res.user)
      saveAuth(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sikertelen bejelentkezés')
    } finally {
      setBusy(false)
    }
  }

  async function handleRefreshUser() {
    if (!token) return
    setError(null)
    setBusy(true)
    try {
      const fresh = await getCurrentUser(token)
      setUser(fresh)
      saveAuth({ token, user: fresh })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sikertelen frissítés')
    } finally {
      setBusy(false)
    }
  }

  function handleCurrentUserUpdated(updated: User) {
    if (!token) return
    setUser(updated)
    saveAuth({ token, user: updated })
  }

  function handleLogout() {
    clearAuth()
    setToken(null)
    setUser(null)
    setPassword('')
    setError(null)
  }

  return (
    <>
      {isAuthed ? (
        <>
          <header className="topbar">
            <div className="topbar__inner">
              <div className="topbar__left" />
              <div className="topbar__center">Sejtautomaták Admin felület</div>
              <div className="topbar__right">
                <div className="topbar__user">
                  <div className="topbar__userName">
                    <b>{user?.name}</b> <span className="muted">({user?.username})</span>
                  </div>
                  <div className="topbar__userMeta">
                    {user?.email} · <code>{user?.role}</code>
                  </div>
                </div>
                <button className="danger" onClick={handleLogout} disabled={busy}>
                  Kijelentkezés
                </button>
              </div>
            </div>
          </header>

          <nav className="menubar">
            <div className="menubar__inner">
              <button
                className={activePage === 'users' ? 'menuItem menuItem--active' : 'menuItem'}
                onClick={() => setActivePage('users')}
                disabled={busy}
              >
                Felhasználók kezelése
              </button>

              <div className="menubar__spacer" />

              <button className="counter" onClick={handleRefreshUser} disabled={busy}>
                {busy ? 'Frissítés…' : 'Profil frissítése'}
              </button>
            </div>
          </nav>
        </>
      ) : null}

      <section id="center" className={isAuthed ? 'center--authed' : undefined}>
        <div>
          <h1>{isAuthed ? 'Üdv!' : 'Cellauto Admin'}</h1>
          <p>
            {isAuthed
              ? 'Válassz menüpontot a folytatáshoz.'
              : 'Bejelentkezéshez add meg az email címedet vagy a felhasználónevedet.'}
          </p>
        </div>

        {!isAuthed ? (
          <form onSubmit={handleLogin} className="card card--narrow">
            <label className="field">
              <span className="label">Email vagy felhasználónév</span>
              <input
                value={loginValue}
                onChange={(e) => setLoginValue(e.target.value)}
                autoComplete="username"
                placeholder="admin vagy admin@cellauto.ro"
                required
              />
            </label>

            <label className="field">
              <span className="label">Jelszó</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>

            {error ? <p className="error">{error}</p> : null}

            <button className="primary" disabled={busy}>
              {busy ? 'Bejelentkezés…' : 'Bejelentkezés'}
            </button>
          </form>
        ) : (
          <div className="content">
            {error ? (
              <div className="card">
                <p className="error">{error}</p>
              </div>
            ) : null}

            {activePage === null ? (
              <div className="card">
                <h2>Kezdőlap</h2>
                <p>Válassz menüpontot fent a folytatáshoz.</p>
              </div>
            ) : activePage === 'users' && token && user ? (
              <UsersAdmin token={token} currentUser={user} onCurrentUserUpdated={handleCurrentUserUpdated} />
            ) : null}
          </div>
        )}
      </section>
    </>
  )
}

export default App
