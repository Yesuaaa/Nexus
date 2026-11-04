package com.nexus.app.features.auth.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.*
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun AuthHeading(title: String, subtitle: String) {
    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(title, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center,
            style = TextStyle(fontFamily = LocalTextStyle.current.fontFamily, fontSize = 24.sp, lineHeight = 29.sp, fontWeight = FontWeight.Bold,
                brush = Brush.horizontalGradient(0.2986f to Color(0xFF111111),
                    0.6635f to Color(0xFF33E2F5))))
        Text(subtitle, fontSize = 14.sp, color = Color(0xFF6583AC),
            textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
    }
}

@Composable
fun AuthTextField(
    value: String, onValueChange: (String) -> Unit, label: String,
    placeholder: String = "", modifier: Modifier = Modifier,
    isPassword: Boolean = false, keyboardType: KeyboardType = KeyboardType.Text,
    errorMessage: String? = null,
    enabled: Boolean = true
) {
    var visible by remember { mutableStateOf(false) }
    Column(modifier.fillMaxWidth()) {
        Text(label, color = Color(0xFF061324), fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(bottom = 10.dp))
        BasicTextField(value = value, onValueChange = onValueChange, enabled = enabled,
            singleLine = true, textStyle = LocalTextStyle.current.copy(fontSize = 14.sp, color = Color(0xFF203A60)),
            keyboardOptions = KeyboardOptions(keyboardType =
                if (isPassword) KeyboardType.Password else keyboardType),
            visualTransformation = if (isPassword && !visible) PasswordVisualTransformation(mask = '\u2022')
                else VisualTransformation.None,
            modifier = Modifier.fillMaxWidth().semantics { contentDescription = label }.heightIn(min = 46.dp)
                .border(BorderStroke(1.dp, if (errorMessage != null) Color(0xFFDC2626) else Color(0xFFDDE5F1)), RoundedCornerShape(12.dp)),
            decorationBox = { inner ->
                Row(Modifier.padding(start = 16.dp, end = if (isPassword) 0.dp else 16.dp),
                    verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.weight(1f).padding(vertical = 12.dp)) {
                        if (value.isEmpty()) Text(if (isPassword) "\u2022".repeat(8) else placeholder,
                            fontSize = 14.sp, color = Color(0xFF8DA3C8))
                        inner()
                    }
                    if (isPassword) IconButton(onClick = { visible = !visible }, enabled = enabled,
                        modifier = Modifier.size(44.dp)) {
                        Icon(if (visible) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                            if (visible) "Hide password" else "Show password",
                            tint = Color(0xFF93A7C6), modifier = Modifier.size(18.dp))
                    }
                }
            })
        errorMessage?.let {
            Text(it, color = Color(0xFFDC2626), fontSize = 12.sp,
                modifier = Modifier.padding(top = 4.dp))
        }
    }
}

@Composable
fun AuthButton(text: String, loading: Boolean, onClick: () -> Unit) {
    Button(onClick = onClick, enabled = !loading,
        modifier = Modifier.fillMaxWidth().heightIn(min = 44.dp),
        shape = RoundedCornerShape(6.dp),
        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF233D92),
            disabledContainerColor = Color(0xFF233D92).copy(alpha = 0.5f))) {
        if (loading) CircularProgressIndicator(Modifier.size(20.dp), color = Color.White,
            strokeWidth = 2.dp)
        else Text(text, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
    }
}
