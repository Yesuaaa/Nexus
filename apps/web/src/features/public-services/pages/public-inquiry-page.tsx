"use client"

import Link from "next/link"
import { useRef, useState, type FormEvent } from "react"
import { ArrowLeft, ArrowUpRight, Check } from "lucide-react"
import { useAsyncResource } from "@/lib/use-async-resource"
import { getPublicService, sendPublicInquiry } from "../api/public-services-api"
import { PublicState } from "./public-services-page"
import type { InquiryInput } from "../model/types"
import styles from "../components/public-services.module.css"

type Field =
  "fullName" | "email" | "contactNumber" | "subject" | "message" | "agreed"

function validate(values: Omit<InquiryInput, "submissionKey">) {
  const errors: Partial<Record<Field, string>> = {}
  if (values.fullName.trim().length < 2 || values.fullName.trim().length > 100)
    errors.fullName = "Enter your full name (2–100 characters)."
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()) ||
    values.email.length > 254
  )
    errors.email = "Enter a valid email address."
  if (!/^\+?[0-9][0-9\s-]{6,19}$/.test(values.contactNumber.trim()))
    errors.contactNumber = "Enter a valid contact number."
  if (values.subject.trim().length < 3 || values.subject.trim().length > 160)
    errors.subject = "Enter a subject (3–160 characters)."
  if (values.message.trim().length < 10 || values.message.trim().length > 6000)
    errors.message = "Tell us a little more (10–6,000 characters)."
  if (!values.agreed)
    errors.agreed = "Please acknowledge that this is an inquiry."
  return errors
}

export function PublicInquiryPage({ id }: { id: string }) {
  const resource = useAsyncResource(
    (signal) => getPublicService(id, signal),
    [id],
  )
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [error, setError] = useState("")
  const [sending, setSending] = useState(false)
  const [receipt, setReceipt] = useState<string | null>(null)
  const draft = useRef<{ signature: string; key: string } | null>(null)
  const inFlight = useRef(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return
    const fields = new FormData(event.currentTarget)
    const value = (name: string) => String(fields.get(name) ?? "").trim()
    const input = {
      fullName: value("fullName"),
      email: value("email").toLowerCase(),
      contactNumber: value("contactNumber"),
      subject: value("subject"),
      message: value("message"),
      website: value("website"),
      agreed: fields.get("agreed") === "on",
    }
    const fieldErrors = validate(input)
    setErrors(fieldErrors)
    setError("")
    const first = Object.keys(fieldErrors)[0]
    if (first) {
      document.getElementById("inquiry-" + first)?.focus()
      return
    }
    const signature = JSON.stringify([id, input])
    if (!draft.current || draft.current.signature !== signature)
      draft.current = { signature, key: crypto.randomUUID() }
    inFlight.current = true
    setSending(true)
    try {
      const result = await sendPublicInquiry(id, {
        ...input,
        submissionKey: draft.current.key,
      })
      setReceipt(result.inquiry.id)
    } catch (reason) {
      setError(
        reason instanceof Error && reason.name !== "TimeoutError"
          ? reason.message
          : "The request took too long. Retry this form; an already received inquiry will not be duplicated.",
      )
    } finally {
      inFlight.current = false
      setSending(false)
    }
  }

  if (resource.loading)
    return <PublicState loading message="Preparing your inquiry…" />
  if (resource.error || !resource.data)
    return (
      <PublicState
        message={resource.error || "This service is unavailable."}
        onRetry={resource.retry}
      />
    )
  const service = resource.data

  if (receipt)
    return (
      <section className={styles.success} role="status">
        <span className={styles.successIcon}>
          <Check size={30} />
        </span>
        <h1>Conversation started.</h1>
        <p>
          Your inquiry about <strong>{service.name}</strong> has been received
          for review. Our team can use the contact details you shared to follow
          up.
        </p>
        <p className={styles.notice}>
          This does not confirm a booking, appointment, or service agreement. No
          payment is due.
        </p>
        <p className={styles.reference}>Your reference: {receipt}</p>
        <Link href="/explore/services" className={styles.primary}>
          Explore other services
          <ArrowUpRight size={18} />
        </Link>
      </section>
    )

  return (
    <>
      <Link href={"/explore/services/" + id} className={styles.back}>
        <ArrowLeft size={16} />
        Back to service
      </Link>
      <div className={styles.inquiryLayout}>
        <div className={styles.inquiryIntro}>
          <h1>
            Tell us what
            <br />
            <span>you have in mind.</span>
          </h1>
          <p>
            Share your goals and requirements for {service.name}. No account is
            needed to start a conversation.
          </p>
          <div className={styles.notice}>
            An inquiry expresses interest. The scope, schedule, and any
            agreement are confirmed separately.
          </div>
        </div>
        <form className={styles.inquiryForm} onSubmit={submit} noValidate>
          <fieldset disabled={sending}>
            <legend className={styles.srOnly}>Service inquiry</legend>
            <label htmlFor="selected-service">Selected service</label>
            <input
              id="selected-service"
              value={service.name}
              readOnly
              aria-readonly="true"
            />
            <div className={styles.formGrid}>
              <div>
                <label htmlFor="inquiry-fullName">
                  Full name <span aria-hidden="true">*</span>
                </label>
                <input
                  id="inquiry-fullName"
                  name="fullName"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={100}
                  aria-invalid={Boolean(errors.fullName)}
                  aria-describedby={
                    errors.fullName ? "error-fullName" : undefined
                  }
                />
                {errors.fullName && (
                  <span id="error-fullName" className={styles.fieldError}>
                    {errors.fullName}
                  </span>
                )}
              </div>
              <div>
                <label htmlFor="inquiry-email">
                  Email address <span aria-hidden="true">*</span>
                </label>
                <input
                  id="inquiry-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? "error-email" : undefined}
                />
                {errors.email && (
                  <span id="error-email" className={styles.fieldError}>
                    {errors.email}
                  </span>
                )}
              </div>
            </div>
            <label htmlFor="inquiry-contactNumber">
              Contact number <span aria-hidden="true">*</span>
            </label>
            <input
              id="inquiry-contactNumber"
              name="contactNumber"
              type="tel"
              autoComplete="tel"
              required
              maxLength={24}
              aria-invalid={Boolean(errors.contactNumber)}
              aria-describedby={
                errors.contactNumber ? "error-contactNumber" : undefined
              }
            />
            {errors.contactNumber && (
              <span id="error-contactNumber" className={styles.fieldError}>
                {errors.contactNumber}
              </span>
            )}
            <label htmlFor="inquiry-subject">
              Subject <span aria-hidden="true">*</span>
            </label>
            <input
              id="inquiry-subject"
              name="subject"
              required
              minLength={3}
              maxLength={160}
              aria-invalid={Boolean(errors.subject)}
              aria-describedby={errors.subject ? "error-subject" : undefined}
            />
            {errors.subject && (
              <span id="error-subject" className={styles.fieldError}>
                {errors.subject}
              </span>
            )}
            <label htmlFor="inquiry-message">
              Your goals &amp; requirements <span aria-hidden="true">*</span>
            </label>
            <textarea
              id="inquiry-message"
              name="message"
              required
              rows={6}
              minLength={10}
              maxLength={6000}
              aria-invalid={Boolean(errors.message)}
              aria-describedby={errors.message ? "error-message" : undefined}
            />
            {errors.message && (
              <span id="error-message" className={styles.fieldError}>
                {errors.message}
              </span>
            )}
            <div className={styles.honeypot} aria-hidden="true">
              <label htmlFor="inquiry-website">Leave this blank</label>
              <input
                id="inquiry-website"
                name="website"
                tabIndex={-1}
                autoComplete="off"
              />
            </div>
            <label className={styles.consent} htmlFor="inquiry-agreed">
              <input
                id="inquiry-agreed"
                name="agreed"
                type="checkbox"
                required
                aria-invalid={Boolean(errors.agreed)}
                aria-describedby={errors.agreed ? "error-agreed" : undefined}
              />
              <span>
                I understand this inquiry is subject to review and does not
                confirm a booking or service agreement.
              </span>
            </label>
            {errors.agreed && (
              <span id="error-agreed" className={styles.fieldError}>
                {errors.agreed}
              </span>
            )}
            {error && (
              <p role="alert" className={styles.formError}>
                {error}
              </p>
            )}
            <button type="submit" className={styles.primary} disabled={sending}>
              {sending ? "Sending your inquiry…" : "Send inquiry"}
              <ArrowUpRight size={18} />
            </button>
          </fieldset>
        </form>
      </div>
    </>
  )
}
