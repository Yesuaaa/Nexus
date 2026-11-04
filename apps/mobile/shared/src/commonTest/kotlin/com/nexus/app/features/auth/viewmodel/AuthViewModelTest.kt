package com.nexus.app.features.auth.viewmodel

import com.nexus.app.features.auth.model.AuthUser
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue
import com.nexus.app.core.network.ApiConnectionException
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest

@OptIn(ExperimentalCoroutinesApi::class)
class AuthViewModelTest {
    @Test
    fun offlineLoginEmitsDiagnosticToast() = runTest {
        val vm = AuthViewModel { _, _ ->
            Result.failure(ApiConnectionException("http://10.0.2.2:3001", Exception("Connection refused")))
        }
        val toast = async(start = CoroutineStart.UNDISPATCHED) { vm.toasts.first() }
        vm.onEmailChange("client@example.com")
        vm.onPasswordChange("secret")
        vm.submit {}
        assertEquals(
            "Cannot reach API at http://10.0.2.2:3001. Ensure backend is running via `pnpm dev:mobile`.",
            toast.await().message
        )
        assertTrue(vm.state.value.offline)
    }


    private val user = AuthUser(
        id = "1",
        email = "client@example.com",
        fullName = "Test Client",
        contactNumber = "09171234567",
        role = "USER",
        isActive = true
    )

    @BeforeTest
    fun setUp() = Dispatchers.setMain(UnconfinedTestDispatcher())

    @AfterTest
    fun tearDown() = Dispatchers.resetMain()

    @Test
    fun blankEmail_showsValidationError_andDoesNotCallLogin() {
        var calls = 0
        val vm = AuthViewModel { _, _ -> calls++; Result.success(user) }

        vm.onPasswordChange("secret")
        vm.submit {}

        assertEquals("Email address is required.", vm.state.value.error)
        assertFalse(vm.state.value.submitting)
        assertEquals(0, calls)
    }

    @Test
    fun blankPassword_showsValidationError() {
        val vm = AuthViewModel { _, _ -> Result.success(user) }

        vm.onEmailChange("client@example.com")
        vm.submit {}

        assertEquals("Password is required.", vm.state.value.error)
    }

    @Test
    fun success_callsOnSuccess_andClearsPassword() {
        val vm = AuthViewModel { _, _ -> Result.success(user) }
        var signedIn: AuthUser? = null

        vm.onEmailChange("client@example.com")
        vm.onPasswordChange("secret")
        vm.submit { signedIn = it }

        assertEquals(user, signedIn)
        assertFalse(vm.state.value.submitting)
        assertEquals("", vm.state.value.password)
        assertNull(vm.state.value.error)
    }

    @Test
    fun networkFailure_marksOffline_keepsPassword_andAllowsRetry() {
        var attempt = 0
        val vm = AuthViewModel { _, _ ->
            attempt++
            if (attempt == 1) Result.failure(RuntimeException("boom")) else Result.success(user)
        }
        var signedIn: AuthUser? = null

        vm.onEmailChange("client@example.com")
        vm.onPasswordChange("secret")
        vm.submit { signedIn = it }

        assertTrue(vm.state.value.offline)
        assertNotNull(vm.state.value.error)
        assertFalse(vm.state.value.submitting)
        assertEquals("secret", vm.state.value.password)
        assertNull(signedIn)

        vm.submit { signedIn = it } // retry
        assertEquals(user, signedIn)
        assertFalse(vm.state.value.offline)
    }

    @Test
    fun secondSubmitWhileSubmitting_isIgnored() {
        var calls = 0
        val gate = CompletableDeferred<Result<AuthUser>>()
        val vm = AuthViewModel { _, _ -> calls++; gate.await() }

        vm.onEmailChange("client@example.com")
        vm.onPasswordChange("secret")
        vm.submit {}
        assertTrue(vm.state.value.submitting)

        vm.submit {}
        assertEquals(1, calls)

        gate.complete(Result.success(user))
        assertFalse(vm.state.value.submitting)
    }

    @Test
    fun editingFields_clearsError() {
        val vm = AuthViewModel { _, _ -> Result.success(user) }

        vm.submit {}
        assertNotNull(vm.state.value.error)

        vm.onEmailChange("a")
        assertNull(vm.state.value.error)
    }
}
