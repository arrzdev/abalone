import { act } from "react"
import { createRoot } from "react-dom/client"

//`renderHook` mounts once. a hook driven by props needs to be rendered again
//with new ones, which is what this adds: same probe, plus `rerender`.

export type RenderedHookWithProps<Value, Props> = {
  /** The hook's return value from the latest render. */
  readonly current: Value
  /** Renders again with new props, inside `act`. */
  rerender: (props: Props) => void
  unmount: () => void
}

function Probe({ run }: { run: () => void }) {
  run()
  return null
}

/** Mounts `hook(props)` and hands back a live view plus a way to change props. */
export function renderHookWithProps<Value, Props>(
  hook: (props: Props) => Value,
  initialProps: Props,
): RenderedHookWithProps<Value, Props> {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

  const root = createRoot(document.createElement("div"))
  const latest: { value: Value | undefined } = { value: undefined }

  function draw(props: Props) {
    root.render(
      <Probe
        run={() => {
          latest.value = hook(props)
        }}
      />,
    )
  }

  act(() => draw(initialProps))

  return {
    get current() {
      return latest.value as Value
    },
    rerender: (props) => act(() => draw(props)),
    unmount: () => act(() => root.unmount()),
  }
}
