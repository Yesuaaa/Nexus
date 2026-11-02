package com.nexus.app.core.validation

object ValidationUtils {

    private val PH_MOBILE_REGEX = Regex("^(08|09)\\d{9}$")
    private val PH_MOBILE_INTERNATIONAL_REGEX = Regex("^(\\+63|63)(8|9)\\d{9}$")
    private val EMAIL_REGEX = Regex("^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.(com|ph)$", RegexOption.IGNORE_CASE)

    fun isValidEmail(email: String): Boolean {
        return EMAIL_REGEX.matches(email.trim())
    }

    fun normalizePhContactNumber(input: String): String {
        val trimmed = input.trim().replace(" ", "").replace("-", "")
        return when {
            trimmed.startsWith("+63") -> "0" + trimmed.removePrefix("+63")
            trimmed.startsWith("63") -> "0" + trimmed.removePrefix("63")
            else -> trimmed
        }
    }

    fun isValidPhContactNumber(input: String): Boolean {
        val normalized = normalizePhContactNumber(input)
        return PH_MOBILE_REGEX.matches(normalized)
    }

    data class PasswordValidationResult(
        val hasMinLength: Boolean,
        val hasUppercase: Boolean,
        val hasLowercase: Boolean,
        val hasDigit: Boolean,
        val hasSpecialChar: Boolean
    ) {
        val isValid: Boolean
            get() = hasMinLength && hasUppercase && hasLowercase && hasDigit && hasSpecialChar
    }

    fun validatePassword(password: String): PasswordValidationResult {
        return PasswordValidationResult(
            hasMinLength = password.length >= 12,
            hasUppercase = password.any { it.isUpperCase() },
            hasLowercase = password.any { it.isLowerCase() },
            hasDigit = password.any { it.isDigit() },
            hasSpecialChar = password.any { !it.isLetterOrDigit() }
        )
    }
}

