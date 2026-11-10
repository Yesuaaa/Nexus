package com.nexus.app.core.components

import com.nexus.app.core.theme.NexusButtonShape
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.KeyboardArrowDown
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.findRootCoordinates
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.*
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupPositionProvider
import androidx.compose.ui.window.PopupProperties
import com.nexus.app.core.theme.NexusColors
import kotlinx.coroutines.launch
import kotlin.math.min

/** Shared select: the popup stays below the trigger and long option lists scroll. */
@Composable
fun NexusDropdown(
    label: String,
    options: List<Pair<String, String>>,
    selectedValue: String?,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    scrollable: Boolean = true
) {
    var expanded by remember { mutableStateOf(false) }
    var anchorSize by remember { mutableStateOf(IntSize.Zero) }
    var availableHeight by remember { mutableStateOf(228.dp) }
    val density = LocalDensity.current
    val scope = rememberCoroutineScope()
    val bringIntoView = remember { BringIntoViewRequester() }
    val scroll = rememberScrollState()
    val shape = RoundedCornerShape(8.dp)
    val position = remember(density, scrollable) {
        val gap = with(density) { 4.dp.roundToPx() }
        object : PopupPositionProvider {
            override fun calculatePosition(anchorBounds: IntRect, windowSize: IntSize, layoutDirection: LayoutDirection, popupContentSize: IntSize): IntOffset {
                val left = if (layoutDirection == LayoutDirection.Ltr) anchorBounds.left else anchorBounds.right - popupContentSize.width
                val below = anchorBounds.bottom + gap
                val top = if (!scrollable && below + popupContentSize.height > windowSize.height) {
                    (anchorBounds.top - gap - popupContentSize.height).coerceAtLeast(0)
                } else below
                return IntOffset(left.coerceIn(0, (windowSize.width - popupContentSize.width).coerceAtLeast(0)), top)
            }
        }
    }
    Box(modifier.bringIntoViewRequester(bringIntoView).onGloballyPositioned {
        anchorSize = it.size
        val space = it.findRootCoordinates().size.height - it.boundsInWindow().bottom - with(density) { 8.dp.toPx() }
        availableHeight = with(density) { space.coerceAtLeast(32f).toDp() }
    }) {
        OutlinedButton(
            onClick = {
                scope.launch {
                    val menuHeight = with(density) { min(options.size, 5) * 44.dp.toPx() + 12.dp.toPx() }
                    bringIntoView.bringIntoView(Rect(0f, 0f, anchorSize.width.toFloat(), anchorSize.height + menuHeight))
                    expanded = true
                }
            },
            enabled = enabled,
            modifier = Modifier.fillMaxWidth().heightIn(min = 44.dp),
            shape = NexusButtonShape,
            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 10.dp),
            border = BorderStroke(1.dp, NexusColors.Border),
            colors = ButtonDefaults.outlinedButtonColors(containerColor = Color.White, contentColor = NexusColors.TextPrimary)
        ) {
            Text(label, Modifier.weight(1f), color = NexusColors.TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Normal, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Spacer(Modifier.width(12.dp))
            Icon(Icons.Outlined.KeyboardArrowDown, null, Modifier.size(18.dp), tint = NexusColors.TextSecondary)
        }
        if (expanded && enabled) Popup(
            popupPositionProvider = position,
            onDismissRequest = { expanded = false },
            properties = PopupProperties(focusable = true)
        ) {
            Surface(
                modifier = Modifier.width(with(density) { anchorSize.width.toDp() }),
                shape = shape,
                color = Color.White,
                border = BorderStroke(1.dp, NexusColors.Border),
                tonalElevation = 0.dp,
                shadowElevation = 6.dp
            ) {
                val menuModifier = if (scrollable) Modifier.heightIn(max = minOf(if (options.size >= 5) 220.dp else 228.dp, availableHeight)) else Modifier
                Box(menuModifier) {
                    Column(Modifier.then(if (scrollable) Modifier.verticalScroll(scroll) else Modifier).padding(vertical = 4.dp)) {
                        options.forEach { (value, text) ->
                            val selected = value == selectedValue
                            Row(
                                Modifier.fillMaxWidth().height(44.dp)
                                    .background(if (selected) NexusColors.SurfaceHover else Color.White)
                                    .selectable(selected = selected, onClick = { expanded = false; onSelect(value) })
                                    .padding(horizontal = 12.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(text, Modifier.weight(1f), color = NexusColors.TextPrimary, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                if (selected) Icon(Icons.Outlined.Check, null, Modifier.padding(start = 8.dp).size(18.dp), tint = NexusColors.TextPrimary)
                            }
                        }
                    }
                    if (scrollable && scroll.maxValue > 0) Canvas(Modifier.matchParentSize()) {
                        val inset = 4.dp.toPx()
                        val trackHeight = (size.height - inset * 2).coerceAtLeast(1f)
                        val thumbHeight = (trackHeight * size.height / (size.height + scroll.maxValue)).coerceAtLeast(20.dp.toPx()).coerceAtMost(trackHeight)
                        val top = inset + (trackHeight - thumbHeight) * scroll.value / scroll.maxValue
                        drawRoundRect(NexusColors.PrimaryBlue, Offset(size.width - 4.dp.toPx(), top), Size(2.dp.toPx(), thumbHeight), CornerRadius(2.dp.toPx()))
                    }
                }
            }
        }
    }
}
