package com.nexus.app.features.auth.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun AuthHeader(registering: Boolean, enabled: Boolean, onSwitch: () -> Unit) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center) {
        Text("English", fontSize = 12.sp, color = Color(0xFF143B61))
        Icon(Icons.Default.KeyboardArrowDown, contentDescription = null,
            tint = Color(0xFF93A6C3), modifier = Modifier.padding(start = 8.dp).size(16.dp))
        Spacer(Modifier.width(16.dp))
        AuthTab("Sign In", !registering, enabled, if (registering) onSwitch else ({}))
        Spacer(Modifier.width(4.dp))
        AuthTab("Register", registering, enabled, if (!registering) onSwitch else ({}))
    }
}

@Composable
private fun AuthTab(text: String, selected: Boolean, enabled: Boolean, onClick: () -> Unit) {
    OutlinedButton(onClick = onClick, enabled = enabled,
        border = BorderStroke(1.dp, if (selected) Color(0xFFE0E1EB) else Color.Transparent),
        shape = RoundedCornerShape(18.dp), contentPadding = PaddingValues(horizontal = 16.dp),
        modifier = Modifier.height(34.dp),
        colors = ButtonDefaults.outlinedButtonColors(contentColor =
            if (selected) Color(0xFF163665) else Color(0xFF6280A9))) {
        Text(text, fontSize = 14.sp)
    }
}
