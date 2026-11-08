import assert from "node:assert/strict"
import test from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { getToastSnapshot, sileo, subscribeToasts } from "../src/lib/toast.ts"

test("the first lazy notification survives until the viewport mounts", async () => {
  assert.equal(getToastSnapshot(), false)
  let activations = 0
  const unsubscribe = subscribeToasts(() => {
    activations += 1
  })
  const errorId = await sileo.error({
    title: "First request failed",
    description: "Please try again.",
  })
  assert.equal(typeof errorId, "string")
  assert.equal(getToastSnapshot(), true)
  const { Toaster, sileo: runtime } = await import("sileo")
  const markup = renderToStaticMarkup(
    createElement(Toaster, { position: "top-center" }),
  )
  assert.match(markup, /First request failed/)
  assert.match(markup, /Please try again\./)
  assert.match(markup, /exp-toast-title/)
  assert.match(markup, /data-position="top-center"/)
  await sileo.success({ title: "Recovered" })
  assert.equal(activations, 1)
  await sileo.dismiss(errorId)
  runtime.clear()
  unsubscribe()
})
