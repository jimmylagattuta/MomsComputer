// app/src/api/http.ts

// 🔧 LOCAL DEV TOGGLE
// Flip to true when your phone should hit your computer on the same Wi-Fi.
const USE_LOCAL_API = false; // ⬅️ set to false to use EXPO_PUBLIC_API_BASE_URL

// Your computer's LAN IP + backend port
const LOCAL_API_BASE_URL = "http://192.168.12.141:3000";

// Centralized resolver
export const API_BASE =
  USE_LOCAL_API
    ? LOCAL_API_BASE_URL
    : (process.env.EXPO_PUBLIC_API_BASE_URL as string);

// 🚨 Safety: never allow a production build to point at a LAN IP
if (__DEV__ === false && USE_LOCAL_API) {
  throw new Error("USE_LOCAL_API is enabled in a non-dev build");
}

console.log("API BASE (http.ts)", API_BASE);

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
