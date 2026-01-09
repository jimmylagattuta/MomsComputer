const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  "http://192.168.12.141:3000";

async function parseJson(res: Response) {
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {}
  return json;
}

export async function postJson(path: string, body: any, token?: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const json = await parseJson(res);

  return {
    ok: res.ok,
    status: res.status,
    json,
  };
}

export async function getJson(path: string, token?: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const json = await parseJson(res);

  return {
    ok: res.ok,
    status: res.status,
    json,
  };
}
