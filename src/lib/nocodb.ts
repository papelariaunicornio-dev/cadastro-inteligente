/**
 * NocoDB REST API client for server-side use.
 * All credentials read from env vars — never hardcoded.
 */

interface NocoDBListResponse<T> {
  list: T[];
  pageInfo: {
    totalRows: number;
    page: number;
    pageSize: number;
    isFirstPage: boolean;
    isLastPage: boolean;
  };
}

interface QueryParams {
  where?: string;
  sort?: string;
  limit?: number;
  offset?: number;
  fields?: string;
}

function getConfig() {
  const apiUrl = process.env.NOCODB_API_URL;
  const token = process.env.NOCODB_API_TOKEN;
  const baseId = process.env.NOCODB_BASE_ID;

  if (!apiUrl || !token || !baseId) {
    throw new Error('NocoDB env vars not configured (NOCODB_API_URL, NOCODB_API_TOKEN, NOCODB_BASE_ID)');
  }

  return { apiUrl, token, baseId };
}

function buildUrl(tableId: string, rowId?: number | string): string {
  const { apiUrl, baseId } = getConfig();
  const base = `${apiUrl}/api/v2/public/shared-view/${tableId}`;
  // Use the v2 data API
  const url = `${apiUrl}/api/v2/meta/bases/${baseId}/tables/${tableId}`;
  // Actually use the correct NocoDB v1 data endpoint
  const dataUrl = `${apiUrl}/api/v1/db/data/noco/${baseId}/${tableId}`;
  if (rowId) {
    return `${dataUrl}/${rowId}`;
  }
  return dataUrl;
}

async function request<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const { token } = getConfig();

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'xc-token': token,
      ...options.headers,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `NocoDB API error ${response.status}: ${errorText}`
    );
  }

  return response.json() as Promise<T>;
}

// ==========================================
// CRUD Operations
// ==========================================

export async function list<T>(
  tableId: string,
  params?: QueryParams
): Promise<{ list: T[]; totalRows: number }> {
  const url = new URL(buildUrl(tableId));

  if (params?.where) url.searchParams.set('where', params.where);
  if (params?.sort) url.searchParams.set('sort', params.sort);
  if (params?.limit) url.searchParams.set('limit', String(params.limit));
  if (params?.offset) url.searchParams.set('offset', String(params.offset));
  if (params?.fields) url.searchParams.set('fields', params.fields);

  const data = await request<NocoDBListResponse<T>>(url.toString());
  return { list: data.list, totalRows: data.pageInfo.totalRows };
}

export async function get<T>(
  tableId: string,
  rowId: number | string
): Promise<T> {
  return request<T>(buildUrl(tableId, rowId));
}

export async function create<T>(
  tableId: string,
  data: Partial<T>
): Promise<T> {
  return request<T>(buildUrl(tableId), {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function bulkCreate<T>(
  tableId: string,
  rows: Partial<T>[]
): Promise<T[]> {
  const url = `${buildUrl(tableId)}/bulk`;
  return request<T[]>(url, {
    method: 'POST',
    body: JSON.stringify(rows),
  });
}

export async function update<T>(
  tableId: string,
  rowId: number | string,
  data: Partial<T>
): Promise<T> {
  return request<T>(buildUrl(tableId, rowId), {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function bulkUpdate<T>(
  tableId: string,
  rows: (Partial<T> & { Id: number })[]
): Promise<T[]> {
  const url = `${buildUrl(tableId)}/bulk`;
  return request<T[]>(url, {
    method: 'PATCH',
    body: JSON.stringify(rows),
  });
}

export async function remove(
  tableId: string,
  rowId: number | string
): Promise<void> {
  await request<unknown>(buildUrl(tableId, rowId), {
    method: 'DELETE',
  });
}
