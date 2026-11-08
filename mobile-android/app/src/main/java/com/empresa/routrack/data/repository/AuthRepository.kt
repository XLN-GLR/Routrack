package com.empresa.routrack.data.repository

import com.empresa.routrack.data.network.SupabaseClientProvider
import io.github.jan.supabase.gotrue.providers.builtin.Email
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Roles permitidos en el ecosistema ROUTRACK.
 */
enum class UserRole {
    ADMIN,
    SUPERVISOR,
    VENDEDOR
}

/**
 * Modelo de datos del perfil de usuario en PostgreSQL.
 */
@Serializable
data class UserProfile(
    val id: String,
    @SerialName("organizacion_id") val organizacionId: String,
    val rol: String,
    @SerialName("nombre_completo") val nombreCompleto: String,
    val email: String,
    val telefono: String? = null,
    val activo: Boolean = true
) {
    val userRole: UserRole
        get() = try {
            UserRole.valueOf(rol.uppercase())
        } catch (_: Exception) {
            UserRole.VENDEDOR
        }
}

/**
 * Modelo ligero de sesión activa para consumo en la aplicación móvil.
 */
data class UserSession(
    val userId: String,
    val email: String?,
    val accessToken: String?,
    val role: UserRole
)

/**
 * Contrato de repositorio de autenticación para Android.
 */
interface AuthRepository {
    suspend fun login(email: String, password: String): Result<UserProfile>
    suspend fun logout(): Result<Unit>
    suspend fun getCurrentSession(): UserSession?
    suspend fun getUserProfile(userId: String): Result<UserProfile?>
}

/**
 * Implementación oficial del repositorio de autenticación con Supabase Auth.
 */
class AuthRepositoryImpl : AuthRepository {

    private val auth = SupabaseClientProvider.auth
    private val postgrest = SupabaseClientProvider.postgrest

    override suspend fun login(email: String, password: String): Result<UserProfile> {
        return try {
            // 1. Iniciar sesión con email y contraseña vía GoTrue
            auth.signInWith(Email) {
                this.email = email.trim()
                this.password = password
            }

            val currentUser = auth.currentUserOrNull()
                ?: return Result.failure(IllegalStateException("No se pudo obtener el usuario autenticado."))

            // 2. Consultar perfil asociado en PostgreSQL
            val profileResult = getUserProfile(currentUser.id)
            val profile = profileResult.getOrNull()
                ?: UserProfile(
                    id = currentUser.id,
                    organizacionId = currentUser.appMetadata?.get("organization_id")?.toString() ?: "",
                    rol = currentUser.appMetadata?.get("role")?.toString() ?: "VENDEDOR",
                    nombreCompleto = currentUser.userMetadata?.get("full_name")?.toString() ?: currentUser.email ?: "",
                    email = currentUser.email ?: email,
                    activo = true
                )

            Result.success(profile)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun logout(): Result<Unit> {
        return try {
            auth.signOut()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getCurrentSession(): UserSession? {
        val session = auth.currentSessionOrNull() ?: return null
        val user = auth.currentUserOrNull() ?: return null

        val roleString = user.appMetadata?.get("role")?.toString()
            ?: user.userMetadata?.get("role")?.toString()
            ?: "VENDEDOR"

        val role = try {
            UserRole.valueOf(roleString.uppercase())
        } catch (_: Exception) {
            UserRole.VENDEDOR
        }

        return UserSession(
            userId = user.id,
            email = user.email,
            accessToken = session.accessToken,
            role = role
        )
    }

    override suspend fun getUserProfile(userId: String): Result<UserProfile?> {
        return try {
            val response = postgrest.from("perfiles")
                .select {
                    filter {
                        eq("id", userId)
                    }
                }
                .decodeSingleOrNull<UserProfile>()

            Result.success(response)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
