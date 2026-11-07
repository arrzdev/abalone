import type { ReactNode } from "react"
import { act } from "react"
import { createRoot } from "react-dom/client"

//the one thing a hook test needs from Testing Library, without the dependency:
//mount a component that calls the hook, and hand back its latest return value.

export type RenderedHook<Value> = {
  /** The hook's return value from the latest render. */
  readonly current: Value
  unmount: () => void
}

/** Calls the hook on every render and reports what it returned. */
function Probe({ run }: { run: () => void }) {
  run()
  return null
}

/**
 * Mounts `hook` inside `wrapper` and returns a live view of what it returns.
 * Wrap anything that changes state in `act`, the way React expects.
 */
export function renderHook<Value>(
  hook: () => Value,
  wrapper?: (props: { children: ReactNode }) => ReactNode,
): RenderedHook<Value> {
  //React only checks that `act` is being used when this says so
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

  const root = createRoot(document.createElement("div"))
  const latest: { value: Value | undefined } = { value: undefined }
  const probe = (
    <Probe
      run={() => {
        latest.value = hook()
      }}
    />
  )

  act(() => {
    root.render(wrapper ? wrapper({ children: probe }) : probe)
  })

  return {
    get current() {
      return latest.value as Value
    },
    unmount: () => act(() => root.unmount()),
  }
}
