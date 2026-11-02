package com.nexus.app.core.storage

import com.russhwolf.settings.Settings

interface TokenStorage {
    fun getAccessToken(): String?
    fun getRefreshToken(): String?
    fun setTokens(accessToken: String, refreshToken: String?)
    fun clearTokens()
    fun hasValidSession(): Boolean
}

class SettingsTokenStorage(
    private val settings: Settings = Settings()
) : TokenStorage {

    companion object {
        private const val KEY_ACCESS_TOKEN = "nexus.auth.token"
        private const val KEY_REFRESH_TOKEN = "nexus.auth.refreshToken"
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
        settings.putString(KEY_ACCESS_TOKEN, accessToken)
        if (refreshToken != null) {
            settings.putString(KEY_REFRESH_TOKEN, refreshToken)
        } else {
            settings.remove(KEY_REFRESH_TOKEN)
        }
    }

    override fun clearTokens() {
        settings.remove(KEY_ACCESS_TOKEN)
        settings.remove(KEY_REFRESH_TOKEN)
    }

    override fun hasValidSession(): Boolean {
        return getAccessToken() != null
    }
}

