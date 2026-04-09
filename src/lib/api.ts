export type ApiError = {
  error: string
}

export type User = {
  id: number
  username: string
  name: string
  email: string
  role: 'vendeg' | 'diak' | 'tanar' | 'admin' | (string & {})
  active: number
  suspended_at: string | null
  email_verified_at: string | null
  created_at: string
  updated_at: string
}

export type LoginResponse = {
  token: string
  user: User
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'

export type CreateUserRequest = {
  username: string
  name: string
  email: string
  password: string
  role?: User['role']
}

export type UpdateUserRequest = Partial<{
  username: string
  name: string
  email: string
  password: string
  role: User['role']
  active: number
}>

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text()
  if (!text) return {} as T
  return JSON.parse(text) as T
}

function authHeaders(token: string) {
  return {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
  }
}

export async function login(params: {
  login: string
  password: string
}): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE_URL}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(params),
  })

  if (!res.ok) {
    const data = await parseJson<ApiError>(res).catch(() => null)
    throw new Error(data?.error || `Login failed (${res.status})`)
  }

  return await parseJson<LoginResponse>(res)
}

export async function getCurrentUser(token: string): Promise<User> {
  const res = await fetch(`${API_BASE_URL}/user`, {
    headers: {
      ...authHeaders(token),
    },
  })

  if (!res.ok) {
    const data = await parseJson<ApiError>(res).catch(() => null)
    throw new Error(data?.error || `User fetch failed (${res.status})`)
  }

  return await parseJson<User>(res)
}

export async function listUsers(token: string): Promise<User[]> {
  const res = await fetch(`${API_BASE_URL}/users`, {
    headers: {
      ...authHeaders(token),
    },
  })

  if (!res.ok) {
    const data = await parseJson<ApiError>(res).catch(() => null)
    throw new Error(data?.error || `Users fetch failed (${res.status})`)
  }

  return await parseJson<User[]>(res)
}

export async function createUser(
  token: string,
  params: CreateUserRequest,
): Promise<User> {
  const res = await fetch(`${API_BASE_URL}/users`, {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  })

  if (!res.ok) {
    const data = await parseJson<ApiError>(res).catch(() => null)
    throw new Error(data?.error || `User create failed (${res.status})`)
  }

  return await parseJson<User>(res)
}

export async function updateUser(
  token: string,
  userId: number,
  params: UpdateUserRequest,
): Promise<User> {
  const res = await fetch(`${API_BASE_URL}/users/${userId}`, {
    method: 'PUT',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  })

  if (!res.ok) {
    const data = await parseJson<ApiError>(res).catch(() => null)
    throw new Error(data?.error || `User update failed (${res.status})`)
  }

  return await parseJson<User>(res)
}

export async function deleteUser(token: string, userId: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/users/${userId}`, {
    method: 'DELETE',
    headers: {
      ...authHeaders(token),
    },
  })

  if (!res.ok) {
    const data = await parseJson<ApiError>(res).catch(() => null)
    throw new Error(data?.error || `User delete failed (${res.status})`)
  }
}

export async function suspendUser(token: string, userId: number): Promise<User> {
  const res = await fetch(`${API_BASE_URL}/users/${userId}/suspend`, {
    method: 'POST',
    headers: {
      ...authHeaders(token),
    },
  })

  if (!res.ok) {
    const data = await parseJson<ApiError>(res).catch(() => null)
    throw new Error(data?.error || `User suspend failed (${res.status})`)
  }

  // API doc says it returns { message, user }, but accept either {user} or user.
  const data = await parseJson<unknown>(res)
  if (data && typeof data === 'object' && 'user' in (data as Record<string, unknown>)) {
    return (data as { user: User }).user
  }
  return data as User
}

export async function unsuspendUser(token: string, userId: number): Promise<User> {
  const res = await fetch(`${API_BASE_URL}/users/${userId}/unsuspend`, {
    method: 'POST',
    headers: {
      ...authHeaders(token),
    },
  })

  if (!res.ok) {
    const data = await parseJson<ApiError>(res).catch(() => null)
    throw new Error(data?.error || `User unsuspend failed (${res.status})`)
  }

  const data = await parseJson<unknown>(res)
  if (data && typeof data === 'object' && 'user' in (data as Record<string, unknown>)) {
    return (data as { user: User }).user
  }
  return data as User
}

