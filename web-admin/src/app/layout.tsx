import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ROUTRACK — Panel Administrativo y Supervisión Operativa",
  description: "Plataforma B2B de rastreo geográfico, supervisión de rutas y auditoría inmutable",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
