package com.nexus.app.features.auth.components

import androidx.compose.foundation.layout.Box
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.nexus.app.core.theme.NexusColors
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.pow
import kotlin.math.sin

private data class HalftoneDot(val center: Offset, val radius: Float, val color: Color)

/** Static, decorative ribbon. Cache its geometry until the available size changes. */
@Composable
internal fun LandingHalftone(modifier: Modifier = Modifier) {
    Box(modifier.drawWithCache {
        val canvasSize = size
        val dots = buildList {
            val columns = 144
            val rows = 23
            val scale = canvasSize.width / 360f
            for (column in 0 until columns) {
                val angle = column.toFloat() / columns * (2f * PI.toFloat())
                for (row in 0..rows) {
                    val band = row.toFloat() / rows
                    val offset = (band - 0.5f) * 2f
                    val radius = 0.73f + offset * 0.24f
                    val x = cos(angle) * radius
                    val wave = sin(angle * 2f + 0.4f) * 0.13f
                    val y = sin(angle) * radius * 0.65f + wave * (1f + offset * 0.3f)
                    val edgeFade = sin(band * PI.toFloat()).coerceAtLeast(0f).pow(0.7f)
                    val light = (0.52f + sin(angle * 2f - band * 2f) * 0.35f).coerceIn(0.1f, 1f)
                    add(
                        HalftoneDot(
                            center = Offset(canvasSize.width * (0.5f + x * 0.49f), canvasSize.height * (0.5f + y * 0.59f)),
                            radius = (0.55f + edgeFade * light * 1.05f) * scale,
                            color = Color(0xFF2F5BFF).copy(alpha = (edgeFade * light).coerceIn(0f, 1f)),
                        ),
                    )
                }
            }
        }
        onDrawBehind {
            dots.forEach { drawCircle(it.color, it.radius, it.center) }
            for (index in -1..1) {
                drawCircle(
                    color = NexusColors.ConverynBlue,
                    radius = 3.6.dp.toPx(),
                    center = Offset(size.width / 2f + index * 18.dp.toPx(), size.height / 2f),
                )
            }
        }
    })
}
