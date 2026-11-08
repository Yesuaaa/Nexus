package com.nexus.app.features.auth.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** The language badge occupies the same top-right position on both auth screens. */
@Composable
fun AuthHeader() {
    Surface(color = Color.White, border = BorderStroke(1.dp, Color(0xFFDDE8F5)), shape = RoundedCornerShape(20.dp)) {
        Row(Modifier.padding(horizontal = 10.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("ENG", fontSize = 11.sp, color = Color(0xFF233D92))
            Box(Modifier.width(1.dp).height(12.dp).then(Modifier), contentAlignment = Alignment.Center) { Text("|", fontSize = 10.sp, color = Color(0xFFD6E1ED)) }
            Text("FIL", fontSize = 11.sp, color = Color(0xFF8DA3BE))
        }
    }
}
