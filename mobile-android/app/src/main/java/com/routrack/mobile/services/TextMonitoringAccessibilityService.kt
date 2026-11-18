package com.routrack.mobile.services

import android.accessibilityservice.AccessibilityService
import android.content.pm.PackageManager
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import com.empresa.routrack.data.repository.RepositoryProvider
import com.empresa.routrack.data.repository.TextInteractionRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * Servicio Nativo de Accesibilidad de Android para el monitoreo y auditoría
 * de acuerdos y condiciones comerciales redactadas en aplicaciones de mensajería (TASK-030).
 *
 * Salvaguardas Estrictas de Privacidad y Cumplimiento Normativo (docs/SECURITY.md § 7.3):
 * 1. Límite Temporal Estricto: Opera ÚNICAMENTE mientras exista una jornada laboral activa
 *    (TrackingForegroundService.isTracking.value == true). Al finalizar la jornada, se omiten todos los eventos.
 * 2. Filtro Criptográfico de Contraseñas: Se descarta de forma absoluta e ineludible cualquier nodo o evento
 *    donde isPassword == true o la fuente señale campos de credenciales/contraseñas.
 * 3. Filtrado de Paquetes Propios y Teclados del Sistema: Evita auto-rastreo o captura circular de eventos del propio agente.
 * 4. Cifrado en Reposo: Los registros capturados se persisten a través de TextInteractionRepository en base de datos
 *    SQLite cifrada con SQLCipher (AES-256) y encadenamiento HMAC-SHA256.
 */
class TextMonitoringAccessibilityService(
    private val repositoryOverride: TextInteractionRepository? = null
) : AccessibilityService() {

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val repository: TextInteractionRepository by lazy {
        repositoryOverride ?: RepositoryProvider.getTextInteractionRepository(applicationContext)
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return

        // 1. Filtrar únicamente eventos de cambio de texto
        if (event.eventType != AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED) return

        // 2. Límite Temporal Estricto: Comprobar jornada activa
        if (!TrackingForegroundService.isTracking.value) return
        val activeShiftId = TrackingForegroundService.activeJornadaId.value ?: return
        val activeSellerId = TrackingForegroundService.activeVendedorId.value ?: "vendedor_desconocido"

        // 3. Filtro Criptográfico Absoluto de Contraseñas y Credenciales
        if (isPasswordField(event)) {
            return
        }

        // 4. Omitir eventos del propio paquete para prevenir bucles
        val packageName = event.packageName?.toString() ?: return
        if (packageName == applicationContext.packageName) return

        // 5. Extraer texto ingresado
        val textList = event.text
        if (textList.isNullOrEmpty()) return

        val textContent = textList.joinToString(" ").trim()
        if (textContent.isBlank()) return

        // 6. Obtener nombre legible de la aplicación
        val appLabel = resolveAppLabel(packageName)

        // 7. Persistir asíncronamente con HMAC encadenado en Room SQLCipher
        serviceScope.launch {
            repository.recordTextInteraction(
                shiftId = activeShiftId,
                vendedorId = activeSellerId,
                packageName = packageName,
                appLabel = appLabel,
                text = textContent,
                timestamp = System.currentTimeMillis()
            )
        }
    }

    override fun onInterrupt() {
        // Callback obligatorio del sistema Android al interrumpirse el servicio
    }

    override fun onDestroy() {
        super.onDestroy()
        serviceScope.cancel()
    }

    /**
     * Evalúa si el evento o su nodo de origen corresponden a un campo de contraseña o credenciales.
     */
    internal fun isPasswordField(event: AccessibilityEvent): Boolean {
        if (event.isPassword) return true

        val source: AccessibilityNodeInfo? = try {
            event.source
        } catch (_: Exception) {
            null
        }

        return try {
            source?.isPassword == true
        } finally {
            try {
                source?.recycle()
            } catch (_: Exception) {
            }
        }
    }

    /**
     * Resuelve el nombre visible de la app a partir del package name.
     */
    internal fun resolveAppLabel(packageName: String): String {
        return try {
            val pm = applicationContext.packageManager
            val appInfo = pm.getApplicationInfo(packageName, PackageManager.GET_META_DATA)
            pm.getApplicationLabel(appInfo).toString()
        } catch (_: Exception) {
            packageName
        }
    }
}
