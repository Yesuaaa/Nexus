package com.nexus.app.features.auth.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.ProvideTextStyle
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import nexusmobile.shared.generated.resources.Res
import nexusmobile.shared.generated.resources.converyn_logo_wordmark
import nexusmobile.shared.generated.resources.inter
import org.jetbrains.compose.resources.Font
import org.jetbrains.compose.resources.painterResource

@Composable
fun AuthScreenLayout(
    modifier: Modifier = Modifier,
    registering: Boolean = false,
    header: @Composable () -> Unit = {},
    action: @Composable () -> Unit,
    switchLink: @Composable () -> Unit = {},
    content: @Composable ColumnScope.() -> Unit,
) {
    val keyboardVisible = WindowInsets.ime.getBottom(LocalDensity.current) > 0
    ProvideTextStyle(LocalTextStyle.current.copy(fontFamily = FontFamily(Font(Res.font.inter)))) {
        BoxWithConstraints(
            modifier.fillMaxSize().background(AuthPalette.Paper)
                .windowInsetsPadding(WindowInsets.safeDrawing).imePadding(),
            contentAlignment = Alignment.TopCenter,
        ) {
            val viewport = maxHeight
            Column(
                Modifier.widthIn(max = 440.dp).fillMaxWidth()
                    .verticalScroll(rememberScrollState()).heightIn(min = viewport)
                    .padding(horizontal = 24.dp),
            ) {
                Spacer(Modifier.height(24.dp))
                Image(
                    painter = painterResource(Res.drawable.converyn_logo_wordmark),
                    contentDescription = "Converyn",
                    contentScale = ContentScale.Fit,
                    modifier = Modifier.width(174.dp).height(30.dp),
                )
                Spacer(Modifier.height(18.dp))
                header()
                Spacer(Modifier.height(24.dp))
                content()
                Spacer(Modifier.height(20.dp))
                action()
                Spacer(Modifier.height(12.dp))
                switchLink()
                Spacer(Modifier.weight(1f))
                if (!registering && !keyboardVisible) {
                    LandingHalftone(
                        Modifier.align(Alignment.CenterHorizontally).width(240.dp).height(100.dp),
                    )
                }
                Spacer(Modifier.height(24.dp))
                AuthFooter()
                Spacer(Modifier.height(20.dp))
            }
        }
    }
}

@Composable
private fun AuthFooter() {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        HorizontalDivider(color = AuthPalette.Border)
        Text(
            "Discuss  \u2022  Quote  \u2022  Approve",
            color = AuthPalette.Blue,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
        )
        FlowRow(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(20.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            listOf("About Converyn", "Terms of Use", "Privacy Policy").forEach {
                Text(it, fontSize = 11.sp, color = AuthPalette.Muted, textAlign = TextAlign.Start)
            }
        }
    }
}
