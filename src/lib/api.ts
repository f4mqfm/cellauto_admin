export type ApiError = {
  error: string
}

export type User = {
  id: number
  username: string
  name: string
  email: string
  role: 'vendeg' | 'diak' | 'tanar' | 'admin' | (string & {})
  active: number | boolean
  suspended_at: string | null
  email_verified_at: string | null
  created_at: string
  updated_at: string
  is_online?: boolean | number
  is_logged_in?: boolean | number
  active_token_count?: number
  last_seen_at?: string | null
}

export type LoginResponse = {
  token: string
  user: User
}

export type EntryPoint = 'www' | 'admin'
export type AccessLogEventType = 'visit' | 'login' | 'logout'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'

export type WordList = {
  id: number
  user_id: number
  name: string
  public?: boolean | number
  notes?: string | null
  wordlist?: string | null
  created_at?: string
  updated_at?: string
  words?: WordItem[]
}

export type WordItem = {
  id: number
  list_id?: number
  generation?: number
  word: string
  position?: number
  created_at?: string
  updated_at?: string
}

export type WordGeneration = {
  generation: number
  words: WordItem[]
}

export type WordGenerationsResponse = {
  list_id: number
  generations: WordGeneration[]
}

export type WordRelation = {
  id: number
  list_id: number
  from_word_id: number
  to_word_id: number
  fromWord?: Pick<WordItem, 'id' | 'generation' | 'word' | 'list_id'>
  toWord?: Pick<WordItem, 'id' | 'generation' | 'word' | 'list_id'>
  created_at?: string
  updated_at?: string
}

export type AccessLog = {
  id: number
  event_type: AccessLogEventType
  entry_point: EntryPoint
  ip_address: string
  user_agent: string
  occurred_at: string
  user_id: number | null
  user?: Pick<User, 'id' | 'username' | 'name' | 'email' | 'role'> | null
}

export type AccessLogsQuery = {
  event_type?: AccessLogEventType
  entry_point?: EntryPoint
  user_id?: number
  from?: string
  to?: string
  per_page?: number
  page?: number
}

export type AccessLogsPage = {
  data: AccessLog[]
  total?: number
  per_page?: number
  current_page?: number
  last_page?: number
}

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

async function parseErrorMessage(res: Response, fallback: string): Promise<string> {
  const text = await res.text().catch(() => '')
  if (!text) return `${fallback} (${res.status})`

  try {
    const data = JSON.parse(text) as unknown
    if (data && typeof data === 'object') {
      const obj = data as Record<string, unknown>
      const msg =
        (typeof obj.error === 'string' && obj.error) ||
        (typeof obj.message === 'string' && obj.message) ||
        (typeof obj.msg === 'string' && obj.msg)
      if (msg) return `${msg} (${res.status})`

      // Laravel validation style: { errors: { field: [msg1, msg2] } }
      const errors = obj.errors
      if (errors && typeof errors === 'object') {
        const eobj = errors as Record<string, unknown>
        const firstKey = Object.keys(eobj)[0]
        const firstVal = firstKey ? eobj[firstKey] : null
        if (Array.isArray(firstVal) && typeof firstVal[0] === 'string') {
          return `${firstVal[0]} (${res.status})`
        }
      }
    }
  } catch {
    // non-JSON body (HTML, plain text)
  }

  const short = text.replace(/\s+/g, ' ').trim().slice(0, 220)
  return `${short || fallback} (${res.status})`
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
  entry_point: EntryPoint
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
    throw new Error(await parseErrorMessage(res, 'Login failed'))
  }

  return await parseJson<LoginResponse>(res)
}

export async function logout(token: string, params: { entry_point: EntryPoint }): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/logout`, {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  })

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Logout failed'))
  }
}

export async function logVisit(params: { entry_point: EntryPoint; occurred_at?: string }): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/access-logs/visit`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  })

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Visit log failed'))
  }
}

export async function listAccessLogs(token: string, query: AccessLogsQuery = {}): Promise<AccessLogsPage> {
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    params.set(key, String(value))
  })
  const suffix = params.toString()
  const endpoint = suffix ? `${API_BASE_URL}/access-logs?${suffix}` : `${API_BASE_URL}/access-logs`

  const res = await fetch(endpoint, {
    headers: {
      ...authHeaders(token),
    },
  })

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Access logs fetch failed'))
  }

  const payload = await parseJson<unknown>(res)
  if (Array.isArray(payload)) {
    return { data: payload as AccessLog[] }
  }
  if (payload && typeof payload === 'object' && Array.isArray((payload as AccessLogsPage).data)) {
    return payload as AccessLogsPage
  }
  return { data: [] }
}

export async function getCurrentUser(token: string): Promise<User> {
  const res = await fetch(`${API_BASE_URL}/user`, {
    headers: {
      ...authHeaders(token),
    },
  })

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'User fetch failed'))
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
    throw new Error(await parseErrorMessage(res, 'Users fetch failed'))
  }

  return await parseJson<User[]>(res)
}

export async function listUsersOnlineStatus(token: string): Promise<User[]> {
  const res = await fetch(`${API_BASE_URL}/admin/users/online-status`, {
    headers: {
      ...authHeaders(token),
    },
  })

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Users online-status fetch failed'))
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
    throw new Error(await parseErrorMessage(res, 'User create failed'))
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
    throw new Error(await parseErrorMessage(res, 'User update failed'))
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
    throw new Error(await parseErrorMessage(res, 'User delete failed'))
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
    throw new Error(await parseErrorMessage(res, 'User suspend failed'))
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
    throw new Error(await parseErrorMessage(res, 'User unsuspend failed'))
  }

  const data = await parseJson<unknown>(res)
  if (data && typeof data === 'object' && 'user' in (data as Record<string, unknown>)) {
    return (data as { user: User }).user
  }
  return data as User
}

export async function listLists(token: string): Promise<WordList[]> {
  const res = await fetch(`${API_BASE_URL}/lists`, {
    headers: {
      ...authHeaders(token),
    },
  })

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Lists fetch failed'))
  }

  return await parseJson<WordList[]>(res)
}

export async function createList(
  token: string,
  params: { name: string; public?: boolean; notes?: string | null; wordlist?: string | null },
): Promise<WordList> {
  const res = await fetch(`${API_BASE_URL}/lists`, {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  })

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'List create failed'))
  }

  return await parseJson<WordList>(res)
}

export async function getList(token: string, listId: number): Promise<WordList> {
  const res = await fetch(`${API_BASE_URL}/lists/${listId}`, {
    headers: {
      ...authHeaders(token),
    },
  })

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'List fetch failed'))
  }

  return await parseJson<WordList>(res)
}

export async function updateList(
  token: string,
  listId: number,
  params: { name: string; public?: boolean; notes?: string | null; wordlist?: string | null },
): Promise<WordList> {
  const res = await fetch(`${API_BASE_URL}/lists/${listId}`, {
    method: 'PUT',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  })

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'List update failed'))
  }

  return await parseJson<WordList>(res)
}

export async function deleteList(token: string, listId: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/lists/${listId}`, {
    method: 'DELETE',
    headers: {
      ...authHeaders(token),
    },
  })

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'List delete failed'))
  }
}

export async function listWords(token: string, listId: number): Promise<WordGenerationsResponse> {
  const res = await fetch(`${API_BASE_URL}/lists/${listId}/words`, {
    headers: {
      ...authHeaders(token),
    },
  })

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Words fetch failed'))
  }

  return await parseJson<WordGenerationsResponse>(res)
}

export async function createWord(
  token: string,
  listId: number,
  params: { generation: number; word?: string; words?: string[] },
): Promise<WordItem> {
  const res = await fetch(`${API_BASE_URL}/lists/${listId}/words`, {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  })

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Word create failed'))
  }

  return await parseJson<WordItem>(res)
}

export async function updateWord(
  token: string,
  listId: number,
  wordId: number,
  params: Partial<{ generation: number; word: string; position: number }>,
): Promise<WordItem> {
  const res = await fetch(`${API_BASE_URL}/lists/${listId}/words/${wordId}`, {
    method: 'PUT',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  })

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Word update failed'))
  }

  return await parseJson<WordItem>(res)
}

export async function deleteWord(
  token: string,
  listId: number,
  wordId: number,
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/lists/${listId}/words/${wordId}`, {
    method: 'DELETE',
    headers: {
      ...authHeaders(token),
    },
  })

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Word delete failed'))
  }
}

export async function replaceWordGenerations(
  token: string,
  listId: number,
  params: { generations: Array<{ generation: number; words: string[] }> },
): Promise<WordGenerationsResponse> {
  const res = await fetch(`${API_BASE_URL}/lists/${listId}/word-generations`, {
    method: 'PUT',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  })

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Word generations update failed'))
  }

  return await parseJson<WordGenerationsResponse>(res)
}

export async function listWordRelations(
  token: string,
  listId: number,
  params: { from_generation?: number } = {},
): Promise<WordRelation[]> {
  const qs = new URLSearchParams()
  if (params.from_generation != null) qs.set('from_generation', String(params.from_generation))

  const suffix = qs.toString()
  const endpoint = suffix
    ? `${API_BASE_URL}/lists/${listId}/word-relations?${suffix}`
    : `${API_BASE_URL}/lists/${listId}/word-relations`

  const res = await fetch(endpoint, {
    headers: {
      ...authHeaders(token),
    },
  })

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Word relations fetch failed'))
  }

  return await parseJson<WordRelation[]>(res)
}

export async function replaceWordRelationsForFromWord(
  token: string,
  listId: number,
  fromWordId: number,
  params: { to_word_ids: number[] },
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/lists/${listId}/word-relations/from/${fromWordId}`, {
    method: 'PUT',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  })

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Word relations update failed'))
  }
}

export async function deleteWordRelation(token: string, listId: number, relationId: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/lists/${listId}/word-relations/${relationId}`, {
    method: 'DELETE',
    headers: {
      ...authHeaders(token),
    },
  })

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'Word relation delete failed'))
  }
}

/** User-owned color palette list */
export type ColorList = {
  id: number
  user_id: number
  name: string
  created_at?: string
  updated_at?: string
  colors?: PaletteColor[]
}

export type PaletteColor = {
  id: number
  list_id: number
  color: string
  position: number
  created_at?: string
  updated_at?: string
}

export async function listColorLists(token: string): Promise<ColorList[]> {
  const res = await fetch(`${API_BASE_URL}/color-lists`, {
    headers: { ...authHeaders(token) },
  })
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Color lists fetch failed'))
  return await parseJson<ColorList[]>(res)
}

export async function createColorList(token: string, params: { name: string }): Promise<ColorList> {
  const res = await fetch(`${API_BASE_URL}/color-lists`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Color list create failed'))
  return await parseJson<ColorList>(res)
}

export async function getColorList(token: string, listId: number): Promise<ColorList> {
  const res = await fetch(`${API_BASE_URL}/color-lists/${listId}`, {
    headers: { ...authHeaders(token) },
  })
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Color list fetch failed'))
  return await parseJson<ColorList>(res)
}

export async function updateColorList(
  token: string,
  listId: number,
  params: { name: string },
): Promise<ColorList> {
  const res = await fetch(`${API_BASE_URL}/color-lists/${listId}`, {
    method: 'PUT',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Color list update failed'))
  return await parseJson<ColorList>(res)
}

export async function deleteColorList(token: string, listId: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/color-lists/${listId}`, {
    method: 'DELETE',
    headers: { ...authHeaders(token) },
  })
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Color list delete failed'))
}

export async function listPaletteColors(token: string, listId: number): Promise<PaletteColor[]> {
  const res = await fetch(`${API_BASE_URL}/color-lists/${listId}/colors`, {
    headers: { ...authHeaders(token) },
  })
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Colors fetch failed'))
  return await parseJson<PaletteColor[]>(res)
}

export async function createPaletteColor(
  token: string,
  listId: number,
  params: { color: string; position: number },
): Promise<PaletteColor> {
  const res = await fetch(`${API_BASE_URL}/color-lists/${listId}/colors`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Color create failed'))
  return await parseJson<PaletteColor>(res)
}

export async function updatePaletteColor(
  token: string,
  listId: number,
  colorId: number,
  params: Partial<{ color: string; position: number }>,
): Promise<PaletteColor> {
  const res = await fetch(`${API_BASE_URL}/color-lists/${listId}/colors/${colorId}`, {
    method: 'PUT',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Color update failed'))
  return await parseJson<PaletteColor>(res)
}

export async function deletePaletteColor(
  token: string,
  listId: number,
  colorId: number,
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/color-lists/${listId}/colors/${colorId}`, {
    method: 'DELETE',
    headers: { ...authHeaders(token) },
  })
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Color delete failed'))
}

