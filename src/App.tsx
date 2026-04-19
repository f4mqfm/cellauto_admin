import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { getCurrentUser, logVisit, login, logout, type User } from './lib/api'
import { clearAuth, loadAuth, saveAuth } from './lib/auth'
import { UsersAdmin } from './admin/UsersAdmin'
import { ListsWordsAdmin } from './lists/ListsWordsAdmin'
import { ColorListsAdmin } from './colorLists/ColorListsAdmin'
import { AccessLogsAdmin } from './admin/AccessLogsAdmin'
import { TaskEvaluationsAdmin } from './admin/TaskEvaluationsAdmin'

function App() {
  const [loginValue, setLoginValue] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [activePage, setActivePage] = useState<'users' | 'lists' | 'colorLists' | 'examEvaluations' | 'accessLogs' | null>(
    null,
  )

  useEffect(() => {
    const auth = loadAuth()
    if (!auth) return
    setToken(auth.token)
    setUser(auth.user)
    void getCurrentUser(auth.token)
      .then((freshUser) => {
        setUser(freshUser)
        saveAuth({ token: auth.token, user: freshUser })
      })
      .catch(() => {
        clearAuth()
        setToken(null)
        setUser(null)
      })
  }, [])

  useEffect(() => {
    void logVisit({ entry_point: 'admin' }).catch(() => undefined)
  }, [])

  const isAuthed = useMemo(() => Boolean(token && user), [token, user])

  const canViewExamEvaluations = useMemo(
    () => Boolean(user && (user.role === 'admin' || user.role === 'tanar')),
    [user],
  )

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const res = await login({ login: loginValue.trim(), password, entry_point: 'admin' })
      setToken(res.token)
      setUser(res.user)
      saveAuth(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sikertelen bejelentkezés')
    } finally {
      setBusy(false)
    }
  }

  function handleCurrentUserUpdated(updated: User) {
    if (!token) return
    setUser(updated)
    saveAuth({ token, user: updated })
  }

  async function handleLogout() {
    setBusy(true)
    if (token) {
      await logout(token, { entry_point: 'admin' }).catch(() => undefined)
    }
    clearAuth()
    setToken(null)
    setUser(null)
    setPassword('')
    setError(null)
    setBusy(false)
  }

  return (
    <>
      {isAuthed ? (
        <>
          <header className="topbar">
            <div className="topbar__inner">
              <div className="topbar__title">Sejtautomaták Admin felület</div>
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
                type="button"
                className={activePage === 'users' ? 'menuItem menuItem--active' : 'menuItem'}
                onClick={() => setActivePage('users')}
                disabled={busy}
              >
                Felhasználók kezelése
              </button>

              <button
                type="button"
                className={activePage === 'lists' ? 'menuItem menuItem--active' : 'menuItem'}
                onClick={() => setActivePage('lists')}
                disabled={busy}
              >
                Szólisták
              </button>

              <button
                type="button"
                className={activePage === 'colorLists' ? 'menuItem menuItem--active' : 'menuItem'}
                onClick={() => setActivePage('colorLists')}
                disabled={busy}
              >
                Színlisták
              </button>
              {canViewExamEvaluations ? (
                <button
                  type="button"
                  className={activePage === 'examEvaluations' ? 'menuItem menuItem--active' : 'menuItem'}
                  onClick={() => setActivePage('examEvaluations')}
                  disabled={busy}
                >
                  Vizsgák megtekintése
                </button>
              ) : null}
              <button
                type="button"
                className={activePage === 'accessLogs' ? 'menuItem menuItem--active' : 'menuItem'}
                onClick={() => setActivePage('accessLogs')}
                disabled={busy}
              >
                Access Logok
              </button>
            </div>
          </nav>
        </>
      ) : null}

      <section id="center" className={isAuthed ? 'center--authed' : undefined}>
        {!isAuthed ? (
          <>
            <div>
              <h1>Cellauto Admin</h1>
              <p>Bejelentkezéshez add meg az email címedet vagy a felhasználónevedet.</p>
            </div>

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
          </>
        ) : (
          <div className="appLayout">
            <aside className="sideMenuPanel">
              <div className="sideMenu card">
                <h2>Dashboard</h2>
                <p className="sideMenu__hint">A bal oldali panel a gyors navigáció.</p>
                <button
                  type="button"
                  className={activePage === 'users' ? 'menuCard menuCard--active' : 'menuCard'}
                  onClick={() => setActivePage('users')}
                  disabled={busy}
                >
                  <span className="menuCard__title">Felhasználók kezelése</span>
                  <span className="menuCard__desc">Felhasználók létrehozása, szerkesztése és jogosultság kezelése.</span>
                </button>
                <button
                  type="button"
                  className={activePage === 'lists' ? 'menuCard menuCard--active' : 'menuCard'}
                  onClick={() => setActivePage('lists')}
                  disabled={busy}
                >
                  <span className="menuCard__title">Szólisták</span>
                  <span className="menuCard__desc">Szólisták kezelése és karbantartása.</span>
                </button>
                <button
                  type="button"
                  className={activePage === 'colorLists' ? 'menuCard menuCard--active' : 'menuCard'}
                  onClick={() => setActivePage('colorLists')}
                  disabled={busy}
                >
                  <span className="menuCard__title">Színlisták</span>
                  <span className="menuCard__desc">Színkészletek módosítása és rendezése.</span>
                </button>
                {canViewExamEvaluations ? (
                  <button
                    type="button"
                    className={activePage === 'examEvaluations' ? 'menuCard menuCard--active' : 'menuCard'}
                    onClick={() => setActivePage('examEvaluations')}
                    disabled={busy}
                  >
                    <span className="menuCard__title">Vizsgák megtekintése</span>
                    <span className="menuCard__desc">
                      Mentett vizsgaértékelések listája és részletes megtekintő (tanár / admin).
                    </span>
                  </button>
                ) : null}
                <button
                  type="button"
                  className={activePage === 'accessLogs' ? 'menuCard menuCard--active' : 'menuCard'}
                  onClick={() => setActivePage('accessLogs')}
                  disabled={busy}
                >
                  <span className="menuCard__title">Access Logok</span>
                  <span className="menuCard__desc">Belépés, kilépés és látogatás naplók szűrhető listában.</span>
                </button>
              </div>
            </aside>

            <div className="dashboardMain">
              {error ? (
                <div className="card">
                  <p className="error">{error}</p>
                </div>
              ) : null}

              <div className="content">
                {activePage === 'users' && token && user ? (
                  <UsersAdmin token={token} currentUser={user} onCurrentUserUpdated={handleCurrentUserUpdated} />
                ) : activePage === 'lists' && token ? (
                  <ListsWordsAdmin token={token} />
                ) : activePage === 'colorLists' && token ? (
                  <ColorListsAdmin token={token} />
                ) : activePage === 'examEvaluations' && token && canViewExamEvaluations ? (
                  <TaskEvaluationsAdmin token={token} />
                ) : activePage === 'accessLogs' && token ? (
                  <AccessLogsAdmin token={token} />
                ) : null}
              </div>
            </div>
          </div>
        )}
      </section>
    </>
  )
}

export default App
