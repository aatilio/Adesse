# Especificaciones Técnicas: Módulo de Regresión Econométrica (React + Python en Vercel)

## 🎯 Objetivo del Proyecto
Desarrollar una página/módulo independiente y totalmente interactivo dentro del sistema web actual. Este módulo debe permitir a los usuarios cargar conjuntos de datos, gestionar variables, renombrarlas y ejecutar modelos de regresión lineal (simple y múltiple). El procesamiento matemático pesado debe delegarse a un backend en Python (FastAPI) corriendo de forma efímera (Serverless) en Vercel, el cual evaluará automáticamente la presencia de heterocedasticidad para ajustar las fórmulas de inferencia estadística (errores estándar convencionales vs. robustos HC3). El frontend en React se encargará exclusivamente de la interfaz, el control de datos y la visualización gráfica interactiva.

---

## 🛠️ Arquitectura y Stack Tecnológico
* **Frontend:** React (Vite + pnpm), Tailwind CSS para el diseño UI. Librería de gráficos: `Recharts`.
* **Backend:** Python 3.9+ desplegado en **Vercel Serverless Functions** (dentro de la carpeta `/api` utilizando FastAPI).
* **Librerías de Cálculo (Python):** `pandas`, `numpy`, `statsmodels`, `scipy`.
* **Persistencia:** Ninguna (procesamiento efímero 100% en memoria por petición).

---

## 📋 Requisitos Funcionales y Flujo de Trabajo

### 1. Gestión de Datos e Interfaz (React Frontend)
* **Ingesta de Datos Múltiple:** * Permitir al usuario importar archivos externos en formato `.csv` mediante un botón de carga.
  * Proveer un área de texto interactiva (*textarea*) que funcione como un editor de datos manual en formato CSV.
* **Exportación:** Incluir un botón para **Descargar los datos actuales en formato Excel/CSV**, añadiendo el bom de codificación (`\uFEFF`) para asegurar la compatibilidad total con Microsoft Excel de forma nativa.
* **Control y Renombrado de Variables:**
  * El sistema debe mapear automáticamente los encabezados del CSV cargado.
  * Renderizar un panel que permita al usuario **renombrar las variables directamente en la interfaz** mediante inputs de texto, cambiando las etiquetas visuales del sistema sin alterar la estructura matricial subyacente.
* **Configuración del Modelo:**
  * Un menú desplegable (*Select*) único para definir la Variable Dependiente ($Y$).
  * Un listado de casillas de verificación (*Checkboxes*) dinámicas para seleccionar una o más Variables Independientes ($X_1, X_2, \dots, X_k$).
  * Un selector con opciones fijas para el Nivel de Confianza de los intervalos (90%, 95%, 99%).

### 2. Microservicio de Cálculo Estadístico (Python Backend)
Crear un endpoint bajo la ruta `POST /api/calculate` utilizando FastAPI. Este recibirá un objeto JSON con la estructura de las variables, la matriz de datos y el nivel de confianza elegido. La ejecución del script debe seguir estrictamente este flujo econométrico:

1. **Estructuración Matricial:** Convertir los arreglos recibidos en vectores flotantes de Pandas. Construir la matriz de regresores agregando explícitamente la columna de constantes (unos) para el cálculo del intercepto ($\beta_0$) mediante `sm.add_constant()`.
2. **Diagnóstico de Heterocedasticidad Automático:** * Ejecutar una regresión inicial por MCO tradicional.
   * Extraer el vector de residuos del modelo: $\hat{u}_i = Y_i - \hat{Y}_i$.
   * Aplicar la **Prueba de Breusch-Pagan** (`het_breuschpagan`) utilizando los residuos y la matriz de regresores con constante.
   * **Regla de Decisión:** Si el p-valor de la prueba del multiplicador de Lagrange es **menor a 0.05**, el backend marcará el modelo con evidencia de **Heterocedasticidad**. Si es igual o mayor, se asumirá **Homocedasticidad**.
3. **Ajuste de Inferencia:**
   * **Si hay Homocedasticidad:** Ejecutar la estimación estándar por MCO tradicional, calculando los errores estándar basados en la varianza común de los residuos del modelo.
   * **Si hay Heterocedasticidad:** Forzar al método de estimación a calcular errores estándar robustos utilizando la corrección **HC3** de Eicker-Huber-White (`cov_type='HC3'`), óptima para muestras pequeñas, asegurando intervalos válidos ante varianza no constante.
4. **Construcción del Reporte de Salida:** Retornar un JSON con el tamaño de muestra ($n$), el coeficiente de determinación ($R^2$), el **$R^2$ ajustado**, la etiqueta del tipo de error estándar utilizado, y un arreglo con los coeficientes ($\hat{\beta}_j$), errores estándar, estadísticos $t$, p-valores correspondientes e intervalos de confianza inferiores y superiores ajustados al nivel configurado.

### 3. Visualización y Rendimiento Gráfico (React Frontend)
Al recibir la respuesta exitosa del servidor, el componente debe renderizar de manera limpia las siguientes secciones:

* **Bloque de Tarjetas de Métricas:** Mostrar de forma ejecutiva el tamaño de muestra, $R^2$, $R^2$ ajustado y una alerta de color dinámica que indique si el modelo procesó errores tradicionales o corregidos por White (HC3).
* **Tabla de Coeficientes Estilo Stata:** Una grilla tabular limpia con formato numérico estricto a **4 decimales**. Los coeficientes deben incluir anotación por asteriscos según el nivel de significancia del p-valor ($^{***}$ para $p < 0.01$, $^{**}$ para $p < 0.05$, $^{*}$ para $p < 0.10$).
* **Gráfico de Dispersión y Ajuste Lineal:** Utilizando `ScatterChart` de Recharts, pintar los puntos reales $(X, Y)$ (tomando la primera variable independiente seleccionada). Trazar sobre los puntos una línea continua que represente el valor predicho ($\hat{Y}$) para observar visualmente la bondad de ajuste.
* **Campana de Gauss Interactiva de Inferencia:**
  * Dibujar la curva de densidad de una distribución Normal Estándar utilizando un set de datos continuo mapeado desde el backend (de $-4.0$ a $4.0$).
  * Marcar líneas de referencia discontinuas en color rojo que representen los **valores críticos** ($\pm Z$) del nivel de confianza (ej. $\pm 1.96$ para el 95%).
  * Cruzar la gráfica con una línea vertical sólida y visible que marque la posición exacta del **Estadístico $t$ calculado** para el regresor principal. Esto permitirá verificar visualmente si el estimador cae dentro de la zona de rechazo (significativo) o de no rechazo.

---

## ⚠️ Validaciones Críticas y Control de Errores
1. **Grados de Libertad:** Si el usuario intenta ejecutar el modelo con un número de observaciones menor o igual al número de variables independientes más uno ($n \le k + 1$), el sistema debe bloquear la ejecución en el frontend o responder con un error HTTP 400 controlado desde Python para evitar fallos de división por cero.
2. **Multicolinealidad Perfecta:** Capturar excepciones en el backend por matrices singulares (cuando una variable es combinación lineal exacta de otra). Si ocurre, interceptar el error y mostrar un mensaje descriptivo en la UI: *"Error: Alta multicolinealidad o matriz singular detectada"*.
3. **Tipos de Datos:** Asegurar que cualquier celda vacía o valor no numérico importado sea transformado a flotante o saneado antes de ser transmitido al microservicio.