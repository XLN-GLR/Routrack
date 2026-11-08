package com.routrack.mobile.data.repository

import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.StandardCharsets

/**
 * Respuesta genérica de una llamada HTTP.
 */
data class HttpResponse(
    val statusCode: Int,
    val body: String
) {
    val isSuccessful: Boolean
        get() = statusCode in 200..299
}

/**
 * Abstracción del transporte HTTP para facilitar pruebas unitarias desacopladas de la red real.
 */
interface HttpTransport {
    fun post(
        url: String,
        headers: Map<String, String>,
        jsonBody: String,
        timeoutMs: Int = 30_000
    ): HttpResponse
}

/**
 * Implementación estándar basada en HttpURLConnection / HttpsURLConnection nativo de Android.
 * No añade dependencias pesadas y opera con total solidez y seguridad TLS.
 */
class DefaultHttpTransport : HttpTransport {

    override fun post(
        url: String,
        headers: Map<String, String>,
        jsonBody: String,
        timeoutMs: Int
    ): HttpResponse {
        val connection = URL(url).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = "POST"
            connection.connectTimeout = timeoutMs
            connection.readTimeout = timeoutMs
            connection.doInput = true
            connection.doOutput = true
            connection.useCaches = false

            // Configurar cabeceras
            headers.forEach { (key, value) ->
                connection.setRequestProperty(key, value)
            }
            if (!headers.containsKey("Content-Type")) {
                connection.setRequestProperty("Content-Type", "application/json; charset=UTF-8")
            }

            // Escribir cuerpo de la petición
            OutputStreamWriter(connection.outputStream, StandardCharsets.UTF_8).use { writer ->
                writer.write(jsonBody)
                writer.flush()
            }

            val statusCode = connection.responseCode
            val inputStream = if (statusCode in 200..299) {
                connection.inputStream
            } else {
                connection.errorStream ?: connection.inputStream
            }

            val responseBody = BufferedReader(InputStreamReader(inputStream, StandardCharsets.UTF_8)).use { reader ->
                reader.readText()
            }

            return HttpResponse(statusCode, responseBody)
        } finally {
            connection.disconnect()
        }
    }
}
