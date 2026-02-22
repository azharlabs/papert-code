import { useEffect, useMemo, useState } from 'react';
import type {
  AdminControls,
  GroupRecord,
  SessionRecord,
  UsageRecord,
  UserRecord,
} from './types';
import {
  createGroup,
  createUser,
  deleteGroup,
  deleteUser,
  fetchSession,
  fetchUsage,
  login,
  updateGroup,
  updateUser,
} from './api/client';
import { PolicyEditor } from './components/PolicyEditor';
import { ProviderEditor } from './components/ProviderEditor';
import { Toggle } from './components/Toggle';
import { useAdminResourceState } from './hooks/useAdminResourceState';
import {
  buildDailyUserMetrics,
  buildUserTokenTotals,
  formatDateKey,
  getSessionTokenSummary,
} from './lib/userMetrics';

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

const formatTimestamp = (value?: string | null) =>
  value ? new Date(value).toLocaleString() : '—';

export function App() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
    () => localStorage.getItem('papert_admin_sidebar_collapsed') === '1',
  );
  const [token, setToken] = useState(
    () => localStorage.getItem('papert_admin_token') || '',
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [info, setInfo] = useState<string | null>(null);

  const {
    loading,
    setLoading,
    error,
    setError,
    groups,
    setGroups,
    users,
    setUsers,
    quotaRequests,
    setQuotaRequests,
    sessions,
    setSessions,
    refreshAll,
  } = useAdminResourceState(token);
  const [selectedSession, setSelectedSession] = useState<SessionRecord | null>(null);
  const [sessionTranscript, setSessionTranscript] = useState<string>('');

  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [usage, setUsage] = useState<UsageRecord[]>([]);

  const [groupDraft, setGroupDraft] = useState<GroupRecord | null>(null);
  const [userDraft, setUserDraft] = useState<UserRecord | null>(null);
  const [editUserPassword, setEditUserPassword] = useState('');
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [isEditGroupModalOpen, setIsEditGroupModalOpen] = useState(false);
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
  const [createGroupDraft, setCreateGroupDraft] = useState<GroupRecord | null>(null);
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [createUserDraft, setCreateUserDraft] = useState<UserRecord | null>(null);
  const [createUserPassword, setCreateUserPassword] = useState('');
  const [isFlowModalOpen, setIsFlowModalOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<
    | 'overview'
    | 'users'
    | 'userDetails'
    | 'groups'
    | 'groupDetails'
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
        const tokens = getSessionTokenSummary(session.usage);
        return sum + tokens.totalTokens;
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
  const selectedUserGroupName = useMemo(() => {
    if (!selectedUser?.groupId) return 'No group';
    return groups.find((group) => group.id === selectedUser.groupId)?.name ?? selectedUser.groupId;
  }, [groups, selectedUser]);

  const selectedUserTokenTotals = useMemo(
    () => buildUserTokenTotals(usage),
    [usage],
  );

  const selectedUserDailyMetrics = useMemo(
    () => buildDailyUserMetrics(usage, selectedUserSessions),
    [usage, selectedUserSessions],
  );
  const adminUsersCount = useMemo(
    () => users.filter((user) => user.role === 'admin').length,
    [users],
  );
  const selfManagedUsersCount = useMemo(
    () => users.filter((user) => user.selfManaged).length,
    [users],
  );
  const usersWithoutGroupCount = useMemo(
    () => users.filter((user) => !user.groupId).length,
    [users],
  );
  const groupsWithQuotasCount = useMemo(
    () =>
      groups.filter((group) => Boolean(group.quotaDaily) || Boolean(group.quotaMonthly)).length,
    [groups],
  );
  const selectedGroupMemberIds = useMemo(() => {
    if (!selectedGroupId) return new Set<string>();
    return new Set(
      users.filter((user) => user.groupId === selectedGroupId).map((user) => user.id),
    );
  }, [users, selectedGroupId]);
  const selectedGroupMembers = useMemo(
    () => users.filter((user) => selectedGroupMemberIds.has(user.id)),
    [users, selectedGroupMemberIds],
  );
  const selectedGroupSessions = useMemo(
    () => sessions.filter((session) => selectedGroupMemberIds.has(session.userId)),
    [sessions, selectedGroupMemberIds],
  );
  const selectedGroupTokens = useMemo(
    () =>
      selectedGroupSessions.reduce(
        (sum, session) => sum + getSessionTokenSummary(session.usage).totalTokens,
        0,
      ),
    [selectedGroupSessions],
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
    { id: 'overview', label: 'Overview', shortLabel: 'OV' },
    { id: 'users', label: 'Users', shortLabel: 'US' },
    { id: 'groups', label: 'Groups', shortLabel: 'GR' },
    { id: 'usage', label: 'Usage', shortLabel: 'UG' },
    { id: 'sessions', label: 'Sessions', shortLabel: 'SE' },
    { id: 'settings', label: 'Settings', shortLabel: 'ST' },
  ] as const;

  const activeLabel = activeSection === 'userDetails' && selectedUser
    ? `${selectedUser.email} details`
    : activeSection === 'groupDetails' && groupDraft
      ? `${groupDraft.name || 'New group'} details`
      : navItems.find((item) => item.id === activeSection)?.label ?? 'Overview';

  useEffect(() => {
    localStorage.setItem(
      'papert_admin_sidebar_collapsed',
      isSidebarCollapsed ? '1' : '0',
    );
  }, [isSidebarCollapsed]);
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
    setCreateUserDraft(createEmptyUser());
    setCreateUserPassword('');
    setIsFlowModalOpen(false);
    setIsCreateUserModalOpen(true);
  };

  const handleNewGroup = () => {
    setCreateGroupDraft(createEmptyGroup());
    setIsFlowModalOpen(false);
    setIsCreateGroupModalOpen(true);
  };

  const closeCreateUserModal = () => {
    setIsCreateUserModalOpen(false);
    setCreateUserDraft(null);
    setCreateUserPassword('');
  };

  const closeCreateGroupModal = () => {
    setIsCreateGroupModalOpen(false);
    setCreateGroupDraft(null);
  };

  const openEditUserModal = () => {
    if (!userDraft) return;
    setEditUserPassword('');
    setIsEditUserModalOpen(true);
  };

  const closeEditUserModal = () => {
    setIsEditUserModalOpen(false);
    setEditUserPassword('');
    setUserDraft(selectedUser ? JSON.parse(JSON.stringify(selectedUser)) : null);
  };

  const openEditGroupModal = () => {
    if (!groupDraft) return;
    setIsEditGroupModalOpen(true);
  };

  const closeEditGroupModal = () => {
    setIsEditGroupModalOpen(false);
    setGroupDraft(selectedGroup ? JSON.parse(JSON.stringify(selectedGroup)) : null);
  };

  const runFlowAction = (
    action:
      | 'sync'
      | 'users'
      | 'new_user'
      | 'groups'
      | 'usage'
      | 'sessions'
      | 'quota_review'
      | 'settings'
      | 'api_health',
  ) => {
    if (action === 'sync') {
      setIsFlowModalOpen(false);
      void refreshAll();
      return;
    }
    if (action === 'new_user') {
      setActiveSection('users');
      handleNewUser();
      return;
    }
    if (action === 'users') {
      setIsFlowModalOpen(false);
      setActiveSection('users');
      return;
    }
    if (action === 'groups') {
      setIsFlowModalOpen(false);
      setActiveSection('groups');
      return;
    }
    if (action === 'usage') {
      setIsFlowModalOpen(false);
      setActiveSection('usage');
      return;
    }
    if (action === 'sessions') {
      setIsFlowModalOpen(false);
      setActiveSection('sessions');
      return;
    }
    if (action === 'quota_review') {
      setIsFlowModalOpen(false);
      setActiveSection('overview');
      return;
    }
    if (action === 'settings') {
      setIsFlowModalOpen(false);
      setActiveSection('settings');
      return;
    }
    if (action === 'api_health') {
      setIsFlowModalOpen(false);
      window.open('/api/v1/admin/health', '_blank', 'noopener,noreferrer');
    }
  };

  useEffect(() => {
    if (!selectedUserId && users.length > 0) {
      setSelectedUserId(users[0].id);
    }
  }, [users, selectedUserId]);

  useEffect(() => {
    if (!selectedGroup) {
      if (selectedGroupId) {
        setGroupDraft(null);
      }
      return;
    }
    setGroupDraft(JSON.parse(JSON.stringify(selectedGroup)));
  }, [selectedGroup, selectedGroupId]);

  useEffect(() => {
    setUserDraft(selectedUser ? JSON.parse(JSON.stringify(selectedUser)) : null);
    setEditUserPassword('');
    if (selectedUserId && token) {
      fetchUsage(token, selectedUserId)
        .then((data) => setUsage(data.usage))
        .catch((err) => setError((err as Error).message));
    } else {
      setUsage([]);
    }
  }, [selectedUser, selectedUserId, token, setError]);

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
    setEditUserPassword('');
    setIsEditUserModalOpen(false);
    setIsEditGroupModalOpen(false);
    setIsCreateGroupModalOpen(false);
    setCreateGroupDraft(null);
    setCreateUserPassword('');
    setCreateUserDraft(null);
    setIsCreateUserModalOpen(false);
    setIsFlowModalOpen(false);
    setEmail('');
    setPassword('');
    setInfo(null);
    setError(null);
  };

  const handleCreateGroupFromModal = async () => {
    if (!token || !createGroupDraft) return;
    if (!createGroupDraft.name.trim()) {
      setError('Group name is required.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const group = await createGroup(token, {
        name: createGroupDraft.name,
        controls: createGroupDraft.controls,
        provider: createGroupDraft.provider,
        quotaMonthly: createGroupDraft.quotaMonthly ?? null,
        quotaDaily: createGroupDraft.quotaDaily ?? null,
      });
      setGroups((prev) => [...prev, group]);
      setSelectedGroupId(group.id);
      setGroupDraft(group);
      setActiveSection('groupDetails');
      closeCreateGroupModal();
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
      setIsEditGroupModalOpen(false);
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
      setGroupDraft(null);
      setIsEditGroupModalOpen(false);
      setActiveSection('groups');
      setInfo('Group removed.');
      setTimeout(() => setInfo(null), 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    if (!token || !createUserDraft || !createUserPassword) return;
    if (createUserPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const created = await createUser(token, {
        email: createUserDraft.email,
        password: createUserPassword,
        role: createUserDraft.role,
        groupId: createUserDraft.groupId ?? null,
        selfManaged: createUserDraft.selfManaged,
        provider: createUserDraft.provider,
        controls: createUserDraft.controls,
        active: createUserDraft.active,
      });
      setUsers((prev) => [...prev, created]);
      setSelectedUserId(created.id);
      setActiveSection('userDetails');
      closeCreateUserModal();
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
    if (editUserPassword && editUserPassword.length < 8) {
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
      if (editUserPassword) {
        payload.password = editUserPassword;
      }
      const updated = await updateUser(token, userDraft.id, payload);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setEditUserPassword('');
      setIsEditUserModalOpen(false);
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
      setIsEditUserModalOpen(false);
      setActiveSection('users');
      setInfo('User removed.');
      setTimeout(() => setInfo(null), 3000);
    } catch (err) {
      setError((err as Error).message);
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
    setActiveSection('userDetails');
  };

  const handleSelectGroup = (id: string) => {
    setSelectedGroupId(id);
    setActiveSection('groupDetails');
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
    <div className={`app-shell ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className="admin-nav">
        <div className="nav-brand">
          <img className="logo-badge" src="/papert-logo.png" alt="Papert logo" />
          <div className="nav-brand__copy">
            <p className="nav-brand__title">Papert Admin</p>
            <p className="nav-brand__subtitle">Control plane</p>
          </div>
          <button
            className="sidebar-toggle"
            type="button"
            onClick={() => setIsSidebarCollapsed((prev) => !prev)}
            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isSidebarCollapsed ? '>>' : '<<'}
          </button>
        </div>
        <div className="nav-items">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${activeSection === item.id ? 'active' : ''}`}
              onClick={() => setActiveSection(item.id)}
              aria-label={item.label}
              title={item.label}
              data-short-label={item.shortLabel}
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
        </header>

        <div className="status-row">
          {loading && <span className="badge badge-info">Syncing…</span>}
          {error && <span className="badge badge-error">{error}</span>}
          {info && <span className="badge badge-success">{info}</span>}
          {lastSyncedSession && (
            <span className="hint">Last sync: {formatTimestamp(lastSyncedSession.createdAt)}</span>
          )}
        </div>

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
              <section className="panel flow-canvas">
                <div className="panel-header">
                  <div>
                    <h2>Complete flow canvas</h2>
                    <p className="hint">
                      Follow these steps in order. Every action button navigates you to the right place.
                    </p>
                  </div>
                  <div className="flow-header-actions">
                    <button
                      className="ghost subtle"
                      type="button"
                      onClick={() => setIsFlowModalOpen(true)}
                    >
                      Open guided modal
                    </button>
                    <a
                      className="ghost subtle flow-link"
                      href="/api/v1/admin/health"
                      target="_blank"
                      rel="noreferrer"
                    >
                      API health
                    </a>
                  </div>
                </div>
                <div className="flow-canvas-grid">
                  <article className="flow-node">
                    <p className="flow-node__step">Step 1</p>
                    <h3>Sync data</h3>
                    <p>Pull latest users, groups, sessions, and quota requests.</p>
                    <button
                      className="ghost subtle"
                      type="button"
                      onClick={() => runFlowAction('sync')}
                    >
                      Sync now
                    </button>
                  </article>
                  <article className="flow-node">
                    <p className="flow-node__step">Step 2</p>
                    <h3>Open Users</h3>
                    <p>Go to the user directory to manage accounts.</p>
                    <button
                      className="ghost subtle"
                      type="button"
                      onClick={() => runFlowAction('users')}
                    >
                      Go to users
                    </button>
                  </article>
                  <article className="flow-node">
                    <p className="flow-node__step">Step 3</p>
                    <h3>Create user</h3>
                    <p>Open the large create-user modal and submit credentials + policy.</p>
                    <button
                      className="primary"
                      type="button"
                      onClick={() => runFlowAction('new_user')}
                    >
                      + New user modal
                    </button>
                  </article>
                  <article className="flow-node">
                    <p className="flow-node__step">Step 4</p>
                    <h3>Configure groups</h3>
                    <p>Set provider defaults and quotas at the group level.</p>
                    <button
                      className="ghost subtle"
                      type="button"
                      onClick={() => runFlowAction('groups')}
                    >
                      Go to groups
                    </button>
                  </article>
                  <article className="flow-node">
                    <p className="flow-node__step">Step 5</p>
                    <h3>Review quota requests</h3>
                    <p>Approve/reject pending quota requests from the overview queue.</p>
                    <button
                      className="ghost subtle"
                      type="button"
                      onClick={() => runFlowAction('quota_review')}
                    >
                      Open queue
                    </button>
                  </article>
                  <article className="flow-node">
                    <p className="flow-node__step">Step 6</p>
                    <h3>Audit usage & sessions</h3>
                    <p>Inspect token trends and transcript-level activity.</p>
                    <div className="flow-node__actions">
                      <button
                        className="ghost subtle"
                        type="button"
                        onClick={() => runFlowAction('usage')}
                      >
                        Usage
                      </button>
                      <button
                        className="ghost subtle"
                        type="button"
                        onClick={() => runFlowAction('sessions')}
                      >
                        Sessions
                      </button>
                    </div>
                  </article>
                </div>
              </section>
            </>
          )}

          {activeSection === 'users' && (
            <section className="panel users-section">
              <div className="panel-header">
                <div>
                  <h2>User directory</h2>
                  <p className="hint">Search users and click a row to open full details.</p>
                </div>
                <button className="primary" onClick={handleNewUser} type="button">
                  + New user
                </button>
              </div>
              <div className="settings-grid">
                <article className="mini-card">
                  <p className="mini-card__label">Total users</p>
                  <p className="mini-card__value">{users.length.toLocaleString()}</p>
                  <p className="mini-card__note">All user records</p>
                </article>
                <article className="mini-card">
                  <p className="mini-card__label">Active users</p>
                  <p className="mini-card__value">{activeUsers.toLocaleString()}</p>
                  <p className="mini-card__note">Can authenticate and fetch config</p>
                </article>
                <article className="mini-card">
                  <p className="mini-card__label">Admin users</p>
                  <p className="mini-card__value">{adminUsersCount.toLocaleString()}</p>
                  <p className="mini-card__note">Role = admin</p>
                </article>
                <article className="mini-card">
                  <p className="mini-card__label">Self-managed</p>
                  <p className="mini-card__value">{selfManagedUsersCount.toLocaleString()}</p>
                  <p className="mini-card__note">Bring-your-own provider key</p>
                </article>
              </div>
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
            </section>
          )}

          {activeSection === 'userDetails' && (
            <section className="panel user-details-section">
              <div className="panel-header">
                <div>
                  <h2>{selectedUser ? `${selectedUser.email} details` : 'User details'}</h2>
                  <p className="hint">
                    Edit user config and review usage/session metrics.
                  </p>
                </div>
                <div className="flow-node__actions">
                  <button
                    className="ghost subtle"
                    type="button"
                    onClick={() => setActiveSection('users')}
                  >
                    Back to users
                  </button>
                  <button
                    className="ghost subtle"
                    type="button"
                    onClick={() => setActiveSection('sessions')}
                  >
                    Open sessions
                  </button>
                </div>
              </div>

              {!selectedUser ? (
                <div className="empty-state">
                  Select a user from the Users table to open details.
                </div>
              ) : (
                <div className="user-metrics-body">
                  <div className="settings-grid">
                    <article className="mini-card">
                      <p className="mini-card__label">Role</p>
                      <p className="mini-card__value">{selectedUser.role}</p>
                      <p className="mini-card__note">Access scope</p>
                    </article>
                    <article className="mini-card">
                      <p className="mini-card__label">Group</p>
                      <p className="mini-card__value">{selectedUserGroupName}</p>
                      <p className="mini-card__note">Current assignment</p>
                    </article>
                    <article className="mini-card">
                      <p className="mini-card__label">Created</p>
                      <p className="mini-card__value">{new Date(selectedUser.createdAt).toLocaleDateString()}</p>
                      <p className="mini-card__note">{formatTimestamp(selectedUser.createdAt)}</p>
                    </article>
                    <article className="mini-card">
                      <p className="mini-card__label">Updated</p>
                      <p className="mini-card__value">{new Date(selectedUser.updatedAt).toLocaleDateString()}</p>
                      <p className="mini-card__note">{formatTimestamp(selectedUser.updatedAt)}</p>
                    </article>
                  </div>
                  <div className="detail-card">
                    <div className="panel-header">
                      <div>
                        <h3>User config</h3>
                        <p className="hint">Open the edit modal to update provider and policy settings.</p>
                      </div>
                      <button className="primary" type="button" onClick={openEditUserModal}>
                        Edit user
                      </button>
                    </div>
                  </div>

                  <div className="usage-summary-row user-metrics-summary">
                    <article className="usage-card">
                      <p>Total tokens so far</p>
                      <strong>{selectedUserTokenTotals.totalTokens.toLocaleString()}</strong>
                      <span className="hint">Across all monthly buckets</span>
                    </article>
                    <article className="usage-card">
                      <p>Input tokens</p>
                      <strong>{selectedUserTokenTotals.inputTokens.toLocaleString()}</strong>
                      <span className="hint">Prompt tokens reported</span>
                    </article>
                    <article className="usage-card">
                      <p>Output tokens</p>
                      <strong>{selectedUserTokenTotals.outputTokens.toLocaleString()}</strong>
                      <span className="hint">Completion tokens reported</span>
                    </article>
                    <article className="usage-card">
                      <p>Sessions</p>
                      <strong>{selectedUserSessions.length.toLocaleString()}</strong>
                      <span className="hint">Total uploaded sessions</span>
                    </article>
                  </div>

                  <div className="usage-history user-metrics-history">
                    <div className="table-head user-metrics-head">
                      <span>Date</span>
                      <span>Sessions</span>
                      <span>Total tokens</span>
                      <span>Input tokens</span>
                      <span>Output tokens</span>
                    </div>
                    {selectedUserDailyMetrics.length === 0 && (
                      <p className="hint user-metrics-empty">
                        No daily usage or session data found for this user.
                      </p>
                    )}
                    {selectedUserDailyMetrics.map((row) => (
                      <div key={row.date} className="table-row user-metrics-row">
                        <span>{formatDateKey(row.date)}</span>
                        <span>{row.sessionCount.toLocaleString()}</span>
                        <span>{row.totalTokens.toLocaleString()}</span>
                        <span>{row.inputTokens.toLocaleString()}</span>
                        <span>{row.outputTokens.toLocaleString()}</span>
                      </div>
                    ))}
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
                          {getSessionTokenSummary(session.usage).totalTokens.toLocaleString()}
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
                  <p className="hint">Search groups and click a row to open full details.</p>
                </div>
                <button className="primary" onClick={handleNewGroup} type="button">
                  + New group
                </button>
              </div>
              <div className="settings-grid">
                <article className="mini-card">
                  <p className="mini-card__label">Total groups</p>
                  <p className="mini-card__value">{groups.length.toLocaleString()}</p>
                  <p className="mini-card__note">All configured groups</p>
                </article>
                <article className="mini-card">
                  <p className="mini-card__label">Users in groups</p>
                  <p className="mini-card__value">{(users.length - usersWithoutGroupCount).toLocaleString()}</p>
                  <p className="mini-card__note">Assigned members</p>
                </article>
                <article className="mini-card">
                  <p className="mini-card__label">Groups with quota</p>
                  <p className="mini-card__value">{groupsWithQuotasCount.toLocaleString()}</p>
                  <p className="mini-card__note">Daily or monthly cap set</p>
                </article>
                <article className="mini-card">
                  <p className="mini-card__label">Ungrouped users</p>
                  <p className="mini-card__value">{usersWithoutGroupCount.toLocaleString()}</p>
                  <p className="mini-card__note">No group assignment</p>
                </article>
              </div>
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
            </section>
          )}

          {activeSection === 'groupDetails' && (
            <section className="panel group-details-section">
              <div className="panel-header">
                <div>
                  <h2>{groupDraft ? `${groupDraft.name || 'New group'} details` : 'Group details'}</h2>
                  <p className="hint">Adjust policies, providers, and quotas for this group.</p>
                </div>
                <button
                  className="ghost subtle"
                  type="button"
                  onClick={() => setActiveSection('groups')}
                >
                  Back to groups
                </button>
              </div>
              {groupDraft ? (
                <div className="detail-card">
                  <div className="settings-grid">
                    <article className="mini-card">
                      <p className="mini-card__label">Members</p>
                      <p className="mini-card__value">{selectedGroupMembers.length.toLocaleString()}</p>
                      <p className="mini-card__note">Users assigned to this group</p>
                    </article>
                    <article className="mini-card">
                      <p className="mini-card__label">Active members</p>
                      <p className="mini-card__value">
                        {selectedGroupMembers.filter((user) => user.active).length.toLocaleString()}
                      </p>
                      <p className="mini-card__note">Users currently enabled</p>
                    </article>
                    <article className="mini-card">
                      <p className="mini-card__label">Sessions</p>
                      <p className="mini-card__value">{selectedGroupSessions.length.toLocaleString()}</p>
                      <p className="mini-card__note">Uploaded by group members</p>
                    </article>
                    <article className="mini-card">
                      <p className="mini-card__label">Session tokens</p>
                      <p className="mini-card__value">{selectedGroupTokens.toLocaleString()}</p>
                      <p className="mini-card__note">Total from session payloads</p>
                    </article>
                  </div>
                  <div className="panel-header">
                    <div>
                      <h3>Group config</h3>
                      <p className="hint">Open the edit modal to update provider, policy, and quotas.</p>
                    </div>
                    <button className="primary" type="button" onClick={openEditGroupModal}>
                      Edit group
                    </button>
                  </div>
                </div>
              ) : (
                <div className="empty-state">
                  Select a group from the Groups table to open details.
                </div>
              )}
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
                              {getSessionTokenSummary(session.usage).totalTokens.toLocaleString()}
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
      {isFlowModalOpen && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Complete flow guide"
          onClick={() => setIsFlowModalOpen(false)}
        >
          <div className="modal-card modal-card--guide" onClick={(event) => event.stopPropagation()}>
            <div className="panel-header">
              <div>
                <h2>Complete click flow</h2>
                <p className="hint">
                  Use this guide to run the full admin workflow from onboarding to monitoring.
                </p>
              </div>
              <button
                className="ghost subtle"
                type="button"
                onClick={() => setIsFlowModalOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="flow-guide-list">
              <article className="flow-guide-row">
                <div>
                  <p className="flow-node__step">Step 1</p>
                  <h3>Sync latest state</h3>
                  <p className="hint">Click sync before making any user or quota changes.</p>
                </div>
                <button className="ghost subtle" type="button" onClick={() => runFlowAction('sync')}>
                  Sync
                </button>
              </article>
              <article className="flow-guide-row">
                <div>
                  <p className="flow-node__step">Step 2</p>
                  <h3>Open Users tab</h3>
                  <p className="hint">Start account management in the users directory.</p>
                </div>
                <button className="ghost subtle" type="button" onClick={() => runFlowAction('users')}>
                  Users
                </button>
              </article>
              <article className="flow-guide-row">
                <div>
                  <p className="flow-node__step">Step 3</p>
                  <h3>Click + New user</h3>
                  <p className="hint">This opens the large create-user modal.</p>
                </div>
                <button className="primary" type="button" onClick={() => runFlowAction('new_user')}>
                  Open create modal
                </button>
              </article>
              <article className="flow-guide-row">
                <div>
                  <p className="flow-node__step">Step 4</p>
                  <h3>Configure groups</h3>
                  <p className="hint">Assign defaults and token limits for the team.</p>
                </div>
                <button className="ghost subtle" type="button" onClick={() => runFlowAction('groups')}>
                  Groups
                </button>
              </article>
              <article className="flow-guide-row">
                <div>
                  <p className="flow-node__step">Step 5</p>
                  <h3>Review quota queue</h3>
                  <p className="hint">Approve or reject pending requests in overview.</p>
                </div>
                <button
                  className="ghost subtle"
                  type="button"
                  onClick={() => runFlowAction('quota_review')}
                >
                  Quota queue
                </button>
              </article>
              <article className="flow-guide-row">
                <div>
                  <p className="flow-node__step">Step 6</p>
                  <h3>Audit usage and sessions</h3>
                  <p className="hint">Check trends and inspect transcripts when needed.</p>
                </div>
                <div className="flow-node__actions">
                  <button className="ghost subtle" type="button" onClick={() => runFlowAction('usage')}>
                    Usage
                  </button>
                  <button className="ghost subtle" type="button" onClick={() => runFlowAction('sessions')}>
                    Sessions
                  </button>
                </div>
              </article>
            </div>
            <div className="actions modal-actions">
              <button
                className="ghost subtle"
                type="button"
                onClick={() => runFlowAction('api_health')}
              >
                Open API health
              </button>
              <button className="primary" type="button" onClick={() => runFlowAction('settings')}>
                Go to settings
              </button>
            </div>
          </div>
        </div>
      )}
      {isCreateUserModalOpen && createUserDraft && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Create user"
          onClick={closeCreateUserModal}
        >
          <div className="modal-card modal-card--wide" onClick={(event) => event.stopPropagation()}>
            <div className="panel-header">
              <div>
                <h2>Create user</h2>
                <p className="hint">Add a new user account and policy profile.</p>
              </div>
              <button className="ghost subtle" type="button" onClick={closeCreateUserModal}>
                Close
              </button>
            </div>
            <div className="policy modal-body">
              <div className="control-grid">
                <label className="field">
                  <span>Email</span>
                  <input
                    value={createUserDraft.email}
                    onChange={(e) =>
                      setCreateUserDraft({ ...createUserDraft, email: e.target.value })
                    }
                    placeholder="user@company.com"
                  />
                </label>
                <label className="field">
                  <span>Password</span>
                  <input
                    type="password"
                    value={createUserPassword}
                    onChange={(e) => setCreateUserPassword(e.target.value)}
                    placeholder="Set initial password"
                  />
                  {createUserPassword && createUserPassword.length < 8 && (
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
                    value={createUserDraft.role}
                    onChange={(e) =>
                      setCreateUserDraft({
                        ...createUserDraft,
                        role: e.target.value as 'admin' | 'user',
                      })
                    }
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
                <label className="field">
                  <span>Group</span>
                  <select
                    value={createUserDraft.groupId ?? ''}
                    onChange={(e) =>
                      setCreateUserDraft({
                        ...createUserDraft,
                        groupId: e.target.value || null,
                      })
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
                checked={createUserDraft.selfManaged}
                onChange={(value) =>
                  setCreateUserDraft({ ...createUserDraft, selfManaged: value })
                }
              />
              {!createUserDraft.selfManaged && (
                <>
                  <ProviderEditor
                    provider={createUserDraft.provider}
                    onChange={(provider) =>
                      setCreateUserDraft({ ...createUserDraft, provider })
                    }
                  />
                  <PolicyEditor
                    controls={createUserDraft.controls}
                    onChange={(controls) =>
                      setCreateUserDraft({ ...createUserDraft, controls })
                    }
                  />
                </>
              )}
              <Toggle
                label="Active"
                description="Disable to block policy fetch and login."
                checked={createUserDraft.active}
                onChange={(value) =>
                  setCreateUserDraft({ ...createUserDraft, active: value })
                }
              />
            </div>
            <div className="actions modal-actions">
              <button className="ghost subtle" type="button" onClick={closeCreateUserModal}>
                Cancel
              </button>
              <button
                className="primary"
                type="button"
                onClick={handleCreateUser}
                disabled={!createUserPassword || createUserPassword.length < 8}
              >
                Create user
              </button>
            </div>
          </div>
        </div>
      )}
      {isEditUserModalOpen && userDraft && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Edit user"
          onClick={closeEditUserModal}
        >
          <div className="modal-card modal-card--wide" onClick={(event) => event.stopPropagation()}>
            <div className="panel-header">
              <div>
                <h2>Edit user</h2>
                <p className="hint">Update credentials, provider, and policy settings.</p>
              </div>
              <button className="ghost subtle" type="button" onClick={closeEditUserModal}>
                Close
              </button>
            </div>
            <div className="policy modal-body">
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
                    value={editUserPassword}
                    onChange={(e) => setEditUserPassword(e.target.value)}
                    placeholder="Leave blank to keep current"
                  />
                  {editUserPassword && editUserPassword.length < 8 && (
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
            </div>
            <div className="actions modal-actions">
              <button className="ghost danger" type="button" onClick={handleDeleteUser}>
                Remove user
              </button>
              <button className="ghost subtle" type="button" onClick={closeEditUserModal}>
                Cancel
              </button>
              <button className="primary" type="button" onClick={handleSaveUser}>
                Save user
              </button>
            </div>
          </div>
        </div>
      )}
      {isCreateGroupModalOpen && createGroupDraft && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Create group"
          onClick={closeCreateGroupModal}
        >
          <div className="modal-card modal-card--wide" onClick={(event) => event.stopPropagation()}>
            <div className="panel-header">
              <div>
                <h2>Create group</h2>
                <p className="hint">Add a new group with provider defaults and policy settings.</p>
              </div>
              <button className="ghost subtle" type="button" onClick={closeCreateGroupModal}>
                Close
              </button>
            </div>
            <div className="policy modal-body">
              <div className="control-grid">
                <label className="field">
                  <span>Name</span>
                  <input
                    value={createGroupDraft.name}
                    onChange={(event) =>
                      setCreateGroupDraft({ ...createGroupDraft, name: event.target.value })
                    }
                    placeholder="Engineering"
                  />
                </label>
                <label className="field">
                  <span>Default model</span>
                  <input
                    value={createGroupDraft.provider.model ?? ''}
                    onChange={(event) =>
                      setCreateGroupDraft({
                        ...createGroupDraft,
                        provider: { ...createGroupDraft.provider, model: event.target.value },
                      })
                    }
                    placeholder="gpt-5"
                  />
                </label>
              </div>
              <PolicyEditor
                controls={createGroupDraft.controls}
                onChange={(controls) => setCreateGroupDraft({ ...createGroupDraft, controls })}
              />
              <ProviderEditor
                provider={createGroupDraft.provider}
                onChange={(provider) => setCreateGroupDraft({ ...createGroupDraft, provider })}
              />
              <div className="control-grid">
                <label className="field">
                  <span>Monthly quota</span>
                  <input
                    type="number"
                    value={createGroupDraft.quotaMonthly ?? ''}
                    onChange={(event) =>
                      setCreateGroupDraft({
                        ...createGroupDraft,
                        quotaMonthly: event.target.value ? Number(event.target.value) : null,
                      })
                    }
                  />
                </label>
                <label className="field">
                  <span>Daily quota</span>
                  <input
                    type="number"
                    value={createGroupDraft.quotaDaily ?? ''}
                    onChange={(event) =>
                      setCreateGroupDraft({
                        ...createGroupDraft,
                        quotaDaily: event.target.value ? Number(event.target.value) : null,
                      })
                    }
                  />
                </label>
              </div>
            </div>
            <div className="actions modal-actions">
              <button className="ghost subtle" type="button" onClick={closeCreateGroupModal}>
                Cancel
              </button>
              <button
                className="primary"
                type="button"
                onClick={handleCreateGroupFromModal}
                disabled={!createGroupDraft.name.trim()}
              >
                Create group
              </button>
            </div>
          </div>
        </div>
      )}
      {isEditGroupModalOpen && groupDraft && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Edit group"
          onClick={closeEditGroupModal}
        >
          <div className="modal-card modal-card--wide" onClick={(event) => event.stopPropagation()}>
            <div className="panel-header">
              <div>
                <h2>Edit group</h2>
                <p className="hint">Update group provider defaults, policy, and quotas.</p>
              </div>
              <button className="ghost subtle" type="button" onClick={closeEditGroupModal}>
                Close
              </button>
            </div>
            <div className="policy modal-body">
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
                    onChange={(event) =>
                      setGroupDraft({
                        ...groupDraft,
                        quotaMonthly: event.target.value ? Number(event.target.value) : null,
                      })
                    }
                  />
                </label>
                <label className="field">
                  <span>Daily quota</span>
                  <input
                    type="number"
                    value={groupDraft.quotaDaily ?? ''}
                    onChange={(event) =>
                      setGroupDraft({
                        ...groupDraft,
                        quotaDaily: event.target.value ? Number(event.target.value) : null,
                      })
                    }
                  />
                </label>
              </div>
            </div>
            <div className="actions modal-actions">
              <button className="ghost danger" type="button" onClick={handleDeleteGroup}>
                Delete group
              </button>
              <button className="ghost subtle" type="button" onClick={closeEditGroupModal}>
                Cancel
              </button>
              <button className="primary" type="button" onClick={handleSaveGroup}>
                Save group
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
