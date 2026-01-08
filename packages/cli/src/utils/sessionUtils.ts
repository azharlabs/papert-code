/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Config,
  ConversationRecord,
  ResumedSessionData,
  SessionListItem,
} from '@papert-code/papert-code-core';
import { SessionService } from '@papert-code/papert-code-core';
import type { Content, Part } from '@google/genai';

/**
 * Represents a text match found during search with surrounding context.
 */
export interface TextMatch {
  /** Text content before the match (with ellipsis if truncated) */
  before: string;
  /** The exact matched text */
  match: string;
  /** Text content after the match (with ellipsis if truncated) */
  after: string;
  /** Role of the message author where the match was found */
  role: 'user' | 'assistant';
}

/**
 * Session information for display and selection purposes.
 */
export interface SessionInfo {
  /** Unique session identifier (filename without extension) */
  id: string;
  /** Filename without extension */
  file: string;
  /** Full filename including .jsonl extension */
  fileName: string;
  /** ISO timestamp when session started */
  startTime: string;
  /** Total number of messages in the session */
  messageCount: number;
  /** ISO timestamp when session was last updated */
  lastUpdated: string;
  /** Display name for the session (typically first user message) */
  displayName: string;
  /** Cleaned first user message content */
  firstUserMessage: string;
  /** Whether this is the currently active session */
  isCurrentSession: boolean;
  /** Display index in the list */
  index: number;
  /** AI-generated summary of the session (if available) */
  summary?: string;
  /** Full concatenated content (only loaded when needed for search) */
  fullContent?: string;
  /** Processed messages with normalized roles (only loaded when needed) */
  messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** Search result snippets when filtering */
  matchSnippets?: TextMatch[];
  /** Total number of matches found in this session */
  matchCount?: number;
}

export interface GetSessionOptions {
  /** Whether to load full message content (needed for search) */
  includeFullContent?: boolean;
}

const MAX_SESSIONS_PER_PAGE = 100;

/**
 * Cleans and sanitizes message content for display by:
 * - Converting newlines to spaces
 * - Collapsing multiple whitespace to single spaces
 * - Removing non-printable characters (keeping only ASCII 32-126)
 * - Trimming leading/trailing whitespace
 * @param message - The raw message content to clean
 * @returns Sanitized message suitable for display
 */
export const cleanMessage = (message: string): string =>
  message
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[^\x20-\x7E]+/g, '')
    .trim();

/**
 * Formats a timestamp as relative time.
 * @param timestamp - The timestamp to format
 * @param style - 'long' (e.g. "2 hours ago") or 'short' (e.g. "2h")
 */
export const formatRelativeTime = (
  timestamp: string,
  style: 'long' | 'short' = 'long',
): string => {
  const now = new Date();
  const time = new Date(timestamp);
  const diffMs = now.getTime() - time.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (style === 'short') {
    if (diffSeconds < 1) return 'now';
    if (diffSeconds < 60) return `${diffSeconds}s`;
    if (diffMinutes < 60) return `${diffMinutes}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 30) return `${diffDays}d`;
    const diffMonths = Math.floor(diffDays / 30);
    return diffMonths < 12
      ? `${diffMonths}mo`
      : `${Math.floor(diffMonths / 12)}y`;
  }

  if (diffDays > 0) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  }
  if (diffHours > 0) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  }
  if (diffMinutes > 0) {
    return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  }
  return 'Just now';
};

const extractTextFromContent = (content?: Content): string => {
  if (!content?.parts) return '';
  const parts = content.parts as Part[];
  const textParts: string[] = [];
  for (const part of parts) {
    if ('text' in part && part.text) {
      if ('thought' in part && part.thought) {
        continue;
      }
      textParts.push(part.text);
    }
  }
  return textParts.join('\n');
};

const extractFirstUserMessage = (conversation: ConversationRecord): string => {
  const userRecords = conversation.messages.filter(
    (record) => record.type === 'user',
  );

  const nonSlash = userRecords.find((record) => {
    const content = extractTextFromContent(record.message as Content);
    const trimmed = content.trim();
    return !!trimmed && !trimmed.startsWith('/') && !trimmed.startsWith('?');
  });

  const candidate = nonSlash ?? userRecords[0];
  if (!candidate) return '';

  return cleanMessage(extractTextFromContent(candidate.message as Content));
};

const loadAllSessions = async (
  sessionService: SessionService,
): Promise<SessionListItem[]> => {
  const items: SessionListItem[] = [];
  let cursor: number | undefined;
  let hasMore = true;

  while (hasMore) {
    const page = await sessionService.listSessions({
      size: MAX_SESSIONS_PER_PAGE,
      cursor,
    });
    items.push(...page.items);
    cursor = page.nextCursor;
    hasMore = page.hasMore && cursor !== undefined;
  }

  return items;
};

const buildSearchData = (
  conversation: ConversationRecord,
): {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  fullContent: string;
  firstUserMessage: string;
} => {
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  for (const record of conversation.messages) {
    if (record.type !== 'user' && record.type !== 'assistant') {
      continue;
    }
    const text = extractTextFromContent(record.message as Content);
    if (!text) continue;
    messages.push({
      role: record.type === 'user' ? 'user' : 'assistant',
      content: text,
    });
  }

  const fullContent = messages.map((m) => m.content).join('\n');
  const firstUserMessage = extractFirstUserMessage(conversation);

  return { messages, fullContent, firstUserMessage };
};

const toSessionInfo = (
  item: SessionListItem,
  index: number,
  currentSessionId?: string,
): SessionInfo => {
  const displayName = cleanMessage(item.prompt || '');
  const lastUpdated = new Date(item.mtime).toISOString();
  const sessionId = item.sessionId;
  const isCurrentSession = sessionId === currentSessionId;

  return {
    id: sessionId,
    file: sessionId,
    fileName: `${sessionId}.jsonl`,
    startTime: item.startTime,
    messageCount: item.messageCount,
    lastUpdated,
    displayName,
    firstUserMessage: displayName,
    isCurrentSession,
    index,
  };
};

const enrichWithFullContent = (
  sessionInfo: SessionInfo,
  sessionData: ResumedSessionData | undefined,
): SessionInfo => {
  if (!sessionData) {
    return sessionInfo;
  }

  const { messages, fullContent, firstUserMessage } = buildSearchData(
    sessionData.conversation,
  );

  return {
    ...sessionInfo,
    displayName: sessionInfo.displayName || firstUserMessage || 'Empty chat',
    firstUserMessage: firstUserMessage || sessionInfo.firstUserMessage,
    messages,
    fullContent,
  };
};

export const getSessionFiles = async (
  config: Config,
  currentSessionId?: string,
  options: GetSessionOptions = {},
): Promise<SessionInfo[]> => {
  const sessionService = new SessionService(config.getProjectRoot());
  const sessionItems = await loadAllSessions(sessionService);

  const baseSessions = sessionItems.map((item, index) =>
    toSessionInfo(item, index, currentSessionId),
  );

  if (!options.includeFullContent) {
    return baseSessions;
  }

  const enriched = await Promise.all(
    baseSessions.map(async (sessionInfo) => {
      const sessionData = await sessionService.loadSession(sessionInfo.id);
      return enrichWithFullContent(sessionInfo, sessionData);
    }),
  );

  return enriched;
};
