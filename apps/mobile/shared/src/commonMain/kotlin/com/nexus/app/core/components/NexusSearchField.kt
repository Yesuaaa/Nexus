package com.nexus.app.core.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nexus.app.core.theme.NexusButtonShape
import com.nexus.app.core.theme.NexusColors

@Composable
fun NexusSearchField(value: String, onValueChange: (String) -> Unit, placeholder: String, modifier: Modifier = Modifier) {
    Surface(modifier.fillMaxWidth().height(48.dp), shape = NexusButtonShape,
        color = Color.White, border = BorderStroke(1.dp, NexusColors.Border)) {
        Row(Modifier.padding(horizontal = 14.dp), verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Icon(Icons.Outlined.Search, null, Modifier.size(20.dp), tint = NexusColors.TextSecondary)
            BasicTextField(value, onValueChange, Modifier.weight(1f), singleLine = true,
                textStyle = TextStyle(fontSize = 13.sp, color = NexusColors.TextPrimary),
                cursorBrush = SolidColor(NexusColors.PrimaryBlue),
                decorationBox = { input ->
                    Box(contentAlignment = Alignment.CenterStart) {
                        if (value.isEmpty()) Text(placeholder, fontSize = 13.sp, color = NexusColors.TextSecondary,
                            maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
                        input()
                    }
                })
        }
    }
}
