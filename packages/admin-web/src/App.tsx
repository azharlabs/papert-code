import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  AdminControls,
  GroupRecord,
  QuotaRequestRecord,
  SessionRecord,
  UsageRecord,
  UserRecord,
} from './types';
import {
  approveQuotaRequest,
  createGroup,
  createUser,
  deleteGroup,
  deleteUser,
  fetchGroups,
  fetchQuotaRequests,
  fetchSession,
  fetchSessions,
  fetchUsage,
  fetchUsers,
  login,
  rejectQuotaRequest,
  updateGroup,
  updateUser,
} from './api/client';
import { PolicyEditor } from './components/PolicyEditor';
import { ProviderEditor } from './components/ProviderEditor';
import { Toggle } from './components/Toggle';

function emptyControls(): AdminControls {
  return {
    secureModeEnabled: false,
    strictModeDisabled: false,
    mcpSetting: {
      mcpEnabled: true,
      overrideMcpConfigJson: '',
    },
    cliFeatureSetting: {
      extensionsSetting: { extensionsEnabled: true },
      unmanagedCapabilitiesEnabled: true,
    },
  };
}

const maskToken = (value: string) => {
  if (!value) return 'No session token';
  if (value.length <= 20) return value;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
};

const formatTimestamp = (value?: string | null) =>
  value ? new Date(value).toLocaleString() : '—';

export function App() {
  const [token, setToken] = useState(
    () => localStorage.getItem('papert_admin_token') || '',
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [groups, setGroups] = useState<GroupRecord[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [quotaRequests, setQuotaRequests] = useState<QuotaRequestRecord[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [selectedSession, setSelectedSession] = useState<SessionRecord | null>(null);
  const [sessionTranscript, setSessionTranscript] = useState<string>('');

  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [usage, setUsage] = useState<UsageRecord[]>([]);

  const [groupDraft, setGroupDraft] = useState<GroupRecord | null>(null);
  const [userDraft, setUserDraft] = useState<UserRecord | null>(null);
  const [newUserPassword, setNewUserPassword] = useState('');
  const [activeSection, setActiveSection] = useState<
    | 'overview'
    | 'users'
    | 'groups'
    | 'usage'
    | 'sessions'
    | 'settings'
  >('overview');
  const [userSearch, setUserSearch] = useState('');
  const [groupSearch, setGroupSearch] = useState('');

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) || null,
    [groups, selectedGroupId],
  );
  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) || null,
    [users, selectedUserId],
  );

  const activeUsers = useMemo(
    () => users.filter((user) => user.active).length,
    [users],
  );

  const totalTokensReported = useMemo(
    () =>
      sessions.reduce((sum, session) => {
        const tokens = typeof session.usage?.tokensUsed === 'number'
          ? session.usage.tokensUsed
          : 0;
        return sum + tokens;
      }, 0),
    [sessions],
  );

  const lastSyncedSession = useMemo(() => {
    if (!sessions.length) return null;
    return [...sessions].sort((a, b) => {
      const alpha = new Date(b.createdAt).getTime();
      const beta = new Date(a.createdAt).getTime();
      return alpha - beta;
    })[0];
  }, [sessions]);

  const pendingQuotaCount = useMemo(
    () => quotaRequests.filter((req) => req.status === 'pending').length,
    [quotaRequests],
  );

  const selectedUserSessions = useMemo(
    () => sessions.filter((session) => session.userId === selectedUserId),
    [sessions, selectedUserId],
  );

  const usageSummary = useMemo(
    () => usage.reduce(
      (summary, record) => {
        if (record.period === 'daily') {
          summary.daily += record.tokensUsed;
        }
        if (record.period === 'monthly') {
          summary.monthly += record.tokensUsed;
        }
        return summary;
      },
      { daily: 0, monthly: 0 },
    ),
    [usage],
  );

  const sortedUsage = useMemo(
    () =>
      [...usage].sort((a, b) =>
        new Date(b.periodStart).getTime() - new Date(a.periodStart).getTime(),
      ),
    [usage],
  );
  const stats = [
    {
      label: 'Active users',
      value: activeUsers,
      note: `${users.length} total`,
    },
    {
      label: 'Sessions synced',
      value: sessions.length,
      note: lastSyncedSession
        ? `Last ${formatTimestamp(lastSyncedSession.createdAt)}`
        : 'No sessions yet',
    },
    {
      label: 'Tokens reported',
      value: totalTokensReported,
      note: 'Sum from session payloads',
    },
    {
      label: 'Quota review queue',
      value: pendingQuotaCount,
      note: 'Pending approvals',
    },
  ];

  const sortedSessions = useMemo(
    () =>
      [...sessions].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [sessions],
  );

  const navItems = [
    { id: 'overview', label: 'Overview' },
    { id: 'users', label: 'Users' },
    { id: 'groups', label: 'Groups' },
    { id: 'usage', label: 'Usage' },
    { id: 'sessions', label: 'Sessions' },
    { id: 'settings', label: 'Settings' },
  ] as const;

  const activeLabel =
    navItems.find((item) => item.id === activeSection)?.label ?? 'Overview';



  const recentSessions = useMemo(
    () =>
      [...sessions]
        .sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
        .slice(0, 6),
    [sessions],
  );

  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    if (!query) return users;
    return users.filter((user) =>
      user.email.toLowerCase().includes(query) ||
      (user.groupId ?? '').toLowerCase().includes(query),
    );
  }, [users, userSearch]);

  const filteredGroups = useMemo(() => {
    const query = groupSearch.trim().toLowerCase();
    if (!query) return groups;
    return groups.filter((group) => group.name.toLowerCase().includes(query));
  }, [groups, groupSearch]);

  const createEmptyUser = (): UserRecord => ({
    id: '',
    email: '',
    role: 'user',
    groupId: null,
    selfManaged: false,
    provider: {},
    controls: emptyControls(),
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const createEmptyGroup = (): GroupRecord => ({
    id: '',
    name: '',
    controls: emptyControls(),
    provider: {},
    quotaMonthly: null,
    quotaDaily: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const handleNewUser = () => {
    setUserDraft(createEmptyUser());
    setSelectedUserId('');
    setNewUserPassword('');
  };

  const handleNewGroup = () => {
    setGroupDraft(createEmptyGroup());
    setSelectedGroupId('');
  };

  useEffect(() => {
    if (!selectedUserId && users.length > 0) {
      setSelectedUserId(users[0].id);
    }
  }, [users, selectedUserId]);

  const refreshAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [groupsData, usersData, quotaData, sessionData] = await Promise.all([
        fetchGroups(token),
        fetchUsers(token),
        fetchQuotaRequests(token),
        fetchSessions(token),
      ]);
      setGroups(groupsData);
      setUsers(usersData);
      setQuotaRequests(quotaData);
      setSessions(sessionData);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      void refreshAll();
    }
  }, [token, refreshAll]);

  useEffect(() => {
    setGroupDraft(selectedGroup ? JSON.parse(JSON.stringify(selectedGroup)) : null);
  }, [selectedGroup]);

  useEffect(() => {
    setUserDraft(selectedUser ? JSON.parse(JSON.stringify(selectedUser)) : null);
    if (selectedUserId && token) {
      fetchUsage(token, selectedUserId)
        .then((data) => setUsage(data.usage))
        .catch((err) => setError((err as Error).message));
    } else {
      setUsage([]);
    }
  }, [selectedUser, selectedUserId, token]);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await login(email, password);
      const authToken = response.token as string;
      setToken(authToken);
      localStorage.setItem('papert_admin_token', authToken);
      setInfo('Logged in.');
      setTimeout(() => setInfo(null), 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setToken('');
    localStorage.removeItem('papert_admin_token');
    setGroups([]);
    setUsers([]);
    setQuotaRequests([]);
    setSessions([]);
    setSelectedSession(null);
    setSessionTranscript('');
    setSelectedGroupId('');
    setSelectedUserId('');
    setUsage([]);
    setGroupDraft(null);
    setUserDraft(null);
    setNewUserPassword('');
    setEmail('');
    setPassword('');
    setInfo(null);
    setError(null);
  };

  const handleCreateGroup = async () => {
    if (!token || !groupDraft) return;
    setLoading(true);
    setError(null);
    try {
      const group = await createGroup(token, {
        name: groupDraft.name,
        controls: groupDraft.controls,
        provider: groupDraft.provider,
        quotaMonthly: groupDraft.quotaMonthly ?? null,
        quotaDaily: groupDraft.quotaDaily ?? null,
      });
      setGroups((prev) => [...prev, group]);
      setSelectedGroupId(group.id);
      setInfo('Group created.');
      setTimeout(() => setInfo(null), 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGroup = async () => {
    if (!token || !groupDraft) return;
    setLoading(true);
    setError(null);
    try {
      const updated = await updateGroup(token, groupDraft.id, {
        name: groupDraft.name,
        controls: groupDraft.controls,
        provider: groupDraft.provider,
        quotaMonthly: groupDraft.quotaMonthly ?? null,
        quotaDaily: groupDraft.quotaDaily ?? null,
      });
      setGroups((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
      setInfo('Group updated.');
      setTimeout(() => setInfo(null), 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!token || !groupDraft) return;
    setLoading(true);
    setError(null);
    try {
      await deleteGroup(token, groupDraft.id);
      setGroups((prev) => prev.filter((g) => g.id !== groupDraft.id));
      setSelectedGroupId('');
      setInfo('Group removed.');
      setTimeout(() => setInfo(null), 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    if (!token || !userDraft || !newUserPassword) return;
    if (newUserPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const created = await createUser(token, {
        email: userDraft.email,
        password: newUserPassword,
        role: userDraft.role,
        groupId: userDraft.groupId ?? null,
        selfManaged: userDraft.selfManaged,
        provider: userDraft.provider,
        controls: userDraft.controls,
        active: userDraft.active,
      });
      setUsers((prev) => [...prev, created]);
      setSelectedUserId(created.id);
      setNewUserPassword('');
      setInfo('User created.');
      setTimeout(() => setInfo(null), 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveUser = async () => {
    if (!token || !userDraft) return;
    if (newUserPassword && newUserPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        email: userDraft.email,
        role: userDraft.role,
        groupId: userDraft.groupId ?? null,
        selfManaged: userDraft.selfManaged,
        provider: userDraft.provider,
        controls: userDraft.controls,
        active: userDraft.active,
      };
      if (newUserPassword) {
        payload.password = newUserPassword;
      }
      const updated = await updateUser(token, userDraft.id, payload);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setNewUserPassword('');
      setInfo('User updated.');
      setTimeout(() => setInfo(null), 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!token || !userDraft) return;
    setLoading(true);
    setError(null);
    try {
      await deleteUser(token, userDraft.id);
      setUsers((prev) => prev.filter((u) => u.id !== userDraft.id));
      setSelectedUserId('');
      setInfo('User removed.');
      setTimeout(() => setInfo(null), 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveRequest = async (id: string) => {
    if (!token) return;
    setLoading(true);
    try {
      const updated = await approveQuotaRequest(token, id);
      setQuotaRequests((prev) =>
        prev.map((req) => (req.id === updated.id ? updated : req)),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRejectRequest = async (id: string) => {
    if (!token) return;
    setLoading(true);
    try {
      const updated = await rejectQuotaRequest(token, id);
      setQuotaRequests((prev) =>
        prev.map((req) => (req.id === updated.id ? updated : req)),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLoadSession = async (sessionId: string) => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await fetchSession(token, sessionId);
      setSelectedSession(data.session);
      setSessionTranscript(data.transcript || '');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUser = (id: string) => {
    setSelectedUserId(id);
    setActiveSection('users');
  };

  const handleSelectGroup = (id: string) => {
    setSelectedGroupId(id);
    setActiveSection('groups');
  };

  if (!token) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <p className="eyebrow">Papert Admin Control Plane</p>
          <h1>Secure sign-in</h1>
          <p className="auth-subtitle">
            Authenticate with the bootstrap admin account to manage policies and usage.
          </p>
          <div className="auth-form">
            <label className="field">
              <span>Email</span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button className="primary" onClick={handleLogin}>
              Sign in
            </button>
            {error && <p className="hint error">{error}</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="admin-nav">
        <div className="nav-brand">
          <div className="logo-badge" />
          <div>
            <p className="nav-brand__title">Papert Admin</p>
            <p className="nav-brand__subtitle">Control plane</p>
          </div>
        </div>
        <div className="nav-items">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${activeSection === item.id ? 'active' : ''}`}
              onClick={() => setActiveSection(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="nav-footer">
          <p className="nav-footer__label">Signed in as</p>
          <p className="nav-footer__value">{email || 'admin'}</p>
          <div className="nav-footer__actions">
            <button className="ghost subtle" onClick={refreshAll} type="button">
              Refresh
            </button>
            <button className="ghost danger" onClick={handleLogout} type="button">
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <main className="content-area">
        <header className="content-header">
          <div>
            <p className="section-label">Papert Code</p>
            <h1>{activeLabel}</h1>
            <p className="section-subtitle">
              Manage policies, sessions, and quotas with the trusted admin tools.
            </p>
          </div>
          <div className="header-actions">
            <button className="ghost subtle" onClick={refreshAll} type="button">
              Sync data
            </button>
            <button className="ghost danger" onClick={handleLogout} type="button">
              Sign out
            </button>
          </div>
        </header>

        <section className="session-card">
          <div>
            <p className="session-card__title">Admin session</p>
            <p className="session-card__token">{maskToken(token)}</p>
            <p className="session-card__meta">Logged in as {email || 'admin'}</p>
          </div>
          <div className="session-card__actions">
            <button className="ghost subtle" onClick={refreshAll} type="button">
              Refresh
            </button>
            <button className="ghost danger" onClick={handleLogout} type="button">
              Sign out
            </button>
          </div>
          <div className="session-card__badges">
            {loading && <span className="badge badge-info">Syncing…</span>}
            {error && <span className="badge badge-error">{error}</span>}
            {info && <span className="badge badge-success">{info}</span>}
          </div>
          {lastSyncedSession && (
            <p className="session-card__subtitle">
              Last sync: {formatTimestamp(lastSyncedSession.createdAt)}
            </p>
          )}
        </section>

        <div className="content-body">
          {activeSection === 'overview' && (
            <>
              <section className="stat-grid overview-stats">
                {stats.map((stat) => (
                  <article className="stat-card" key={stat.label}>
                    <p className="stat-card__label">{stat.label}</p>
                    <p className="stat-card__value">{stat.value.toLocaleString()}</p>
                    <p className="stat-card__note">{stat.note}</p>
                  </article>
                ))}
              </section>
              <div className="overview-grid">
                <article className="panel">
                  <div className="panel-header">
                    <div>
                      <h2>Recent sessions</h2>
                      <p className="hint">Sessions uploaded to the admin control plane.</p>
                    </div>
                  </div>
                  {recentSessions.length === 0 ? (
                    <p className="hint">No sessions yet.</p>
                  ) : (
                    <div className="session-list overview">
                      {recentSessions.map((session) => (
                        <div key={session.id} className="session-row overview">
                          <div>
                            <strong>{session.sessionId}</strong>
                            <p className="hint">
                              {session.userId} • {session.model ?? 'model unknown'}
                            </p>
                          </div>
                          <div className="session-row__actions">
                            <p className="hint">{formatTimestamp(session.startedAt)}</p>
                            <button
                              className="ghost subtle"
                              onClick={() => handleLoadSession(session.id)}
                              type="button"
                            >
                              Load
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
                <article className="panel">
                  <div className="panel-header">
                    <div>
                      <h2>Quota requests</h2>
                      <p className="hint">Approve pending token increases.</p>
                    </div>
                  </div>
                  {quotaRequests.length === 0 ? (
                    <p className="hint">No outstanding requests.</p>
                  ) : (
                    <div className="quota-list overview">
                      {quotaRequests.map((req) => (
                        <div key={req.id} className="quota-card">
                          <div>
                            <strong>{req.userId}</strong>
                            <p className="hint">{req.requestedMonthly ?? '—'} tokens requested</p>
                          </div>
                          <div className="chip-row">
                            <span className={`status-pill ${req.status}`}>{req.status}</span>
                            <div className="chip-row__actions">
                              <button
                                className="ghost subtle"
                                onClick={() => handleApproveRequest(req.id)}
                                type="button"
                              >
                                Approve
                              </button>
                              <button
                                className="ghost subtle danger"
                                onClick={() => handleRejectRequest(req.id)}
                                type="button"
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
                <article className="panel">
                  <div className="panel-header">
                    <div>
                      <h2>Last transcript</h2>
                      <p className="hint">Review the most recent transcript you opened.</p>
                    </div>
                  </div>
                  {selectedSession ? (
                    <>
                      <div className="session-meta">
                        <div>
                          <p className="hint">Session</p>
                          <strong>{selectedSession.sessionId}</strong>
                        </div>
                        <div>
                          <p className="hint">User</p>
                          <strong>{selectedSession.userId}</strong>
                        </div>
                        <div>
                          <p className="hint">Model</p>
                          <strong>{selectedSession.model ?? 'unknown model'}</strong>
                        </div>
                        <div>
                          <p className="hint">Uploaded</p>
                          <strong>{formatTimestamp(selectedSession.createdAt)}</strong>
                        </div>
                      </div>
                      <pre className="transcript">
                        {sessionTranscript || 'No transcript body provided.'}
                      </pre>
                    </>
                  ) : (
                    <p className="hint">Load a session to preview the transcript.</p>
                  )}
                </article>
              </div>
            </>
          )}

          {activeSection === 'users' && (
            <section className="panel users-section">
              <div className="panel-header">
                <div>
                  <h2>User directory</h2>
                  <p className="hint">Browse users and adjust policies.</p>
                </div>
                <button className="primary" onClick={handleNewUser} type="button">
                  + New user
                </button>
              </div>
              <div className="panel-split">
                <div className="list-card">
                  <div className="list-filter">
                    <input
                      value={userSearch}
                      onChange={(event) => setUserSearch(event.target.value)}
                      placeholder="Search by email or group..."
                    />
                  </div>
                  <div className="list-body">
                    {filteredUsers.length === 0 ? (
                      <p className="hint">No users match that query.</p>
                    ) : (
                      filteredUsers.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          className={`list-row ${user.id === selectedUserId ? 'active' : ''}`}
                          onClick={() => handleSelectUser(user.id)}
                        >
                          <div>
                            <strong>{user.email}</strong>
                            <p className="hint">
                              {user.groupId || 'no group'} • {user.role}
                            </p>
                          </div>
                          <div className="list-row__meta">
                            <span>{user.provider.baseUrl ?? 'admin managed'}</span>
                            <span className={`status-pill ${user.active ? 'success' : 'muted'}`}>
                              {user.active ? 'active' : 'disabled'}
                            </span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
                <div className="detail-card">
                  <div className="panel-header">
                    <div>
                      <h3>{userDraft ? `${userDraft.email || 'Edit user'}` : 'User details'}</h3>
                      <p className="hint">Update credentials, provider, and policies.</p>
                    </div>
                  </div>
                  {userDraft ? (
                    <>
                      <div className="control-grid">
                        <label className="field">
                          <span>Email</span>
                          <input
                            value={userDraft.email}
                            onChange={(e) => setUserDraft({ ...userDraft, email: e.target.value })}
                          />
                        </label>
                        <label className="field">
                          <span>Password</span>
                          <input
                            type="password"
                            value={newUserPassword}
                            onChange={(e) => setNewUserPassword(e.target.value)}
                            placeholder={
                              userDraft.id ? 'Leave blank to keep current' : 'Set initial password'
                            }
                          />
                          {newUserPassword && newUserPassword.length < 8 && (
                            <span className="hint error">
                              Password must be at least 8 characters.
                            </span>
                          )}
                        </label>
                      </div>
                      <div className="control-grid">
                        <label className="field">
                          <span>Role</span>
                          <select
                            value={userDraft.role}
                            onChange={(e) =>
                              setUserDraft({ ...userDraft, role: e.target.value as 'admin' | 'user' })
                            }
                          >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                          </select>
                        </label>
                        <label className="field">
                          <span>Group</span>
                          <select
                            value={userDraft.groupId ?? ''}
                            onChange={(e) =>
                              setUserDraft({ ...userDraft, groupId: e.target.value || null })
                            }
                          >
                            <option value="">No group</option>
                            {groups.map((group) => (
                              <option key={group.id} value={group.id}>
                                {group.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <Toggle
                        label="Self-managed provider"
                        description="Allow the user to bring their own OpenAI-compatible key."
                        checked={userDraft.selfManaged}
                        onChange={(value) => setUserDraft({ ...userDraft, selfManaged: value })}
                      />
                      {!userDraft.selfManaged && (
                        <>
                          <ProviderEditor
                            provider={userDraft.provider}
                            onChange={(provider) => setUserDraft({ ...userDraft, provider })}
                          />
                          <PolicyEditor
                            controls={userDraft.controls}
                            onChange={(controls) => setUserDraft({ ...userDraft, controls })}
                          />
                        </>
                      )}
                      <Toggle
                        label="Active"
                        description="Disable to block policy fetch and login."
                        checked={userDraft.active}
                        onChange={(value) => setUserDraft({ ...userDraft, active: value })}
                      />
                      <div className="actions">
                        {userDraft.id ? (
                          <>
                            <button className="ghost danger" onClick={handleDeleteUser}>
                              Remove user
                            </button>
                            <button className="primary" onClick={handleSaveUser}>
                              Save user
                            </button>
                          </>
                        ) : (
                          <button
                            className="primary"
                            onClick={handleCreateUser}
                            disabled={!newUserPassword || newUserPassword.length < 8}
                          >
                            Create user
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="empty-state">
                      Select a user to edit their policies and usage.
                    </div>
                  )}
                </div>
              </div>
              {selectedUser && (
                <div className="usage-grid">
                  <div className="usage-summary-row">
                    <article className="usage-card">
                      <p>Daily tokens</p>
                      <strong>{usageSummary.daily.toLocaleString()}</strong>
                      <span className="hint">Latest daily report</span>
                    </article>
                    <article className="usage-card">
                      <p>Monthly tokens</p>
                      <strong>{usageSummary.monthly.toLocaleString()}</strong>
                      <span className="hint">Aggregated this month</span>
                    </article>
                    <article className="usage-card">
                      <p>Sessions</p>
                      <strong>
                        {selectedUserSessions.length
                          ? selectedUserSessions.length.toLocaleString()
                          : '0'}
                      </strong>
                      <span className="hint">Uploaded from CLI</span>
                    </article>
                  </div>
                  <div className="session-table">
                    <div className="table-head">
                      <span>Session ID</span>
                      <span>Model</span>
                      <span>Started</span>
                      <span>Tokens</span>
                      <span>Action</span>
                    </div>
                    {selectedUserSessions.length === 0 && (
                      <p className="hint">No sessions recorded yet for this user.</p>
                    )}
                    {selectedUserSessions.map((session) => (
                      <div key={session.id} className="session-row">
                        <span>{session.sessionId}</span>
                        <span>{session.model ?? 'unknown model'}</span>
                        <span>{formatTimestamp(session.startedAt)}</span>
                        <span>
                          {typeof session.usage?.tokensUsed === 'number'
                            ? session.usage.tokensUsed.toLocaleString()
                            : '—'}
                        </span>
                        <button
                          className="ghost subtle"
                          onClick={() => handleLoadSession(session.id)}
                          type="button"
                        >
                          View
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
          {activeSection === 'groups' && (
            <section className="panel groups-section">
              <div className="panel-header">
                <div>
                  <h2>Groups directory</h2>
                  <p className="hint">Manage group policies and quotas.</p>
                </div>
                <button className="primary" onClick={handleNewGroup} type="button">
                  + New group
                </button>
              </div>
              <div className="panel-split">
                <div className="list-card">
                  <div className="list-filter">
                    <input
                      value={groupSearch}
                      onChange={(event) => setGroupSearch(event.target.value)}
                      placeholder="Search groups..."
                    />
                  </div>
                  <div className="list-body">
                    {filteredGroups.length === 0 ? (
                      <p className="hint">No groups match that query.</p>
                    ) : (
                      filteredGroups.map((group) => (
                        <button
                          key={group.id}
                          type="button"
                          className={`list-row ${group.id === selectedGroupId ? 'active' : ''}`}
                          onClick={() => handleSelectGroup(group.id)}
                        >
                          <div>
                            <strong>{group.name}</strong>
                            <p className="hint">
                              {group.provider.baseUrl ?? 'admin provider'}
                            </p>
                          </div>
                          <div className="list-row__meta">
                            <span>
                              {group.quotaMonthly ? `${group.quotaMonthly} tokens/mo` : 'No quota'}
                            </span>
                            <span>
                              {group.quotaDaily ? `${group.quotaDaily} tokens/day` : '—'}
                            </span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
                <div className="detail-card">
                  <div className="panel-header">
                    <div>
                      <h3>{groupDraft ? `${groupDraft.name || 'Edit group'}` : 'Group details'}</h3>
                      <p className="hint">Adjust policies, providers, and quotas.</p>
                    </div>
                  </div>
                  {groupDraft ? (
                    <>
                      <div className="control-grid">
                        <label className="field">
                          <span>Name</span>
                          <input
                            value={groupDraft.name}
                            onChange={(event) =>
                              setGroupDraft({ ...groupDraft, name: event.target.value })
                            }
                          />
                        </label>
                        <label className="field">
                          <span>Default model</span>
                          <input
                            value={groupDraft.provider.model ?? ''}
                            onChange={(event) =>
                              setGroupDraft({
                                ...groupDraft,
                                provider: { ...groupDraft.provider, model: event.target.value },
                              })
                            }
                          />
                        </label>
                      </div>
                      <PolicyEditor
                        controls={groupDraft.controls}
                        onChange={(controls) => setGroupDraft({ ...groupDraft, controls })}
                      />
                      <ProviderEditor
                        provider={groupDraft.provider}
                        onChange={(provider) => setGroupDraft({ ...groupDraft, provider })}
                      />
                      <div className="control-grid">
                        <label className="field">
                          <span>Monthly quota</span>
                          <input
                            type="number"
                            value={groupDraft.quotaMonthly ?? ''}
                            onChange={(e) =>
                              setGroupDraft({
                                ...groupDraft,
                                quotaMonthly: e.target.value ? Number(e.target.value) : null,
                              })
                            }
                          />
                        </label>
                        <label className="field">
                          <span>Daily quota</span>
                          <input
                            type="number"
                            value={groupDraft.quotaDaily ?? ''}
                            onChange={(e) =>
                              setGroupDraft({
                                ...groupDraft,
                                quotaDaily: e.target.value ? Number(e.target.value) : null,
                              })
                            }
                          />
                        </label>
                      </div>
                      <div className="actions">
                        {groupDraft.id ? (
                          <>
                            <button className="ghost danger" onClick={handleDeleteGroup}>
                              Delete group
                            </button>
                            <button className="primary" onClick={handleSaveGroup}>
                              Save group
                            </button>
                          </>
                        ) : (
                          <button className="primary" onClick={handleCreateGroup}>
                            Create group
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="empty-state">
                      Select a group to edit its policies and quotas.
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {activeSection === 'usage' && (
            <section className="panel usage-section">
              <div className="panel-header">
                <div>
                  <h2>Usage trends</h2>
                  <p className="hint">Token consumption reported through the admin API.</p>
                </div>
              </div>
              <div className="usage-cards">
                <article className="usage-card">
                  <p>Daily tokens</p>
                  <strong>{usageSummary.daily.toLocaleString()}</strong>
                  <span className="hint">Latest daily report</span>
                </article>
                <article className="usage-card">
                  <p>Monthly tokens</p>
                  <strong>{usageSummary.monthly.toLocaleString()}</strong>
                  <span className="hint">Aggregated this month</span>
                </article>
                <article className="usage-card">
                  <p>Sessions captured</p>
                  <strong>{sessions.length.toLocaleString()}</strong>
                  <span className="hint">Uploaded via CLI</span>
                </article>
              </div>
              <div className="usage-history">
                <div className="table-head">
                  <span>Period</span>
                  <span>Start</span>
                  <span>Tokens</span>
                </div>
                {sortedUsage.length === 0 && (
                  <p className="hint">No usage data yet.</p>
                )}
                {sortedUsage.map((record) => (
                  <div key={`${record.period}-${record.periodStart}`} className="table-row">
                    <span>{record.period}</span>
                    <span>{new Date(record.periodStart).toLocaleDateString()}</span>
                    <span>{record.tokensUsed?.toLocaleString() ?? '0'}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeSection === 'sessions' && (
            <section className="panel sessions-section">
              <div className="panel-header">
                <div>
                  <h2>Sessions</h2>
                  <p className="hint">Browse and inspect transcripts.</p>
                </div>
              </div>
              <div className="panel-split sessions-grid">
                <div className="list-card">
                  <div className="list-body">
                    {sortedSessions.length === 0 ? (
                      <p className="hint">No sessions recorded.</p>
                    ) : (
                      sortedSessions.map((session) => (
                        <button
                          key={session.id}
                          type="button"
                          className={`list-row ${selectedSession?.id === session.id ? 'active' : ''}`}
                          onClick={() => handleLoadSession(session.id)}
                        >
                          <div>
                            <strong>{session.sessionId}</strong>
                            <p className="hint">
                              {session.userId} • {session.model ?? 'unknown model'}
                            </p>
                          </div>
                          <div className="list-row__meta">
                            <span>{formatTimestamp(session.startedAt)}</span>
                            <span className="hint">
                              {typeof session.usage?.tokensUsed === 'number'
                                ? session.usage.tokensUsed.toLocaleString()
                                : '—'}
                              {' '}tokens
                            </span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
                <div className="detail-card">
                  <div className="panel-header">
                    <div>
                      <h3>Transcript preview</h3>
                      <p className="hint">Select a session to view the transcript.</p>
                    </div>
                  </div>
                  {selectedSession ? (
                    <>
                      <div className="session-meta">
                        <div>
                          <p className="hint">Session</p>
                          <strong>{selectedSession.sessionId}</strong>
                        </div>
                        <div>
                          <p className="hint">User</p>
                          <strong>{selectedSession.userId}</strong>
                        </div>
                        <div>
                          <p className="hint">Model</p>
                          <strong>{selectedSession.model ?? 'unknown model'}</strong>
                        </div>
                        <div>
                          <p className="hint">Uploaded</p>
                          <strong>{formatTimestamp(selectedSession.createdAt)}</strong>
                        </div>
                      </div>
                      <pre className="transcript">
                        {sessionTranscript || 'No transcript body provided.'}
                      </pre>
                    </>
                  ) : (
                    <p className="hint">Load a session to view its transcript.</p>
                  )}
                </div>
              </div>
            </section>
          )}

          {activeSection === 'settings' && (
            <section className="panel settings-section">
              <div className="panel-header">
                <div>
                  <h2>Settings</h2>
                  <p className="hint">Quick facts and configuration reminders.</p>
                </div>
              </div>
              <div className="settings-grid">
                <article className="mini-card">
                  <p className="mini-card__label">Active users</p>
                  <p className="mini-card__value">{activeUsers}</p>
                  <p className="mini-card__note">{users.length} total</p>
                </article>
                <article className="mini-card">
                  <p className="mini-card__label">Pending quota requests</p>
                  <p className="mini-card__value">{pendingQuotaCount}</p>
                  <p className="mini-card__note">Approve to keep teams moving.</p>
                </article>
                <article className="mini-card">
                  <p className="mini-card__label">Last sync</p>
                  <p className="mini-card__value">
                    {lastSyncedSession ? formatTimestamp(lastSyncedSession.createdAt) : 'No data'}
                  </p>
                  <p className="mini-card__note">Sessions refreshed after login.</p>
                </article>
                <article className="mini-card">
                  <p className="mini-card__label">Selected group</p>
                  <p className="mini-card__value">{selectedGroup ? selectedGroup.name : 'None'}</p>
                  <p className="mini-card__note">Use the Groups tab to adjust policies.</p>
                </article>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
