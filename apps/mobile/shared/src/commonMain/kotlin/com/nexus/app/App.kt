package com.nexus.app

import androidx.compose.runtime.Composable
import androidx.compose.ui.tooling.preview.Preview
import com.nexus.app.core.theme.NexusTheme
import com.nexus.app.navigation.AppNavHost

@Composable
@Preview
fun App() {
    NexusTheme {
        AppNavHost()
    }
}
