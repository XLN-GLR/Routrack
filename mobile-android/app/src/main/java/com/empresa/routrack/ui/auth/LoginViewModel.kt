package com.empresa.routrack.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.empresa.routrack.data.repository.AuthRepository
import com.empresa.routrack.data.repository.AuthRepositoryImpl
import com.empresa.routrack.data.repository.UserProfile
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Estados de UI para la pantalla de inicio de sesión según docs/DESIGN.md.
 */
sealed interface LoginUiState {
    data object Idle : LoginUiState
    data object Loading : LoginUiState
    data class Success(val profile: UserProfile) : LoginUiState
    data class Error(val message: String) : LoginUiState
}

/**
 * ViewModel que orquesta el flujo de autenticación en Android.
 */
class LoginViewModel(
    private val authRepository: AuthRepository = AuthRepositoryImpl()
) : ViewModel() {

    private val _uiState = MutableStateFlow<LoginUiState>(LoginUiState.Idle)
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()

    private val _email = MutableStateFlow("")
    val email: StateFlow<String> = _email.asStateFlow()

    private val _password = MutableStateFlow("")
    val password: StateFlow<String> = _password.asStateFlow()

    fun onEmailChanged(newEmail: String) {
        _email.value = newEmail
        if (_uiState.value is LoginUiState.Error) {
            _uiState.value = LoginUiState.Idle
        }
    }

    fun onPasswordChanged(newPassword: String) {
        _password.value = newPassword
        if (_uiState.value is LoginUiState.Error) {
            _uiState.value = LoginUiState.Idle
        }
    }

    fun login() {
        val currentEmail = _email.value.trim()
        val currentPassword = _password.value

        // Validación de entradas en el cliente (Regla 8)
        if (currentEmail.isBlank() || !android.util.Patterns.EMAIL_ADDRESS.matcher(currentEmail).matches()) {
            _uiState.value = LoginUiState.Error("Ingrese un correo electrónico válido.")
            return
        }

        if (currentPassword.length < 6) {
            _uiState.value = LoginUiState.Error("La contraseña debe tener al menos 6 caracteres.")
            return
        }

        _uiState.value = LoginUiState.Loading

        viewModelScope.launch {
            val result = authRepository.login(currentEmail, currentPassword)
            result.fold(
                onSuccess = { profile ->
                    _uiState.value = LoginUiState.Success(profile)
                },
                onFailure = { error ->
                    val userMessage = when {
                        error.message?.contains("Invalid login credentials", ignoreCase = true) == true ->
                            "Credenciales inválidas. Compruebe su correo y contraseña."
                        error.message?.contains("Unable to resolve host", ignoreCase = true) == true ->
                            "Sin conexión a Internet. Verifique su red móvil o Wi-Fi."
                        else ->
                            error.localizedMessage ?: "Ocurrió un error al autenticarse. Intente nuevamente."
                    }
                    _uiState.value = LoginUiState.Error(userMessage)
                }
            )
        }
    }

    fun clearError() {
        if (_uiState.value is LoginUiState.Error) {
            _uiState.value = LoginUiState.Idle
        }
    }
}
