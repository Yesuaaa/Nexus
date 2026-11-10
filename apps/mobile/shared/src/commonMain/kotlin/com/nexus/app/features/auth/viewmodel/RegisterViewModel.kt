package com.nexus.app.features.auth.viewmodel

import com.nexus.app.core.network.ApiConnectionException
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nexus.app.core.components.ToastKind
import com.nexus.app.features.auth.api.AuthRequestException
import com.nexus.app.features.auth.model.AuthUser
import com.nexus.app.features.auth.model.validateRegistration
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class RegisterUiState(
    val fullName: String = "",
    val contactNumber: String = "",
    val email: String = "",
    val password: String = "",
    val confirmation: String = "",
    val submitting: Boolean = false,
    val success: Boolean = false,
    /** Validation or server error (duplicate email, bad input, ...). */
    val error: String? = null,
    /** True when the failure was not a server answer: no connection or server unreachable. */
    val offline: Boolean = false
)

class RegisterViewModel(
    private val register: suspend (
        fullName: String,
        contactNumber: String,
        email: String,
        password: String
    ) -> Result<AuthUser>
) : ViewModel() {

    private val _state = MutableStateFlow(RegisterUiState())
    val state: StateFlow<RegisterUiState> = _state.asStateFlow()

    private val _toasts = MutableSharedFlow<AuthToast>(extraBufferCapacity = 1)
    val toasts: SharedFlow<AuthToast> = _toasts.asSharedFlow()

    fun onFullNameChange(value: String) =
        _state.update { it.copy(fullName = value, error = null, offline = false) }

    fun onContactNumberChange(value: String) =
        _state.update {
            it.copy(contactNumber = value.filter(Char::isDigit).take(11), error = null, offline = false)
        }

    fun onEmailChange(value: String) =
        _state.update { it.copy(email = value, error = null, offline = false) }

    fun onPasswordChange(value: String) =
        _state.update { it.copy(password = value, error = null, offline = false) }

    fun onConfirmationChange(value: String) =
        _state.update { it.copy(confirmation = value, error = null, offline = false) }

    fun submit(onSuccess: (AuthUser) -> Unit) {
        val current = _state.value
        if (current.submitting || current.success) return

        val validation = validateRegistration(
            current.fullName,
            current.contactNumber,
            current.email,
            current.password,
            current.confirmation
        )
        if (validation != null) {
            _state.update { it.copy(error = validation, offline = false) }
            return
        }

        _state.update { it.copy(submitting = true, error = null, offline = false) }
        viewModelScope.launch {
            val result = try {
                register(current.fullName, current.contactNumber, current.email, current.password)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Throwable) {
                Result.failure(e)
            }

            result
                .onSuccess { user ->
                    // Never keep passwords in memory after a successful registration.
                    _state.update { it.copy(submitting = false, success = true, password = "", confirmation = "") }
                    onSuccess(user)
                }
                .onFailure { error ->
                    val fromServer = error is AuthRequestException
                    val message = if (fromServer) {
                        error.message ?: "Couldn't create the account. Try again."
                    } else if (error is ApiConnectionException) {
                        error.message.orEmpty()
                    } else {
                        "Can't reach the server. Check your connection and try again."
                    }
                    _state.update {
                        it.copy(submitting = false, offline = !fromServer, error = message)
                    }
                    _toasts.tryEmit(AuthToast("Account unavailable", message, ToastKind.ERROR))
                }
        }
    }
}