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

@OptIn(ExperimentalCoroutinesApi::class)
class RegisterViewModelTest {

    private val user = AuthUser(
        id = "1",
        email = "juan@example.com",
        fullName = "Juan Dela Cruz",
        contactNumber = "09171234567",
        role = "USER",
        isActive = true
    )

    private val strongPassword = "Str0ng!Passw0rd"

    @BeforeTest
    fun setUp() = Dispatchers.setMain(UnconfinedTestDispatcher())

    @AfterTest
    fun tearDown() = Dispatchers.resetMain()

    private fun RegisterViewModel.fillValid() {
        onFullNameChange("Juan Dela Cruz")
        onContactNumberChange("09171234567")
        onEmailChange("juan@example.com")
        onPasswordChange(strongPassword)
        onConfirmationChange(strongPassword)
    }

    @Test
    fun invalidInput_showsValidationError_andDoesNotCallRegister() {
        var calls = 0
        val vm = RegisterViewModel { _, _, _, _ -> calls++; Result.success(user) }

        vm.submit {}

        assertEquals("Enter a valid full name.", vm.state.value.error)
        assertFalse(vm.state.value.submitting)
        assertEquals(0, calls)
    }

    @Test
    fun mismatchedPasswords_showError() {
        val vm = RegisterViewModel { _, _, _, _ -> Result.success(user) }

        vm.fillValid()
        vm.onConfirmationChange("Different!Passw0rd")
        vm.submit {}

        assertEquals("Passwords do not match.", vm.state.value.error)
    }

    @Test
    fun contactNumber_keepsOnlyDigits_maxEleven() {
        val vm = RegisterViewModel { _, _, _, _ -> Result.success(user) }

        vm.onContactNumberChange("09-17 123 4567 89")

        assertEquals("09171234567", vm.state.value.contactNumber)
    }

    @Test
    fun success_callsOnSuccess_andClearsPasswords() {
        var received: List<String>? = null
        val vm = RegisterViewModel { name, contact, email, password ->
            received = listOf(name, contact, email, password)
            Result.success(user)
        }
        var signedIn: AuthUser? = null

        vm.fillValid()
        vm.submit { signedIn = it }

        assertEquals(user, signedIn)
        assertEquals(
            listOf("Juan Dela Cruz", "09171234567", "juan@example.com", strongPassword),
            received
        )
        assertFalse(vm.state.value.submitting)
        assertEquals("", vm.state.value.password)
        assertEquals("", vm.state.value.confirmation)
        assertNull(vm.state.value.error)
    }

    @Test
    fun networkFailure_marksOffline_keepsInput_andAllowsRetry() {
        var attempt = 0
        val vm = RegisterViewModel { _, _, _, _ ->
            attempt++
            if (attempt == 1) Result.failure(RuntimeException("boom")) else Result.success(user)
        }
        var signedIn: AuthUser? = null

        vm.fillValid()
        vm.submit { signedIn = it }

        assertTrue(vm.state.value.offline)
        assertNotNull(vm.state.value.error)
        assertFalse(vm.state.value.submitting)
        assertEquals(strongPassword, vm.state.value.password)
        assertNull(signedIn)

        vm.submit { signedIn = it } // retry
        assertEquals(user, signedIn)
        assertFalse(vm.state.value.offline)
    }

    @Test
    fun secondSubmitWhileSubmitting_isIgnored() {
        var calls = 0
        val gate = CompletableDeferred<Result<AuthUser>>()
        val vm = RegisterViewModel { _, _, _, _ -> calls++; gate.await() }

        vm.fillValid()
        vm.submit {}
        assertTrue(vm.state.value.submitting)

        vm.submit {}
        assertEquals(1, calls)

        gate.complete(Result.success(user))
        assertFalse(vm.state.value.submitting)
    }

    @Test
    fun editingFields_clearsError() {
        val vm = RegisterViewModel { _, _, _, _ -> Result.success(user) }

        vm.submit {}
        assertNotNull(vm.state.value.error)

        vm.onFullNameChange("J")
        assertNull(vm.state.value.error)
    }
}