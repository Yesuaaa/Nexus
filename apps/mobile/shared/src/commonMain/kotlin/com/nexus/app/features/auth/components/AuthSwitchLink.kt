package com.nexus.app.features.auth.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun AuthSwitchLink(prompt: String, action: String, enabled: Boolean, onClick: () -> Unit) {
    Text(buildAnnotatedString { append(prompt); append(" "); withStyle(SpanStyle(color = Color(0xFF233D92), fontWeight = FontWeight.SemiBold)) { append(action) } },
        modifier = Modifier.fillMaxWidth().heightIn(min = 20.dp).clickable(enabled = enabled, onClick = onClick),
        fontSize = 13.sp, lineHeight = 20.sp, textAlign = TextAlign.Center, color = Color(0xFF617DA4))
}
