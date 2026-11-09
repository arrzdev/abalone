import { createAuthClient } from "better-auth/client"
import { usernameClient } from "better-auth/client/plugins"
import { endSession } from "@/data/auth/session-end"
import {
  discardToken,
  getBearerToken,
  writeToken,
} from "@/data/auth/token"
import { backendBaseUrl } from "@/data/backend-client"

//---- Auth client --------------------------------------------------
//better-auth's SDK is the auth data layer: it drives sign-up, sign-in and
//sign-out against the mounted handler and exposes a reactive session. the token
//half is wired here once — read it on the way out, stash it on the way back,
//drop it when the server stops honouring it — so nothing downstream handles a
//header and nothing downstream decides what a session is.
//
//nothing imports this module directly: `loadAuthClient` in data/auth/client.ts
//imports it on first use, so the SDK is not part of what a page downloads before
//it hydrates. the first render reads only the stored token.

function isSessionRead(url: URL | string): boolean {
  return String(url).includes("/get-session")
}

function sentBearerToken(headers: Headers): string {
  const header = headers.get("authorization") ?? ""
  if (!header.startsWith("Bearer ")) return ""
  return header.slice("Bearer ".length)
}

export const authClient = createAuthClient({
  //full path: the handler is mounted at the api's /api/v1/auth basePath
  baseURL: `${backendBaseUrl}/api/v1/auth`,
  //the server's `username()` plugin has a client half, and without it
  //`signIn.username` does not exist
  plugins: [usernameClient()],
  fetchOptions: {
    auth: { type: "Bearer", token: getBearerToken },
    onSuccess: (context) => {
      const token = context.response.headers.get("set-auth-token")
      if (token) return writeToken(token)

      //better-auth answers a dead token with an empty session rather than a 401,
      //so a session read that comes back with nothing is the only notice this
      //device gets that its token has expired or been revoked
      if (!isSessionRead(context.request.url) || context.data) return
      discardToken(sentBearerToken(context.request.headers))
    },
    //a session read refused outright is the same notice, louder: the whole
    //session goes, cached summary included. a 503 or a dropped connection says
    //nothing about the token and changes nothing here
    onError: (context) => {
      if (!isSessionRead(context.request.url)) return
      if (context.response.status !== 401) return
      const sent = sentBearerToken(context.request.headers)
      if (sent && sent === getBearerToken()) endSession()
    },
  },
})

export type AuthClient = typeof authClient
