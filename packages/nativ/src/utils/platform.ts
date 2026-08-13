/** Whether the current device is iOS/iPadOS (including iPadOS reporting as MacIntel). */
export function isIOS() {
  if (typeof navigator === "undefined") return false
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  )
}
