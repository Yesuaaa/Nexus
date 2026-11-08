package com.nexus.app.features.auth.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material.icons.outlined.VisibilityOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.*
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun AuthHeading(title: String, subtitle: String) {
    Column(Modifier.fillMaxWidth().heightIn(min = 64.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
        Text(title, style = TextStyle(fontFamily = LocalTextStyle.current.fontFamily, fontSize = 24.sp, lineHeight = 29.sp, fontWeight = FontWeight.Bold,
            brush = Brush.horizontalGradient(0.2986f to Color(0xFF111111), 0.6635f to Color(0xFF33E2F5))))
        Text(subtitle, fontSize = 14.sp, lineHeight = 20.sp, color = Color(0xFF617DA4))
    }
}

@Composable
fun AuthTextField(
    value: String, onValueChange: (String) -> Unit, label: String,
    placeholder: String = "", modifier: Modifier = Modifier,
    isPassword: Boolean = false, keyboardType: KeyboardType = KeyboardType.Text,
    errorMessage: String? = null, enabled: Boolean = true,
    leadingIcon: ImageVector? = null, prefix: String? = null, fieldHeight: Dp = 54.dp
) {
    var visible by remember { mutableStateOf(false) }
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(label, color = Color(0xFF152E55), fontSize = 13.sp, lineHeight = 17.sp, fontWeight = FontWeight.SemiBold)
        BasicTextField(value = value, onValueChange = onValueChange, enabled = enabled, singleLine = true,
            textStyle = LocalTextStyle.current.copy(fontSize = 14.sp, color = Color(0xFF203A60)),
            keyboardOptions = KeyboardOptions(keyboardType = if (isPassword) KeyboardType.Password else keyboardType),
            visualTransformation = if (isPassword && !visible) PasswordVisualTransformation(mask = '\u2022') else VisualTransformation.None,
            modifier = Modifier.fillMaxWidth().heightIn(min = fieldHeight).background(Color.White, RoundedCornerShape(14.dp))
                .border(BorderStroke(1.dp, if (errorMessage != null) Color(0xFFDC2626) else Color(0xFFD6E1ED)), RoundedCornerShape(14.dp))
                .semantics { contentDescription = label },
            decorationBox = { inner ->
                Row(Modifier.padding(start = 16.dp, end = if (isPassword) 0.dp else 16.dp).heightIn(min = fieldHeight),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    leadingIcon?.let { Icon(it, null, Modifier.size(18.dp), tint = Color(0xFF617DA4)) }
                    prefix?.let {
                        Text(it, fontSize = 14.sp, color = Color(0xFF152E55))
                        Box(Modifier.width(1.dp).height(20.dp).background(Color(0xFFD6E1ED)))
                    }
                    Box(Modifier.weight(1f).padding(vertical = 12.dp)) {
                        if (value.isEmpty()) Text(placeholder.ifBlank { if (isPassword) "Enter your password" else "" }, fontSize = 14.sp, color = Color(0xFF8DA3BE))
                        inner()
                    }
                    if (isPassword) IconButton(onClick = { visible = !visible }, enabled = enabled, modifier = Modifier.size(44.dp)) {
                        Icon(if (visible) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility, if (visible) "Hide password" else "Show password",
                            tint = Color(0xFF617DA4), modifier = Modifier.size(18.dp))
                    }
                }
            })
        errorMessage?.let { Text(it, color = Color(0xFFDC2626), fontSize = 12.sp) }
    }
}

@Composable
fun AuthButton(text: String, loading: Boolean, onClick: () -> Unit) {
    Button(onClick = onClick, enabled = !loading, modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp), shape = RoundedCornerShape(14.dp),
        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF233D92), disabledContainerColor = Color(0xFF233D92).copy(alpha = .5f))) {
        if (loading) CircularProgressIndicator(Modifier.size(20.dp), color = Color.White, strokeWidth = 2.dp)
        else { Text(text, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.SemiBold); Spacer(Modifier.width(12.dp)); Icon(Icons.AutoMirrored.Outlined.ArrowForward, null, Modifier.size(18.dp)) }
    }
}
