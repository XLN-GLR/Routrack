package com.empresa.routrack.ui

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.empresa.routrack.data.repository.RepositoryProvider
import com.empresa.routrack.data.repository.UserProfile
import com.empresa.routrack.ui.auth.LoginScreen
import com.empresa.routrack.ui.auth.LoginViewModel
import com.empresa.routrack.ui.settings.AccessibilityPermissionScreen
import com.empresa.routrack.ui.tracking.TrackingScreen
import com.empresa.routrack.ui.tracking.TrackingViewModel
import com.routrack.mobile.presentation.visits.HighAccuracyLocationProvider
import com.routrack.mobile.presentation.visits.LocationResult
import com.routrack.mobile.presentation.visits.VisitCheckInScreen
import com.routrack.mobile.presentation.visits.VisitViewModel

/**
 * Actividad Principal de ROUTRACK Mobile.
 * Integra la pantalla de autenticación LoginScreen y el Scaffold principal de telemetría y campo.
 */
class MainActivity : ComponentActivity() {

    private val loginViewModel: LoginViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        try {
            net.sqlcipher.database.SQLiteDatabase.loadLibs(applicationContext)
        } catch (_: Throwable) {
        }
        setContent {
            MaterialTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    var activeProfile by remember { mutableStateOf<UserProfile?>(null) }

                    if (activeProfile == null) {
                        LoginScreen(
                            viewModel = loginViewModel,
                            onLoginSuccess = { profile ->
                                activeProfile = profile
                            }
                        )
                    } else {
                        RoutrackHomeScaffold(profile = activeProfile!!)
                    }
                }
            }
        }
    }
}

private enum class MainScreen {
    TRACKING,
    VISITS,
    ACCESSIBILITY_SETTINGS
}

@Composable
fun RoutrackHomeScaffold(
    profile: UserProfile
) {
    var currentScreen by remember { mutableStateOf(MainScreen.TRACKING) }
    val context = androidx.compose.ui.platform.LocalContext.current
    val appContext = context.applicationContext as? android.app.Application

    var initError by remember { mutableStateOf<String?>(null) }

    val trackingViewModel: TrackingViewModel? = remember {
        try {
            if (appContext != null) {
                TrackingViewModel(appContext)
            } else {
                initError = "No se pudo obtener el contexto de la aplicación."
                null
            }
        } catch (t: Throwable) {
            android.util.Log.e("MainActivity", "Error al inicializar TrackingViewModel", t)
            initError = t.localizedMessage ?: "Error al inicializar la base de datos o telemetría."
            null
        }
    }

    val visitViewModel: VisitViewModel? = remember {
        try {
            if (appContext != null && trackingViewModel != null) {
                val visitRepo = RepositoryProvider.getVisitRepository(appContext)
                val shiftRepo = RepositoryProvider.getShiftRepository(appContext)
                val locationProvider = HighAccuracyLocationProvider {
                    val s = trackingViewModel.uiState.value
                    LocationResult(
                        latitude = s.ultimaLatitud ?: -0.190123,
                        longitude = s.ultimaLongitud ?: -78.487654,
                        accuracyMeters = s.ultimaPrecision ?: 15f
                    )
                }
                VisitViewModel(
                    visitRepository = visitRepo,
                    shiftRepository = shiftRepo,
                    locationProvider = locationProvider,
                    currentShiftIdProvider = { trackingViewModel.uiState.value.activeJornada?.id },
                    currentSellerIdProvider = { profile.id }
                )
            } else null
        } catch (t: Throwable) {
            android.util.Log.e("MainActivity", "Error al inicializar VisitViewModel", t)
            null
        }
    }

    if (initError != null || trackingViewModel == null) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            contentAlignment = Alignment.Center
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Text(
                    text = "Aviso de Inicialización",
                    style = MaterialTheme.typography.titleLarge,
                    color = MaterialTheme.colorScheme.error
                )
                Text(
                    text = initError ?: "No fue posible inicializar los servicios de telemetría local.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
        return
    }

    when (currentScreen) {
        MainScreen.TRACKING -> {
            TrackingScreen(
                viewModel = trackingViewModel,
                vendedorId = profile.id,
                nombreVendedor = profile.nombreCompleto,
                onNavigateToAccessibility = {
                    currentScreen = MainScreen.ACCESSIBILITY_SETTINGS
                },
                onNavigateToVisits = {
                    currentScreen = MainScreen.VISITS
                }
            )
        }
        MainScreen.VISITS -> {
            if (visitViewModel != null) {
                VisitCheckInScreen(
                    viewModel = visitViewModel,
                    onNavigateBack = {
                        currentScreen = MainScreen.TRACKING
                    }
                )
            } else {
                currentScreen = MainScreen.TRACKING
            }
        }
        MainScreen.ACCESSIBILITY_SETTINGS -> {
            AccessibilityPermissionScreen(
                onNavigateBack = {
                    currentScreen = MainScreen.TRACKING
                }
            )
        }
    }
}
