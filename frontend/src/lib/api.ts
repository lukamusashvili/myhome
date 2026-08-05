export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

export function statementLookupUrl(id: string): string {
  return `${API_BASE_URL}/api/myhome/statements/${id}`;
}

export interface StatementResult {
  status: number;
  data: unknown;
}

export async function submitStatement(
  token: string,
  fields: Record<string, unknown>
): Promise<StatementResult> {
  const response = await fetch(`${API_BASE_URL}/api/statements`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(fields),
  });

  const data = await response.json();

  return { status: response.status, data };
}
