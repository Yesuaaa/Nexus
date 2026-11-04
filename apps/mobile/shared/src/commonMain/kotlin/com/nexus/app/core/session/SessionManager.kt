package com.nexus.app.core.session

import com.nexus.app.features.auth.model.AuthUser
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow

class SessionManager {
    private val _user = MutableStateFlow<AuthUser?>(null)
    val user: StateFlow<AuthUser?> = _user.asStateFlow()

    private val _notice = MutableStateFlow<String?>(null)
    val notice: StateFlow<String?> = _notice.asStateFlow()

    private val _expired = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val expired: SharedFlow<Unit> = _expired.asSharedFlow()

    fun setUser(user: AuthUser) {
        _user.value = user
        _notice.value = null
    }

    fun clear(notice: String? = null) {
        _user.value = null
        _notice.value = notice
    }

    /** Called by the HTTP client when the refresh token is missing or rejected. */
    fun expire() {
        clear("Your session expired. Please sign in again.")
        _expired.tryEmit(Unit)
    }
}