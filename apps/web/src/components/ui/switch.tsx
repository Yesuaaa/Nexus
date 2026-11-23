import type { ComponentProps } from "react"

export function Switch(
  props: Omit<ComponentProps<"input">, "type" | "role" | "className">,
) {
  return (
    <span className="relative mt-1 inline-flex shrink-0">
      <input
        {...props}
        type="checkbox"
        role="switch"
        className="peer absolute inset-0 z-10 m-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
      <span
        aria-hidden="true"
        className="inline-flex h-6 w-10 items-center rounded-full bg-[#cbd5e3] p-1 transition-colors peer-checked:bg-[#203f8c] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#294a9b] peer-disabled:opacity-60 peer-checked:[&>span]:translate-x-4"
      >
        <span className="size-4 rounded-full bg-white transition-transform motion-reduce:transition-none" />
      </span>
    </span>
  )
}
