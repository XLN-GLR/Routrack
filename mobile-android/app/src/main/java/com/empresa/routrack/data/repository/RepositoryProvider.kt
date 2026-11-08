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
    private var unifiedRepositoryInstance: com.empresa.routrack.data.RoutrackRepository? = null

    private fun getDatabase(context: Context): RoutrackDatabase {
        return databaseInstance ?: synchronized(this) {
            databaseInstance ?: run {
                val keyStoreManager = KeyStoreManager.getInstance(context.applicationContext)
                val passphrase = try {
                    keyStoreManager.getDatabasePassphrase()
                } catch (_: Exception) {
                    null
                }
                RoutrackDatabase.getInstance(context.applicationContext, passphrase).also {
                    databaseInstance = it
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

    /**
     * Retorna la instancia singleton de ShiftRepository.
     */
    fun getShiftRepository(context: Context): ShiftRepository {
        return shiftRepositoryInstance ?: synchronized(this) {
            shiftRepositoryInstance ?: run {
                val db = getDatabase(context)
                val secretKeyProvider = getSecretKeyProvider(context)
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
        return trackingRepositoryInstance ?: synchronized(this) {
            trackingRepositoryInstance ?: run {
                val db = getDatabase(context)
                val secretKeyProvider = getSecretKeyProvider(context)
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
        return visitRepositoryInstance ?: synchronized(this) {
            visitRepositoryInstance ?: run {
                val db = getDatabase(context)
                val secretKeyProvider = getSecretKeyProvider(context)
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
     * Retorna el repositorio unificado de ROUTRACK Mobile.
     */
    fun getUnifiedRepository(context: Context): com.empresa.routrack.data.RoutrackRepository {
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
        return syncRepositoryInstance ?: synchronized(this) {
            syncRepositoryInstance ?: run {
                val db = getDatabase(context)
                val secretKeyProvider = getSecretKeyProvider(context)
                SyncRepositoryImpl(
                    ubicacionDao = db.ubicacionGpsDao(),
                    visitaDao = db.visitaDao(),
                    auditoriaDao = db.bitacoraAuditoriaDao(),
                    jornadaDao = db.jornadaDao(),
                    authRepository = AuthRepositoryImpl(),
                    secretKeyProvider = secretKeyProvider,
                    ioDispatcher = Dispatchers.IO
                ).also { syncRepositoryInstance = it }
            }
        }
    }
}
