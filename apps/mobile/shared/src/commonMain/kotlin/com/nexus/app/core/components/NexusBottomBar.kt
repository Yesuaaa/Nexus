package com.nexus.app.core.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nexus.app.core.theme.NexusColors
import com.nexus.app.navigation.BottomTab

@Composable
fun NexusBottomBar(
    currentTab: BottomTab,
    onTabSelected: (BottomTab) -> Unit,
    modifier: Modifier = Modifier
) {
    val layout = LocalNexusLayout.current
    Row(
        modifier = modifier
            .fillMaxWidth()
            .navigationBarsPadding()
            .background(NexusColors.Background)
            .border(width = 1.dp, color = NexusColors.Border)
            .padding(horizontal = 8.dp, vertical = if (layout.short) 4.dp else 6.dp),
        horizontalArrangement = Arrangement.SpaceAround,
        verticalAlignment = Alignment.CenterVertically
    ) {
        BottomTab.entries.forEach { tab ->
            val isSelected = tab == currentTab

            Box(
                modifier = Modifier
                    .weight(1f)
                    .heightIn(min = 48.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(if (isSelected) NexusColors.SurfaceHover else NexusColors.Background)
                    .clickable { onTabSelected(tab) }
                    .padding(horizontal = 4.dp, vertical = 6.dp),
                contentAlignment = Alignment.Center
            ) {
                if (layout.short) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Icon(tab.icon, contentDescription = null, tint = NexusColors.PrimaryBlue, modifier = Modifier.size(20.dp))
                        Text(
                            tab.label, fontSize = 11.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                            color = if (isSelected) NexusColors.ServiceCardNavy else NexusColors.TextSecondary
                        )
                    }
                } else {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Icon(
                            imageVector = tab.icon,
                            contentDescription = tab.label,
                            tint = if (isSelected) NexusColors.ServiceCardNavy else NexusColors.TextSecondary,
                            modifier = Modifier.size(22.dp)
                        )
                        Text(
                            text = tab.label,
                            fontSize = 11.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                            color = if (isSelected) NexusColors.ServiceCardNavy else NexusColors.TextSecondary
                        )
                    }
                }
            }
        }
    }
}

