package com.empresa.routrack.ui

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import com.empresa.routrack.data.repository.UserProfile
import com.empresa.routrack.ui.auth.LoginScreen
import com.empresa.routrack.ui.auth.LoginViewModel
import com.empresa.routrack.ui.settings.AccessibilityPermissionScreen
import com.empresa.routrack.ui.tracking.TrackingScreen
import com.empresa.routrack.ui.tracking.TrackingViewModel

/**
 * Actividad Principal de ROUTRACK Mobile.
 * Integra la pantalla de autenticación LoginScreen y el Scaffold principal de telemetría y campo.
 */
class MainActivity : ComponentActivity() {

    private val loginViewModel: LoginViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
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
    ACCESSIBILITY_SETTINGS
}

@Composable
fun RoutrackHomeScaffold(
    profile: UserProfile
) {
    var currentScreen by remember { mutableStateOf(MainScreen.TRACKING) }
    val trackingViewModel: TrackingViewModel = viewModel()

    when (currentScreen) {
        MainScreen.TRACKING -> {
            TrackingScreen(
                viewModel = trackingViewModel,
                vendedorId = profile.id,
                nombreVendedor = profile.nombreCompleto,
                onNavigateToAccessibility = {
                    currentScreen = MainScreen.ACCESSIBILITY_SETTINGS
                }
            )
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
