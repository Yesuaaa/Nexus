package com.nexus.app.features.auth.screens

import androidx.compose.material3.Text
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.sp
import com.nexus.app.core.components.LocalNexusLayout
import com.nexus.app.core.components.LocalNexusToast
import com.nexus.app.core.components.NexusButton
import com.nexus.app.core.components.NexusTextField
import com.nexus.app.core.components.ToastKind
import com.nexus.app.core.theme.NexusColors
import com.nexus.app.features.auth.api.AuthRequestException
import com.nexus.app.features.auth.components.AuthHeader
import com.nexus.app.features.auth.components.AuthScreenLayout
import com.nexus.app.features.auth.components.AuthSwitchLink
import com.nexus.app.features.auth.model.validateRegistration
import kotlinx.coroutines.launch

@Composable
fun RegisterScreen(
    onRegister: suspend (String, String, String, String) -> Result<Unit>,
    onNavigateToLogin: () -> Unit,
    modifier: Modifier = Modifier
) {
    var fullName by rememberSaveable { mutableStateOf("") }
    var contactNumber by rememberSaveable { mutableStateOf("") }
    var email by rememberSaveable { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var confirmation by remember { mutableStateOf("") }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var submitting by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val toast = LocalNexusToast.current
    val layout = LocalNexusLayout.current

    AuthScreenLayout(
        modifier = modifier,
        action = {
            NexusButton(
                text = "Create Account",
                loading = submitting,
                onClick = {
                    val validation = validateRegistration(fullName, contactNumber, email, password, confirmation)
                    if (validation != null) {
                        errorMessage = validation
                    } else if (!submitting) {
                        submitting = true
                        scope.launch {
                            try {
                                onRegister(fullName, contactNumber, email, password).onFailure { error ->
                                    val message = (error as? AuthRequestException)?.message
                                        ?: "Check your connection and try again."
                                    // Like the web form, input/duplicate-email errors stay inline.
                                    if ((error as? AuthRequestException)?.status in listOf(400, 409)) {
                                        errorMessage = message
                                    } else {
                                        toast.show("Account unavailable", message, ToastKind.ERROR)
                                    }
                                }
                            } finally {
                                submitting = false
                            }
                        }
                    }
                }
            )
        },
        header = {
            AuthHeader()
        },
        footer = {
            AuthSwitchLink("Already have an account?", "Sign in", !submitting, onNavigateToLogin)
        }
    ) {
        Text(
            "Create Account",
            fontSize = if (layout.short || layout.narrow) 26.sp else 30.sp,
            fontWeight = FontWeight.Bold,
            color = NexusColors.HeaderDarkNavy
        )
        Text("Register for your EXP client account", fontSize = 14.sp, color = NexusColors.TextSecondary)
        NexusTextField(
            value = fullName,
            onValueChange = { fullName = it; errorMessage = null },
            label = "Full name",
            placeholder = "Juan Dela Cruz",
            enabled = !submitting
        )
        NexusTextField(
            value = contactNumber,
            onValueChange = { contactNumber = it.filter(Char::isDigit).take(11); errorMessage = null },
            label = "Contact number",
            placeholder = "09123456789",
            keyboardType = KeyboardType.Phone,
            enabled = !submitting
        )
        NexusTextField(
            value = email,
            onValueChange = { email = it; errorMessage = null },
            label = "Email address",
            placeholder = "user@email.com",
            keyboardType = KeyboardType.Email,
            enabled = !submitting
        )
        NexusTextField(
            value = password,
            onValueChange = { password = it; errorMessage = null },
            label = "Password",
            isPassword = true,
            enabled = !submitting
        )
        NexusTextField(
            value = confirmation,
            onValueChange = { confirmation = it; errorMessage = null },
            label = "Confirm password",
            isPassword = true,
            enabled = !submitting
        )
        Text(
            "Use at least 12 characters.",
            color = NexusColors.TextSecondary,
            fontSize = 12.sp,
            textAlign = TextAlign.Start,
            modifier = Modifier.fillMaxWidth()
        )
        errorMessage?.let { Text(it, color = NexusColors.ErrorRed, fontSize = 13.sp) }
    }
}
