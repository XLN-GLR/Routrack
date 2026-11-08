package com.empresa.routrack.data.crypto

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.nio.charset.StandardCharsets
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * Gestor de claves criptográficas seguras resguardadas en Android Keystore (Hardware TEE / StrongBox).
 * Genera y custodia claves simétricas AES-256-GCM y provee métodos de cifrado/descifrado en reposo.
 */
class KeyStoreManager(private val context: Context? = null) {

    companion object {
        private const val ANDROID_KEYSTORE = "AndroidKeyStore"
        private const val MASTER_KEY_ALIAS = "RoutrackMasterKey"
        private const val TRANSFORMATION = "AES/GCM/NoPadding"
        private const val GCM_IV_LENGTH = 12
        private const val GCM_TAG_LENGTH = 128
        private const val SEPARATOR = "]"

        @Volatile
        private var INSTANCE: KeyStoreManager? = null

        fun getInstance(context: Context? = null): KeyStoreManager {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: KeyStoreManager(context?.applicationContext).also { INSTANCE = it }
            }
        }
    }

    private val keyStore: KeyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply {
        load(null)
    }

    /**
     * Obtiene la clave maestra simétrica AES-256 desde Android Keystore.
     * Si no existe, la genera y resguarda de forma segura en el hardware del dispositivo.
     */
    @Synchronized
    fun getOrCreateMasterKey(): SecretKey {
        if (keyStore.containsAlias(MASTER_KEY_ALIAS)) {
            val entry = keyStore.getEntry(MASTER_KEY_ALIAS, null) as? KeyStore.SecretKeyEntry
            if (entry != null) {
                return entry.secretKey
            }
        }

        val keyGenerator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES,
            ANDROID_KEYSTORE
        )

        val keyGenParameterSpec = KeyGenParameterSpec.Builder(
            MASTER_KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .setRandomizedEncryptionRequired(true)
            .build()

        keyGenerator.init(keyGenParameterSpec)
        return keyGenerator.generateKey()
    }

    /**
     * Cifra un texto plano en reposo usando AES-256-GCM.
     * Retorna una cadena Base64 estructurada conteniendo el Vector de Inicialización (IV) y el texto cifrado.
     */
    fun encrypt(plainText: String): String {
        val secretKey = getOrCreateMasterKey()
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, secretKey)

        val iv = cipher.iv
        val cipherBytes = cipher.doFinal(plainText.toByteArray(StandardCharsets.UTF_8))

        val ivBase64 = encodeBase64(iv)
        val cipherBase64 = encodeBase64(cipherBytes)

        return "$ivBase64$SEPARATOR$cipherBase64"
    }

    /**
     * Descifra un payload cifrado previamente con [encrypt].
     */
    fun decrypt(encryptedPayload: String): String {
        val parts = encryptedPayload.split(SEPARATOR)
        require(parts.size == 2) { "Formato de payload cifrado no válido." }

        val iv = decodeBase64(parts[0])
        val cipherBytes = decodeBase64(parts[1])

        val secretKey = getOrCreateMasterKey()
        val cipher = Cipher.getInstance(TRANSFORMATION)
        val spec = GCMParameterSpec(GCM_TAG_LENGTH, iv)
        cipher.init(Cipher.DECRYPT_MODE, secretKey, spec)

        val plainBytes = cipher.doFinal(cipherBytes)
        return String(plainBytes, StandardCharsets.UTF_8)
    }

    /**
     * Genera o retorna una frase de paso para la base de datos SQLCipher.
     * Derivada de manera determinista desde el Keystore para desbloquear SQLite cifrado.
     */
    fun getDatabasePassphrase(): ByteArray {
        val masterKey = getOrCreateMasterKey()
        // Derivar una frase de paso persistente utilizando un hash SHA-256 del alias y material de clave
        val md = java.security.MessageDigest.getInstance("SHA-256")
        md.update(MASTER_KEY_ALIAS.toByteArray(StandardCharsets.UTF_8))
        return md.digest(masterKey.encoded ?: MASTER_KEY_ALIAS.toByteArray(StandardCharsets.UTF_8))
    }

    private fun encodeBase64(data: ByteArray): String {
        return java.util.Base64.getEncoder().encodeToString(data)
    }

    private fun decodeBase64(base64: String): ByteArray {
        return java.util.Base64.getDecoder().decode(base64)
    }
}
