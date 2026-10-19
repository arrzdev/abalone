import tryCatch from "@repo/shared/try-catch"

//true for localhost / LAN origins, so dev on a phone over the local network
//(http://192.168.x.x:7171) is trusted by CORS without hardcoding it. read by
//the network policy (and by an auth instance's trusted origins once a project
//adds one), so it lives here rather than inside either consumer.
export function isPrivateOrigin(origin: string): boolean {
  const [url, parseError] = tryCatch(() => new URL(origin))
  if (parseError || !url) return false
  const { hostname } = url
  return (
    hostname === "localhost" ||
    /^10\.\d+\.\d+\.\d+$/.test(hostname) ||
    /^192\.168\.\d+\.\d+$/.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(hostname)
  )
}
