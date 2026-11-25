package com.nexus.app.features.auth.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nexus.app.core.theme.NexusButtonShape
import com.nexus.app.core.theme.NexusColors
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import nexusmobile.shared.generated.resources.Res
import nexusmobile.shared.generated.resources.converyn_logo_wordmark
import org.jetbrains.compose.resources.painterResource

/**
 * Animated Converyn app-open splash screen.
 * Mirrors the web ConverynLogoReveal choreography: staggered 3-dot entrance,
 * smooth wordmark reveal, and brief brand hold before handing off to navigation.
 */
@Composable
fun ConverynSplashScreen(
    restorationError: String? = null,
    onRetry: () -> Unit = {},
    skipAnimation: Boolean = false,
    onAnimationFinished: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    val dotScales = remember { List(3) { Animatable(if (skipAnimation) 1f else 0.55f) } }
    val dotAlphas = remember { List(3) { Animatable(if (skipAnimation) 1f else 0f) } }
    val logoAlpha = remember { Animatable(if (skipAnimation) 1f else 0f) }
    val logoScale = remember { Animatable(if (skipAnimation) 1f else 0.90f) }
    val logoOffsetY = remember { Animatable(if (skipAnimation) 0f else 20f) }
    val taglineAlpha = remember { Animatable(if (skipAnimation) 1f else 0f) }

    LaunchedEffect(skipAnimation) {
        if (skipAnimation) {
            onAnimationFinished()
            return@LaunchedEffect
        }
        // Stage 1: Staggered 3-dot brand pop-in
        dotScales.indices.forEach { index ->
            launch {
                delay(index * 110L)
                launch {
                    dotAlphas[index].animateTo(
                        targetValue = 1f,
                        animationSpec = tween(durationMillis = 260, easing = FastOutSlowInEasing),
                    )
                }
                dotScales[index].animateTo(
                    targetValue = 1f,
                    animationSpec = tween(durationMillis = 300, easing = FastOutSlowInEasing),
                )
            }
        }

        // Stage 2: Converyn wordmark smooth reveal
        delay(320L)
        launch {
            logoAlpha.animateTo(
                targetValue = 1f,
                animationSpec = tween(durationMillis = 560, easing = FastOutSlowInEasing),
            )
        }
        launch {
            logoScale.animateTo(
                targetValue = 1f,
                animationSpec = tween(durationMillis = 580, easing = FastOutSlowInEasing),
            )
        }
        logoOffsetY.animateTo(
            targetValue = 0f,
            animationSpec = tween(durationMillis = 580, easing = FastOutSlowInEasing),
        )

        // Stage 3: Tagline fade-in and short settle
        taglineAlpha.animateTo(
            targetValue = 1f,
            animationSpec = tween(durationMillis = 280, easing = FastOutSlowInEasing),
        )
        delay(260L)
        onAnimationFinished()
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(Color(0xFFF4F8FD), Color.White, Color(0xFFF8FBFE)),
                ),
            ),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                dotScales.indices.forEach { index ->
                    Box(
                        modifier = Modifier
                            .size(8.dp)
                            .graphicsLayer {
                                scaleX = dotScales[index].value
                                scaleY = dotScales[index].value
                                alpha = dotAlphas[index].value
                            }
                            .background(NexusColors.ConverynBlue, CircleShape),
                    )
                }
            }

            Spacer(Modifier.height(18.dp))

            Image(
                painter = painterResource(Res.drawable.converyn_logo_wordmark),
                contentDescription = "Converyn",
                contentScale = ContentScale.Fit,
                modifier = Modifier
                    .width(210.dp)
                    .height(48.dp)
                    .graphicsLayer {
                        alpha = logoAlpha.value
                        scaleX = logoScale.value
                        scaleY = logoScale.value
                        translationY = logoOffsetY.value
                    },
            )

            Spacer(Modifier.height(12.dp))

            Text(
                text = "DISCUSS  \u2022  QUOTE  \u2022  APPROVE",
                fontSize = 11.sp,
                fontWeight = FontWeight.Medium,
                letterSpacing = 1.4.sp,
                color = NexusColors.TextSecondary,
                modifier = Modifier.alpha(taglineAlpha.value),
            )

            if (restorationError != null) {
                Spacer(Modifier.height(28.dp))
                Text(
                    text = restorationError,
                    color = NexusColors.TextSecondary,
                    fontSize = 13.sp,
                    textAlign = TextAlign.Center,
                )
                Spacer(Modifier.height(14.dp))
                Button(
                    shape = NexusButtonShape,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = NexusColors.ConverynBlue,
                        contentColor = Color.White,
                    ),
                    onClick = onRetry,
                ) {
                    Text("Retry")
                }
            }
        }
    }
}
