package com.nexus.app.core.storage

import com.nexus.app.features.auth.model.AuthUser
import com.russhwolf.settings.Settings
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

@Serializable
data class VerifiedClientProfile(val user: AuthUser, val accessToken: String)

interface TokenStorage {
    fun getAccessToken(): String?
    fun getRefreshToken(): String?
    fun setTokens(accessToken: String, refreshToken: String?)
    fun clearTokens()
    fun getVerifiedProfile(): VerifiedClientProfile? = null
    fun setVerifiedProfile(profile: VerifiedClientProfile) {}
    fun clearVerifiedProfile() {}
    /** Local credential presence only. The server decides whether a session is valid. */
    fun hasValidSession(): Boolean
}

class SettingsTokenStorage(
    private val settings: Settings = createSecureSettings()
) : TokenStorage {

    companion object {
        private const val KEY_ACCESS_TOKEN = "nexus.auth.token"
        private const val KEY_REFRESH_TOKEN = "nexus.auth.refreshToken"
        private const val KEY_VERIFIED_PROFILE = "nexus.auth.verifiedClient"
    }

    override fun getAccessToken(): String? {
        val token = settings.getStringOrNull(KEY_ACCESS_TOKEN)
        return if (token.isNullOrBlank()) null else token
    }

    override fun getRefreshToken(): String? {
        val token = settings.getStringOrNull(KEY_REFRESH_TOKEN)
        return if (token.isNullOrBlank()) null else token
    }

    override fun setTokens(accessToken: String, refreshToken: String?) {
        if (refreshToken != null) {
            settings.putString(KEY_REFRESH_TOKEN, refreshToken)
        } else {
            settings.remove(KEY_REFRESH_TOKEN)
        }
        // Commit the rotated refresh credential before publishing the new access token.
        settings.putString(KEY_ACCESS_TOKEN, accessToken)
    }

    override fun clearTokens() {
        settings.remove(KEY_ACCESS_TOKEN)
        settings.remove(KEY_REFRESH_TOKEN)
        clearVerifiedProfile()
    }

    override fun getVerifiedProfile(): VerifiedClientProfile? =
        settings.getStringOrNull(KEY_VERIFIED_PROFILE)?.let {
            runCatching { Json.decodeFromString<VerifiedClientProfile>(it) }.getOrNull()
        }

    override fun setVerifiedProfile(profile: VerifiedClientProfile) {
        settings.putString(KEY_VERIFIED_PROFILE, Json.encodeToString(profile))
    }

    override fun clearVerifiedProfile() { settings.remove(KEY_VERIFIED_PROFILE) }

    override fun hasValidSession(): Boolean = getAccessToken() != null
}
