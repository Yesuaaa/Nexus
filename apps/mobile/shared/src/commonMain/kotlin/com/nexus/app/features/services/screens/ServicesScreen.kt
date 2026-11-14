package com.nexus.app.features.services.screens

import com.nexus.app.core.components.LocalNexusBottomPadding
import com.nexus.app.core.components.NexusSearchField
import com.nexus.app.core.components.NexusDialogButton
import com.nexus.app.core.components.NexusAlertDialog
import com.nexus.app.core.theme.NexusButtonShape
import androidx.compose.foundation.background
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nexus.app.core.components.LocalNexusToast
import com.nexus.app.core.components.NexusButton
import com.nexus.app.core.components.NexusButtonVariant
import com.nexus.app.core.theme.NexusColors
import com.nexus.app.features.booking.components.*
import com.nexus.app.features.booking.model.*
import com.nexus.app.features.booking.viewmodel.BookingViewModel
import org.koin.compose.viewmodel.koinViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ServicesScreen(
    onBookedRequests: () -> Unit = {},
    onRequestCreated: (String) -> Unit = {},
    modifier: Modifier = Modifier,
    viewModel: BookingViewModel = koinViewModel()
) {
    val state by viewModel.state.collectAsState()
    val toast = LocalNexusToast.current
    LaunchedEffect(viewModel) {
        viewModel.toasts.collect { toast.show(it.title, it.message, it.kind) }
    }
    val service = state.service
    val selectedPackage = service?.packages?.find { it.id == state.draft.packageId }
    val locked = state.submitting || state.pendingSubmission != null
    val selectedPrice = selectedPackage?.price() ?: service?.price().orEmpty()
    LazyColumn(
        modifier.fillMaxSize().background(Color(0xFFF7F8FA)).imePadding(),
        contentPadding = PaddingValues(start = 24.dp, end = 24.dp,
            top = when {
                state.receipt != null -> 24.dp
                state.step > 1 -> 0.dp
                else -> 20.dp
            }, bottom = 20.dp + LocalNexusBottomPadding.current),
        verticalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        if (state.receipt != null) {
            val receipt = state.receipt!!
            item { PageHeading("Request submitted", "Your project is ready for the department to review.") }
            item { BookingPanel("Your request") {
                InfoLine("Reference", receipt.referenceNumber ?: receipt.id)
                InfoLine("Status", statusLabel(receipt.status))
                InfoLine("Submitted", receipt.createdAt.take(10))
            } }
            item { NexusButton("View request", { onRequestCreated(receipt.id) }) }
            item {
                NexusButton("Start another request", viewModel::newRequest,
                    variant = NexusButtonVariant.OUTLINE)
            }
        } else if (state.step == 1) {
            item {
                PageHeading("Build Your Brand with EXP",
                    "Discover digital services crafted to amplify your presence and turn ideas into business impact.")
            }
            item { TextButton(shape = NexusButtonShape, onClick = onBookedRequests, contentPadding = PaddingValues(0.dp)) { Text("My booked requests  →") } }
            if (service != null) item {
                OutlinedButton(shape = NexusButtonShape, onClick = { viewModel.goTo(if (state.packageSelected) 3 else 2) }) { Text("Continue your draft") }
            }
            item { BookingProgress(1) }
            item { NexusSearchField(state.search, viewModel::search, "Search services") }
            item {
                val departments = state.services.flatMap { it.departments }.distinctBy { it.id }
                FilterMenu(departments.find { it.id == state.department }?.name ?: "All services",
                    listOf("" to "All services") + departments.map { it.id to it.name },
                    modifier = Modifier.width(208.dp), onSelect = viewModel::department)
            }
            if (state.loading) item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
            state.error?.let { item { RetryNotice(it, viewModel::loadCatalog) } }
            val services = state.services.filter {
                (state.search.isBlank() || it.name.contains(state.search, true) || it.description.contains(state.search, true)) &&
                    (state.department.isBlank() || it.departments.any { d -> d.id == state.department })
            }
            if (!state.loading && state.error == null && services.isEmpty()) item {
                BookingPanel("No services found") {
                    Text(if (state.services.isEmpty()) "No active services are available yet. Please check again later."
                        else "Try another search or department.", color = NexusColors.TextSecondary)
                    TextButton(shape = NexusButtonShape, onClick = { viewModel.search(""); viewModel.department(""); viewModel.loadCatalog() }) { Text("Reset and refresh") }
                }
            }
            items(services.chunked(2), key = { it.first().id }) { row ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                    row.forEach { item ->
                        Card(onClick = { viewModel.showDetails(item) }, modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(12.dp),
                            colors = CardDefaults.cardColors(containerColor = NexusColors.ServiceCardNavy)) {
                            ServiceImage(item.imageUrl, item.imageAltText ?: item.name, Modifier.fillMaxWidth().height(64.dp))
                            Column(Modifier.fillMaxWidth().height(96.dp).padding(horizontal = 10.dp, vertical = 6.dp)) {
                                Text(item.name, fontSize = 13.sp, lineHeight = 16.sp,
                                    maxLines = 2, overflow = TextOverflow.Ellipsis,
                                    fontWeight = FontWeight.SemiBold, color = Color.White)
                                Spacer(Modifier.height(6.dp))
                                Text(item.price(), fontSize = 11.sp, lineHeight = 14.sp,
                                    maxLines = 2, overflow = TextOverflow.Ellipsis,
                                    color = Color.White.copy(alpha = 0.85f))
                                Spacer(Modifier.weight(1f))
                                Text("Request service  +", fontSize = 12.sp, lineHeight = 16.sp,
                                    maxLines = 1, color = Color.White)
                            }
                        }
                    }
                    if (row.size == 1) Spacer(Modifier.weight(1f))
                }
            }
        } else {
            item {
                TextButton(shape = NexusButtonShape, onClick = { viewModel.goTo(state.step - 1) }, enabled = !locked,
                    contentPadding = PaddingValues(0.dp)) {
                    Icon(Icons.Outlined.ArrowBack, null, Modifier.size(16.dp))
                    Text(" Back")
                }
                PageHeading(when (state.step) {
                    2 -> "Choose Your Package"
                    3 -> "Project Requirements"
                    else -> "Who would you like to work with?"
                })
            }
            item { BookingProgress(state.step) }
            if (state.step == 2 && service != null) {
                item { Text("Find the right package for your goals. We'll help bring your vision to life.", fontSize = 13.sp, color = NexusColors.TextSecondary) }
                item { BookingPanel("Selected service") {
                    Text(service.name, fontWeight = FontWeight.SemiBold)
                    Text(service.departments.joinToString { it.name }, fontSize = 12.sp, color = NexusColors.TextSecondary)
                    TextButton(shape = NexusButtonShape, contentPadding = PaddingValues(0.dp), modifier = Modifier.align(Alignment.Start), onClick = { viewModel.showDetails(service) }) { Text("View service details") }
                } }
                item { PageHeading("Packages & pricing", "Choose a service option to see what's included.") }
                if (service.packages.none { it.isActive }) {
                    item { PackageOption("Standard service", service.description, service.price(),
                        emptyList(), state.packageSelected && state.draft.packageId == null) { viewModel.choosePackage(null) } }
                } else {
                    items(service.packages.filter { it.isActive }.sortedBy { it.displayOrder }, key = { it.id }) { pkg ->
                        PackageOption(pkg.name + if (pkg.isRecommended) " \u2022 Recommended" else "",
                            pkg.description, pkg.price(), pkg.includedFeatures,
                            state.packageSelected && state.draft.packageId == pkg.id) { viewModel.choosePackage(pkg.id) }
                    }
                }
                if (service.requiresConsultation) item { BookingPanel("Consultation required") {
                    Text(service.consultationNotes ?: "We'll confirm the scope, requirements, and pricing during consultation.",
                        fontSize = 13.sp, color = NexusColors.TextSecondary)
                } }
                item { BookingContinueButton(onClick = { viewModel.goTo(3) },
                    enabled = state.packageSelected, modifier = Modifier.fillMaxWidth()) }
            }
            if (state.step == 3 && service != null) {
                item { Text("Share your goals, requirements, and expected timeline so we can understand your project.",
                    fontSize = 13.sp, color = NexusColors.TextSecondary) }
                item { SelectionSummary(service.name, selectedPackage?.name ?: "Standard service", selectedPrice) }
                item { PageHeading("Tell us about your project", "Your draft stays available while you work through these steps.") }
                item { RequirementField("Project goals", "What do you want to achieve?", state.draft.goals, 2000,
                    state.fieldErrors["goals"], !locked) { viewModel.updateField("goals", it) } }
                item { RequirementField("Project requirements", "Describe the deliverables, features, or support you need.", state.draft.requirements, 5000,
                    state.fieldErrors["requirements"], !locked) { viewModel.updateField("requirements", it) } }
                item { RequirementField("Expected timeline", "For example: within six weeks, with a launch in January.", state.draft.expectedTimeline, 300,
                    state.fieldErrors["expectedTimeline"], !locked) { viewModel.updateField("expectedTimeline", it) } }
                item { RequirementField("Additional details (optional)", "Add any useful context.", state.draft.additionalDetails, 5000,
                    state.fieldErrors["additionalDetails"], !locked, required = false) { viewModel.updateField("additionalDetails", it) } }
                if (service.clientRequirements.isNotEmpty()) item { BookingPanel("What we'll need") {
                    service.clientRequirements.forEach { Text("• $it", fontSize = 13.sp) }
                } }
                item { Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = { toast.show("Draft saved", "Your draft is kept while you continue in the app.", com.nexus.app.core.components.ToastKind.INFO) },
                        enabled = !locked, shape = NexusButtonShape,
                        border = androidx.compose.foundation.BorderStroke(1.dp, NexusColors.PrimaryBlue),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = NexusColors.PrimaryBlue),
                        modifier = Modifier.heightIn(min = 44.dp)) { Text("Save requirements") }
                    BookingContinueButton(onClick = { viewModel.goTo(4) }, enabled = !locked,
                        modifier = Modifier.weight(1f))
                } }
            }
            if (state.step == 4 && service != null) {
                item { Text("Choose a preferred specialist or let the department find the right person. Your preference is subject to availability.",
                    fontSize = 13.sp, color = NexusColors.TextSecondary) }
                item { SpecialistOption("Let the department assign a specialist",
                    "We'll match your project with an available team member.",
                    state.draft.preferredSpecialistId == null, !locked) { viewModel.chooseSpecialist(null) } }
                if (state.specialistsLoading) item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
                state.specialistError?.let { item { RetryNotice(it, viewModel::loadSpecialists) } }
                items(state.specialists, key = { it.id }) { specialist ->
                    BookingPanel(specialist.fullName) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            RadioButton(selected = state.draft.preferredSpecialistId == specialist.id,
                                onClick = { viewModel.chooseSpecialist(specialist.id) }, enabled = !locked)
                            ServiceImage(specialist.imageUrl, specialist.fullName, Modifier.size(40.dp))
                            Column(Modifier.padding(start = 10.dp).weight(1f)) {
                                Text(specialist.position ?: "Specialist", fontSize = 13.sp)
                                Text(specialist.department?.name.orEmpty(), fontSize = 12.sp, color = NexusColors.TextSecondary)
                            }
                        }
                        TextButton(shape = NexusButtonShape, onClick = { viewModel.showProfile(specialist.id) }, enabled = !state.profileLoading) { Text("View profile") }
                    }
                }
                if (!state.specialistsLoading && state.specialistError == null && state.specialists.isEmpty()) item {
                    Text("No specialists are currently listed. The department can assign someone for you.", fontSize = 13.sp, color = NexusColors.TextSecondary)
                }
                item { SelectionSummary(service.name, selectedPackage?.name ?: "Standard service", selectedPrice) }
                item { BookingPanel("Your project") {
                    InfoLine("Preferred specialist", state.specialists.find { it.id == state.draft.preferredSpecialistId }?.fullName ?: "Department assignment")
                    InfoLine("Project goals", state.draft.goals)
                    InfoLine("Project requirements", state.draft.requirements)
                    InfoLine("Expected timeline", state.draft.expectedTimeline)
                    if (state.draft.additionalDetails.isNotBlank()) InfoLine("Additional details", state.draft.additionalDetails)
                    Row {
                        TextButton(shape = NexusButtonShape, onClick = { viewModel.goTo(3) }, enabled = !locked) { Text("Edit requirements") }
                        TextButton(shape = NexusButtonShape, onClick = { viewModel.goTo(2) }, enabled = !locked) { Text("Edit package") }
                    }
                } }
                state.error?.let { item { Text(it, color = NexusColors.ErrorRed, fontSize = 13.sp) } }
                if (state.pendingSubmission != null && !state.submitting) item {
                    Text("Your draft is safe. Retry the same submission to confirm its result before making edits.",
                        fontSize = 13.sp, color = NexusColors.TextSecondary)
                }
                item { NexusButton(if (state.pendingSubmission != null) "Retry submission" else "Submit request",
                    viewModel::submit, loading = state.submitting) }
                item { Text("Please review your information before submitting your request.", fontSize = 11.sp,
                    color = NexusColors.TextSecondary) }
            }
        }
    }
    state.details?.let { details ->
        ModalBottomSheet(onDismissRequest = viewModel::closeDetails,
            sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
            containerColor = Color.White) {
            BoxWithConstraints(Modifier.fillMaxWidth()) {
                val sheetMaxHeight = maxHeight * 0.9f
                Column(
                    Modifier.fillMaxWidth().heightIn(max = sheetMaxHeight)
                        .verticalScroll(rememberScrollState()).padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Text("Service details", modifier = Modifier.weight(1f),
                            fontWeight = FontWeight.SemiBold)
                        IconButton(onClick = viewModel::closeDetails, modifier = Modifier.size(40.dp)) {
                            Icon(Icons.Outlined.Close, "Close service details")
                        }
                    }
                    ServiceImage(details.imageUrl, details.imageAltText ?: details.name,
                        Modifier.fillMaxWidth().height(220.dp.coerceAtMost(sheetMaxHeight * 0.35f)))
                    PageHeading(details.name, details.description)
                    InfoLine("Pricing", details.price())
                    details.keyBenefits.forEach { benefit ->
                        BookingPanel(benefit.title) {
                            Text(benefit.description, fontSize = 13.sp, color = NexusColors.TextSecondary)
                        }
                    }
                    if (details.clientRequirements.isNotEmpty()) {
                        BookingPanel("What we'll need") {
                            details.clientRequirements.forEach { Text("\u2022 $it", fontSize = 13.sp) }
                        }
                    }
                    BookingContinueButton(onClick = { viewModel.chooseService(details) },
                        enabled = !locked, modifier = Modifier.fillMaxWidth())
                }
            }
        }
    }

    state.profile?.let { profile ->
        NexusAlertDialog(onDismissRequest = viewModel::closeProfile,
            title = { Text(profile.fullName) },
            text = { Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(profile.position ?: "Specialist")
                Text(profile.bio ?: "No biography has been added.")
                if (profile.specialties.isNotEmpty()) Text(profile.specialties.joinToString(" ? "))
            } },
            confirmButton = { NexusDialogButton(onClick = viewModel::closeProfile) { Text("Close") } })
    }
}

@Composable
private fun SelectionSummary(service: String, pkg: String, price: String) {
    BookingPanel("Your selection") {
        InfoLine("Service", service)
        InfoLine("Package", pkg)
        HorizontalDivider()
        InfoLine("Pricing", price)
    }
}
@Composable
private fun PackageOption(name: String, description: String, price: String, features: List<String>,
    selected: Boolean, onSelect: () -> Unit) {
    val foreground = if (selected) Color.White else NexusColors.HeaderDarkNavy
    val secondary = if (selected) Color.White.copy(alpha = 0.85f) else NexusColors.TextSecondary
    Card(
        onClick = onSelect,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (selected) NexusColors.PrimaryBlue else Color.White,
            contentColor = foreground
        ),
        border = androidx.compose.foundation.BorderStroke(1.dp,
            if (selected) NexusColors.PrimaryBlue else NexusColors.Border)
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(name, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = foreground)
            Text(description, fontSize = 13.sp, color = secondary)
            Text(price, fontSize = 20.sp, fontWeight = FontWeight.SemiBold, color = foreground)
            features.forEach { Text("\u2022 $it", fontSize = 13.sp, color = secondary) }
            OutlinedButton(
                onClick = onSelect, modifier = Modifier.fillMaxWidth().heightIn(min = 44.dp),
                shape = NexusButtonShape,
                border = androidx.compose.foundation.BorderStroke(1.dp,
                    if (selected) Color.White.copy(alpha = 0.65f) else NexusColors.Border),
                colors = ButtonDefaults.outlinedButtonColors(
                    contentColor = if (selected) Color.White else NexusColors.PrimaryBlue)
            ) {
                Text(if (selected) "Selected" else "Select this package",
                    color = if (selected) Color.White else NexusColors.PrimaryBlue)
            }
        }
    }
}

@Composable
private fun SpecialistOption(title: String, description: String, selected: Boolean, enabled: Boolean, onSelect: () -> Unit) {
    Card(onClick = onSelect, enabled = enabled, colors = CardDefaults.cardColors(
        containerColor = if (selected) NexusColors.SurfaceHover else Color.White),
        border = androidx.compose.foundation.BorderStroke(1.dp, NexusColors.Border)) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            RadioButton(selected, onClick = onSelect, enabled = enabled)
            Column(Modifier.weight(1f)) {
                Text(title, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                Text(description, fontSize = 12.sp, color = NexusColors.TextSecondary)
            }
        }
    }
}
@Composable
private fun RequirementField(label: String, hint: String, value: String, limit: Int, error: String?,
    enabled: Boolean, required: Boolean = true, onChange: (String) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(label + if (required) " *" else "", fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
        Text(hint, fontSize = 12.sp, color = NexusColors.TextSecondary)
        OutlinedTextField(value, onChange, modifier = Modifier.fillMaxWidth(), enabled = enabled,
            minLines = if (limit == 300) 2 else 4, maxLines = 8,
            isError = error != null, shape = RoundedCornerShape(10.dp),
            supportingText = {
                Column {
                    error?.let { Text(it) }
                    Text("${value.length} / $limit", modifier = Modifier.align(Alignment.End))
                }
            })
    }
}
