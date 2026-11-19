u8q1A# Reglas ProGuard / R8 para ROUTRACK Mobile

# SQLCipher
-keep class net.sqlcipher.** { *; }
-keep class net.sqlcipher.database.** { *; }

# Room Database
-keep class androidx.room.** { *; }
-dontwarn androidx.room.paging.**

# Kotlinx Serialization & Supabase
-keepattributes *Annotation*,InnerClasses,Signature
-dontnote kotlinx.serialization.**
-keepclassmembers class * {
    @kotlinx.serialization.SerialName <fields>;
}

# Ktor Client
-keep class io.ktor.** { *; }
-dontwarn io.ktor.**
