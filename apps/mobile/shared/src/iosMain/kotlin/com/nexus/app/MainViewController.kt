package com.nexus.app

import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.window.ComposeUIViewController
import com.nexus.app.core.files.IosFiles
import com.nexus.app.core.files.LocalPlatformFiles

fun MainViewController() = ComposeUIViewController {
    val files = remember { IosFiles() }
    CompositionLocalProvider(LocalPlatformFiles provides files) { App() }
}
