# Certamen 1 — Ensambles, costo y umbral óptimo

**Grupo 14 · Joaquín Rivas · Matías Ortega**

Proyecto de clasificación binaria sobre **Heart Disease Health Indicators**, una versión procesada del BRFSS 2015.

**Repositorio público:** https://github.com/OrtegaMatias/cardioinsight

## Fuentes

- Dataset procesado: https://www.kaggle.com/datasets/alexteboul/heart-disease-health-indicators-dataset (Alex Teboul, licencia **CC0: Public Domain** según la [API de metadatos de Kaggle](https://www.kaggle.com/api/v1/datasets/view/alexteboul/heart-disease-health-indicators-dataset)).
- Fuente primaria y documentación: https://www.cdc.gov/brfss/annual_data/annual_2015.html

Se incluye el CSV procesado de 253.680 respuestas y 21 predictoras para facilitar la reproducción del análisis. No es el archivo bruto del CDC, que contiene 441.456 registros y 330 variables. No contiene identificadores personales directos; eso no convierte una respuesta de salud ingresada por un visitante en información pública.

## Flujo

1. Partición train/test 80/20 estratificada, semilla 2026.
2. Limpieza dentro de `ColumnTransformer`.
3. Cinco modelos × dos etapas: SMOTENC y pesos.
4. `RandomizedSearchCV`, F1 de clase 1 y tres folds.
5. Elección del ganador por F1-CV.
6. Reentrenamiento del mismo algoritmo sin balanceo para recuperar probabilidades en escala real.
7. Umbral teórico y `TunedThresholdClassifierCV` solo con train.
8. Comparación económica y sensibilidad.
9. Dashboard Streamlit.

Se usa **SMOTENC**, variante de SMOTE vista en la plantilla de Netflix, porque 18 predictoras son binarias u ordinales. Así no se generan categorías fraccionarias.

## Instalación local

En macOS, LightGBM necesita OpenMP:

```bash
brew install libomp
```

Crear el entorno e instalar dependencias:

```bash
uv venv --python 3.13 .venv
uv pip install --python .venv/bin/python -r requirements_entrenamiento.txt
```

### Ejecución en VS Code

Abre **la carpeta `certamen 1`** en VS Code e instala las extensiones Python y Jupyter. En la esquina superior derecha del notebook, **Select Kernel → Python Environments → `.venv/bin/python` (Python 3.13)**; luego usa **Restart Kernel and Run All Cells**. Si ya abriste la carpeta padre, el notebook también localiza `certamen 1`, su CSV y `entrenar_modelo.py`.

El kernel guardado anteriormente apuntaba a Python 3.14 y fallaba con `ModuleNotFoundError: No module named 'imblearn'`. La solución es seleccionar el entorno `.venv` instalado con `requirements_entrenamiento.txt`, no instalar paquetes en el Python global ni cambiar el algoritmo. Si `.venv` no aparece, usa **Select Kernel → Python Environments → Select Another Interpreter** y selecciona el archivo `certamen 1/.venv/bin/python`.

## Entrenamiento final

```bash
.venv/bin/python entrenar_modelo.py \
  --csv heart_disease_health_indicators_BRFSS2015.csv \
  --n-sub 30000 --n-iter 10 --cv-folds 3 --salida resultados
```

Las respuestas idénticas se conservan: BRFSS no incluye un identificador que permita afirmar que dos perfiles iguales pertenecen a la misma persona. `--eliminar-duplicados` solo debe usarse si se obtiene evidencia de duplicación administrativa.

## Prueba rápida

```bash
.venv/bin/python entrenar_modelo.py \
  --csv heart_disease_health_indicators_BRFSS2015.csv \
  --filas-demo 3000 --n-sub 1000 --n-iter 1 --cv-folds 2 \
  --salida resultados_demo
```

## Aplicación web

El dashboard original `app.py` sigue disponible para reproducir la entrega de Streamlit. La aplicación para `https://cardioinsight.cvdi.cl` utiliza **Next.js** (`web/`) y **FastAPI** (`api/`) con un Compose independiente. El encabezado muestra el logo UDD reutilizado del proyecto de IA para la gestión industrial.

La pantalla inicial es un **dashboard gerencial centrado en datos**: controles de costos FP/FN y umbral, KPIs de costo total, comparación frente a 0,50, recall y precisión; curva interactiva de costo y matriz de confusión; debajo, tabla comparativa del corte de referencia y el escenario actual, y límites de interpretación. En móvil los KPI y gráficos aparecen antes de los controles desplegables. «Evidencia» conserva los siete análisis del certamen y «Simulación individual» ofrece el formulario educativo de 21 variables.

El corte 0,10 fue seleccionado con train/CV para los costos originales; alterar los costos **no** selecciona ni valida un nuevo corte. La curva y los conteos en test son retrospectivos, no ahorros proyectados ni riesgos clínicos individuales. La app no diagnostica ni recomienda tratamientos.

El dashboard y la simulación individual son públicos y no requieren clave ni sesión. `resultados/modelo_inferencia.joblib` está versionado: es el pipeline entrenado reducido para inferencia (~16 MB), sin datos de visitantes. El paquete completo `resultados/modelo_final.joblib` (~100 MB) se conserva solo en local y se ignora en Git. La app no almacena respuestas del formulario ni entradas del simulador; **evita introducir datos personales o identificables**. Infraestructura externa como Cloudflare puede mantener registros operativos según su configuración. La API limita el tamaño de cada solicitud de inferencia y los contenedores tienen límites de recursos, pero el acceso público permite tráfico y consumo de recursos por terceros.

### Ejecutar en local

Con Docker disponible, desde esta carpeta:

```bash
docker compose up -d --build
```

Abrir `http://127.0.0.1:8091` directamente. La inferencia utiliza `resultados/modelo_inferencia.joblib`, que se descarga con el repositorio; el dashboard lee los demás archivos versionados en `resultados/`.

### Publicar sin tocar otros proyectos

El `docker-compose.yml` usa el proyecto/red `cardioinsight`, limita CPU/memoria y enlaza **solo** `127.0.0.1:8091`; no comparte compose, volúmenes ni puertos con Firma MC o NeuroLens. Los límites acotan el consumo de los contenedores, pero no eliminan el riesgo de saturación del host, disco o red: supervisar recursos en el servidor.

Primera instalación: en el servidor, crear **solo** este clon (no usar los directorios de las otras apps):

```bash
git clone https://github.com/OrtegaMatias/cardioinsight.git ~/cardioinsight
```

En el servidor, actualizar únicamente este clon y su Compose (se solicita la contraseña `sudo` del servidor):

```bash
cd ~/cardioinsight && git pull
sudo docker compose up -d --build
```

La ruta de Cloudflare Tunnel `cardioinsight.cvdi.cl` apunta a `http://localhost:8091` y se mantiene separada de las rutas existentes. La nueva versión no monta ni usa claves o sesiones. En el servidor se retiró exclusivamente el cron de rotación de CardioInsight; la rotación de NeuroLens a las 05:00 sigue intacta. Tras reconstruir los contenedores, puede borrarse el archivo antiguo `~/cardioinsight/acceso/clave`, que queda fuera del repositorio.

Para regenerar el artefacto versionado tras entrenar de nuevo (sin volver a entrenar):

```bash
docker compose build api
docker run --rm --user="$(id -u):$(id -g)" -v "$PWD/resultados:/app/resultados" cardioinsight-api:latest python /app/exportar_modelo.py
```

## Notebook

`Certamen1_Grupo_14.ipynb` reproduce la narrativa exigida y consume el flujo canónico de `entrenar_modelo.py`. Se entrega ejecutado con los resultados visibles.

## Presentación y exportación

Abrir `PRESENTACION_INTERACTIVA.html` junto a `respaldo_demo/`: el HTML funciona sin CDN, pero la captura del dashboard usa esa carpeta. Flechas, espacio, Page Up/Down, Home/End, botones inferiores y deslizamiento táctil navegan; `F` activa pantalla completa. La lámina de umbral permite mover FP, FN y el umbral manual; el mínimo de test es **retrospectivo**, mientras el umbral reportable 0,10 fue seleccionado por CV en train.

El HTML actual tiene **12 láminas**: el flujo explica seis pasos del código; la curva de costo y los controles están en una lámina, y la ROC completa, su zoom e iso-costo junto con la matriz de confusión, en la siguiente. El PDF, PPTX y las doce PNG existentes son exportaciones anteriores y **no reflejan** estos cambios. Cuando terminen los cambios de diseño, regenerar los respaldos instalando Google Chrome y Poppler (`brew install poppler`) y ejecutar:

```bash
.venv/bin/python exportar_presentacion_estatica.py
```

Después de regenerar, importar `PRESENTACION_CERTAMEN.pdf` en Canva (16:9), revisar cada lámina y compartir enlace con permiso de visualización. Hasta entonces **no entregar el PDF/PPTX antiguos como si correspondieran al HTML**. Las capturas/diapositivas corresponden a la versión Streamlit; en la exposición, indicar explícitamente que la nueva demo web migró a Next.js o actualizar capturas antes de presentarla. El PPTX conserva las láminas como imágenes 4K, no elementos editables.

## Entregables preparados

- `FICHA_BASE.md`: ficha exigida para inscripción/Canvas y fundamento documentado de los costos.
- `Certamen1_Grupo_14.ipynb`: notebook final ejecutado.
- `app.py`: dashboard canónico.
- `PRESENTACION_INTERACTIVA.html`: presentación actual de 12 láminas. `PRESENTACION_CERTAMEN.pdf`, `.pptx` y las PNG siguen en su versión anterior; falta regenerarlos cuando terminen los cambios.
- `GUION_EXPOSICION.md`: guion actualizado a la secuencia actual de 12 láminas.
- `PREGUNTAS_DEFENSA.md`: respuestas técnicas y evidencia de la decisión sobre filas idénticas.
- `MATRIZ_REVISION.md`: cumplimiento final, verificaciones y acciones manuales.
- `respaldo_demo/`: capturas de respaldo del dashboard.
- `presentacion_web_assets/` y `exportar_presentacion_estatica.py`: PNG anteriores y script de exportación preparado para 12 láminas.

## Costos

- FP = CLP 100.000: aproximación de consulta cardiológica, ECG y ecocardiograma según Arancel MLE FONASA 2025.
- FN = CLP 1.000.000: supuesto gerencial conservador de 10×, no tarifa clínica.

El estudio chileno de Alvear et al. reportó CLP 423.300 por día UCI cardiovascular en valores de 2011; se usa para dimensionar una posible complicación, no como tarifa individual. La sensibilidad prueba razones FN/FP de 2× a 50×. Fuentes, códigos FONASA y límites del supuesto: `FICHA_BASE.md`.

## Uso de inteligencia artificial

Se usó un asistente de programación de OpenAI para apoyar la migración del dashboard Streamlit a Next.js/FastAPI, el diseño de la interfaz y la revisión de seguridad del despliegue. El entrenamiento y los resultados se basan en `entrenar_modelo.py` y el notebook ejecutado; no se inventaron métricas con un LLM. El grupo debe revisar y poder explicar el código antes de exponer.
