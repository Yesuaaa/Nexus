package com.nexus.app.features.auth.screens

import com.nexus.app.core.components.NexusDialogButton
import com.nexus.app.core.components.NexusAlertDialog
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.MailOutline
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nexus.app.core.components.LocalNexusToast
import com.nexus.app.core.theme.NexusColors
import com.nexus.app.features.auth.components.*
import com.nexus.app.features.auth.model.AuthUser
import com.nexus.app.features.auth.viewmodel.AuthViewModel
import org.koin.compose.viewmodel.koinViewModel

@Composable
fun LoginScreen(onLoggedIn: (AuthUser) -> Unit, onNavigateToRegister: () -> Unit = {}, sessionNotice: String? = null,
    modifier: Modifier = Modifier, viewModel: AuthViewModel = koinViewModel()) {
    val state by viewModel.state.collectAsState()
    val toast = LocalNexusToast.current
    var submitted by rememberSaveable { mutableStateOf(false) }
    var recovery by rememberSaveable { mutableStateOf(false) }
    LaunchedEffect(viewModel) { viewModel.toasts.collect { toast.show(it.title, it.message, it.kind) } }
    AuthScreenLayout(modifier = modifier, registering = false,
        header = { AuthHeader() },
        action = {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.CenterEnd) {
                    Text("Forgot password?", Modifier.clickable(enabled = !state.submitting) { recovery = true }, fontSize = 12.sp,
                        lineHeight = 18.sp, fontWeight = FontWeight.SemiBold, color = Color(0xFF233D92))
                }
                AuthButton(if (state.offline) "Retry" else "Sign In", state.submitting) { submitted = true; viewModel.submit { user -> submitted = false; onLoggedIn(user) } }
            }
        },
        switchLink = { AuthSwitchLink("New to EXP?", "Create an account", !state.submitting, onNavigateToRegister) }
    ) {
        AuthHeading("Welcome Back", "Sign in to your EXP account.")
        Spacer(Modifier.height(22.dp))
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            AuthTextField(state.email, viewModel::onEmailChange, "Email address", "you@example.com", keyboardType = KeyboardType.Email,
                errorMessage = if (submitted && !state.success && state.email.isBlank()) "Email address is required." else null,
                enabled = !state.submitting, leadingIcon = Icons.Outlined.MailOutline)
            AuthTextField(state.password, viewModel::onPasswordChange, "Password", "Enter your password", isPassword = true,
                errorMessage = if (submitted && !state.success && state.password.isBlank()) "Password is required." else null,
                enabled = !state.submitting, leadingIcon = Icons.Outlined.Lock)
        }
        if (!state.success && !state.offline && state.email.isNotBlank() && state.password.isNotBlank()) state.error?.let { Text(it, Modifier.padding(top = 8.dp), color = NexusColors.ErrorRed, fontSize = 13.sp) }
        sessionNotice?.let { Text(it, Modifier.padding(top = 8.dp), color = NexusColors.TextSecondary, fontSize = 13.sp) }
    }
    if (recovery) NexusAlertDialog(onDismissRequest = { recovery = false }, title = { Text("Forgot your password?") },
        text = { Text("Please contact EXP Digital Solutions support for help recovering your account.") },
        confirmButton = { NexusDialogButton(onClick = { recovery = false }) { Text("Close") } })
}
