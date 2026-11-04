package com.nexus.app.features.auth.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nexus.app.core.components.ToastKind
import com.nexus.app.features.auth.api.AuthRequestException
import com.nexus.app.features.auth.model.AuthUser
import com.nexus.app.features.auth.model.validateLogin
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class LoginUiState(
    val email: String = "",
    val password: String = "",
    val submitting: Boolean = false,
    /** Validation or server error (wrong password, inactive account, ...). */
    val error: String? = null,
    /** True when the failure was not a server answer: no connection or server unreachable. */
    val offline: Boolean = false
)

/** One-shot message for the screen to show as a toast. */
data class AuthToast(val title: String, val message: String, val kind: ToastKind)

class AuthViewModel(
    private val login: suspend (email: String, password: String) -> Result<AuthUser>
) : ViewModel() {

    private val _state = MutableStateFlow(LoginUiState())
    val state: StateFlow<LoginUiState> = _state.asStateFlow()

    private val _toasts = MutableSharedFlow<AuthToast>(extraBufferCapacity = 1)
    val toasts: SharedFlow<AuthToast> = _toasts.asSharedFlow()

    fun onEmailChange(value: String) =
        _state.update { it.copy(email = value, error = null, offline = false) }

    fun onPasswordChange(value: String) =
        _state.update { it.copy(password = value, error = null, offline = false) }

    fun submit(onSuccess: (AuthUser) -> Unit) {
        val current = _state.value
        if (current.submitting) return

        val validation = validateLogin(current.email, current.password)
        if (validation != null) {
            _state.update { it.copy(error = validation, offline = false) }
            return
        }

        _state.update { it.copy(submitting = true, error = null, offline = false) }
        viewModelScope.launch {
            val result = try {
                login(current.email, current.password)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Throwable) {
                Result.failure(e)
            }

            result
                .onSuccess { user ->
                    // Never keep the password in memory after a successful sign-in.
                    _state.update { it.copy(submitting = false, password = "") }
                    onSuccess(user)
                }
                .onFailure { error ->
                    val fromServer = error is AuthRequestException
                    val message = if (fromServer) {
                        error.message ?: "Sign-in failed. Try again."
                    } else {
                        "Can't reach the server. Check your connection and try again."
                    }
                    _state.update {
                        it.copy(submitting = false, offline = !fromServer, error = message)
                    }
                    _toasts.tryEmit(AuthToast("Sign-in failed", message, ToastKind.ERROR))
                }
        }
    }
}