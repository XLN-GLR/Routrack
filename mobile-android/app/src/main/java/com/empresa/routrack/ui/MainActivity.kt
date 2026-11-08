package com.empresa.routrack.ui

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
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
import com.empresa.routrack.data.repository.UserProfile
import com.empresa.routrack.ui.auth.LoginScreen
import com.empresa.routrack.ui.auth.LoginViewModel

/**
 * Actividad Principal de ROUTRACK Mobile.
 * Integra la pantalla de autenticación LoginScreen y el Scaffold principal.
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

@Composable
fun RoutrackHomeScaffold(profile: UserProfile) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = "Bienvenido, ${profile.nombreCompleto} (${profile.rol})",
            style = MaterialTheme.typography.titleMedium
        )
    }
}
