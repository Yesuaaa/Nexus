package com.nexus.app.features.auth.model

private val registrationEmail = Regex(
    "^[A-Za-z0-9]+([._+-][A-Za-z0-9]+)*@[A-Za-z0-9-]+(\\.[A-Za-z0-9-]+)*\\.(com|ph)$",
    RegexOption.IGNORE_CASE
)
private val contactNumber = Regex("^(08|09)\\d{9}$")
private val fullName = Regex("^\\p{L}[\\p{L} .'’-]*$")

fun validateLogin(email: String, password: String): String? = when {
    email.trim().isBlank() -> "Email address is required."
    password.isBlank() -> "Password is required."
    else -> null
}

fun validateRegistration(
    name: String,
    contact: String,
    email: String,
    password: String,
    confirmation: String
): String? = registrationFieldErrors(name, contact, email, password, confirmation).values.firstOrNull()

/** Ordered errors shared by the submit guard and individual form fields. */
fun registrationFieldErrors(
    name: String,
    contact: String,
    email: String,
    password: String,
    confirmation: String
): Map<String, String> = buildMap {
    if (name.trim().length !in 2..100 || !fullName.matches(name.trim()))
        put("fullName", "Enter a valid full name.")
    if (!contactNumber.matches(contact.trim()))
        put("contactNumber", "Use an 11-digit Philippine mobile number starting with 08 or 09.")
    if (!registrationEmail.matches(email.trim()))
        put("email", "Use a valid .com or .ph email address.")
    val passwordError = when {
        password.length < 12 -> "Use at least 12 characters for your password."
        password.encodeToByteArray().size > 1024 -> "Password is too long."
        !password.any(Char::isUpperCase) ||
            !password.any(Char::isLowerCase) ||
            !password.any(Char::isDigit) ||
            password.all(Char::isLetterOrDigit) ->
            "Password needs uppercase, lowercase, number, and special characters."
        else -> null
    }
    passwordError?.let { put("password", it) }
    if (password != confirmation) put("confirmation", "Passwords do not match.")
}
