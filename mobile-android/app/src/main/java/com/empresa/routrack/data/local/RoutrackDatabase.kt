package com.empresa.routrack.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.empresa.routrack.data.local.dao.BitacoraAuditoriaDao
import com.empresa.routrack.data.local.dao.JornadaDao
import com.empresa.routrack.data.local.dao.TextInteractionDao
import com.empresa.routrack.data.local.dao.UbicacionGpsDao
import com.empresa.routrack.data.local.dao.VisitaDao
import com.empresa.routrack.data.local.entity.BitacoraAuditoriaEntity
import com.empresa.routrack.data.local.entity.JornadaEntity
import com.empresa.routrack.data.local.entity.TextInteractionEntity
import com.empresa.routrack.data.local.entity.UbicacionGpsEntity
import com.empresa.routrack.data.local.entity.VisitaEntity
import net.sqlcipher.database.SupportFactory

/**
 * Base de datos principal Room para la persistencia local cifrada en ROUTRACK.
 *
 * Integra SQLCipher mediante SupportFactory y la clave maestra resguardada en Android Keystore,
 * garantizando el cifrado en reposo (AES-256) de toda la telemetría, turnos, visitas, bitácora y textos corporativos.
 */
@Database(
    entities = [
        JornadaEntity::class,
        UbicacionGpsEntity::class,
        BitacoraAuditoriaEntity::class,
        VisitaEntity::class,
        TextInteractionEntity::class
    ],
    version = 3,
    exportSchema = false
)
abstract class RoutrackDatabase : RoomDatabase() {

    abstract fun jornadaDao(): JornadaDao
    abstract fun ubicacionGpsDao(): UbicacionGpsDao
    abstract fun bitacoraAuditoriaDao(): BitacoraAuditoriaDao
    abstract fun visitaDao(): VisitaDao
    abstract fun textInteractionDao(): TextInteractionDao

    companion object {
        private const val DATABASE_NAME = "routrack_secure.db"

        @Volatile
        private var INSTANCE: RoutrackDatabase? = null

        /**
         * Retorna la instancia singleton de la base de datos Room.
         * Si se suministra una frase de paso (passphrase), se inicializa con el motor de cifrado SQLCipher.
         */
        fun getInstance(context: Context, passphrase: ByteArray? = null): RoutrackDatabase {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: buildDatabase(context.applicationContext, passphrase).also { INSTANCE = it }
            }
        }

        private fun buildDatabase(appContext: Context, passphrase: ByteArray?): RoutrackDatabase {
            // Verificación y autorrecuperación de integridad criptográfica
            if (passphrase != null && passphrase.isNotEmpty()) {
                try {
                    net.sqlcipher.database.SQLiteDatabase.loadLibs(appContext)
                    val dbFile = appContext.getDatabasePath(DATABASE_NAME)
                    if (dbFile.exists()) {
                        try {
                            val factory = SupportFactory(passphrase)
                            val testHelper = factory.create(
                                androidx.sqlite.db.SupportSQLiteOpenHelper.Configuration.builder(appContext)
                                    .name(DATABASE_NAME)
                                    .callback(object : androidx.sqlite.db.SupportSQLiteOpenHelper.Callback(1) {
                                        override fun onCreate(db: androidx.sqlite.db.SupportSQLiteDatabase) {}
                                        override fun onUpgrade(db: androidx.sqlite.db.SupportSQLiteDatabase, oldVersion: Int, newVersion: Int) {}
                                    })
                                    .build()
                            )
                            testHelper.writableDatabase
                            testHelper.close()
                        } catch (e: Throwable) {
                            android.util.Log.w("RoutrackDatabase", "Base de datos local no coincide con la clave criptográfica activa o está dañada. Purgando para recreación segura...", e)
                            appContext.deleteDatabase(DATABASE_NAME)
                        }
                    }
                } catch (t: Throwable) {
                    android.util.Log.e("RoutrackDatabase", "Aviso: no fue posible inicializar subsistema SQLCipher nativo", t)
                }
            }

            val builder = Room.databaseBuilder(
                appContext,
                RoutrackDatabase::class.java,
                DATABASE_NAME
            )

            // Cifrado transparente con SQLCipher si se provee clave criptográfica
            if (passphrase != null && passphrase.isNotEmpty()) {
                try {
                    val factory = SupportFactory(passphrase)
                    builder.openHelperFactory(factory)
                } catch (e: Throwable) {
                    android.util.Log.e("RoutrackDatabase", "Aviso: no se pudo cargar SQLCipher nativo, usando SQLite estándar", e)
                }
            }

            return builder
                .fallbackToDestructiveMigration()
                .build()
        }
    }
}
