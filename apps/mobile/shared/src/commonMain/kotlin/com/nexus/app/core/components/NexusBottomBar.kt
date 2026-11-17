package com.nexus.app.core.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nexus.app.core.theme.NexusColors
import com.nexus.app.navigation.BottomTab

val LocalNexusBottomPadding = staticCompositionLocalOf { 0.dp }

@Composable
fun NexusBottomBar(
    currentTab: BottomTab?,
    onTabSelected: (BottomTab) -> Unit,
    modifier: Modifier = Modifier,
    conversationStyle: Boolean = false
) {
    if (conversationStyle) {
        Column(modifier.fillMaxWidth().background(Color.White).navigationBarsPadding()) {
            HorizontalDivider(color = Color(0xFFECEEF1))
            Row(Modifier.fillMaxWidth().padding(vertical = 10.dp), horizontalArrangement = Arrangement.SpaceAround) {
                BottomTab.entries.forEach { tab ->
                    Column(
                        Modifier.weight(1f).heightIn(min = 44.dp).clickable { onTabSelected(tab) },
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Icon(tab.icon, null, Modifier.size(20.dp), tint = NexusColors.TextSecondary)
                        Text(
                            tab.label,
                            textAlign = TextAlign.Center,
                            maxLines = 1,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Normal,
                            color = NexusColors.TextSecondary
                        )
                    }
                }
            }
        }
        return
    }

    val layout = LocalNexusLayout.current
    val activePillColor = Color(0xFF2C4C9B)
    val inactiveColor = Color(0xFF64748B)

    Box(
        modifier = modifier
            .background(Color.Transparent)
            .fillMaxWidth()
            .navigationBarsPadding()
            .padding(horizontal = 16.dp, vertical = if (layout.short) 6.dp else 10.dp),
        contentAlignment = Alignment.Center
    ) {
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(28.dp),
            color = Color.White,
            shadowElevation = 8.dp,
            border = BorderStroke(1.dp, Color(0xFFECEEF1))
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 6.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.SpaceAround,
                verticalAlignment = Alignment.CenterVertically
            ) {
                BottomTab.entries.forEach { tab ->
                    val isSelected = tab == currentTab

                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(20.dp))
                            .background(if (isSelected) activePillColor else Color.Transparent)
                            .clickable(
                                interactionSource = remember { MutableInteractionSource() },
                                indication = null
                            ) { onTabSelected(tab) }
                            .padding(vertical = if (layout.short) 6.dp else 8.dp, horizontal = 2.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(3.dp)
                        ) {
                            Icon(
                                imageVector = tab.icon,
                                contentDescription = tab.label,
                                tint = if (isSelected) Color.White else inactiveColor,
                                modifier = Modifier.size(20.dp)
                            )
                            Text(
                                text = tab.label,
                                textAlign = TextAlign.Center,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                fontSize = if (layout.narrow) 10.sp else 11.sp,
                                fontWeight = if (isSelected) FontWeight.Medium else FontWeight.Normal,
                                color = if (isSelected) Color.White else inactiveColor
                            )
                        }
                    }
                }
            }
        }
    }
}
