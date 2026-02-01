import type {
  GroupRecord,
  QuotaRequestRecord,
  SessionRecord,
  UserRecord,
  UsageRecord,
} from '../types';

const API_BASE = '/api/v1';

function buildHeaders(token?: string): Headers {
  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return headers;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, options);
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await response.json() : undefined;

  if (!response.ok) {
    const message =
      payload?.message || payload?.error || response.statusText || 'Request failed';
    throw new Error(message);
  }

  return payload as T;
}

export async function login(email: string, password: string) {
  return request<{ token: string } & Record<string, unknown>>('/auth/login', {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ email, password }),
  });
}

export async function fetchUsers(token: string): Promise<UserRecord[]> {
  const data = await request<{ users: UserRecord[] }>('/admin/users', {
    headers: buildHeaders(token),
  });
  return data.users;
}

export async function createUser(token: string, payload: Record<string, unknown>) {
  const data = await request<{ user: UserRecord }>('/admin/users', {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  });
  return data.user;
}

export async function updateUser(token: string, id: string, payload: Record<string, unknown>) {
  const data = await request<{ user: UserRecord }>(`/admin/users/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  });
  return data.user;
}

export async function deleteUser(token: string, id: string) {
  return request<{ removed: boolean }>(`/admin/users/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: buildHeaders(token),
  });
}

export async function fetchGroups(token: string): Promise<GroupRecord[]> {
  const data = await request<{ groups: GroupRecord[] }>('/admin/groups', {
    headers: buildHeaders(token),
  });
  return data.groups;
}

export async function createGroup(token: string, payload: Record<string, unknown>) {
  const data = await request<{ group: GroupRecord }>('/admin/groups', {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  });
  return data.group;
}

export async function updateGroup(token: string, id: string, payload: Record<string, unknown>) {
  const data = await request<{ group: GroupRecord }>(`/admin/groups/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  });
  return data.group;
}

export async function deleteGroup(token: string, id: string) {
  return request<{ removed: boolean }>(`/admin/groups/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: buildHeaders(token),
  });
}

export async function fetchUsage(token: string, userId: string): Promise<{ usage: UsageRecord[] }> {
  return request<{ usage: UsageRecord[] }>(`/admin/usage/${encodeURIComponent(userId)}`, {
    headers: buildHeaders(token),
  });
}

export async function fetchQuotaRequests(token: string): Promise<QuotaRequestRecord[]> {
  const data = await request<{ requests: QuotaRequestRecord[] }>('/admin/quota-requests', {
    headers: buildHeaders(token),
  });
  return data.requests;
}

export async function approveQuotaRequest(token: string, id: string) {
  const data = await request<{ request: QuotaRequestRecord }>(
    `/admin/quota-requests/${encodeURIComponent(id)}/approve`,
    {
      method: 'POST',
      headers: buildHeaders(token),
    },
  );
  return data.request;
}

export async function rejectQuotaRequest(token: string, id: string) {
  const data = await request<{ request: QuotaRequestRecord }>(
    `/admin/quota-requests/${encodeURIComponent(id)}/reject`,
    {
      method: 'POST',
      headers: buildHeaders(token),
    },
  );
  return data.request;
}

export async function fetchSessions(token: string, userId?: string): Promise<SessionRecord[]> {
  const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
  const data = await request<{ sessions: SessionRecord[] }>(`/admin/sessions${query}`, {
    headers: buildHeaders(token),
  });
  return data.sessions;
}

export async function fetchSession(token: string, id: string): Promise<{ session: SessionRecord; transcript?: string }> {
  return request<{ session: SessionRecord; transcript?: string }>(
    `/admin/sessions/${encodeURIComponent(id)}`,
    {
      headers: buildHeaders(token),
    },
  );
}
