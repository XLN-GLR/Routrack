package com.empresa.routrack.data.network

import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.gotrue.Auth
import io.github.jan.supabase.gotrue.auth
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.realtime.Realtime
import io.github.jan.supabase.realtime.realtime

/**
 * Proveedor Singleton del cliente oficial de Supabase para Android.
 * Inicializa los módulos de Auth (GoTrue), Postgrest y Realtime utilizando
 * credenciales anónimas públicas sujetas estrictamente a Row Level Security (RLS).
 */
object SupabaseClientProvider {

    // Configuración base pública por defecto (puede sobreescribirse mediante BuildConfig)
    private const val DEFAULT_SUPABASE_URL = "https://aaermspsuxpamylwnbyz.supabase.co"
    private const val DEFAULT_ANON_KEY = "sb_publishable_B910MIl6cyXtkNim6KkXLQ_vFTRXn5q"

    val client: SupabaseClient by lazy {
        createSupabaseClient(
            supabaseUrl = DEFAULT_SUPABASE_URL,
            supabaseKey = DEFAULT_ANON_KEY
        ) {
            install(Auth)
            install(Postgrest)
            install(Realtime)
        }
    }

    val auth: Auth
        get() = client.auth

    val postgrest: Postgrest
        get() = client.postgrest

    val realtime: Realtime
        get() = client.realtime
}
