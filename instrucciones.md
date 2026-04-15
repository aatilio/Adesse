# 📋 Documento de Especificaciones: Sistema de Asistencia Inteligente (SAI)

## 1. Visión General
El objetivo es construir una aplicación web (PWA) para el control de asistencia de alumnos en tiempo real. El sistema debe prevenir el fraude (estudiantes marcando por otros) mediante el uso de códigos QR dinámicos, validación por geolocalización (GPS) y registro único de dispositivo.

## 2. Stack Tecnológico
- **Frontend:** React.js con Vite 7 (Versión estable).
- **Estilos:** Tailwind CSS (Diseño profesional y minimalista).
- **Backend/Base de Datos:** Supabase (PostgreSQL + Auth + Edge Functions).
- **Despliegue:** Vercel (Frontend) y Supabase Cloud (Backend).
- **Entorno:** Docker con Docker Compose para desarrollo local.

## 3. Modelo de Datos (PostgreSQL en Supabase)
El agente de IA debe generar las siguientes tablas:

- **estudiantes:** - `id` (uuid), `codigo_estudiante` (text, unico), `nombre_completo` (text), `device_id` (text, para evitar duplicidad).
- **sesiones_clase:** - `id` (uuid), `nombre_clase` (text), `ubicacion_lat` (float), `ubicacion_lng` (float), `rango_tolerancia` (int, metros), `token_qr` (text, dinámico).
- **asistencias:** - `id` (uuid), `estudiante_id` (fkey), `sesion_id` (fkey), `fecha_hora` (timestamp con zona horaria), `estado` (enum: 'Puntual', 'Presente', 'Tarde', 'Justificado'), `coordenadas_registro` (point).

## 4. Flujo de Usuario y Lógica de Negocio

### A. Pantalla de Ingreso (Identificación)
1. El sistema solicita el **Código de Estudiante**.
2. Validación: El código debe existir en la base de datos.
3. El sistema debe persistir la sesión localmente (LocalStorage) para evitar re-ingresos constantes.

### B. Módulo del Alumno (Marcado de Asistencia)
1. **Validación QR:** El alumno debe escanear un QR generado por el profesor. El QR contiene un token JWT que expira cada 15 segundos.
2. **Geolocalización:** Al escanear, el frontend captura las coordenadas GPS.
3. **Selección de Estado:** Tras validar el QR y el GPS, el alumno selecciona su estado:
   - Puntual
   - Presente
   - Tarde
   - Justificado
4. **Validación de Servidor:** La hora de registro se toma del servidor de Supabase, no del dispositivo del alumno.

### C. Módulo del Profesor (Panel de Control)
1. Generador de **QR Dinámico**: Un componente que refresca un código QR basado en un token temporal vinculado a la sesión de clase.
2. Monitor en Tiempo Real: Tabla que muestra a los alumnos que marcan asistencia al instante.

## 5. Instrucciones de Codificación para el Agente de IA

### Fase 1: Configuración de UI (React + Tailwind)
- Crea una interfaz "Mobile First" limpia.
- Usa `lucide-react` para iconos.
- Implementa estados de carga (skeletons) y notificaciones de éxito/error (toast).

### Fase 2: Lógica de Geolocalización
- Implementa una función `checkLocation` que use la API del navegador `navigator.geolocation`.
- Calcula la distancia entre el alumno y el aula usando la **Fórmula de Haversine**.

### Fase 3: Integración con Supabase
- Configura el cliente de Supabase en `src/api/supabase.js`.
- Implementa las políticas de seguridad **RLS (Row Level Security)** para que un alumno solo pueda insertar su propia asistencia.

### Fase 4: Generación de QR
- Usa `qrcode.react` para generar el código en la vista del profesor.
- Usa `html5-qrcode` o `react-qr-scanner` para la lectura en la vista del alumno.

## 6. Variables de Entorno (.env)
El sistema requiere:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`