//---- Bearer token store -------------------------------------------
//the session bearer token, kept in its own import-free module so the typed RPC
//client (data/backend-client.ts) can read it for auto auth-header injection
//without forming a cycle with the auth client (which depends on backend-client).
//
//sessions are BEARER tokens rather than cookies: the app and the api are
//different origins, and a cross-origin cookie is a fight with Safari the PWA
//would keep losing. the server returns the token in `set-auth-token` on every
//auth response, we stash it here, and send it back as `Authorization: Bearer …`.

const TOKEN_KEY = "abalone.bearer"

function readToken(): string {
  if (typeof localStorage === "undefined") return ""
  return localStorage.getItem(TOKEN_KEY) ?? ""
}

//the current session bearer token, or "" for a guest
export function getBearerToken(): string {
  return readToken()
}

export function writeToken(token: string | null): void {
  if (typeof localStorage === "undefined") return
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

//value-checked rather than cleared outright: a sign-in that lands while an older
//request is still in flight has already written a good token, and only the
//refused one should go
export function discardToken(refused: string): void {
  if (readToken() !== refused) return
  writeToken(null)
}
