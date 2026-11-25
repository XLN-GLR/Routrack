package com.empresa.routrack

import android.app.Application
import android.util.Log
import com.routrack.mobile.workers.SyncScheduler

/**
 * Clase de aplicación principal de ROUTRACK Mobile.
 * Centraliza la inicialización de librerías nativas y componentes globales del ciclo de vida.
 */
class RoutrackApplication : Application() {

    override fun onCreate() {
        super.onCreate()
        com.empresa.routrack.data.repository.RepositoryProvider.init(this)
        inicializarComponentesNativos()
        iniciarSincronizadorSegundoPlano()
    }

    private fun inicializarComponentesNativos() {
        try {
            // Precarga obligatoria de binarios nativos SQLCipher según documentación oficial de Zetetic
            net.sqlcipher.database.SQLiteDatabase.loadLibs(this)
            Log.i("RoutrackApplication", "Librerías nativas SQLCipher precargadas con éxito.")
        } catch (t: Throwable) {
            Log.e("RoutrackApplication", "Aviso: no fue posible precargar binarios nativos SQLCipher", t)
        }
    }

    private fun iniciarSincronizadorSegundoPlano() {
        try {
            SyncScheduler.schedulePeriodicSync(this)
            Log.i("RoutrackApplication", "SyncScheduler periódico registrado con éxito.")
        } catch (t: Throwable) {
            Log.e("RoutrackApplication", "Aviso: no se pudo programar SyncScheduler periódico", t)
        }
    }
}
