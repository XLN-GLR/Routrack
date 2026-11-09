package com.routrack.mobile.presentation.visits

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Divider
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.util.Locale

/**
 * Pantalla principal de Clientes Asignados y Flujo de Check-In / Check-Out de Visita Comercial.
 *
 * Cumple con los criterios de TASK-018:
 *  1. Captura de alta precisión no bloqueante de coordenadas GPS y timestamp.
 *  2. Formulario y validación estricta de compromisos comerciales y precios pactados.
 *  3. Persistencia inmediata en Room con estado PENDING.
 */
@Composable
fun VisitCheckInScreen(
    viewModel: VisitViewModel,
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    Scaffold(
        modifier = modifier.fillMaxSize(),
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            when (val state = uiState) {
                is VisitUiState.ClientList -> {
                    ClientListContent(
                        state = state,
                        onSearchQueryChanged = viewModel::onSearchQueryChanged,
                        onTogglePendingFilter = viewModel::onTogglePendingFilter,
                        onStartCheckIn = viewModel::performCheckIn
                    )
                }

                is VisitUiState.ActiveVisit -> {
                    ActiveVisitContent(
                        state = state,
                        onAddAgreement = viewModel::addCommercialAgreement,
                        onRemoveAgreement = viewModel::removeCommercialAgreement,
                        onObservationsChanged = viewModel::onObservationsChanged,
                        onPromisedDateChanged = viewModel::onPromisedDateChanged,
                        onStockNotesChanged = viewModel::onStockNotesChanged,
                        onPerformCheckOut = viewModel::performCheckOut,
                        onCancelVisit = viewModel::cancelActiveVisit
                    )
                }

                is VisitUiState.Completed -> {
                    CompletedVisitContent(
                        state = state,
                        onDismiss = viewModel::dismissCompleted
                    )
                }
            }
        }
    }
}

// =============================================================================
// CONTENIDO 1: LISTA DE CLIENTES ASIGNADOS
// =============================================================================

@Composable
private fun ClientListContent(
    state: VisitUiState.ClientList,
    onSearchQueryChanged: (String) -> Unit,
    onTogglePendingFilter: () -> Unit,
    onStartCheckIn: (AssignedClient) -> Unit
) {
    val filteredClients = remember(state.clients, state.searchQuery, state.filterOnlyPending) {
        val query = state.searchQuery.trim().lowercase(Locale.ROOT)
        state.clients.filter { client ->
            val matchesQuery = query.isEmpty() ||
                    client.nombre.lowercase(Locale.ROOT).contains(query) ||
                    (client.nombreComercial?.lowercase(Locale.ROOT)?.contains(query) == true) ||
                    client.identificacionFiscal.contains(query) ||
                    client.direccion.lowercase(Locale.ROOT).contains(query)

            val matchesFilter = !state.filterOnlyPending || !client.visitadoHoy
            matchesQuery && matchesFilter
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        // Cabecera
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "Cartera de Clientes",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF0F172A)
                )
                Text(
                    text = "Puntos de venta asignados para la jornada",
                    style = MaterialTheme.typography.bodySmall,
                    color = Color(0xFF64748B)
                )
            }

            Surface(
                shape = CircleShape,
                color = Color(0xFFEFF6FF),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFBFDBFE))
            ) {
                Text(
                    text = "${filteredClients.size} clientes",
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF1D4ED8)
                )
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Barra de búsqueda
        OutlinedTextField(
            value = state.searchQuery,
            onValueChange = onSearchQueryChanged,
            modifier = Modifier.fillMaxWidth(),
            placeholder = { Text("Buscar por nombre, RUC o dirección...") },
            leadingIcon = {
                Icon(
                    imageVector = Icons.Default.Search,
                    contentDescription = "Buscar",
                    tint = Color(0xFF94A3B8)
                )
            },
            singleLine = true,
            shape = RoundedCornerShape(12.dp)
        )

        Spacer(modifier = Modifier.height(8.dp))

        // Filtros rápidos
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            FilterChip(
                selected = state.filterOnlyPending,
                onClick = onTogglePendingFilter,
                label = { Text("Solo visitas pendientes") },
                leadingIcon = if (state.filterOnlyPending) {
                    { Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(16.dp)) }
                } else null
            )
        }

        if (state.errorMessage != null) {
            Spacer(modifier = Modifier.height(8.dp))
            Surface(
                color = Color(0xFFFEF2F2),
                shape = RoundedCornerShape(8.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFFECACA))
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.Warning,
                        contentDescription = null,
                        tint = Color(0xFFDC2626),
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = state.errorMessage,
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFFB91C1C)
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Lista de clientes
        if (filteredClients.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "No se encontraron clientes para el criterio seleccionado",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color(0xFF94A3B8),
                    textAlign = TextAlign.Center
                )
            }
        } else {
            LazyColumn(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(filteredClients, key = { it.id }) { client ->
                    ClientCardItem(
                        client = client,
                        isLocating = state.isLocating,
                        onCheckInClick = { onStartCheckIn(client) }
                    )
                }
            }
        }
    }
}

@Composable
private fun ClientCardItem(
    client: AssignedClient,
    isLocating: Boolean,
    onCheckInClick: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = client.nombre,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF0F172A)
                    )
                    if (!client.nombreComercial.isNullOrBlank()) {
                        Text(
                            text = client.nombreComercial,
                            style = MaterialTheme.typography.bodySmall,
                            color = Color(0xFF2563EB),
                            fontWeight = FontWeight.Medium
                        )
                    }
                }

                // Badge de estado de visita
                if (client.visitadoHoy) {
                    Surface(
                        shape = RoundedCornerShape(6.dp),
                        color = Color(0xFFECFDF5),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFA7F3D0))
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = Icons.Default.CheckCircle,
                                contentDescription = null,
                                tint = Color(0xFF059669),
                                modifier = Modifier.size(12.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = "Visitado",
                                style = MaterialTheme.typography.labelSmall,
                                color = Color(0xFF047857),
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(6.dp))

            Text(
                text = client.direccion,
                style = MaterialTheme.typography.bodySmall,
                color = Color(0xFF475569)
            )

            Spacer(modifier = Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Info de geocerca
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.Place,
                        contentDescription = null,
                        tint = Color(0xFF64748B),
                        modifier = Modifier.size(14.dp)
                    )
                    Spacer(modifier = Modifier.width(3.dp))
                    Text(
                        text = "Geocerca: ${client.radioToleranciaMetros} m",
                        style = MaterialTheme.typography.labelSmall,
                        color = Color(0xFF64748B)
                    )
                }

                // Botón de Check-in
                Button(
                    onClick = onCheckInClick,
                    enabled = !isLocating,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (client.visitadoHoy) Color(0xFF475569) else Color(0xFF2563EB)
                    ),
                    shape = RoundedCornerShape(8.dp),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(
                        horizontal = 14.dp,
                        vertical = 6.dp
                    )
                ) {
                    if (isLocating) {
                        CircularProgressIndicator(
                            color = Color.White,
                            modifier = Modifier.size(14.dp),
                            strokeWidth = 2.dp
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(text = "Capturando GPS...", fontSize = 12.sp)
                    } else {
                        Icon(
                            imageVector = Icons.Default.LocationOn,
                            contentDescription = null,
                            modifier = Modifier.size(14.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = if (client.visitadoHoy) "Nueva Visita" else "Check-In",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
    }
}

// =============================================================================
// CONTENIDO 2: VISITA COMERCIAL ACTIVA (CHECK-IN EN CURSO)
// =============================================================================

@Composable
private fun ActiveVisitContent(
    state: VisitUiState.ActiveVisit,
    onAddAgreement: (String, Int, Double, Double) -> Boolean,
    onRemoveAgreement: (String) -> Unit,
    onObservationsChanged: (String) -> Unit,
    onPromisedDateChanged: (String) -> Unit,
    onStockNotesChanged: (String) -> Unit,
    onPerformCheckOut: () -> Unit,
    onCancelVisit: () -> Unit
) {
    var showAddDialog by remember { mutableStateOf(false) }
    var showConfirmCancel by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp)
    ) {
        // Tarjeta Cabecera de Visita Activa
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A))
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "GESTIÓN EN CURSO",
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF93C5FD)
                    )

                    // Cronómetro en tiempo real
                    Text(
                        text = formatDuration(state.elapsedSeconds),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                        color = Color.White
                    )
                }

                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = state.client.nombre,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )

                Text(
                    text = state.client.direccion,
                    style = MaterialTheme.typography.bodySmall,
                    color = Color(0xFF94A3B8)
                )

                Spacer(modifier = Modifier.height(12.dp))

                // Estado de Geocerca (Verificada vs Fuera de Rango)
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = if (state.isVerifiedGeofence) Color(0xFF065F46) else Color(0xFF7F1D1D)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = if (state.isVerifiedGeofence) Icons.Default.CheckCircle else Icons.Default.Warning,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = if (state.isVerifiedGeofence) {
                                "Geocerca Validada (${state.distanceToClientMeters.toInt()}m del cliente)"
                            } else {
                                "Fuera de Rango (${state.distanceToClientMeters.toInt()}m / tol. ${state.client.radioToleranciaMetros}m)"
                            },
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Sección: Acuerdos Comerciales y Precios Pactados
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "Precios y Acuerdos Pactados",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF0F172A)
                )
                Text(
                    text = "Compromisos comerciales pactados con el cliente",
                    style = MaterialTheme.typography.bodySmall,
                    color = Color(0xFF64748B)
                )
            }

            Button(
                onClick = { showAddDialog = true },
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2563EB)),
                shape = RoundedCornerShape(8.dp),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 10.dp, vertical = 4.dp)
            ) {
                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text(text = "Pactar", fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        if (state.agreements.isEmpty()) {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = Color(0xFFF8FAFC),
                shape = RoundedCornerShape(12.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2E8F0))
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        imageVector = Icons.Default.ShoppingCart,
                        contentDescription = null,
                        tint = Color(0xFFCBD5E1),
                        modifier = Modifier.size(32.dp)
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = "No se han pactado precios en esta visita",
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Medium,
                        color = Color(0xFF64748B)
                    )
                    Text(
                        text = "Presiona 'Pactar' para documentar compromisos de precios y volumen.",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFF94A3B8),
                        textAlign = TextAlign.Center
                    )
                }
            }
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                state.agreements.forEach { agreement ->
                    AgreementRowItem(
                        agreement = agreement,
                        onRemove = { onRemoveAgreement(agreement.id) }
                    )
                }

                // Resumen Total
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    color = Color(0xFFEFF6FF),
                    shape = RoundedCornerShape(10.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFBFDBFE))
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 14.dp, vertical = 10.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Total Pactado (${state.agreements.size} items):",
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF1E3A8A)
                        )
                        Text(
                            text = String.format(Locale.US, "$%.2f", state.totalAmount),
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.ExtraBold,
                            color = Color(0xFF1D4ED8)
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Sección: Observaciones y Compromisos de Entrega
        Text(
            text = "Detalles y Observaciones",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = Color(0xFF0F172A)
        )

        Spacer(modifier = Modifier.height(8.dp))

        OutlinedTextField(
            value = state.promisedDeliveryDate,
            onValueChange = onPromisedDateChanged,
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Fecha prometida de entrega / reposición") },
            placeholder = { Text("Ej. 2026-11-12 / Próximo jueves") },
            singleLine = true,
            shape = RoundedCornerShape(10.dp)
        )

        Spacer(modifier = Modifier.height(8.dp))

        OutlinedTextField(
            value = state.stockNotes,
            onValueChange = onStockNotesChanged,
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Inventario y Stock en Tienda") },
            placeholder = { Text("Ej. Quedan 4 cajas en percha, quiebre en SKU 202...") },
            singleLine = true,
            shape = RoundedCornerShape(10.dp)
        )

        Spacer(modifier = Modifier.height(8.dp))

        OutlinedTextField(
            value = state.observations,
            onValueChange = onObservationsChanged,
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Notas y Acuerdos Verbales") },
            placeholder = { Text("Detalle los compromisos asumidos con el administrador de la tienda...") },
            minLines = 3,
            maxLines = 5,
            shape = RoundedCornerShape(10.dp)
        )

        if (state.errorMessage != null) {
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = state.errorMessage,
                style = MaterialTheme.typography.bodySmall,
                color = Color(0xFFDC2626)
            )
        }

        Spacer(modifier = Modifier.height(20.dp))

        // Botón Principal de Check-Out
        Button(
            onClick = onPerformCheckOut,
            enabled = !state.isCompleting,
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF059669))
        ) {
            if (state.isCompleting) {
                CircularProgressIndicator(
                    color = Color.White,
                    modifier = Modifier.size(20.dp),
                    strokeWidth = 2.dp
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(text = "Finalizando y Guardando en Room...", fontWeight = FontWeight.Bold)
            } else {
                Icon(Icons.Default.Check, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Finalizar Visita (Check-Out)",
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Bold
                )
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        OutlinedButton(
            onClick = { showConfirmCancel = true },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp)
        ) {
            Text(text = "Descartar Visita", color = Color(0xFF64748B))
        }
    }

    // Diálogo para Agregar Acuerdo Comercial
    if (showAddDialog) {
        AddCommercialAgreementDialog(
            onDismiss = { showAddDialog = false },
            onAdd = { product, qty, price, discount ->
                val success = onAddAgreement(product, qty, price, discount)
                if (success) {
                    showAddDialog = false
                }
                success
            }
        )
    }

    // Diálogo para Confirmar Cancelación
    if (showConfirmCancel) {
        AlertDialog(
            onDismissRequest = { showConfirmCancel = false },
            title = { Text("¿Descartar Visita?") },
            text = { Text("Si descartas la visita se perderán las observaciones y precios pactados de esta sesión.") },
            confirmButton = {
                TextButton(onClick = {
                    showConfirmCancel = false
                    onCancelVisit()
                }) {
                    Text("Sí, Descartar", color = Color(0xFFDC2626), fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showConfirmCancel = false }) {
                    Text("Continuar Gestión")
                }
            }
        )
    }
}

@Composable
private fun AgreementRowItem(
    agreement: CommercialAgreement,
    onRemove: () -> Unit
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(10.dp),
        color = Color.White,
        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2E8F0))
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = agreement.productName,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF0F172A)
                )
                Text(
                    text = "${agreement.quantity} un. x $${String.format(Locale.US, "%.2f", agreement.agreedUnitPrice)}" +
                            if (agreement.discountPercentage > 0) " (${agreement.discountPercentage}% desc)" else "",
                    style = MaterialTheme.typography.bodySmall,
                    color = Color(0xFF64748B)
                )
            }

            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = String.format(Locale.US, "$%.2f", agreement.subtotal),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF1D4ED8)
                )

                IconButton(onClick = onRemove) {
                    Icon(
                        imageVector = Icons.Default.Delete,
                        contentDescription = "Eliminar",
                        tint = Color(0xFFEF4444),
                        modifier = Modifier.size(18.dp)
                    )
                }
            }
        }
    }
}

// =============================================================================
// DIÁLOGO: AGREGAR PRECIO PACTADO CON VALIDACIÓN ESTRICTA (CRITERIO 2)
// =============================================================================

@Composable
private fun AddCommercialAgreementDialog(
    onDismiss: () -> Unit,
    onAdd: (productName: String, quantity: Int, unitPrice: Double, discountPercentage: Double) -> Boolean
) {
    var productName by remember { mutableStateOf("") }
    var quantityText by remember { mutableStateOf("1") }
    var unitPriceText by remember { mutableStateOf("") }
    var discountText by remember { mutableStateOf("0") }
    var validationError by remember { mutableStateOf<String?>(null) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = "Pactar Precio y Cantidad",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = productName,
                    onValueChange = { productName = it },
                    label = { Text("Producto / SKU *") },
                    placeholder = { Text("Ej. Aceite 1L / Arroz 5kg") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = quantityText,
                        onValueChange = { quantityText = it.filter { char -> char.isDigit() } },
                        label = { Text("Cantidad *") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )

                    OutlinedTextField(
                        value = unitPriceText,
                        onValueChange = { unitPriceText = it },
                        label = { Text("Precio Unit. ($) *") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                }

                OutlinedTextField(
                    value = discountText,
                    onValueChange = { discountText = it },
                    label = { Text("Descuento Pactado (%)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                if (validationError != null) {
                    Text(
                        text = validationError ?: "",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFFDC2626)
                    )
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (productName.trim().length < 2) {
                        validationError = "El nombre del producto debe contener al menos 2 caracteres."
                        return@Button
                    }
                    val qty = quantityText.toIntOrNull()
                    if (qty == null || qty <= 0) {
                        validationError = "La cantidad debe ser un número entero mayor a 0."
                        return@Button
                    }
                    val price = unitPriceText.toDoubleOrNull()
                    if (price == null || price <= 0.0) {
                        validationError = "El precio unitario debe ser un valor numérico mayor a $0.00."
                        return@Button
                    }
                    val disc = if (discountText.isBlank()) 0.0 else discountText.toDoubleOrNull()
                    if (disc == null || disc < 0.0 || disc > 100.0) {
                        validationError = "El descuento debe encontrarse entre 0% y 100%."
                        return@Button
                    }

                    validationError = null
                    onAdd(productName.trim(), qty, price, disc)
                },
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2563EB))
            ) {
                Text("Guardar Acuerdo")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancelar")
            }
        }
    )
}

// =============================================================================
// CONTENIDO 3: VISITA COMPLETADA EXITOSAMENTE
// =============================================================================

@Composable
private fun CompletedVisitContent(
    state: VisitUiState.Completed,
    onDismiss: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        contentAlignment = Alignment.Center
    ) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Surface(
                    shape = CircleShape,
                    color = Color(0xFFECFDF5),
                    modifier = Modifier.size(64.dp)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = Icons.Default.CheckCircle,
                            contentDescription = null,
                            tint = Color(0xFF059669),
                            modifier = Modifier.size(36.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                Text(
                    text = "¡Visita Registrada!",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF0F172A)
                )

                Text(
                    text = state.clientName,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = Color(0xFF2563EB)
                )

                Spacer(modifier = Modifier.height(16.dp))

                Divider(color = Color(0xFFE2E8F0))

                Spacer(modifier = Modifier.height(12.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(text = "Duración en tienda:", color = Color(0xFF64748B), fontSize = 13.sp)
                    Text(
                        text = formatDuration(state.durationSeconds),
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF0F172A),
                        fontSize = 13.sp
                    )
                }

                Spacer(modifier = Modifier.height(6.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(text = "Total acuerdos pactados:", color = Color(0xFF64748B), fontSize = 13.sp)
                    Text(
                        text = String.format(Locale.US, "$%.2f", state.totalAmount),
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF059669),
                        fontSize = 13.sp
                    )
                }

                Spacer(modifier = Modifier.height(6.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(text = "Estado de geocerca:", color = Color(0xFF64748B), fontSize = 13.sp)
                    Text(
                        text = state.geofenceStatus,
                        fontWeight = FontWeight.Bold,
                        color = if (state.geofenceStatus == "VERIFIED") Color(0xFF059669) else Color(0xFFDC2626),
                        fontSize = 13.sp
                    )
                }

                Spacer(modifier = Modifier.height(8.dp))

                Surface(
                    color = Color(0xFFF1F5F9),
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = "Guardado localmente en SQLite Room con estado PENDING. Se sincronizará automáticamente al detectar conexión.",
                        style = MaterialTheme.typography.labelSmall,
                        color = Color(0xFF475569),
                        modifier = Modifier.padding(10.dp),
                        textAlign = TextAlign.Center
                    )
                }

                Spacer(modifier = Modifier.height(20.dp))

                Button(
                    onClick = onDismiss,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(44.dp),
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0F172A))
                ) {
                    Text(text = "Volver a Clientes", fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

private fun formatDuration(seconds: Long): String {
    val hrs = seconds / 3600
    val mins = (seconds % 3600) / 60
    val secs = seconds % 60
    return if (hrs > 0) {
        String.format(Locale.US, "%02d:%02d:%02d", hrs, mins, secs)
    } else {
        String.format(Locale.US, "%02d:%02d", mins, secs)
    }
}
