package com.nexus.app.features.auth.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nexus.app.core.theme.NexusColors
import com.nexus.app.features.auth.components.LandingHalftone
import com.nexus.app.features.auth.components.AuthPalette.Paper as LandingPaper
import com.nexus.app.features.auth.components.AuthPalette.Ink as LandingInk
import com.nexus.app.features.auth.components.AuthPalette.Muted as LandingMuted
import com.nexus.app.features.auth.components.AuthPalette.Accent as LandingAccent
import nexusmobile.shared.generated.resources.Res
import nexusmobile.shared.generated.resources.converyn_logo_wordmark
import nexusmobile.shared.generated.resources.sora_extra_bold
import org.jetbrains.compose.resources.Font
import org.jetbrains.compose.resources.painterResource

@Composable
fun LandingScreen(
    onNavigateToLogin: () -> Unit,
    onNavigateToRegister: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(LandingPaper)
            .windowInsetsPadding(WindowInsets.safeDrawing),
        contentAlignment = Alignment.TopCenter,
    ) {
        Column(
            modifier = Modifier
                .widthIn(max = 440.dp)
                .fillMaxSize()
                .padding(horizontal = 24.dp),
        ) {
            BoxWithConstraints(Modifier.weight(1f).fillMaxWidth()) {
                val viewportHeight = maxHeight
                val headingSize = (maxWidth.value / 10.6f).coerceIn(28f, 34f)
                val stackedSteps = maxWidth < 300.dp || LocalDensity.current.fontScale > 1.2f

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState())
                        .heightIn(min = viewportHeight),
                ) {
                    Spacer(Modifier.height(24.dp))
                    Image(
                        painter = painterResource(Res.drawable.converyn_logo_wordmark),
                        contentDescription = "Converyn",
                        contentScale = ContentScale.Fit,
                        modifier = Modifier.width(174.dp).height(30.dp),
                    )
                    Spacer(Modifier.height(30.dp))
                    Text(
                        text = buildAnnotatedString {
                            withStyle(SpanStyle(color = LandingInk)) { append("CREATIVE IDEAS.\n") }
                            withStyle(SpanStyle(color = NexusColors.ConverynBlue)) {
                                append("CONNECTED\nGROWTH.")
                            }
                        },
                        fontFamily = FontFamily(Font(Res.font.sora_extra_bold, FontWeight.ExtraBold)),
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = headingSize.sp,
                        lineHeight = (headingSize * 1.12f).sp,
                        letterSpacing = (-1.2).sp,
                        modifier = Modifier.semantics { heading() },
                    )
                    Spacer(Modifier.height(18.dp))
                    Text(
                        text = "Creative content, digital marketing, and web experiences built around your goals.",
                        fontSize = 15.sp,
                        lineHeight = 22.sp,
                        color = LandingMuted,
                    )
                    Spacer(Modifier.height(12.dp))
                    Spacer(Modifier.weight(1f))
                    LandingHalftone(
                        Modifier.fillMaxWidth().height((viewportHeight * 0.34f).coerceIn(180.dp, 250.dp)),
                    )
                    Spacer(Modifier.weight(1f))
                    Spacer(Modifier.height(18.dp))
                    LandingProcess(stacked = stackedSteps)
                    Spacer(Modifier.height(8.dp))
                }
            }

            LandingActions(onNavigateToLogin, onNavigateToRegister)
        }
    }
}

@Composable
private fun LandingProcess(stacked: Boolean) {
    val steps = listOf(
        Triple("01", "Discuss", "Share your idea"),
        Triple("02", "Quote", "Review your plan"),
        Triple("03", "Approve", "Bring it to life"),
    )
    Column {
        HorizontalDivider(color = LandingInk.copy(alpha = 0.18f))
        Spacer(Modifier.height(12.dp))
        if (stacked) {
            Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                steps.forEach { (number, title, description) ->
                    Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                        Text(number, color = LandingAccent, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                        Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                            Text(title, color = LandingInk, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                            Text(description, color = LandingMuted, fontSize = 12.sp)
                        }
                    }
                }
            }
        } else {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                steps.forEachIndexed { index, (number, title, description) ->
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        Text(number, color = LandingAccent, fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                            Text(title, color = LandingInk, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                            if (index < steps.lastIndex) {
                                Spacer(Modifier.weight(1f))
                                Icon(
                                    Icons.AutoMirrored.Outlined.ArrowForward,
                                    contentDescription = null,
                                    tint = LandingAccent,
                                    modifier = Modifier.padding(horizontal = 8.dp).size(16.dp),
                                )
                            }
                        }
                        Text(description, color = LandingMuted, fontSize = 11.sp, lineHeight = 15.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun LandingActions(onSignIn: () -> Unit, onCreateAccount: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(top = 22.dp, bottom = 20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Button(
            onClick = onSignIn,
            shape = RoundedCornerShape(8.dp),
            colors = ButtonDefaults.buttonColors(containerColor = NexusColors.ConverynBlue, contentColor = Color.White),
            modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp),
        ) {
            Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                Text("Sign In", fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                Icon(
                    Icons.AutoMirrored.Outlined.ArrowForward,
                    contentDescription = null,
                    modifier = Modifier.align(Alignment.CenterEnd).size(22.dp),
                )
            }
        }
        OutlinedButton(
            onClick = onCreateAccount,
            shape = RoundedCornerShape(8.dp),
            border = BorderStroke(1.dp, NexusColors.ConverynBlue),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = NexusColors.ConverynBlue),
            modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp),
        ) {
            Text("Create Account", fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}
