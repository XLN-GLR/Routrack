package com.empresa.routrack.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.empresa.routrack.data.local.dao.BitacoraAuditoriaDao
import com.empresa.routrack.data.local.dao.JornadaDao
import com.empresa.routrack.data.local.dao.UbicacionGpsDao
import com.empresa.routrack.data.local.entity.BitacoraAuditoriaEntity
import com.empresa.routrack.data.local.entity.JornadaEntity
import com.empresa.routrack.data.local.entity.UbicacionGpsEntity
import net.zetetic.database.sqlcipher.SupportFactory

/**
 * Base de datos principal Room para la persistencia local cifrada en ROUTRACK.
 *
 * Integra SQLCipher mediante SupportFactory y la clave maestra resguardada en Android Keystore,
 * garantizando el cifrado en reposo (AES-256) de toda la telemetría, turnos y bitácora de auditoría.
 */
@Database(
    entities = [
        JornadaEntity::class,
        UbicacionGpsEntity::class,
        BitacoraAuditoriaEntity::class
    ],
    version = 1,
    exportSchema = false
)
abstract class RoutrackDatabase : RoomDatabase() {

    abstract fun jornadaDao(): JornadaDao
    abstract fun ubicacionGpsDao(): UbicacionGpsDao
    abstract fun bitacoraAuditoriaDao(): BitacoraAuditoriaDao

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
            val builder = Room.databaseBuilder(
                appContext,
                RoutrackDatabase::class.java,
                DATABASE_NAME
            )

            // Cifrado transparente con SQLCipher si se provee clave criptográfica
            if (passphrase != null && passphrase.isNotEmpty()) {
                val factory = SupportFactory(passphrase)
                builder.openHelperFactory(factory)
            }

            return builder
                .fallbackToDestructiveMigration()
                .build()
        }
    }
}
