/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

export type ShareServiceConfig = {
  baseUrl: string;
  token?: string;
};

export type ShareCreateRequest = {
  sessionId: string;
  payload: Record<string, unknown>;
};

export type ShareCreateResponse = {
  id: string;
  url: string;
  secret: string;
};

function getHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (token) {
    headers['authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function createShareLink(
  config: ShareServiceConfig,
  request: ShareCreateRequest,
): Promise<ShareCreateResponse> {
  const response = await fetch(new URL('/api/v1/share', config.baseUrl), {
    method: 'POST',
    headers: getHeaders(config.token),
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Failed to share session: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as Partial<ShareCreateResponse>;
  if (!data.id || !data.url || !data.secret) {
    throw new Error('Invalid share response from server.');
  }

  return { id: data.id, url: data.url, secret: data.secret };
}

export async function deleteShareLink(
  config: ShareServiceConfig,
  shareId: string,
  secret: string,
): Promise<void> {
  const response = await fetch(
    new URL(`/api/v1/share/${shareId}`, config.baseUrl),
    {
      method: 'DELETE',
      headers: getHeaders(config.token),
      body: JSON.stringify({ secret }),
    },
  );

  if (!response.ok && response.status !== 204) {
    throw new Error(`Failed to unshare session: ${response.status} ${response.statusText}`);
  }
}
