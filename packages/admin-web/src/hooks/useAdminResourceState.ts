import { useCallback, useEffect, useState } from 'react';
import { fetchGroups, fetchQuotaRequests, fetchSessions, fetchUsers } from '../api/client';
import type {
  GroupRecord,
  QuotaRequestRecord,
  SessionRecord,
  UserRecord,
} from '../types';

export function useAdminResourceState(token: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<GroupRecord[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [quotaRequests, setQuotaRequests] = useState<QuotaRequestRecord[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);

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
    if (!token) {
      setGroups([]);
      setUsers([]);
      setQuotaRequests([]);
      setSessions([]);
      setError(null);
      return;
    }
    void refreshAll();
  }, [token, refreshAll]);

  return {
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
  };
}
