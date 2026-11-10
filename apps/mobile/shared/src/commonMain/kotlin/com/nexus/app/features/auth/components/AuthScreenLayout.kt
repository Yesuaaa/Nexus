package com.nexus.app.features.auth.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.HeadsetMic
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import nexusmobile.shared.generated.resources.*
import org.jetbrains.compose.resources.Font
import org.jetbrains.compose.resources.painterResource

@Composable
fun AuthScreenLayout(
    modifier: Modifier = Modifier,
    registering: Boolean = false,
    header: @Composable () -> Unit = {},
    action: @Composable () -> Unit,
    switchLink: @Composable () -> Unit = {},
    content: @Composable ColumnScope.() -> Unit
) {
    val background = if (registering) Color(0xFFEFF5FA) else Color(0xFFF8FBFE)
    ProvideTextStyle(LocalTextStyle.current.copy(fontFamily = FontFamily(Font(Res.font.inter)))) {
        BoxWithConstraints(modifier.fillMaxSize().background(background).imePadding(), contentAlignment = Alignment.TopCenter) {
            val viewport = maxHeight
            if (registering) {
                Column(Modifier.widthIn(max = 440.dp).fillMaxWidth().verticalScroll(rememberScrollState()).heightIn(min = viewport)) {
                    AuthMainContent(registering, header, action, switchLink, content)
                    Spacer(Modifier.heightIn(min = 50.dp).weight(1f))
                    AuthLegalLinks(Modifier.padding(horizontal = 28.dp))
                    Spacer(Modifier.height(14.dp))
                }
            } else {
                Column(Modifier.widthIn(max = 440.dp).fillMaxWidth().fillMaxHeight()) {
                    Column(Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState())) {
                        AuthMainContent(registering, header, action, switchLink, content)
                    }
                    val keyboardVisible = WindowInsets.ime.getBottom(androidx.compose.ui.platform.LocalDensity.current) > 0
                    if (keyboardVisible) AuthLegalLinks(Modifier.padding(horizontal = 28.dp, vertical = 12.dp))
                    else LoginSupportFooter()
                }
            }
        }
    }
}

@Composable
private fun AuthMainContent(
    registering: Boolean,
    header: @Composable () -> Unit,
    action: @Composable () -> Unit,
    switchLink: @Composable () -> Unit,
    content: @Composable ColumnScope.() -> Unit
) {
    Column(Modifier.fillMaxWidth()) {
        BoxWithConstraints(Modifier.fillMaxWidth().height(if (registering) 157.dp else 184.dp).clipToBounds()) {
            val photoSize = if (registering) 160.dp else 158.dp
            val orbitSize = if (registering) 196.dp else 204.dp
            Box(Modifier.offset(x = maxWidth - if (registering) 133.dp else 163.dp, y = if (registering) (-59).dp else (-42).dp)
                .size(orbitSize).border(1.dp, Color(0xFFDDE8F5).copy(alpha = if (registering) 1f else .35f), CircleShape))
            Box(Modifier.offset(x = maxWidth - if (registering) 115.dp else 150.dp, y = if (registering) (-41).dp else (-29).dp)
                .size(if (registering) 160.dp else 178.dp).background(Color(0xFFD9F3F6).copy(alpha = if (registering) .65f else .18f), CircleShape))
            if (!registering) Image(painterResource(Res.drawable.auth_administration), "Administrative work", contentScale = ContentScale.Crop,
                modifier = Modifier.offset(x = maxWidth - 140.dp, y = (-19).dp).size(photoSize).clip(CircleShape))
            Box(Modifier.offset(x = if (registering) 28.dp else 22.dp, y = if (registering) 36.dp else 51.dp)) { AuthBrand() }
            Text("DIGITAL SOLUTIONS", Modifier.offset(x = 28.dp, y = if (registering) 105.dp else 124.dp), fontSize = 11.sp, letterSpacing = .7.sp, color = Color(0xFF61748D))
            Box(Modifier.offset(x = maxWidth - if (registering) 115.dp else 162.dp, y = if (registering) 122.dp else 111.dp)
                .size(if (registering) 7.dp else 9.dp).background(Color(0xFF28C9E0).copy(alpha = .5f), CircleShape))
            Box(Modifier.align(Alignment.TopEnd).padding(top = if (registering) 22.dp else 16.dp, end = if (registering) 52.dp else 80.dp)) { header() }
        }
        Column(Modifier.fillMaxWidth().padding(horizontal = 28.dp)) {
            content()
            Spacer(Modifier.height(if (registering) 20.dp else 22.dp))
            action()
            Spacer(Modifier.height(if (registering) 18.dp else 22.dp))
            switchLink()
        }
    }
}

@Composable
private fun AuthBrand() {
    // Render the supplied EXP bitmap in the exported logo's crop, without changing the asset.
    Box(Modifier.size(134.dp, 69.dp).clipToBounds()) {
        Image(painterResource(Res.drawable.exp_logo), "EXP", modifier = Modifier.offset(x = (-25).dp, y = (-58).dp)
            .wrapContentSize(Alignment.TopStart, unbounded = true).requiredSize(184.dp), contentScale = ContentScale.FillBounds)
    }
}

@Composable
private fun LoginSupportFooter() {
    BoxWithConstraints(Modifier.fillMaxWidth().height(178.dp).clipToBounds()) {
        Box(Modifier.offset(x = (-50).dp, y = (-6).dp).size(172.dp).border(1.dp, Color(0xFFDDE8F5).copy(alpha = .6f), CircleShape))
        Box(Modifier.offset(x = (-38).dp, y = 6.dp).size(148.dp).background(Color(0xFFD9F3F6).copy(alpha = .25f), CircleShape))
        Image(painterResource(Res.drawable.auth_support), "Customer support at work", contentScale = ContentScale.Crop,
            modifier = Modifier.offset(x = (-29).dp, y = 15.dp).size(130.dp).clip(CircleShape))
        Column(Modifier.offset(x = 130.dp, y = 20.dp).widthIn(max = 209.dp).padding(end = 16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Icon(Icons.Outlined.HeadsetMic, null, Modifier.size(14.dp), tint = Color(0xFF233D92))
                Text("Customer Service", fontSize = 11.sp, color = Color(0xFF233D92))
            }
            Text("Support for your\nnext big step.", fontSize = 18.sp, lineHeight = 25.sp, fontWeight = FontWeight.SemiBold, color = Color(0xFF152E55))
            Text("Service imagery for illustration.", fontSize = 9.sp, color = Color(0xFF8CA0BB))
        }
        AuthLegalLinks(Modifier.align(Alignment.BottomCenter).padding(horizontal = 28.dp, vertical = 12.dp))
    }
}

@Composable
private fun AuthLegalLinks(modifier: Modifier = Modifier) {
    Row(modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        listOf("About EXP", "Terms of Use", "Privacy Policy").forEach { Text(it, fontSize = 10.sp, color = Color(0xFF617DA4)) }
    }
}
