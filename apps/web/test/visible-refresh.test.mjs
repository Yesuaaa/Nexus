import assert from "node:assert/strict"
import test from "node:test"
import { watchVisibleRefresh } from "../src/lib/visible-refresh.ts"

test("a restored visible page revalidates and cleanup removes lifecycle listeners", () => {
  const previousWindow = globalThis.window
  const previousDocument = globalThis.document
  const window = new EventTarget()
  const document = Object.assign(new EventTarget(), {
    visibilityState: "visible",
  })
  globalThis.window = window
  globalThis.document = document
  try {
    let refreshes = 0
    const stop = watchVisibleRefresh(
      () => {
        refreshes += 1
      },
      { poll: false },
    )
    const show = (persisted) => {
      const event = new Event("pageshow")
      Object.defineProperty(event, "persisted", { value: persisted })
      window.dispatchEvent(event)
    }
    show(false)
    assert.equal(refreshes, 0)
    show(true)
    assert.equal(refreshes, 1)
    document.visibilityState = "hidden"
    show(true)
    assert.equal(refreshes, 1)
    document.visibilityState = "visible"
    window.dispatchEvent(new Event("focus"))
    assert.equal(refreshes, 2)
    stop()
    show(true)
    window.dispatchEvent(new Event("focus"))
    assert.equal(refreshes, 2)
  } finally {
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
    if (previousDocument === undefined) delete globalThis.document
    else globalThis.document = previousDocument
  }
})
