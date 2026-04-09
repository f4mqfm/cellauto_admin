import type { User } from './api'

const TOKEN_KEY = 'cellauto_admin_token'
const USER_KEY = 'cellauto_admin_user'

export function loadAuth(): { token: string; user: User } | null {
  const token = localStorage.getItem(TOKEN_KEY)
  const userRaw = localStorage.getItem(USER_KEY)
  if (!token || !userRaw) return null
  try {
    return { token, user: JSON.parse(userRaw) as User }
  } catch {
    return null
  }
}

export function saveAuth(params: { token: string; user: User }) {
  localStorage.setItem(TOKEN_KEY, params.token)
  localStorage.setItem(USER_KEY, JSON.stringify(params.user))
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

