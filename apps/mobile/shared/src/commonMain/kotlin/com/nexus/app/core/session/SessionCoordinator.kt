package com.nexus.app.core.session

import com.nexus.app.core.storage.TokenStorage
import com.nexus.app.core.storage.VerifiedClientProfile
import com.nexus.app.features.auth.model.AuthUser
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/** Serializes credential publication and session boundaries; never locks over network I/O. */
class SessionCoordinator(val storage: TokenStorage, val manager: SessionManager = SessionManager()) {
    private val writes = Mutex()
    val refresh = Mutex()
    var clearBearerCache: () -> Unit = {}
    var onExpired: () -> Unit = {}
    val generation: Long get() = manager.generation

    suspend fun beginAuthentication(): Long = writes.withLock {
        clearLocal()
        manager.clear()
        generation
    }

    suspend fun beginLogout(): Pair<Long, String?> = writes.withLock {
        // Invalidate in-flight work now; retain the credential for server logout until finally.
        manager.clear()
        clearBearerCache()
        generation to storage.getAccessToken()
    }

    suspend fun clear(expected: Long = generation, expired: Boolean = false) = writes.withLock {
        if (generation != expected) return@withLock
        if (expired && manager.state.value.signedOut && !storage.hasValidSession()) return@withLock
        clearLocal()
        manager.clear(if (expired) SESSION_EXPIRED_MESSAGE else null)
        if (expired) onExpired()
    }

    private fun clearLocal() {
        storage.clearTokens()
        storage.clearVerifiedProfile()
        clearBearerCache()
    }

    suspend fun authenticate(expected: Long, access: String, refresh: String, user: AuthUser): Boolean = writes.withLock {
        if (generation != expected) return@withLock false
        storage.setTokens(access, refresh)
        storage.setVerifiedProfile(VerifiedClientProfile(user, access))
        clearBearerCache()
        manager.setUser(user, expected)
        true
    }

    suspend fun rotate(expected: Long, access: String, refresh: String): Boolean = writes.withLock {
        if (generation != expected) return@withLock false
        val cached = cachedProfile()
        storage.setTokens(access, refresh)
        if (cached != null) storage.setVerifiedProfile(VerifiedClientProfile(cached, access))
        true
    }

    suspend fun verified(expected: Long, user: AuthUser): Boolean = writes.withLock {
        if (generation != expected || !storage.hasValidSession()) return@withLock false
        val previous = cachedProfile()
        if (previous != null && previous.id != user.id) {
            clearLocal()
            manager.clear(SESSION_EXPIRED_MESSAGE)
            onExpired()
            return@withLock false
        }
        storage.setVerifiedProfile(VerifiedClientProfile(user, storage.getAccessToken()!!))
        manager.setUser(user, expected)
        true
    }

    suspend fun restoreOffline(expected: Long): AuthUser? = writes.withLock {
        if (generation != expected) return@withLock null
        cachedProfile()?.also { manager.setUser(it, expected, offline = true) }
    }

    private fun cachedProfile(): AuthUser? = storage.getVerifiedProfile()?.takeIf {
        it.accessToken == storage.getAccessToken() && it.user.role == "USER" && it.user.isActive
    }?.user
}
