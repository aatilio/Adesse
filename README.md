# ADESE 🎓 `v1.5.0`

Una aplicación web moderna diseñada para registrar, controlar y gestionar de manera interactiva la asistencia de estudiantes en tiempo real. 

**ADESE** (Asistencia Digital Estratégica para el Sector Educativo) fue estructurado bajo un enfoque *Mobile-First* pensando en la facilidad para que los alumnos confirmen su presencia escaneando un código QR dinámico proveído por el docente. Todo el sistema está orquestado mediante **Docker**, aislando de forma segura la Base de Datos, el API Backend y el Frontend.

## 🚀 Características Principales

* **Control de Horario Flexible:** Los límites de tiempo son 100% configurables por el docente para cada sesión (Puntual, Presente, Tarde). El sistema bloquea inteligentemente el registro fuera de los horarios establecidos, garantizando integridad en los reportes.
* **Escaneo de Código QR Activo:** En lugar de ser un simple pase de lista fijo, la pantalla del profesor genera códigos interactivos (JWT) renovables cada 15 segundos, impidiendo que el alumno haga fraude con fotos de códigos anteriores.
* **Panel Docente en Tiempo Real:** 
  * Ver quién llegó, con qué estado de asistencia de manera automática y a qué hora.
  * Modificar o justificar asistencias.
  * Modificar directamente nombres o CI/CUI del alumnado sin necesidad de consultas manuales.
* **Modo Offline/Prueba Integrado:** Permite a los programadores interactuar con el escáner haciendo bypass local sin requerir de dos cámaras 🧪.

## 🛠️ Stack Tecnológico

La aplicación está construida sobre un stack moderno y eficiente:
* **Frontend:** React + Vite (Alojado en Node.js, interactivo mediante CSS Moderno).
* **Backend:** Express API + Node.js
* **Base de Datos:** PostgreSQL + Supabase
* **Contenedores:** Docker + Docker Compose, adicional pgAdmin opcional.
* **Librerías Adicionales:** Lucide-react (Íconos), QRCode (Generador QR interactivo), JsonWebToken (Cifrado).

## 📁 Estructura del Proyecto

```text
asistencia-app/
├── backend/                # API Express + Lógica DB
│   ├── Dockerfile          # Configuración de imagen de backend
│   ├── index.js            # Punto de entrada de la API
│   ├── init.sql            # Esquema y semillas de PostgreSQL
│   └── package.json        # Dependencias del backend
├── src/                    # Aplicación React (Frontend)
│   ├── api/                # Cliente para peticiones HTTP
│   ├── components/         # Componentes UI (QR, Tablas, Toast)
│   ├── pages/              # Vistas completas (Login, Alumno, Profesor)
│   ├── App.jsx             # Enrutador y gestión de sesiones
│   ├── main.jsx            # Punto de entrada de React
│   └── index.css           # Sistema de diseño y estilos globales
├── .gitignore              # Archivos excluidos de Git
├── docker-compose.yml      # Orquestación de contenedores
├── vercel.json             # Configuración para despliegue Cloud
└── README.md               # Documentación general
```

## 🎮 Guía de Inicio (Local)

Al usar Docker Compose, correr la aplicación completa requiere un solo comando.

1. Instala [Docker](https://www.docker.com/).
2. Clona este proyecto o sitúate en la raíz.
3. Levanta los servicios escribiendo:
   ```bash
   docker compose up -d --build
   ```

## 🙋‍♂️ Cómo se usa

1. **Si eres Docente:**
   * Inicia sesión con el código: **PROF01**.
2. **Si eres Alumno:**
   * Inicia sesión con tu código CUI matriculado.

## 🗄️ Esquema DB

* `estudiantes`: Tabla base del alumnado.
* `sesiones_clase`: Manejo de clases abiertas, cerradas y llaves temporales QR.
* `asistencias`: Tabla principal referencial que documenta Estado y Hora entre cada sesión/alumno.
