package com.nexus.app.features.help.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.ExpandMore
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nexus.app.core.components.LocalNexusBottomPadding
import com.nexus.app.core.components.NexusSearchField
import com.nexus.app.core.components.NexusButton
import com.nexus.app.core.components.StatusBadge
import com.nexus.app.core.theme.NexusColors
import com.nexus.app.features.help.model.FaqGroup
import com.nexus.app.features.help.model.FaqQuestion
import com.nexus.app.features.help.model.filterFaqGroups
import com.nexus.app.features.help.model.helpFaqGroups

@Composable
fun HelpScreen(
    onOpenMessages: () -> Unit = {},
    onEmailSupport: ((String) -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    val uriHandler = LocalUriHandler.current
    var search by rememberSaveable { mutableStateOf("") }
    var openQuestion by rememberSaveable {
        mutableStateOf<String?>(helpFaqGroups.firstOrNull()?.questions?.firstOrNull()?.title)
    }
    val groups = remember(search) { filterFaqGroups(search) }

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(NexusColors.SurfaceLight),
        contentPadding = PaddingValues(
            start = 20.dp, end = 20.dp, top = 20.dp,
            bottom = 20.dp + LocalNexusBottomPadding.current,
        ),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item {
            Text(
                text = "Find answers about booking services and tracking your requests.",
                fontSize = 13.sp,
                lineHeight = 20.sp,
                color = NexusColors.TextSecondary,
            )
        }

        item {
            NexusSearchField(
                value = search,
                onValueChange = { search = it },
                placeholder = "Search questions…",
                modifier = Modifier.height(44.dp),
            )
        }

        if (groups.isEmpty()) {
            item {
                HelpSearchEmptyState(query = search.trim())
            }
        } else {
            groups.forEach { group ->
                item(key = "group-${group.title}") {
                    FaqGroupSection(
                        group = group,
                        openQuestion = openQuestion,
                        onToggleQuestion = { title ->
                            openQuestion = if (openQuestion == title) null else title
                        },
                    )
                }
            }
        }

        item {
            SupportBookingCard(
                onOpenMessages = onOpenMessages,
                onEmailClick = {
                    val email = "support@exp.test"
                    if (onEmailSupport != null) {
                        onEmailSupport(email)
                    } else {
                        runCatching { uriHandler.openUri("mailto:$email") }
                    }
                },
            )
        }
    }
}

@Composable
private fun FaqGroupSection(
    group: FaqGroup,
    openQuestion: String?,
    onToggleQuestion: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(
            text = group.title,
            fontSize = 16.sp,
            fontWeight = FontWeight.SemiBold,
            color = NexusColors.HeaderDarkNavy,
        )
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(8.dp),
            color = Color.White,
            border = BorderStroke(1.dp, NexusColors.Border),
        ) {
            Column(modifier = Modifier.fillMaxWidth()) {
                group.questions.forEachIndexed { index, question ->
                    val expanded = openQuestion == question.title
                    FaqAccordionItem(
                        question = question,
                        expanded = expanded,
                        onToggle = { onToggleQuestion(question.title) },
                    )
                    if (index < group.questions.lastIndex) {
                        HorizontalDivider(color = NexusColors.Border)
                    }
                }
            }
        }
    }
}

@Composable
private fun FaqAccordionItem(
    question: FaqQuestion,
    expanded: Boolean,
    onToggle: () -> Unit,
) {
    val easing = CubicBezierEasing(0f, 0f, .58f, 1f)
    val chevronRotation by animateFloatAsState(
        targetValue = if (expanded) 180f else 0f,
        animationSpec = tween(durationMillis = 200, easing = easing),
        label = "FAQ chevron rotation",
    )
    Column(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable(role = Role.Button, onClick = onToggle)
                .semantics { stateDescription = if (expanded) "Expanded" else "Collapsed" }
                .padding(horizontal = 16.dp, vertical = 14.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = question.title,
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                color = NexusColors.TextPrimary,
                modifier = Modifier.weight(1f).padding(end = 12.dp),
            )
            Icon(
                imageVector = Icons.Outlined.ExpandMore,
                contentDescription = if (expanded) "Collapse ${question.title}" else "Expand ${question.title}",
                tint = NexusColors.TextSecondary,
                modifier = Modifier.size(20.dp).rotate(chevronRotation),
            )
        }
        AnimatedVisibility(
            visible = expanded,
            enter = expandVertically(
                animationSpec = tween(durationMillis = 200, easing = easing),
                expandFrom = Alignment.Top,
            ),
            exit = shrinkVertically(
                animationSpec = tween(durationMillis = 200, easing = easing),
                shrinkTowards = Alignment.Top,
            ),
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(start = 16.dp, end = 16.dp, bottom = 16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                when {
                    question.statuses.isNotEmpty() -> {
                        question.statuses.forEachIndexed { idx, status ->
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                modifier = Modifier.fillMaxWidth(),
                            ) {
                                StatusBadge(status = status)
                                Text(
                                    text = question.answers.getOrElse(idx) { "" },
                                    fontSize = 13.sp,
                                    lineHeight = 20.sp,
                                    color = NexusColors.TextSecondary,
                                    modifier = Modifier.weight(1f),
                                )
                            }
                        }
                    }
                    question.isOrderedSteps -> {
                        question.answers.forEachIndexed { idx, step ->
                            Row(
                                verticalAlignment = Alignment.Top,
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                                modifier = Modifier.fillMaxWidth(),
                            ) {
                                Text(
                                    text = "${idx + 1}.",
                                    fontSize = 13.sp,
                                    lineHeight = 20.sp,
                                    fontWeight = FontWeight.Medium,
                                    color = NexusColors.TextSecondary,
                                )
                                Text(
                                    text = step,
                                    fontSize = 13.sp,
                                    lineHeight = 20.sp,
                                    color = NexusColors.TextSecondary,
                                    modifier = Modifier.weight(1f),
                                )
                            }
                        }
                    }
                    else -> {
                        question.answers.forEach { paragraph ->
                            Text(
                                text = paragraph,
                                fontSize = 13.sp,
                                lineHeight = 20.sp,
                                color = NexusColors.TextSecondary,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun HelpSearchEmptyState(query: String) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(8.dp),
        color = Color.White,
        border = BorderStroke(1.dp, NexusColors.Border),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .background(Color(0xFFF1F4F7), CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = Icons.Outlined.Search,
                    contentDescription = null,
                    tint = Color(0xFF738096),
                    modifier = Modifier.size(18.dp),
                )
            }
            Text(
                text = buildAnnotatedString {
                    append("No results for ")
                    withStyle(SpanStyle(fontWeight = FontWeight.SemiBold, color = NexusColors.TextPrimary)) {
                        append("“$query”")
                    }
                    append(" found.")
                },
                fontSize = 13.sp,
                color = NexusColors.TextSecondary,
                textAlign = TextAlign.Center,
            )
        }
    }
}

@Composable
private fun SupportBookingCard(
    onOpenMessages: () -> Unit,
    onEmailClick: () -> Unit,
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(8.dp),
        color = Color.White,
        border = BorderStroke(1.dp, NexusColors.Border),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Icon(
                    imageVector = Icons.Outlined.ChatBubbleOutline,
                    contentDescription = null,
                    tint = NexusColors.PrimaryBlue,
                    modifier = Modifier.size(20.dp),
                )
                Text(
                    text = "Need help with a booking?",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = NexusColors.HeaderDarkNavy,
                )
            }
            Text(
                text = "Open your booking conversation to ask the team a question or follow up on an update.",
                fontSize = 13.sp,
                lineHeight = 20.sp,
                color = NexusColors.TextSecondary,
            )
            NexusButton(
                text = "Open messages",
                onClick = onOpenMessages,
                modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
            )
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Text(
                    text = "Or email us at",
                    fontSize = 13.sp,
                    color = NexusColors.TextSecondary,
                )
                Text(
                    text = "support@exp.test",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium,
                    color = NexusColors.PrimaryBlue,
                    textDecoration = TextDecoration.Underline,
                    modifier = Modifier.clickable(role = Role.Button, onClick = onEmailClick),
                )
            }
        }
    }
}
