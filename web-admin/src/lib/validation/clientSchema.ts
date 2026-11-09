/**
 * ROUTRACK — Esquema de Validación Zod para Clientes Comerciales
 * Archivo: web-admin/src/lib/validation/clientSchema.ts
 *
 * Cumple con el Criterio 1 de TASK-017:
 * Creación y edición de clientes validada con Zod (doble capa de validación).
 * Mensajes de error claros, contextualizados y 100% en español.
 */

import { z } from "zod";

/**
 * Validador de RUC / Cédula para personas naturales y jurídicas en Ecuador.
 * - Cédula: 10 dígitos numéricos.
 * - RUC: 13 dígitos numéricos terminados en 001.
 */
function isValidEcuadorianTaxId(id: string): boolean {
  if (!/^\d{10}(\d{3})?$/.test(id)) return false;
  if (id.length === 13 && !id.endsWith("001")) return false;
  return true;
}

export const clientFormSchema = z.object({
  nombre: z
    .string({ message: "La razón social o nombre del cliente es obligatoria" })
    .trim()
    .min(3, "El nombre debe tener al menos 3 caracteres")
    .max(150, "El nombre no puede exceder los 150 caracteres"),

  nombre_comercial: z
    .string()
    .trim()
    .max(150, "El nombre comercial no puede exceder los 150 caracteres")
    .optional()
    .nullable()
    .or(z.literal("")),

  identificacion_fiscal: z
    .string({ message: "La identificación fiscal (RUC / Cédula) es obligatoria" })
    .trim()
    .min(10, "La identificación debe tener al menos 10 dígitos")
    .max(13, "La identificación no puede superar los 13 dígitos")
    .refine(
      (val) => isValidEcuadorianTaxId(val),
      {
        message:
          "Identificación fiscal inválida. Debe ser una Cédula de 10 dígitos o un RUC ecuatoriano de 13 dígitos terminado en 001",
      }
    ),

  direccion: z
    .string({ message: "La dirección física del establecimiento es obligatoria" })
    .trim()
    .min(5, "La dirección debe contener al menos 5 caracteres (calle, número o referencia)")
    .max(250, "La dirección no puede exceder los 250 caracteres"),

  telefono: z
    .string()
    .trim()
    .regex(/^[0-9+() -]{7,20}$/, "Formato de teléfono inválido (debe contener entre 7 y 20 caracteres numéricos)")
    .optional()
    .nullable()
    .or(z.literal("")),

  latitud: z
    .number({
      message: "La latitud debe ser un valor numérico decimal",
    })
    .min(-90, "La latitud mínima permitida es -90.0°")
    .max(90, "La latitud máxima permitida es 90.0°"),

  longitud: z
    .number({
      message: "La longitud debe ser un valor numérico decimal",
    })
    .min(-180, "La longitud mínima permitida es -180.0°")
    .max(180, "La longitud máxima permitida es 180.0°"),

  radio_tolerancia_metros: z
    .number({
      message: "El radio de geocerca debe ser un número entero en metros",
    })
    .int("El radio de geocerca debe ser un valor entero")
    .min(10, "El radio mínimo de geocerca es de 10 metros para evitar falsos rechazos GPS")
    .max(1000, "El radio máximo de geocerca no debe exceder los 1000 metros (1 km)")
    .default(50),

  activo: z.boolean().default(true),
});

export type ClientFormValues = z.infer<typeof clientFormSchema>;

/**
 * Valida un objeto contra el esquema de cliente y retorna los datos parseados
 * o la lista de errores formateados en español.
 */
export function validateClientInput(data: unknown): {
  success: boolean;
  data?: ClientFormValues;
  errors?: Record<string, string>;
} {
  const result = clientFormSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] ? String(issue.path[0]) : "global";
    if (!errors[field]) {
      errors[field] = issue.message;
    }
  }

  return { success: false, errors };
}
