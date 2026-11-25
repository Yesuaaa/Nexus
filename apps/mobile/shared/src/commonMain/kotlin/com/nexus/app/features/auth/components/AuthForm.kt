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
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.error
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.*
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nexus.app.core.theme.NexusColors
import nexusmobile.shared.generated.resources.Res
import nexusmobile.shared.generated.resources.sora_extra_bold
import org.jetbrains.compose.resources.Font

@Composable
fun AuthHeading(title: String, subtitle: String) {
    val words = title.uppercase().split(' ')
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            text = buildAnnotatedString {
                append(words.dropLast(1).joinToString(" "))
                if (words.size > 1) append(" ")
                withStyle(SpanStyle(color = AuthPalette.Blue)) {
                    append(words.last())
                    append(".")
                }
            },
            color = AuthPalette.Ink,
            fontFamily = FontFamily(Font(Res.font.sora_extra_bold, FontWeight.ExtraBold)),
            fontWeight = FontWeight.ExtraBold,
            fontSize = 28.sp,
            lineHeight = 34.sp,
            letterSpacing = (-0.9).sp,
            modifier = Modifier.semantics { heading() },
        )
        Text(subtitle, fontSize = 14.sp, lineHeight = 21.sp, color = AuthPalette.Muted)
    }
}

@Composable
fun AuthTextField(
    value: String, onValueChange: (String) -> Unit, label: String,
    placeholder: String = "", modifier: Modifier = Modifier,
    isPassword: Boolean = false, keyboardType: KeyboardType = KeyboardType.Text,
    errorMessage: String? = null, enabled: Boolean = true,
    leadingIcon: ImageVector? = null, prefix: String? = null, fieldHeight: Dp = 52.dp,
) {
    var visible by remember { mutableStateOf(false) }
    var focused by remember { mutableStateOf(false) }
    val borderColor = when {
        errorMessage != null -> NexusColors.ErrorRed
        focused -> AuthPalette.Blue
        else -> AuthPalette.Border
    }
    val shape = RoundedCornerShape(8.dp)
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(label, color = AuthPalette.Ink, fontSize = 13.sp, lineHeight = 18.sp, fontWeight = FontWeight.SemiBold)
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            enabled = enabled,
            singleLine = true,
            textStyle = LocalTextStyle.current.copy(fontSize = 15.sp, color = AuthPalette.Ink),
            cursorBrush = SolidColor(AuthPalette.Blue),
            keyboardOptions = KeyboardOptions(keyboardType = if (isPassword) KeyboardType.Password else keyboardType),
            visualTransformation = if (isPassword && !visible) PasswordVisualTransformation(mask = '\u2022') else VisualTransformation.None,
            modifier = Modifier.fillMaxWidth().heightIn(min = fieldHeight)
                .background(Color.White.copy(alpha = 0.65f), shape)
                .border(BorderStroke(if (focused) 1.5.dp else 1.dp, borderColor), shape)
                .onFocusChanged { focused = it.isFocused }
                .semantics {
                    contentDescription = label
                    errorMessage?.let { error(it) }
                },
            decorationBox = { inner ->
                Row(
                    Modifier.padding(start = 16.dp, end = if (isPassword) 0.dp else 16.dp).heightIn(min = fieldHeight),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    leadingIcon?.let { Icon(it, null, Modifier.size(18.dp), tint = AuthPalette.Muted) }
                    prefix?.let {
                        Text(it, fontSize = 15.sp, color = AuthPalette.Ink)
                        Box(Modifier.width(1.dp).height(20.dp).background(AuthPalette.Border))
                    }
                    Box(Modifier.weight(1f).padding(vertical = 12.dp)) {
                        if (value.isEmpty()) {
                            Text(
                                placeholder.ifBlank { if (isPassword) "Enter your password" else "" },
                                fontSize = 15.sp,
                                color = AuthPalette.Muted,
                            )
                        }
                        inner()
                    }
                    if (isPassword) {
                        IconButton(onClick = { visible = !visible }, enabled = enabled, modifier = Modifier.size(48.dp)) {
                            Icon(
                                if (visible) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility,
                                if (visible) "Hide password" else "Show password",
                                tint = AuthPalette.Muted,
                                modifier = Modifier.size(20.dp),
                            )
                        }
                    }
                }
            },
        )
        errorMessage?.let { Text(it, color = NexusColors.ErrorRed, fontSize = 12.sp, lineHeight = 18.sp) }
    }
}

@Composable
fun AuthButton(text: String, loading: Boolean, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        enabled = !loading,
        modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp),
        shape = RoundedCornerShape(8.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = AuthPalette.Blue,
            contentColor = Color.White,
            disabledContainerColor = AuthPalette.Blue.copy(alpha = 0.5f),
        ),
    ) {
        if (loading) {
            CircularProgressIndicator(Modifier.size(20.dp), color = Color.White, strokeWidth = 2.dp)
        } else {
            Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                Text(text, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                Icon(
                    Icons.AutoMirrored.Outlined.ArrowForward,
                    contentDescription = null,
                    modifier = Modifier.align(Alignment.CenterEnd).size(22.dp),
                )
            }
        }
    }
}
