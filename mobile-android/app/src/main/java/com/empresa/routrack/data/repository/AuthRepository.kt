package com.empresa.routrack.data.repository

import android.content.Context
import com.empresa.routrack.data.crypto.KeyStoreManager
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
    suspend fun getCachedOrganizationId(): String? = null
    suspend fun getCachedProfile(): UserProfile? = null
}

/**
 * Implementación oficial del repositorio de autenticación con Supabase Auth.
 * Resguarda la identidad organizacional y token de refresco cifrados en Android Keystore
 * para garantizar que WorkManager pueda autenticar sincronizaciones en segundo plano.
 */
class AuthRepositoryImpl @JvmOverloads constructor(
    private val context: Context? = null
) : AuthRepository {

    companion object {
        private const val PREFS_NAME = "routrack_auth_cache"
        private const val KEY_USER_ID = "user_id"
        private const val KEY_ORG_ID = "org_id"
        private const val KEY_ROLE = "role"
        private const val KEY_EMAIL = "email"
        private const val KEY_NAME = "name"
        private const val KEY_REFRESH_TOKEN_ENC = "rt_enc"
        const val DEFAULT_SEED_ORG_ID = "11111111-1111-4111-8111-111111111111"
    }

    private val auth get() = SupabaseClientProvider.auth
    private val postgrest get() = SupabaseClientProvider.postgrest

    override suspend fun login(email: String, password: String): Result<UserProfile> {
        return try {
            android.util.Log.i("AuthRepository", "Iniciando autenticación en Supabase para: $email")
            // 1. Iniciar sesión con email y contraseña vía GoTrue
            auth.signInWith(Email) {
                this.email = email.trim()
                this.password = password
            }

            val currentUser = auth.currentUserOrNull()
                ?: return Result.failure(IllegalStateException("No se pudo obtener el usuario autenticado desde Supabase."))

            // 2. Consultar perfil asociado en PostgreSQL
            val profileResult = getUserProfile(currentUser.id)
            val profile = profileResult.getOrNull()
                ?: UserProfile(
                    id = currentUser.id,
                    organizacionId = currentUser.appMetadata?.get("organization_id")?.toString()?.replace("\"", "")
                        ?: currentUser.appMetadata?.get("organizacion_id")?.toString()?.replace("\"", "")
                        ?: DEFAULT_SEED_ORG_ID,
                    rol = currentUser.appMetadata?.get("role")?.toString()?.replace("\"", "")
                        ?: currentUser.appMetadata?.get("rol")?.toString()?.replace("\"", "")
                        ?: "VENDEDOR",
                    nombreCompleto = currentUser.userMetadata?.get("full_name")?.toString()?.replace("\"", "")
                        ?: currentUser.email
                        ?: email,
                    email = currentUser.email ?: email,
                    activo = true
                )

            val refreshToken = auth.currentSessionOrNull()?.refreshToken
            persistAuthCache(profile, refreshToken)

            android.util.Log.i("AuthRepository", "Autenticación exitosa. Perfil: ${profile.nombreCompleto} (${profile.rol})")
            Result.success(profile)
        } catch (t: Throwable) {
            android.util.Log.e("AuthRepository", "Fallo durante el inicio de sesión en Supabase", t)
            Result.failure(if (t is Exception) t else Exception(t.message ?: "Error de autenticación", t))
        }
    }

    override suspend fun logout(): Result<Unit> {
        return try {
            clearAuthCache()
            auth.signOut()
            Result.success(Unit)
        } catch (t: Throwable) {
            android.util.Log.e("AuthRepository", "Error durante logout", t)
            Result.failure(if (t is Exception) t else Exception(t.message, t))
        }
    }

    override suspend fun getCurrentSession(): UserSession? {
        return try {
            try {
                auth.awaitInitialization()
            } catch (_: Throwable) {
            }

            var session = auth.currentSessionOrNull()

            // Si no hay sesión cargada en memoria (ej. WorkManager en arranque en frío), restaurar vía refreshToken cifrado
            if (session == null) {
                val cachedRefreshToken = readEncryptedRefreshToken()
                if (!cachedRefreshToken.isNullOrBlank()) {
                    try {
                        val refreshed = auth.refreshSession(cachedRefreshToken)
                        auth.importSession(refreshed)
                        session = auth.currentSessionOrNull() ?: refreshed
                    } catch (t: Throwable) {
                        android.util.Log.w("AuthRepository", "No se pudo restaurar sesión con refresh token en caché: ${t.localizedMessage}")
                    }
                }
            } else {
                // Refrescar el access_token proactivamente si está vencido o por vencer (< 60s)
                val expiresAtMillis = session.expiresAt.epochSeconds * 1000L
                if (System.currentTimeMillis() >= expiresAtMillis - 60_000L) {
                    try {
                        auth.refreshCurrentSession()
                        session = auth.currentSessionOrNull()
                    } catch (t: Throwable) {
                        android.util.Log.w("AuthRepository", "Aviso al refrescar sesión activa: ${t.localizedMessage}")
                    }
                }
            }

            val activeSession = session ?: return null
            val user = activeSession.user ?: auth.currentUserOrNull()
            val userId = user?.id ?: readPlainPref(KEY_USER_ID) ?: return null

            // Actualizar refresh token si rotó
            if (activeSession.refreshToken.isNotBlank()) {
                saveEncryptedRefreshToken(activeSession.refreshToken)
            }

            val roleString = user?.appMetadata?.get("role")?.toString()?.replace("\"", "")
                ?: user?.appMetadata?.get("rol")?.toString()?.replace("\"", "")
                ?: user?.userMetadata?.get("role")?.toString()?.replace("\"", "")
                ?: readPlainPref(KEY_ROLE)
                ?: "VENDEDOR"

            val role = try {
                UserRole.valueOf(roleString.uppercase())
            } catch (_: Exception) {
                UserRole.VENDEDOR
            }

            UserSession(
                userId = userId,
                email = user?.email ?: readPlainPref(KEY_EMAIL),
                accessToken = activeSession.accessToken,
                role = role
            )
        } catch (t: Throwable) {
            android.util.Log.e("AuthRepository", "Error al obtener sesión activa", t)
            null
        }
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

            if (response != null) {
                persistAuthCache(response, auth.currentSessionOrNull()?.refreshToken)
            }

            Result.success(response)
        } catch (t: Throwable) {
            android.util.Log.e("AuthRepository", "Aviso: no se pudo obtener perfil remoto de perfiles", t)
            Result.failure(if (t is Exception) t else Exception(t.message, t))
        }
    }

    override suspend fun getCachedOrganizationId(): String? {
        return readPlainPref(KEY_ORG_ID)
    }

    override suspend fun getCachedProfile(): UserProfile? {
        val userId = readPlainPref(KEY_USER_ID) ?: return null
        val orgId = readPlainPref(KEY_ORG_ID) ?: DEFAULT_SEED_ORG_ID
        val role = readPlainPref(KEY_ROLE) ?: "VENDEDOR"
        val email = readPlainPref(KEY_EMAIL) ?: ""
        val name = readPlainPref(KEY_NAME) ?: if (email.isNotBlank()) email else "Vendedor"
        return UserProfile(
            id = userId,
            organizacionId = orgId,
            rol = role,
            nombreCompleto = name,
            email = email,
            activo = true
        )
    }

    private val resolvedContext: Context?
        get() = (context ?: RepositoryProvider.getAppContext())?.applicationContext

    private fun persistAuthCache(profile: UserProfile, refreshToken: String?) {
        val ctx = resolvedContext ?: return
        try {
            val prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit()
                .putString(KEY_USER_ID, profile.id)
                .putString(KEY_ORG_ID, profile.organizacionId)
                .putString(KEY_ROLE, profile.rol)
                .putString(KEY_EMAIL, profile.email)
                .putString(KEY_NAME, profile.nombreCompleto)
                .apply()

            if (!refreshToken.isNullOrBlank()) {
                saveEncryptedRefreshToken(refreshToken)
            }
        } catch (t: Throwable) {
            android.util.Log.w("AuthRepository", "Aviso al persistir caché de sesión: ${t.localizedMessage}")
        }
    }

    private fun saveEncryptedRefreshToken(refreshToken: String) {
        val ctx = resolvedContext ?: return
        try {
            val encrypted = KeyStoreManager.getInstance(ctx).encrypt(refreshToken)
            val prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().putString(KEY_REFRESH_TOKEN_ENC, encrypted).apply()
        } catch (_: Throwable) {
        }
    }

    private fun readEncryptedRefreshToken(): String? {
        val ctx = resolvedContext ?: return null
        return try {
            val prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val encrypted = prefs.getString(KEY_REFRESH_TOKEN_ENC, null) ?: return null
            KeyStoreManager.getInstance(ctx).decrypt(encrypted)
        } catch (_: Throwable) {
            null
        }
    }

    private fun readPlainPref(key: String): String? {
        val ctx = resolvedContext ?: return null
        return try {
            ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getString(key, null)
        } catch (_: Throwable) {
            null
        }
    }

    private fun clearAuthCache() {
        val ctx = resolvedContext ?: return
        try {
            ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit().clear().apply()
        } catch (_: Throwable) {
        }
    }
}
