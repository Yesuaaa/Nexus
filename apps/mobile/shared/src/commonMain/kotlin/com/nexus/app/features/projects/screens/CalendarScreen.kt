package com.nexus.app.features.projects.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ChevronLeft
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nexus.app.core.components.NexusButton
import com.nexus.app.core.components.NexusNavIcons
import com.nexus.app.core.theme.NexusColors
import com.nexus.app.features.projects.model.*
import com.nexus.app.features.projects.viewmodel.ProjectsViewModel
import kotlinx.datetime.*
import org.koin.compose.viewmodel.koinViewModel

private val monthNames = listOf("January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December")
private val dayNames = listOf("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
private fun eventColor(type: String): Color = when (type) {
    "meeting" -> NexusColors.AccentCyan
    "milestone" -> Color(0xFFE59A28)
    else -> NexusColors.PrimaryBlue
}

@Composable
fun CalendarScreen(onBooking: () -> Unit, onEvent: (CalendarEvent) -> Unit, viewModel: ProjectsViewModel = koinViewModel()) {
    val state by viewModel.state.collectAsState()
    val today = Clock.System.now().toLocalDateTime(PhilippineTime).date
    var selectedValue by rememberSaveable { mutableStateOf(today.toString()) }
    var monthValue by rememberSaveable { mutableStateOf(LocalDate(today.year, today.monthNumber, 1).toString()) }
    val selected = LocalDate.parse(selectedValue)
    val month = LocalDate.parse(monthValue)
    val firstCell = month.minus(DatePeriod(days = month.dayOfWeek.isoDayNumber % 7))
    val nextMonth = month.plus(DatePeriod(months = 1))
    val cellCount = ((month.dayOfWeek.isoDayNumber % 7 + month.daysUntil(nextMonth) + 6) / 7) * 7
    val dates = (0 until cellCount).map { firstCell.plus(DatePeriod(days = it)) }
    val byDate = remember(state.events) { state.events.sortedBy { it.startsAt }.groupBy { calendarDate(it.startsAt) } }
    val selectedEvents = byDate[selected].orEmpty()
    val monthEvents = state.events.filter { calendarDate(it.startsAt).let { date -> date.year == month.year && date.monthNumber == month.monthNumber } }.sortedBy { it.startsAt }
    val upcoming = state.events.filter { !it.completed && Instant.parse(it.startsAt) >= Clock.System.now() }.minByOrNull { it.startsAt }
    ProjectLoadEffect("calendar", viewModel::calendar)
    ProjectPage {
        ProjectHeading("Schedule")
        NexusButton("+  Book a consultation", onBooking)
        ProjectFeedback(state, viewModel::calendar)
        ProjectCard {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text("${monthNames[month.monthNumber - 1]} ${month.year}", Modifier.weight(1f), color = NexusColors.TextPrimary, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                TextButton(onClick = { selectedValue = today.toString(); monthValue = LocalDate(today.year, today.monthNumber, 1).toString() }) { Text("Today", fontSize = 12.sp) }
                IconButton(onClick = { monthValue = month.minus(DatePeriod(months = 1)).toString() }, modifier = Modifier.size(40.dp)) {
                    Icon(Icons.Outlined.ChevronLeft, "Previous month", tint = NexusColors.PrimaryBlue)
                }
                IconButton(onClick = { monthValue = month.plus(DatePeriod(months = 1)).toString() }, modifier = Modifier.size(40.dp)) {
                    Icon(Icons.Outlined.ChevronRight, "Next month", tint = NexusColors.PrimaryBlue)
                }
            }
            Row(Modifier.fillMaxWidth()) {
                listOf("S", "M", "T", "W", "T", "F", "S").forEach { Text(it, Modifier.weight(1f), textAlign = androidx.compose.ui.text.style.TextAlign.Center, fontSize = 12.sp, color = NexusColors.TextSecondary) }
            }
            dates.chunked(7).forEach { week ->
                Row(Modifier.fillMaxWidth()) {
                    week.forEach { date ->
                        val chosen = date == selected
                        val events = byDate[date].orEmpty()
                        Column(Modifier.weight(1f).heightIn(min = 44.dp).clip(RoundedCornerShape(6.dp))
                            .background(if (chosen) NexusColors.PrimaryBlue else if (events.isNotEmpty()) Color(0xFFE2ECFF) else Color.Transparent)
                            .semantics { contentDescription = "$date, ${events.size} events${if (chosen) ", selected" else ""}" }
                            .clickable { selectedValue = date.toString(); if (date.monthNumber != month.monthNumber) monthValue = LocalDate(date.year, date.monthNumber, 1).toString() }
                            .padding(vertical = 8.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(5.dp)) {
                            Text(date.dayOfMonth.toString(), fontSize = 13.sp, fontWeight = if (chosen || date == today || events.isNotEmpty()) FontWeight.Bold else FontWeight.Normal,
                                color = if (chosen) Color.White else if (date.monthNumber != month.monthNumber) NexusColors.TextMuted else NexusColors.TextPrimary)
                            Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                                events.map { it.type }.distinct().take(3).forEach { type -> Box(Modifier.size(6.dp).background(if (chosen) Color.White else eventColor(type), CircleShape)) }
                            }
                        }
                    }
                }
            }
            ProjectCopy("Highlighted dates have bookings or scheduled events.")
            HorizontalDivider(color = NexusColors.Border)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                listOf("consultation", "meeting", "milestone").forEach { type ->
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        Box(Modifier.size(5.dp).background(eventColor(type), CircleShape))
                        Text(statusLabel(type), fontSize = 12.sp, color = NexusColors.TextSecondary)
                    }
                }
            }
        }
        ProjectCard {
            ProjectTitle("${dayNames[selected.dayOfWeek.isoDayNumber - 1]}, ${monthNames[selected.monthNumber - 1]} ${selected.dayOfMonth}")
            ProjectCopy("${selectedEvents.size} events · Philippine time")
            if (selectedEvents.isEmpty()) {
                Column(Modifier.fillMaxWidth().padding(vertical = 20.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Icon(NexusNavIcons.Calendar, null, Modifier.size(28.dp), tint = NexusColors.TextSecondary)
                    ProjectTitle("No events on this day")
                    ProjectCopy("Select a date in the calendar to see its schedule.")
                }
            }
            selectedEvents.forEach { EventRow(it, onEvent) }
        }
        ProjectCard {
            ProjectTitle("Coming up next")
            ProjectCopy("Philippine time")
            if (upcoming == null) ProjectCopy("No upcoming events scheduled.") else EventRow(upcoming, onEvent)
        }
        ProjectCard {
            ProjectTitle("This month")
            if (monthEvents.isEmpty()) ProjectCopy("No events scheduled for this month.")
            monthEvents.forEach { EventRow(it, onEvent) }
        }
    }
}

@Composable
private fun EventRow(event: CalendarEvent, onEvent: (CalendarEvent) -> Unit) {
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(6.dp)).clickable { onEvent(event) }.padding(vertical = 10.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text("${monthNames[calendarDate(event.startsAt).monthNumber - 1].take(3)} ${calendarDate(event.startsAt).dayOfMonth} · ${event.title}", color = eventColor(event.type), fontSize = 14.sp, fontWeight = FontWeight.Medium)
        ProjectCopy("${calendarTime(event.startsAt)}${event.endsAt?.let { " – ${calendarTime(it)}" }.orEmpty()} · ${event.context}")
        event.location?.takeIf { it.isNotBlank() }?.let { ProjectCopy(it) }
        event.staff?.let { ProjectCopy(it) }
        if (event.pending) ProjectStatus("Awaiting confirmation")
        if (event.completed) ProjectStatus("COMPLETED")
    }
}
