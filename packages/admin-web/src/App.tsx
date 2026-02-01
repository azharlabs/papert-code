import React, { useEffect, useMemo, useState } from 'react';
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
  const [newGroupName, setNewGroupName] = useState('');

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) || null,
    [groups, selectedGroupId],
  );
  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) || null,
    [users, selectedUserId],
  );

  const refreshAll = async () => {
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
  };

  useEffect(() => {
    if (token) {
      refreshAll();
    }
  }, [token]);

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
  }, [selectedUserId, token]);

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
  };

  const handleCreateGroup = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const group = await createGroup(token, {
        name: newGroupName,
        controls: emptyControls(),
        provider: {},
        quotaMonthly: null,
        quotaDaily: null,
      });
      setGroups((prev) => [...prev, group]);
      setNewGroupName('');
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

  if (!token) {
    return (
      <div className="app">
        <header className="hero">
          <div>
            <p className="eyebrow">Papert Admin Control Plane</p>
            <h1>Sign in to manage users, quotas, and sessions.</h1>
            <p className="subtitle">
              Admin login required. Use the credentials created by your platform team.
            </p>
          </div>
          <div className="panel accent">
            <h2>Admin login</h2>
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
        </header>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">Papert Admin Control Plane</p>
          <h1>Manage permissions, quotas, and sessions.</h1>
          <p className="subtitle">
            Configure group policy, assign users, and monitor token usage in one place.
          </p>
        </div>
        <div className="panel accent">
          <h2>Session</h2>
          <p className="hint">Token stored locally for this browser.</p>
          <div className="split">
            <button className="ghost" onClick={refreshAll}>
              Refresh
            </button>
            <button className="ghost danger" onClick={handleLogout}>
              Sign out
            </button>
          </div>
          {loading && <span className="badge">Syncing…</span>}
          {error && <span className="badge error">{error}</span>}
          {info && <span className="badge info">{info}</span>}
        </div>
      </header>

      <main className="grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Groups</h2>
              <p className="hint">Group policies define permissions and quotas.</p>
            </div>
          </div>
          <div className="list-grid">
            {groups.map((group) => (
              <button
                key={group.id}
                className={group.id === selectedGroupId ? 'list-item active' : 'list-item'}
                onClick={() => setSelectedGroupId(group.id)}
              >
                <span>{group.name}</span>
                <small>{group.id}</small>
              </button>
            ))}
          </div>
          <label className="field">
            <span>New group name</span>
            <input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} />
          </label>
          <button className="primary" onClick={handleCreateGroup} disabled={!newGroupName}>
            Create group
          </button>
          {groupDraft && (
            <>
              <PolicyEditor controls={groupDraft.controls} onChange={(controls) => setGroupDraft({ ...groupDraft, controls })} />
              <ProviderEditor provider={groupDraft.provider} onChange={(provider) => setGroupDraft({ ...groupDraft, provider })} />
              <div className="split">
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
                <button className="ghost danger" onClick={handleDeleteGroup}>
                  Delete group
                </button>
                <button className="primary" onClick={handleSaveGroup}>
                  Save group
                </button>
              </div>
            </>
          )}
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Users</h2>
              <p className="hint">Create users and assign groups or overrides.</p>
            </div>
          </div>
          <div className="list-grid">
            {users.map((user) => (
              <button
                key={user.id}
                className={user.id === selectedUserId ? 'list-item active' : 'list-item'}
                onClick={() => setSelectedUserId(user.id)}
              >
                <span>{user.email}</span>
                <small>{user.role} • {user.groupId || 'no group'}</small>
              </button>
            ))}
          </div>
          <label className="field">
            <span>Email</span>
            <input
              value={userDraft?.email ?? ''}
              onChange={(e) =>
                setUserDraft((draft) =>
                  draft
                    ? { ...draft, email: e.target.value }
                    : {
                        id: '',
                        email: e.target.value,
                        role: 'user',
                        groupId: null,
                        selfManaged: false,
                        provider: {},
                        controls: emptyControls(),
                        active: true,
                        createdAt: '',
                        updatedAt: '',
                      },
                )
              }
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={newUserPassword}
              onChange={(e) => setNewUserPassword(e.target.value)}
              placeholder={userDraft?.id ? 'Leave blank to keep current' : 'Set initial password'}
            />
          </label>
          {userDraft && (
            <>
              <label className="field">
                <span>Role</span>
                <select
                  value={userDraft.role}
                  onChange={(e) => setUserDraft({ ...userDraft, role: e.target.value as 'admin' | 'user' })}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              <label className="field">
                <span>Group</span>
                <select
                  value={userDraft.groupId ?? ''}
                  onChange={(e) => setUserDraft({ ...userDraft, groupId: e.target.value || null })}
                >
                  <option value="">No group</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </label>
              <Toggle
                label="Self-managed provider"
                description="User provides their own OpenAI-compatible API key. Full access."
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
                description="Disable to prevent login and policy fetch."
                checked={userDraft.active}
                onChange={(value) => setUserDraft({ ...userDraft, active: value })}
              />
            </>
          )}
          <div className="actions">
            {userDraft?.id ? (
              <>
                <button className="ghost danger" onClick={handleDeleteUser}>
                  Remove user
                </button>
                <button className="primary" onClick={handleSaveUser}>
                  Save user
                </button>
              </>
            ) : (
              <button className="primary" onClick={handleCreateUser}>
                Create user
              </button>
            )}
          </div>
        </section>
      </main>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Token usage</h2>
            <p className="hint">Monitor monthly and daily usage for the selected user.</p>
          </div>
        </div>
        {usage.length === 0 ? (
          <p className="hint">Select a user to view usage.</p>
        ) : (
          <div className="list-grid">
            {usage.map((record) => (
              <div key={record.id} className="list-item">
                <strong>{record.period}</strong>
                <small>{record.periodStart}</small>
                <span>{record.tokensUsed.toLocaleString()} tokens</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel list">
        <div className="panel-header">
          <div>
            <h2>Quota requests</h2>
            <p className="hint">Approve or reject token quota increase requests.</p>
          </div>
        </div>
        {quotaRequests.length === 0 && <p className="hint">No requests.</p>}
        {quotaRequests.map((req) => (
          <div key={req.id} className="list-item">
            <span>{req.userId}</span>
            <small>{req.status} • {req.requestedMonthly ?? 'n/a'} tokens</small>
            <div className="split">
              <button className="ghost" onClick={() => handleApproveRequest(req.id)}>
                Approve
              </button>
              <button className="ghost danger" onClick={() => handleRejectRequest(req.id)}>
                Reject
              </button>
            </div>
          </div>
        ))}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Sessions</h2>
            <p className="hint">All user sessions uploaded by the CLI.</p>
          </div>
        </div>
        <div className="list-grid">
          {sessions.map((session) => (
            <button
              key={session.id}
              className={session.id === selectedSession?.id ? 'list-item active' : 'list-item'}
              onClick={() => handleLoadSession(session.id)}
            >
              <span>{session.sessionId}</span>
              <small>{session.userId} • {session.model ?? 'unknown model'}</small>
            </button>
          ))}
        </div>
        {selectedSession && (
          <div>
            <h3>Transcript</h3>
            <pre>{sessionTranscript || 'No transcript uploaded.'}</pre>
          </div>
        )}
      </section>
    </div>
  );
}

interface PolicyEditorProps {
  controls: AdminControls;
  onChange: (next: AdminControls) => void;
}

function PolicyEditor({ controls, onChange }: PolicyEditorProps) {
  const update = (patch: Partial<AdminControls>) =>
    onChange({ ...controls, ...patch });

  const updateMcp = (patch: NonNullable<AdminControls['mcpSetting']>) =>
    update({ mcpSetting: { ...controls.mcpSetting, ...patch } });

  const updateCli = (patch: NonNullable<AdminControls['cliFeatureSetting']>) =>
    update({ cliFeatureSetting: { ...controls.cliFeatureSetting, ...patch } });

  const updateExtensions = (enabled: boolean) =>
    updateCli({
      extensionsSetting: {
        ...controls.cliFeatureSetting?.extensionsSetting,
        extensionsEnabled: enabled,
      },
    });

  return (
    <div className="policy">
      <Toggle
        label="Secure mode"
        description="Enforce secure mode behaviors for CLI sessions."
        checked={controls.secureModeEnabled ?? false}
        onChange={(value) => update({ secureModeEnabled: value })}
      />
      <Toggle
        label="Strict mode disabled"
        description="Relax strict-mode safety validations."
        checked={controls.strictModeDisabled ?? false}
        onChange={(value) => update({ strictModeDisabled: value })}
      />
      <Toggle
        label="MCP enabled"
        description="Allow MCP servers and related commands."
        checked={controls.mcpSetting?.mcpEnabled ?? false}
        onChange={(value) => updateMcp({ mcpEnabled: value })}
      />
      <label className="field">
        <span>Override MCP config JSON</span>
        <textarea
          rows={4}
          value={controls.mcpSetting?.overrideMcpConfigJson ?? ''}
          placeholder={`{\n  "mcpServers": {\n    "server": { ... }\n  }\n}`}
          onChange={(event) =>
            updateMcp({ overrideMcpConfigJson: event.target.value })
          }
        />
      </label>
      <Toggle
        label="Extensions enabled"
        description="Control extensions and plugins availability."
        checked={
          controls.cliFeatureSetting?.extensionsSetting?.extensionsEnabled ?? false
        }
        onChange={updateExtensions}
      />
      <Toggle
        label="Skills enabled"
        description="Allow unmanaged skills to load in the CLI."
        checked={
          controls.cliFeatureSetting?.unmanagedCapabilitiesEnabled ?? false
        }
        onChange={(value) =>
          updateCli({ unmanagedCapabilitiesEnabled: value })
        }
      />
    </div>
  );
}

interface ProviderEditorProps {
  provider: { apiKey?: string; baseUrl?: string; model?: string };
  onChange: (next: { apiKey?: string; baseUrl?: string; model?: string }) => void;
}

function ProviderEditor({ provider, onChange }: ProviderEditorProps) {
  return (
    <div className="policy">
      <label className="field">
        <span>API key</span>
        <input
          value={provider.apiKey ?? ''}
          onChange={(e) => onChange({ ...provider, apiKey: e.target.value })}
        />
      </label>
      <label className="field">
        <span>Base URL</span>
        <input
          value={provider.baseUrl ?? ''}
          onChange={(e) => onChange({ ...provider, baseUrl: e.target.value })}
        />
      </label>
      <label className="field">
        <span>Default model</span>
        <input
          value={provider.model ?? ''}
          onChange={(e) => onChange({ ...provider, model: e.target.value })}
        />
      </label>
    </div>
  );
}

interface ToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}

function Toggle({ label, description, checked, onChange }: ToggleProps) {
  return (
    <div className="toggle">
      <div>
        <strong>{label}</strong>
        <p>{description}</p>
      </div>
      <button
        className={checked ? 'pill active' : 'pill'}
        onClick={() => onChange(!checked)}
        type="button"
      >
        {checked ? 'Enabled' : 'Disabled'}
      </button>
    </div>
  );
}
