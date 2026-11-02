package com.nexus.app.features.services.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Work
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nexus.app.core.theme.NexusColors

@Composable
fun ServicesScreen(
    onServiceClick: (String) -> Unit = {},
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .background(NexusColors.Background)
            .padding(horizontal = 20.dp, vertical = 12.dp)
    ) {
        Text(
            text = "Build Your Brand with EXP",
            fontSize = 22.sp,
            fontWeight = FontWeight.Bold,
            color = NexusColors.HeaderDarkNavy
        )

        Text(
            text = "Discover powerful digital services crafted to amplify your presence, connect with your audience, and turn ideas into real business impact.",
            fontSize = 13.sp,
            color = NexusColors.TextSecondary,
            lineHeight = 18.sp,
            modifier = Modifier.padding(top = 8.dp, bottom = 12.dp)
        )

        // Step indicator
        Column(modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp)) {
            Text(
                text = "STEP 1 OF 4",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = NexusColors.ServiceCardNavy,
                modifier = Modifier.padding(bottom = 4.dp)
            )
            Box(
                modifier = Modifier
                    .fillMaxWidth(0.25f)
                    .height(3.dp)
                    .background(NexusColors.ServiceCardNavy)
            )
            HorizontalDivider(color = NexusColors.Border, thickness = 1.dp)
        }

        // Search Bar Placeholder
        OutlinedTextField(
            value = "",
            onValueChange = {},
            readOnly = true,
            placeholder = { Text("Search services...", color = NexusColors.TextMuted, fontSize = 13.sp) },
            shape = RoundedCornerShape(10.dp),
            colors = OutlinedTextFieldDefaults.colors(
                unfocusedBorderColor = NexusColors.Border,
                unfocusedContainerColor = NexusColors.Background
            ),
            modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp)
        )

        // Services Preview Grid (Figma exact preview)
        val sampleServices = listOf(
            "Admin Counselling",
            "Badga Special Services",
            "Customer Service",
            "Technical Support"
        )

        LazyVerticalGrid(
            columns = GridCells.Fixed(2),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier.fillMaxSize()
        ) {
            items(sampleServices.size) { index ->
                val name = sampleServices[index]
                ServiceGridCard(
                    title = name,
                    onClick = { onServiceClick(name) }
                )
            }
        }
    }
}

@Composable
private fun ServiceGridCard(
    title: String,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(170.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(NexusColors.ServiceCardNavy)
            .clickable(onClick = onClick)
            .padding(14.dp)
    ) {
        Column(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(Color.White.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Work,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(20.dp)
                )
            }

            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = title,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                    lineHeight = 18.sp
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Request service",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Medium,
                        color = Color.White.copy(alpha = 0.85f)
                    )
                    Box(
                        modifier = Modifier
                            .size(24.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color.White.copy(alpha = 0.2f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Add,
                            contentDescription = "Select",
                            tint = Color.White,
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }
            }
        }
    }
}

