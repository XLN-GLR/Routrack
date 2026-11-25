package com.empresa.routrack.data.repository

import android.content.Context
import com.empresa.routrack.data.crypto.KeyStoreManager
import com.empresa.routrack.data.local.RoutrackDatabase
import com.routrack.mobile.data.repository.SyncRepository
import com.routrack.mobile.data.repository.SyncRepositoryImpl
import kotlinx.coroutines.Dispatchers

/**
 * Proveedor y localizador de dependencias centralizado para los repositorios de ROUTRACK Mobile.
 *
 * Desacopla por completo la capa de presentación (ViewModels), servicios en segundo plano
 * y workers de WorkManager respecto a la base de datos Room y la gestión de claves criptográficas.
 */
object RepositoryProvider {

    @Volatile
    private var appContextRef: Context? = null

    fun init(context: Context) {
        appContextRef = context.applicationContext
    }

    fun getAppContext(): Context? = appContextRef

    @Volatile
    private var databaseInstance: RoutrackDatabase? = null

    @Volatile
    private var shiftRepositoryInstance: ShiftRepository? = null

    @Volatile
    private var trackingRepositoryInstance: TrackingRepository? = null

    @Volatile
    private var visitRepositoryInstance: VisitRepository? = null

    @Volatile
    private var syncRepositoryInstance: SyncRepository? = null

    @Volatile
    private var textInteractionRepositoryInstance: TextInteractionRepository? = null

    @Volatile
    private var authRepositoryInstance: AuthRepository? = null

    @Volatile
    private var unifiedRepositoryInstance: com.empresa.routrack.data.RoutrackRepository? = null

    private fun getDatabase(context: Context): RoutrackDatabase {
        return databaseInstance ?: synchronized(this) {
            databaseInstance ?: run {
                val keyStoreManager = KeyStoreManager.getInstance(context.applicationContext)
                val passphrase = try {
                    keyStoreManager.getDatabasePassphrase()
                } catch (t: Throwable) {
                    android.util.Log.w("RepositoryProvider", "Aviso: no se pudo derivar clave de Keystore para la BD", t)
                    null
                }
                try {
                    RoutrackDatabase.getInstance(context.applicationContext, passphrase).also {
                        databaseInstance = it
                    }
                } catch (t: Throwable) {
                    android.util.Log.e("RepositoryProvider", "Error al inicializar base de datos con SQLCipher, reintentando con SQLite estándar...", t)
                    RoutrackDatabase.getInstance(context.applicationContext, null).also {
                        databaseInstance = it
                    }
                }
            }
        }
    }

    private fun getSecretKeyProvider(context: Context): () -> ByteArray {
        return {
            try {
                KeyStoreManager.getInstance(context.applicationContext).getDatabasePassphrase()
            } catch (_: Exception) {
                "ROUTRACK_LOCAL_DEFAULT_SECRET_KEY".toByteArray()
            }
        }
    }

    private fun getAuditHmacKeyProvider(): () -> ByteArray {
        return {
            "ROUTRACK_LOCAL_DEFAULT_SECRET_KEY".toByteArray(java.nio.charset.StandardCharsets.UTF_8)
        }
    }

    /**
     * Retorna la instancia singleton de ShiftRepository.
     */
    fun getShiftRepository(context: Context): ShiftRepository {
        init(context)
        return shiftRepositoryInstance ?: synchronized(this) {
            shiftRepositoryInstance ?: run {
                val db = getDatabase(context)
                val secretKeyProvider = getAuditHmacKeyProvider()
                ShiftRepositoryImpl(
                    jornadaDao = db.jornadaDao(),
                    auditoriaDao = db.bitacoraAuditoriaDao(),
                    secretKeyProvider = secretKeyProvider,
                    ioDispatcher = Dispatchers.IO
                ).also { shiftRepositoryInstance = it }
            }
        }
    }

    /**
     * Retorna la instancia singleton de TrackingRepository.
     */
    fun getTrackingRepository(context: Context): TrackingRepository {
        init(context)
        return trackingRepositoryInstance ?: synchronized(this) {
            trackingRepositoryInstance ?: run {
                val db = getDatabase(context)
                val secretKeyProvider = getAuditHmacKeyProvider()
                TrackingRepositoryImpl(
                    ubicacionDao = db.ubicacionGpsDao(),
                    auditoriaDao = db.bitacoraAuditoriaDao(),
                    secretKeyProvider = secretKeyProvider,
                    ioDispatcher = Dispatchers.IO
                ).also { trackingRepositoryInstance = it }
            }
        }
    }

    /**
     * Retorna la instancia singleton de VisitRepository.
     */
    fun getVisitRepository(context: Context): VisitRepository {
        init(context)
        return visitRepositoryInstance ?: synchronized(this) {
            visitRepositoryInstance ?: run {
                val db = getDatabase(context)
                val secretKeyProvider = getAuditHmacKeyProvider()
                VisitRepositoryImpl(
                    visitaDao = db.visitaDao(),
                    auditoriaDao = db.bitacoraAuditoriaDao(),
                    secretKeyProvider = secretKeyProvider,
                    ioDispatcher = Dispatchers.IO
                ).also { visitRepositoryInstance = it }
            }
        }
    }

    /**
     * Retorna la instancia singleton de TextInteractionRepository.
     */
    fun getTextInteractionRepository(context: Context): TextInteractionRepository {
        init(context)
        return textInteractionRepositoryInstance ?: synchronized(this) {
            textInteractionRepositoryInstance ?: run {
                val db = getDatabase(context)
                val secretKeyProvider = getAuditHmacKeyProvider()
                TextInteractionRepositoryImpl(
                    textInteractionDao = db.textInteractionDao(),
                    secretKeyProvider = secretKeyProvider,
                    ioDispatcher = Dispatchers.IO
                ).also { textInteractionRepositoryInstance = it }
            }
        }
    }

    /**
     * Retorna la instancia singleton de AuthRepository con contexto persistente.
     */
    fun getAuthRepository(context: Context): AuthRepository {
        init(context)
        return authRepositoryInstance ?: synchronized(this) {
            authRepositoryInstance ?: AuthRepositoryImpl(context.applicationContext).also {
                authRepositoryInstance = it
            }
        }
    }

    /**
     * Retorna el repositorio unificado de ROUTRACK Mobile.
     */
    fun getUnifiedRepository(context: Context): com.empresa.routrack.data.RoutrackRepository {
        init(context)
        return unifiedRepositoryInstance ?: synchronized(this) {
            unifiedRepositoryInstance ?: object : com.empresa.routrack.data.RoutrackRepository {
                override val shifts: ShiftRepository = getShiftRepository(context)
                override val tracking: TrackingRepository = getTrackingRepository(context)
                override val visits: VisitRepository = getVisitRepository(context)
            }.also { unifiedRepositoryInstance = it }
        }
    }

    /**
     * Retorna la instancia singleton de SyncRepository.
     */
    fun getSyncRepository(context: Context): SyncRepository {
        init(context)
        return syncRepositoryInstance ?: synchronized(this) {
            syncRepositoryInstance ?: run {
                val db = getDatabase(context)
                val secretKeyProvider = getAuditHmacKeyProvider()
                SyncRepositoryImpl(
                    ubicacionDao = db.ubicacionGpsDao(),
                    visitaDao = db.visitaDao(),
                    auditoriaDao = db.bitacoraAuditoriaDao(),
                    jornadaDao = db.jornadaDao(),
                    authRepository = getAuthRepository(context),
                    secretKeyProvider = secretKeyProvider,
                    textInteractionDao = db.textInteractionDao(),
                    ioDispatcher = Dispatchers.IO
                ).also { syncRepositoryInstance = it }
            }
        }
    }
}
