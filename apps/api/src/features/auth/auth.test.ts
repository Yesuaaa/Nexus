import assert from "node:assert/strict"
import { test } from "node:test"
import { hashPassword, validPassword, verifyPassword } from "./auth.password.js"
import {
  normalizedEmail,
  registrationEmail,
  validRegistrationProfile,
} from "./auth.schema.js"

test("passwords are salted and verified", async () => {
  const first = await hashPassword("a long unique password")
  const second = await hashPassword("a long unique password")
  assert.notEqual(first, second)
  assert.equal(await verifyPassword("a long unique password", first), true)
  assert.equal(await verifyPassword("wrong password", first), false)
  assert.equal(await verifyPassword("anything", "malformed"), false)
  assert.equal(validPassword("too short"), false)
  assert.equal(validPassword("Aa1!bcdefghi"), true)
  assert.equal(validPassword("Éléphant١٢٣!"), true)
  assert.equal(validPassword("StrongPass12!"), true)
  assert.equal(validPassword("twelve chars"), false)
  assert.equal(validPassword("strongpassword12!"), false)
  assert.equal(validPassword("STRONGPASSWORD12!"), false)
  assert.equal(validPassword("StrongPassword!!"), false)
  assert.equal(validPassword("StrongPassword12"), false)
  assert.equal(validPassword("StrongPassword1\u0301"), false)
  assert.equal(validPassword(`Aa1!${"é".repeat(510)}`), true)
  assert.equal(validPassword(`Aa1!${"é".repeat(511)}`), false)
})

test("email normalization preserves the general login and account format", () => {
  assert.equal(
    normalizedEmail(" LOGIN+tag@Example.org "),
    "login+tag@example.org",
  )
  assert.equal(normalizedEmail("invalid"), undefined)
  assert.equal(normalizedEmail(null), undefined)
  assert.equal(normalizedEmail([]), undefined)
  assert.equal(normalizedEmail({}), undefined)
})

test("registration emails follow the .com and .ph requirements", () => {
  assert.equal(registrationEmail("  User@Example.com  "), "user@example.com")
  const maxEmail = `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(57)}.com`
  assert.equal(maxEmail.length, 254)
  assert.equal(registrationEmail(maxEmail), maxEmail)
  assert.equal(
    registrationEmail("Person+tag@Subdomain.Example.com.ph"),
    "person+tag@subdomain.example.com.ph",
  )
  assert.equal(
    registrationEmail("José@例え.example.ph"),
    "josé@xn--r8jz45g.example.ph",
  )
  assert.equal(registrationEmail("o'hara@example.ph"), "o'hara@example.ph")
  assert.equal(registrationEmail("person@example.org"), undefined)
  assert.equal(registrationEmail("person..name@example.com"), undefined)
  assert.equal(registrationEmail("person@example..com"), undefined)
  assert.equal(registrationEmail("person@-example.com"), undefined)
  assert.equal(registrationEmail("---@email.com"), undefined)
  assert.equal(
    registrationEmail(
      `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(58)}.com`,
    ),
    undefined,
  )
  assert.equal(registrationEmail("a".repeat(65) + "@example.com"), undefined)
  assert.equal(
    registrationEmail("person@example.com" + "x".repeat(245)),
    undefined,
  )
  assert.equal(registrationEmail(null), undefined)
  assert.equal(registrationEmail([]), undefined)
  assert.equal(registrationEmail({}), undefined)
})

test("registration requires a valid name and contact number", () => {
  assert.equal(validRegistrationProfile("Jane Doe", "09123456789"), true)
  assert.equal(validRegistrationProfile("J".repeat(100), "09123456789"), true)
  assert.equal(validRegistrationProfile("Jane Doe", " 09123456789 "), true)
  assert.equal(
    validRegistrationProfile("José O'Neil-Santos", "08123456789"),
    true,
  )
  assert.equal(
    validRegistrationProfile("Jose\u0301 O'Neil", "08123456789"),
    true,
  )
  assert.equal(validRegistrationProfile("李 明", "08123456789"), true)
  assert.equal(validRegistrationProfile(undefined, "09123456789"), false)
  assert.equal(validRegistrationProfile("Jane Doe", null), false)
  assert.equal(validRegistrationProfile("  ", "09123456789"), false)
  assert.equal(validRegistrationProfile("J", "09123456789"), false)
  assert.equal(validRegistrationProfile("Jane123", "09123456789"), false)
  assert.equal(validRegistrationProfile("Jane Doe", "  "), false)
  assert.equal(validRegistrationProfile("Jane Doe", "+63 912 345 6789"), false)
  assert.equal(validRegistrationProfile("Jane Doe", "07123456789"), false)
  assert.equal(validRegistrationProfile("Jane Doe", "0912345678"), false)
  assert.equal(validRegistrationProfile("Jane Doe", "091234567890"), false)
  assert.equal(validRegistrationProfile("J".repeat(101), "09123456789"), false)
  assert.equal(validRegistrationProfile("Jane Doe", undefined), false)
  assert.equal(validRegistrationProfile("Jane Doe", "not a number"), false)
  assert.equal(validRegistrationProfile([], "09123456789"), false)
  assert.equal(validRegistrationProfile({}, "09123456789"), false)
})
