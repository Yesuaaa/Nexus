"use client"

import {
  forwardRef,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
} from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"

type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement

function isControl(element: EventTarget | null): element is Control {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  )
}

/** Check native and custom constraints without opening a browser tooltip. */
export function validateFields(fields: Iterable<Control>) {
  let firstInvalid: Control | undefined
  for (const control of fields) {
    if (!control.checkValidity()) firstInvalid ??= control
  }
  if (firstInvalid) {
    const control = firstInvalid
    control.focus()
    // Wait for inline feedback to mount before scrolling nested panels.
    requestAnimationFrame(() => {
      if (!control.isConnected || document.activeElement !== control) return
      control.scrollIntoView({ block: "center", inline: "nearest" })
      for (const id of (control.getAttribute("aria-describedby") || "").split(
        " ",
      )) {
        const message = document.getElementById(id)
        if (message?.hasAttribute("data-field-error"))
          message.scrollIntoView({ block: "center", inline: "nearest" })
      }
    })
  }
  return !firstInvalid
}

function validationMessage(control: Control) {
  const { validity } = control
  if (validity.customError) return control.validationMessage
  if (validity.valueMissing) {
    if (control instanceof HTMLSelectElement) return "Choose an option."
    if (control instanceof HTMLInputElement) {
      if (control.type === "checkbox") return "Select this option to continue."
      if (control.type === "radio") return "Choose an option."
      if (control.type === "file") return "Choose a file."
    }
    return "Complete this field."
  }
  if (validity.typeMismatch)
    return control instanceof HTMLInputElement && control.type === "email"
      ? "Enter a valid email address."
      : "Enter a valid URL."
  if (validity.badInput) return "Enter a valid number."
  if (control instanceof HTMLInputElement) {
    if (validity.rangeUnderflow)
      return `Enter a value of ${control.min} or more.`
    if (validity.rangeOverflow)
      return `Enter a value of ${control.max} or less.`
    if (validity.stepMismatch)
      return `Enter a value in increments of ${control.step || "1"}.`
  }
  if (!(control instanceof HTMLSelectElement)) {
    if (validity.tooShort)
      return `Enter at least ${control.minLength} characters.`
    if (validity.tooLong)
      return `Enter no more than ${control.maxLength} characters.`
  }
  if (validity.patternMismatch) return "Enter a value in the requested format."
  return "Check this field and try again."
}

function FieldError({
  control,
  message,
}: {
  control: Control
  message: string
}) {
  const id = useId()
  // Render at the field group rather than inside input adornments (password
  // toggles, currency prefixes, and calendar buttons must retain their layout).
  const label = control.labels?.[0]
  const container =
    control.closest("[data-validation-field]") ||
    (label?.contains(control) ? label : label?.parentElement) ||
    control.parentElement

  useLayoutEffect(() => {
    const invalid = control.getAttribute("aria-invalid")
    control.setAttribute("aria-invalid", "true")
    control.setAttribute("data-validation-invalid", "true")
    const addDescription = () => {
      const descriptions = new Set(
        (control.getAttribute("aria-describedby") || "")
          .split(" ")
          .filter(Boolean),
      )
      descriptions.add(id)
      const value = [...descriptions].join(" ")
      if (control.getAttribute("aria-describedby") !== value)
        control.setAttribute("aria-describedby", value)
    }
    addDescription()
    // Controlled fields can update their hint IDs while an error is visible.
    const observer = new MutationObserver(addDescription)
    observer.observe(control, {
      attributes: true,
      attributeFilter: ["aria-describedby"],
    })
    return () => {
      observer.disconnect()
      if (invalid === null) control.removeAttribute("aria-invalid")
      else control.setAttribute("aria-invalid", invalid)
      control.removeAttribute("data-validation-invalid")
      const descriptions = (control.getAttribute("aria-describedby") || "")
        .split(" ")
        .filter((value) => value && value !== id)
        .join(" ")
      if (descriptions) control.setAttribute("aria-describedby", descriptions)
      else control.removeAttribute("aria-describedby")
    }
  }, [control, id])

  if (!container || !control.isConnected) return null
  return createPortal(
    <span
      id={id}
      // Keep errors out of wrapping labels' accessible names. The explicit
      // aria-describedby reference still exposes this text as a description;
      // the form's live region announces newly reported errors.
      aria-hidden="true"
      data-field-error
      className="col-span-full block w-full text-[11px] leading-5 font-normal text-[#bc3649] [overflow-wrap:anywhere]"
    >
      {message}
    </span>,
    container,
  )
}

/** Shared form validation. `noValidate` preserves forms with their own schemas. */
export const Form = forwardRef<HTMLFormElement, ComponentProps<"form">>(
  function Form(
    {
      noValidate,
      onSubmit,
      onInvalidCapture,
      onChangeCapture,
      onChange,
      onReset,
      className,
      children,
      ...props
    },
    ref,
  ) {
    const [errors, setErrors] = useState(
      new Map<Control, { id: number; message: string }>(),
    )
    const nextErrorId = useRef(0)
    return (
      <form
        {...props}
        ref={ref}
        noValidate
        className={cn(
          "[&_[data-validation-invalid=true]]:border-[#d64557]",
          className,
        )}
        onInvalidCapture={(event) => {
          event.preventDefault()
          const control = event.target
          if (isControl(control)) {
            const error = {
              id: errors.get(control)?.id ?? nextErrorId.current++,
              message: validationMessage(control),
            }
            setErrors((current) => new Map(current).set(control, error))
          }
          onInvalidCapture?.(event)
        }}
        onChangeCapture={(event) => {
          // Clear a previously reported custom error before feature handlers
          // recompute it. Quotation/payment rules are checked again on submit.
          if (isControl(event.target) && errors.has(event.target))
            event.target.setCustomValidity("")
          onChangeCapture?.(event)
        }}
        onChange={(event) => {
          onChange?.(event)
          const control = event.target
          if (!isControl(control) || !errors.has(control)) return
          const message = control.validity.valid
            ? ""
            : validationMessage(control)
          setErrors((current) => {
            const next = new Map(current)
            const error = current.get(control)
            if (!message) next.delete(control)
            else if (error) next.set(control, { ...error, message })
            return next
          })
        }}
        onReset={(event) => {
          onReset?.(event)
          if (!event.defaultPrevented) {
            for (const control of errors.keys()) control.setCustomValidity("")
            setErrors(new Map())
          }
        }}
        onSubmit={(event) => {
          setErrors(new Map())
          const submitter = (event.nativeEvent as SubmitEvent).submitter
          const skipValidation =
            noValidate ||
            ((submitter instanceof HTMLButtonElement ||
              submitter instanceof HTMLInputElement) &&
              submitter.formNoValidate)
          if (
            !skipValidation &&
            !validateFields(
              Array.from(event.currentTarget.elements).filter(isControl),
            )
          ) {
            event.preventDefault()
            return
          }
          onSubmit?.(event)
        }}
      >
        {children}
        {errors.size > 0 && (
          <span role="alert" aria-atomic="true" className="sr-only">
            {[
              ...new Set([...errors.values()].map((error) => error.message)),
            ].join(" ")}
          </span>
        )}
        {[...errors].map(([control, error]) => (
          <FieldError
            key={error.id}
            control={control}
            message={error.message}
          />
        ))}
      </form>
    )
  },
)
