package com.nexus.app

import androidx.compose.runtime.Composable
import androidx.compose.ui.tooling.preview.Preview
import com.nexus.app.core.components.NexusFeedback
import com.nexus.app.core.components.NexusResponsive
import com.nexus.app.core.di.appModule
import com.nexus.app.core.theme.NexusTheme
import com.nexus.app.navigation.AppNavHost
import org.koin.compose.KoinApplication

@Composable
@Preview
fun App() {
    KoinApplication(application = { modules(appModule) }) {
        NexusTheme {
            NexusResponsive {
                NexusFeedback { AppNavHost() }
            }
        }
    }
}