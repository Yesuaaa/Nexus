package com.nexus.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.Composable
import androidx.compose.ui.tooling.preview.Preview
import com.nexus.app.navigation.DeepLinks

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)

        // Skip on recreation (rotation) so an old link isn't replayed.
        if (savedInstanceState == null) DeepLinks.offer(intent?.dataString)

        setContent {
            androidx.compose.runtime.CompositionLocalProvider(
                com.nexus.app.core.files.LocalPlatformFiles provides rememberAndroidFiles()
            ) { App() }
        }
    }

    // Link arrives while the app is already running (launchMode=singleTop).
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        DeepLinks.offer(intent.dataString)
    }
}

@Preview
@Composable
fun AppAndroidPreview() {
    App()
}