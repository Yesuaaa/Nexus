package com.nexus.app.features.auth.model

import kotlinx.serialization.Serializable

@Serializable
data class LoginRequest(
    val email: String,
    val password: String
)

@Serializable
data class RegisterRequest(
    val fullName: String,
    val contactNumber: String,
    val email: String,
    val password: String
)

@Serializable
data class AuthUser(
    val id: String,
    val email: String,
    val fullName: String? = null,
    val contactNumber: String? = null,
    val role: String,
    val isActive: Boolean
)

@Serializable
data class AuthSession(
    val token: String,
    val refreshToken: String,
    val expiresIn: Int,
    val user: AuthUser
) {
    val accessToken: String get() = token
}

typealias AuthResponse = AuthSession
typealias UserDto = AuthUser

@Serializable
data class CurrentUserResponse(
    val user: AuthUser
)

@Serializable
data class ApiErrorResponse(
    val error: String? = null
)
