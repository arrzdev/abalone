import { afterEach, describe, expect, it, vi } from "vitest"
import { nativPwaRegisterPlugin } from "#nativ/vite/virtuals"

type RegisterSW = (options: {
  immediate?: boolean
  onNeedRefresh?: () => void
}) => (reload?: boolean) => Promise<void>

//the client module is a source string the plugin serves; evaluate it here the
//way the browser would, against the stubbed navigator below
function loadRegisterSW(): RegisterSW {
  const plugin = nativPwaRegisterPlugin()
  const load = plugin.load as (id: string) => string
  const source = load("\0virtual:nativ/pwa-register").replace(
    "export function registerSW",
    "function registerSW",
  )
  return new Function(`${source}\nreturn registerSW`)() as RegisterSW
}

type FakeWorker = EventTarget & { state: string }

function createWorker(): FakeWorker {
  return Object.assign(new EventTarget(), { state: "installing" })
}

function setState(worker: FakeWorker, state: string) {
  worker.state = state
  worker.dispatchEvent(new Event("statechange"))
}

//a service worker container whose registration starts with `active` as given;
//`install()` runs one new worker through updatefound -> installed
function stubServiceWorker(active: FakeWorker | null) {
  const container = Object.assign(new EventTarget(), {
    controller: active as FakeWorker | null,
    register: vi.fn(),
  })
  const registration = Object.assign(new EventTarget(), {
    active,
    installing: null as FakeWorker | null,
    waiting: null as FakeWorker | null,
  })
  container.register.mockResolvedValue(registration)
  vi.stubGlobal("navigator", { serviceWorker: container })

  return {
    container,
    install({
      controllerBeforeInstalled,
    }: {
      controllerBeforeInstalled: boolean
    }) {
      const worker = createWorker()
      registration.installing = worker
      registration.dispatchEvent(new Event("updatefound"))
      //WebKit: another browsing context's worker can claim this page while ours installs
      if (controllerBeforeInstalled) container.controller = createWorker()
      setState(worker, "installed")
    },
  }
}

//register() awaits the registration before it listens for updatefound
function flushRegistration() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("registerSW", () => {
  it("does not ask for a refresh on the first install, even when the page is already controlled", async () => {
    const serviceWorker = stubServiceWorker(null)
    const onNeedRefresh = vi.fn()
    loadRegisterSW()({ immediate: true, onNeedRefresh })
    await flushRegistration()

    serviceWorker.install({ controllerBeforeInstalled: true })

    expect(onNeedRefresh).not.toHaveBeenCalled()
  })

  it("asks for a refresh when a new version installs over an active one", async () => {
    const serviceWorker = stubServiceWorker(createWorker())
    const onNeedRefresh = vi.fn()
    loadRegisterSW()({ immediate: true, onNeedRefresh })
    await flushRegistration()

    serviceWorker.install({ controllerBeforeInstalled: false })

    expect(onNeedRefresh).toHaveBeenCalledOnce()
  })
})
