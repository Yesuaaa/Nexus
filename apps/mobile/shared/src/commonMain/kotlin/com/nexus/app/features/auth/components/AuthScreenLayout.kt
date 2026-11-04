package com.nexus.app.features.auth.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.ProvideTextStyle
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import nexusmobile.shared.generated.resources.Res
import nexusmobile.shared.generated.resources.exp_logo
import nexusmobile.shared.generated.resources.inter
import org.jetbrains.compose.resources.Font
import org.jetbrains.compose.resources.painterResource

@Composable
fun AuthScreenLayout(
    modifier: Modifier = Modifier,
    registering: Boolean = false,
    header: @Composable () -> Unit = {},
    action: @Composable () -> Unit,
    content: @Composable ColumnScope.() -> Unit
) {
    ProvideTextStyle(LocalTextStyle.current.copy(fontFamily = FontFamily(Font(Res.font.inter)))) {
        BoxWithConstraints(
            modifier.fillMaxSize().background(Color.White).safeDrawingPadding().imePadding(),
            contentAlignment = Alignment.TopCenter
        ) {
            val viewportHeight = maxHeight
            val scrollState = rememberScrollState()
            Column(
                Modifier.widthIn(max = 440.dp).fillMaxWidth().verticalScroll(scrollState, enabled = scrollState.maxValue > 0)
                    .heightIn(min = viewportHeight).padding(horizontal = 23.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Box(Modifier.padding(top = 20.dp)) { header() }
                Spacer(Modifier.height(if (registering) 4.dp else
                    (viewportHeight - 706.dp).coerceIn(12.dp, 100.dp)))
                Image(painterResource(Res.drawable.exp_logo), "EXP Digital Solutions",
                    Modifier.size(240.dp, 124.dp))
                Spacer(Modifier.height(4.dp))
                Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(if (registering) 12.dp else 20.dp)) {
                    content()
                    action()
                }
                Spacer(Modifier.heightIn(min = 16.dp).weight(1f))
                Row(Modifier.fillMaxWidth().padding(bottom = 24.dp),
                    horizontalArrangement = Arrangement.spacedBy(24.dp, Alignment.CenterHorizontally)) {
                    listOf("About", "Terms of Use", "Privacy Policy").forEach {
                        Text(it, color = Color(0xFF8EA5CA), fontSize = 11.sp)
                    }
                }
            }
        }
    }
}
