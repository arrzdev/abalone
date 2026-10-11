/**
 * Bytes as base64url, without padding.
 *
 * base64url rather than base64 because every caller puts the result in a url,
 * and `+` and `/` would need escaping on every hop that touches it.
 */
export function toBase64Url(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}
