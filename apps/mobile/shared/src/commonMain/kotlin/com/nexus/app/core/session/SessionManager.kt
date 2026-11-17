package com.nexus.app.core.session

import com.nexus.app.features.auth.model.AuthUser
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

const val SESSION_EXPIRED_MESSAGE = "Your session expired. Please sign in again."

data class SessionState(
    val generation: Long = 0,
    val user: AuthUser? = null,
    val signedOut: Boolean = false,
    val offline: Boolean = false,
    val notice: String? = null
)

class SessionManager {
    private val mutable = MutableStateFlow(SessionState())
    val state = mutable.asStateFlow()
    private val _user = MutableStateFlow<AuthUser?>(null)
    val user = _user.asStateFlow()
    private val _notice = MutableStateFlow<String?>(null)
    val notice = _notice.asStateFlow()
    val generation: Long get() = state.value.generation

    private fun syncLegacyFlows() {
        _user.value = mutable.value.user
        _notice.value = mutable.value.notice
    }

    internal fun setUser(user: AuthUser, expected: Long = generation, offline: Boolean = false) {
        mutable.update {
            if (it.generation != expected) it
            else it.copy(user = user, signedOut = false, offline = offline, notice = null)
        }
        syncLegacyFlows()
    }

    /** Profile requests may update only the account and generation that started them. */
    fun updateUser(user: AuthUser, expected: Long = generation) {
        mutable.update {
            if (it.generation != expected || (it.user != null && it.user.id != user.id) ||
                user.role != "USER" || !user.isActive) it
            else it.copy(user = user)
        }
        syncLegacyFlows()
    }

    fun expire() {
        clear(SESSION_EXPIRED_MESSAGE)
    }

    fun clear(notice: String? = null) {
        mutable.update { SessionState(generation = it.generation + 1, signedOut = true, notice = notice) }
        syncLegacyFlows()
    }
}
