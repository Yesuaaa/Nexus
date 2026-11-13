package com.nexus.app.features.billing.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.Download
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil3.compose.AsyncImage
import com.nexus.app.core.files.LocalPlatformFiles
import com.nexus.app.core.files.SelectedFile
import com.nexus.app.core.theme.NexusButtonShape
import com.nexus.app.core.theme.NexusColors
import com.nexus.app.features.billing.model.BillingPayment
import com.nexus.app.features.billing.viewmodel.BillingUiState
import com.nexus.app.features.billing.viewmodel.BillingViewModel
import kotlinx.datetime.Instant
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime
import org.koin.compose.viewmodel.koinViewModel

private val DueCardBackground = Color(0xFFEAF1FD)
private val DueCardBorder = Color(0xFFB9CBEE)
private val DueCardDivider = Color(0xFFC7D7EF)
private val BillingActionBlue = Color(0xFF203F8C)
private val SlateBg = Color(0xFFF1F5F9)
private val SlateText = Color(0xFF334155)
private val EmeraldBg = Color(0xFFD1FAE5)
private val EmeraldText = Color(0xFF065F46)

@Composable
fun BillingLogsScreen(
    onGoToChats: (requestId: String) -> Unit,
    onPay: (requestId: String) -> Unit,
    modifier: Modifier = Modifier,
    viewModel: BillingViewModel = koinViewModel()
) {
    val state by viewModel.state.collectAsState()
    val platformFiles = LocalPlatformFiles.current

    LaunchedEffect(Unit) {
        viewModel.load()
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(NexusColors.Background)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        Text(
            text = "See what\u2019s due and review payments for your booked services.",
            fontSize = 13.sp,
            color = NexusColors.TextSecondary
        )

        when {
            state.loading -> {
                Box(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 32.dp),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = NexusColors.PrimaryBlue)
                }
            }

            state.error != null -> {
                Surface(
                    shape = RoundedCornerShape(10.dp),
                    color = NexusColors.ErrorLightBg,
                    border = BorderStroke(1.dp, NexusColors.ErrorRed.copy(alpha = 0.25f)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Text(
                            text = state.error ?: "Could not load billing records.",
                            color = NexusColors.ErrorRed,
                            fontSize = 13.sp
                        )
                        OutlinedButton(
                            onClick = { viewModel.load() },
                            shape = NexusButtonShape
                        ) {
                            Text("Retry", fontSize = 13.sp)
                        }
                    }
                }
            }

            else -> {
                DueNextSection(
                    payments = state.due,
                    onReview = { viewModel.selectPayment(it) }
                )
                PaymentHistorySection(
                    payments = state.history,
                    onSelect = { viewModel.selectPayment(it) }
                )
            }
        }
    }

    val selected = state.selectedPayment
    if (selected != null) {
        PaymentDetailsDialog(
            payment = selected,
            state = state,
            onDismiss = { viewModel.dismissDialog() },
            onToggleProof = { viewModel.toggleProofExpanded() },
            onGoToChats = {
                viewModel.dismissDialog()
                onGoToChats(selected.requestId)
            },
            onPay = {
                viewModel.dismissDialog()
                onPay(selected.requestId)
            },
            onDownload = {
                platformFiles?.let { viewModel.downloadProof(it) }
            }
        )
    }
}

@Composable
private fun DueNextSection(
    payments: List<BillingPayment>,
    onReview: (BillingPayment) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(
            text = "Due next",
            fontSize = 16.sp,
            fontWeight = FontWeight.SemiBold,
            color = NexusColors.TextPrimary
        )

        if (payments.isEmpty()) {
            EmptyBillingCard("No payments due.")
        } else {
            Surface(
                shape = RoundedCornerShape(12.dp),
                color = DueCardBackground,
                border = BorderStroke(1.dp, DueCardBorder),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column {
                    payments.forEachIndexed { index, payment ->
                        val isDemo = payment.bookingReference == "DEMO-BILLING-001"
                        if (index > 0) {
                            HorizontalDivider(color = DueCardDivider, thickness = 1.dp)
                        }
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { onReview(payment) }
                                .padding(horizontal = 16.dp, vertical = 14.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Column(
                                modifier = Modifier.weight(1f),
                                verticalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Text(
                                    text = if (isDemo) "Website Development" else payment.serviceName,
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = NexusColors.TextPrimary
                                )
                                Text(
                                    text = if (isDemo) {
                                        "INV-003 \u00b7 BK-2026-0142"
                                    } else {
                                        payment.bookingReference ?: "Booked service"
                                    },
                                    fontSize = 12.sp,
                                    color = NexusColors.TextSecondary
                                )
                                Row(
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = formatBillingAmount(payment.amount, payment.currency),
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = NexusColors.TextPrimary
                                    )
                                    Text(
                                        text = "\u00b7",
                                        fontSize = 12.sp,
                                        color = NexusColors.TextSecondary
                                    )
                                    Text(
                                        text = if (isDemo) "Due Nov 20, 2026" else "Payment due",
                                        fontSize = 12.sp,
                                        color = NexusColors.TextSecondary
                                    )
                                }
                            }
                            Button(
                                onClick = { onReview(payment) },
                                shape = NexusButtonShape,
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = BillingActionBlue,
                                    contentColor = Color.White
                                ),
                                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp)
                            ) {
                                Text("Review", fontSize = 12.sp, fontWeight = FontWeight.Medium)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun PaymentHistorySection(
    payments: List<BillingPayment>,
    onSelect: (BillingPayment) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(
            text = "Payment history",
            fontSize = 16.sp,
            fontWeight = FontWeight.SemiBold,
            color = NexusColors.TextPrimary
        )

        if (payments.isEmpty()) {
            EmptyBillingCard("No payment history yet.")
        } else {
            Surface(
                shape = RoundedCornerShape(12.dp),
                color = NexusColors.Background,
                border = BorderStroke(1.dp, NexusColors.Border),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column {
                    payments.forEachIndexed { index, payment ->
                        if (index > 0) {
                            HorizontalDivider(color = NexusColors.Border, thickness = 1.dp)
                        }
                        val statusStyle = billingStatusStyle(payment)
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { onSelect(payment) }
                                .padding(horizontal = 16.dp, vertical = 14.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Column(
                                modifier = Modifier.weight(1f),
                                verticalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Text(
                                    text = payment.serviceName,
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = NexusColors.TextPrimary
                                )
                                Text(
                                    text = if (payment.status == "VERIFIED" && payment.verifiedAt != null) {
                                        formatBillingDate(payment.verifiedAt)
                                    } else {
                                        payment.bookingReference ?: "Booked service"
                                    },
                                    fontSize = 12.sp,
                                    color = NexusColors.TextSecondary
                                )
                                Row(
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = formatBillingAmount(payment.amount, payment.currency),
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = NexusColors.TextPrimary
                                    )
                                    BillingStatusPill(
                                        label = statusStyle.label,
                                        background = statusStyle.background,
                                        textColor = statusStyle.textColor
                                    )
                                }
                            }
                            Icon(
                                imageVector = Icons.Outlined.ChevronRight,
                                contentDescription = when {
                                    payment.proofFile != null && payment.status == "VERIFIED" -> "View receipt"
                                    payment.proofFile != null -> "View proof"
                                    else -> "View payment"
                                },
                                tint = NexusColors.TextSecondary,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun EmptyBillingCard(message: String) {
    Surface(
        shape = RoundedCornerShape(10.dp),
        color = NexusColors.Background,
        border = BorderStroke(1.dp, NexusColors.Border),
        modifier = Modifier.fillMaxWidth()
    ) {
        Text(
            text = message,
            fontSize = 13.sp,
            color = NexusColors.TextSecondary,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp)
        )
    }
}

@Composable
fun PaymentDetailsDialog(
    payment: BillingPayment,
    state: BillingUiState,
    onDismiss: () -> Unit,
    onToggleProof: () -> Unit,
    onGoToChats: () -> Unit,
    onPay: () -> Unit,
    onDownload: () -> Unit
) {
    val statusStyle = billingStatusStyle(payment)
    val title = when {
        payment.sandbox -> "Sandbox receipt"
        payment.status == "PENDING" -> "Payment summary"
        payment.proofFile != null -> "Payment proof"
        else -> "Payment details"
    }
    val showSubtitleRef = (payment.status == "PENDING" || (payment.proofFile != null && !payment.sandbox)) &&
        !payment.bookingReference.isNullOrBlank()
    val subtitle = if (showSubtitleRef) {
        "${payment.serviceName} \u00b7 ${payment.bookingReference}"
    } else {
        payment.serviceName
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            shape = RoundedCornerShape(14.dp),
            color = NexusColors.Background,
            border = BorderStroke(1.dp, NexusColors.Border),
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 24.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        text = title,
                        fontSize = 18.sp,
                        fontWeight = if (payment.status == "VERIFIED") FontWeight.Bold else FontWeight.SemiBold,
                        color = NexusColors.TextPrimary
                    )
                    Text(
                        text = subtitle,
                        fontSize = 13.sp,
                        color = NexusColors.TextSecondary
                    )
                }

                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = if (payment.status == "PENDING") "Amount due" else "Payment amount",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium,
                            color = NexusColors.TextSecondary
                        )
                        BillingStatusPill(
                            label = statusStyle.label,
                            background = statusStyle.background,
                            textColor = statusStyle.textColor
                        )
                    }
                    Text(
                        text = formatBillingAmount(payment.amount, payment.currency),
                        fontSize = 24.sp,
                        fontWeight = if (payment.status == "VERIFIED") FontWeight.ExtraBold else FontWeight.Bold,
                        color = BillingActionBlue
                    )
                    if (payment.status == "SUBMITTED") {
                        Text(
                            text = "The team will verify your payment within 1 business day.",
                            fontSize = 12.sp,
                            color = NexusColors.TextSecondary
                        )
                    }
                    if (payment.sandbox) {
                        Text(
                            text = "Test payment only. No money was charged.",
                            fontSize = 12.sp,
                            color = NexusColors.TextSecondary
                        )
                    }
                }

                val metadataRows = buildMetadataRows(payment)
                if (metadataRows.isNotEmpty() || payment.proofFile != null) {
                    Surface(
                        shape = RoundedCornerShape(10.dp),
                        color = NexusColors.Background,
                        border = BorderStroke(1.dp, NexusColors.Border),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(14.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            metadataRows.forEach { (label, value) ->
                                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                    Text(
                                        text = label,
                                        fontSize = 11.sp,
                                        color = NexusColors.TextSecondary
                                    )
                                    Text(
                                        text = value,
                                        fontSize = 13.sp,
                                        fontWeight = if (payment.status == "VERIFIED") FontWeight.Medium else FontWeight.Normal,
                                        color = NexusColors.TextPrimary
                                    )
                                }
                            }

                            payment.proofFile?.let { file ->
                                if (!payment.sandbox) {
                                    ProofAttachmentSection(
                                        fileName = file.name,
                                        mimeType = file.mimeType,
                                        preview = state.proofPreview,
                                        loading = state.proofPreviewLoading,
                                        error = state.proofPreviewError,
                                        expanded = state.proofExpanded,
                                        onToggleExpand = onToggleProof
                                    )
                                } else {
                                    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                        Text(
                                            text = "Attached file",
                                            fontSize = 11.sp,
                                            color = NexusColors.TextSecondary
                                        )
                                        Text(
                                            text = file.name,
                                            fontSize = 12.sp,
                                            color = NexusColors.TextPrimary
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                if (payment.status == "PENDING") {
                    LineItemsTable(payment = payment)
                }

                if (state.downloadError != null) {
                    Text(
                        text = state.downloadError,
                        fontSize = 12.sp,
                        color = NexusColors.ErrorRed
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    OutlinedButton(
                        onClick = onGoToChats,
                        shape = NexusButtonShape,
                        border = BorderStroke(1.dp, NexusColors.Border)
                    ) {
                        Text("Go to chats", fontSize = 12.sp, color = NexusColors.TextPrimary)
                    }

                    when {
                        payment.status == "PENDING" -> {
                            Button(
                                onClick = onPay,
                                shape = NexusButtonShape,
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = BillingActionBlue,
                                    contentColor = Color.White
                                )
                            ) {
                                Text(
                                    text = "Pay ${formatBillingAmount(payment.amount, payment.currency)}",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Medium
                                )
                            }
                        }

                        payment.proofFile != null -> {
                            Button(
                                onClick = onDownload,
                                enabled = !state.downloading,
                                shape = NexusButtonShape,
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = BillingActionBlue,
                                    contentColor = Color.White
                                )
                            ) {
                                Icon(
                                    imageVector = Icons.Outlined.Download,
                                    contentDescription = null,
                                    modifier = Modifier.size(16.dp)
                                )
                                Spacer(Modifier.width(6.dp))
                                Text(
                                    text = when {
                                        state.downloading -> "Downloading\u2026"
                                        payment.sandbox -> "Download receipt"
                                        else -> "Download proof"
                                    },
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Medium
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ProofAttachmentSection(
    fileName: String,
    mimeType: String,
    preview: SelectedFile?,
    loading: Boolean,
    error: String?,
    expanded: Boolean,
    onToggleExpand: () -> Unit
) {
    val isImage = mimeType in listOf("image/png", "image/jpeg")
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            text = "Attached file",
            fontSize = 11.sp,
            color = NexusColors.TextSecondary
        )
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            if (isImage) {
                when {
                    loading -> {
                        Box(
                            modifier = Modifier
                                .size(72.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .border(1.dp, NexusColors.Border, RoundedCornerShape(8.dp)),
                            contentAlignment = Alignment.Center
                        ) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                strokeWidth = 2.dp,
                                color = NexusColors.PrimaryBlue
                            )
                        }
                    }

                    preview != null -> {
                        AsyncImage(
                            model = preview.bytes,
                            contentDescription = if (expanded) "Collapse payment proof" else "Enlarge payment proof",
                            contentScale = ContentScale.Crop,
                            modifier = Modifier
                                .size(72.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .border(1.dp, NexusColors.Border, RoundedCornerShape(8.dp))
                                .clickable { onToggleExpand() }
                        )
                    }
                }
            }
            Text(
                text = fileName,
                fontSize = 12.sp,
                color = NexusColors.TextSecondary,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f)
            )
        }
        if (error != null) {
            Text(text = error, fontSize = 11.sp, color = NexusColors.TextSecondary)
        }
        if (isImage && preview != null && expanded) {
            AsyncImage(
                model = preview.bytes,
                contentDescription = "Uploaded payment proof",
                contentScale = ContentScale.Fit,
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 280.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .border(1.dp, NexusColors.Border, RoundedCornerShape(8.dp))
            )
        }
    }
}

@Composable
private fun LineItemsTable(payment: BillingPayment) {
    val items = payment.lineItems
    Column(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text("Item", fontSize = 12.sp, fontWeight = FontWeight.Medium, color = NexusColors.TextSecondary)
            Text("Amount", fontSize = 12.sp, fontWeight = FontWeight.Medium, color = NexusColors.TextSecondary)
        }
        HorizontalDivider(color = NexusColors.Border, thickness = 1.dp)

        if (items != null && items.size > 1) {
            items.forEach { item ->
                val lineTotal = (item.quantity * (item.unitPrice.toDoubleOrNull() ?: 0.0))
                Row(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.Top
                ) {
                    Text(
                        text = item.description,
                        fontSize = 13.sp,
                        color = NexusColors.TextPrimary,
                        modifier = Modifier.weight(1f).padding(end = 12.dp)
                    )
                    Text(
                        text = formatBillingAmount(formatDoubleTwoDecimals(lineTotal), payment.currency),
                        fontSize = 13.sp,
                        color = NexusColors.TextPrimary,
                        textAlign = TextAlign.End
                    )
                }
                HorizontalDivider(color = NexusColors.Border, thickness = 1.dp)
            }
            Row(
                modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text("Total due", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = NexusColors.TextPrimary)
                Text(
                    text = formatBillingAmount(payment.amount, payment.currency),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = NexusColors.TextPrimary
                )
            }
        } else {
            Row(
                modifier = Modifier.fillMaxWidth().padding(vertical = 10.dp),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = payment.serviceName,
                    fontSize = 13.sp,
                    color = NexusColors.TextPrimary,
                    modifier = Modifier.weight(1f).padding(end = 12.dp)
                )
                Text(
                    text = formatBillingAmount(payment.amount, payment.currency),
                    fontSize = 13.sp,
                    color = NexusColors.TextPrimary
                )
            }
            HorizontalDivider(color = NexusColors.Border, thickness = 1.dp)
        }
    }
}

@Composable
private fun BillingStatusPill(
    label: String,
    background: Color,
    textColor: Color
) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(background)
            .padding(horizontal = 10.dp, vertical = 3.dp)
    ) {
        Text(
            text = label,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            color = textColor
        )
    }
}

private data class BillingStatusStyle(
    val label: String,
    val background: Color,
    val textColor: Color
)

private fun billingStatusStyle(payment: BillingPayment): BillingStatusStyle = when {
    payment.status == "PENDING" -> BillingStatusStyle(
        label = "Payment due",
        background = NexusColors.StatusPendingBg,
        textColor = NexusColors.StatusPendingText
    )
    payment.sandbox -> BillingStatusStyle(
        label = "Test payment",
        background = SlateBg,
        textColor = SlateText
    )
    payment.status == "VERIFIED" -> BillingStatusStyle(
        label = "Verified payment",
        background = EmeraldBg,
        textColor = EmeraldText
    )
    else -> BillingStatusStyle(
        label = "Awaiting verification",
        background = NexusColors.StatusPendingBg,
        textColor = NexusColors.StatusPendingText
    )
}

private fun buildMetadataRows(payment: BillingPayment): List<Pair<String, String>> = buildList {
    if (!payment.bookingReference.isNullOrBlank() && (payment.proofFile == null || payment.sandbox)) {
        add("Booking reference" to payment.bookingReference)
    }
    if (payment.status == "PENDING" && !payment.approvedAt.isNullOrBlank()) {
        add("Quotation accepted on" to formatBillingDate(payment.approvedAt))
    }
    if (payment.status == "PENDING") {
        add("Due date" to "Not specified")
    }
    if (payment.proofFile != null && !payment.sandbox) {
        add("Payment method" to "Not recorded")
        if (!payment.submittedAt.isNullOrBlank()) {
            add("Submitted" to formatBillingDate(payment.submittedAt))
        }
    }
    if (!payment.reference.isNullOrBlank()) {
        add("Reference" to payment.reference)
    }
    if (payment.status == "VERIFIED" && !payment.verifiedAt.isNullOrBlank()) {
        add("Verified on" to formatBillingDate(payment.verifiedAt))
    }
}

internal fun formatBillingAmount(amount: String, currency: String = "PHP"): String {
    val clean = amount.trim()
    val negative = clean.startsWith("-")
    val unsigned = clean.removePrefix("-")
    val parts = unsigned.split('.', limit = 2)
    val intPart = (parts.firstOrNull()?.takeIf { it.isNotEmpty() } ?: "0")
        .reversed().chunked(3).joinToString(",").reversed()
    val decPart = (parts.getOrNull(1) ?: "00").padEnd(2, '0').take(2)
    val prefix = if (currency.equals("PHP", ignoreCase = true)) "\u20B1" else "$currency "
    return (if (negative) "-" else "") + prefix + intPart + "." + decPart
}

private fun formatDoubleTwoDecimals(value: Double): String {
    val cents = kotlin.math.round(value * 100.0).toLong()
    val whole = cents / 100
    val frac = kotlin.math.abs(cents % 100).toString().padStart(2, '0')
    return "$whole.$frac"
}

private fun formatBillingDate(iso: String): String = try {
    val dt = Instant.parse(iso).toLocalDateTime(TimeZone.of("Asia/Manila"))
    val months = listOf("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
    "${months[dt.monthNumber - 1]} ${dt.dayOfMonth}, ${dt.year}"
} catch (_: Exception) {
    iso
}
