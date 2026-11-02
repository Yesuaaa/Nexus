package com.nexus.app.features.services.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Work
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nexus.app.core.components.LocalNexusLayout
import com.nexus.app.core.theme.NexusColors

@Composable
fun ServicesScreen(
    onServiceClick: (String) -> Unit = {},
    modifier: Modifier = Modifier
) {
    val layout = LocalNexusLayout.current
    val sampleServices = listOf("Admin Counselling", "Badga Special Services", "Customer Service", "Technical Support")
    LazyVerticalGrid(
        columns = GridCells.Adaptive(minSize = 160.dp),
        modifier = modifier.fillMaxSize().background(NexusColors.Background),
        contentPadding = PaddingValues(horizontal = layout.gutter, vertical = layout.gap),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item(span = { GridItemSpan(maxLineSpan) }) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Build Your Brand with EXP", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = NexusColors.HeaderDarkNavy)
                Text(
                    "Discover digital services crafted to amplify your presence and turn ideas into business impact.",
                    fontSize = 13.sp, color = NexusColors.TextSecondary, lineHeight = 18.sp
                )
                Text("STEP 1 OF 4", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = NexusColors.PrimaryBlue)
            }
        }
        item(span = { GridItemSpan(maxLineSpan) }) {
            OutlinedTextField(
                value = "", onValueChange = {}, readOnly = true,
                placeholder = { Text("Search services...", fontSize = 13.sp) },
                shape = RoundedCornerShape(10.dp),
                modifier = Modifier.fillMaxWidth()
            )
        }
        items(sampleServices.size) { index ->
            val name = sampleServices[index]
            Column(
                modifier = Modifier.fillMaxWidth().heightIn(min = 150.dp)
                    .clip(RoundedCornerShape(14.dp)).background(NexusColors.ServiceCardNavy)
                    .clickable { onServiceClick(name) }.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Icon(Icons.Default.Work, contentDescription = null, tint = Color.White)
                Text(name, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = Color.White)
                Text("Request service", fontSize = 12.sp, color = Color.White.copy(alpha = 0.85f))
            }
        }
    }
}

