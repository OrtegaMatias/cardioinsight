# Matriz de cumplimiento final — Certamen 1

**Grupo 14 · Joaquín Rivas · Matías Ortega**

## Dictamen

La solución técnica y los entregables locales están completos: entrenamiento reproducible, notebook ejecutado, dashboard interactivo, resultados, ficha, presentación importable en Canva, guion, preguntas de defensa y capturas de respaldo.

Quedan tres acciones externas que requieren una cuenta o confirmación del grupo: inscripción de la base con el profesor, publicación en Streamlit Community Cloud e importación a Canva.

## Matriz de los cuatro entregables

| Entregable obligatorio | Evidencia preparada | Estado local | Acción externa pendiente |
|---|---|---|---|
| Ficha de la base | `FICHA_BASE.md`: Kaggle/CDC, 253.680 registros, 21 predictoras, 9,42% minoritaria, costos y privacidad | Cumple | Adjuntar confirmación de inscripción con el profesor |
| Notebook ejecutado | `Certamen1_Grupo_14.ipynb`, 9 secciones, resultados y gráficos visibles, todas las celdas ejecutadas sin error | Cumple | Subir a Canvas/Drive |
| Dashboard | `app.py`, siete pestañas, cinco elementos mínimos, calibración y ROC/iso-costo; probado en navegador | Cumple localmente | Subir a GitHub y publicar URL de Streamlit |
| Presentación | `PRESENTACION_INTERACTIVA.html` del Grupo 14, PDF/PPTX, guion y declaración de IA | Cumple localmente | Importar PDF a Canva y compartir enlace visible |

## Matriz técnica contra el enunciado

| Requisito | Evidencia final | Estado |
|---|---|---|
| Más de 100.000 registros | 253.680 respuestas conservadas | Cumple |
| Objetivo binario | `HeartDiseaseorAttack`, 0/1 | Cumple |
| Minoritaria entre 1% y 30% | 9,42%; 23.893 positivos | Cumple |
| Al menos 8 predictoras | 21 | Cumple |
| EDA breve | Tipos, nulos, únicos, rangos, clases y gráficos en notebook | Cumple |
| Limpieza dentro de `ColumnTransformer` | Recorte declarado de BMI y escala numérica dentro del pipeline | Cumple |
| Split 80/20 estratificado | Train 202.944; test 50.736; semilla 2026 | Cumple |
| Cinco modelos obligatorios | Árbol, Random Forest, AdaBoost, XGBoost y LightGBM | Cumple |
| Etapa A sin fuga | `SMOTENC` dentro de `imblearn.Pipeline`, aplicado por fold | Cumple |
| Etapa B con pesos | Mecanismo específico en los cinco modelos; stump ponderado en AdaBoost | Cumple |
| Dos o más hiperparámetros/modelo | Grillas expandidas; diez muestras por búsqueda | Cumple |
| CV estratificada | `RandomizedSearchCV` + `StratifiedKFold`, 3 folds | Cumple |
| Tabla de diez combinaciones | F1 train/CV/test, brecha, recall, precisión, ROC-AUC, tiempo y PR-AUC | Cumple |
| Ganador elegido por CV | Random Forest + pesos; F1-CV 0,384 ± 0,006 | Cumple |
| Test solo confirma | F1-test 0,369; brecha train–test 0,014 | Cumple |
| Probabilidades en escala real | Random Forest reentrenado sin SMOTE ni pesos, mismos hiperparámetros | Cumple |
| Costos monetarios | FP CLP 100.000 aproximado con Arancel MLE FONASA 2025; FN CLP 1.000.000 declarado como supuesto 10×; sensibilidad 2×–50× | Cumple |
| Umbral teórico | 0,091 mediante `C_FP/(C_FP+C_FN)` | Cumple |
| Umbral empírico con train | 0,10 mediante `TunedThresholdClassifierCV` | Cumple |
| Cinco estrategias en test | Todo 0, 0,5, teórico, empírico y modelo Etapa B | Cumple |
| Costo, matriz, recall, precisión y ahorro | Notebook, CSV y dashboard | Cumple |
| Sensibilidad | Razones FN/FP 2, 5, 10, 20 y 50 | Cumple |
| Dashboard mínimo | Sliders de costos, umbral manual, curva, matriz e indicadores | Cumple |
| ROC con iso-costo | Pestaña adicional interactiva | Cumple opcional |
| Sesgos y privacidad | Revisión por sexo en notebook; límites clínicos y privacidad declarados | Cumple |
| Declaración de IA | Última diapositiva y notebook | Cumple |
| Respaldo de demo | Cuatro capturas en `respaldo_demo/` | Cumple |

## Resultados que deben poder defender

| Decisión | Resultado |
|---|---:|
| Ganador por F1-CV | Random Forest + pesos |
| F1-CV | 0,384 ± 0,006 |
| F1-test | 0,369 |
| Umbral teórico | 0,091 |
| Umbral empírico de train/CV | 0,10 |
| Recall con umbral 0,5 | 5,0% |
| Recall con umbral 0,10 | 83,0% |
| Precisión con umbral 0,10 | 23,3% |
| Costo con umbral 0,5 | CLP 4.550.700.000 |
| Costo con umbral 0,10 | CLP 2.117.800.000 |
| Ahorro estimado | CLP 2.432.900.000 |

## Riesgos cerrados durante la revisión

| Hallazgo original | Corrección aplicada |
|---|---|
| Eliminación injustificada de perfiles idénticos | Se conservan: no existe ID; quitaría 23.723 negativos y 176 positivos y elevaría artificialmente la prevalencia de 9,42% a 10,32% |
| SMOTE sobre categorías binarias/ordinales | Se reemplazó por `SMOTENC`, alineado con la plantilla de Netflix |
| AdaBoost B variaba la profundidad | Se fijó `max_depth=1`; se buscan `n_estimators` y `learning_rate` |
| Umbral dinámico calculado con test | El umbral reportable se obtiene de OOF/train; el mínimo de test se rotula retrospectivo |
| Dos aplicaciones Streamlit | Se consolidó una sola app canónica: `app.py` |
| Moneda y fundamento débiles | Se migró a CLP; FP basado en arancel FONASA y FN declarado como supuesto con sensibilidad |
| Dependencias abiertas | Versiones fijadas en dos archivos de requisitos |
| Falta de notebook y presentación | Ambos entregables fueron creados y ejecutados/generados |
| Falta de respaldo | Cuatro capturas reproducen resumen, costos y ROC |

## Verificación observada

- Entrenamiento completo: 10 búsquedas y artefactos regenerados en 3,7 minutos.
- Notebook ejecutado con `nbconvert`: todas las celdas tienen contador; cero salidas de error.
- Consistencia: diez combinaciones, tres folds, ganador por CV, brechas, costos, ahorros, 202.944 predicciones OOF y 50.736 predicciones test correctas.
- Lint funcional (`ruff --select F`) y compilación Python: aprobados.
- Dashboard abierto en Chromium; slider FN movido de CLP 1.000.000 a CLP 2.000.000; curva, matriz, indicadores y ROC respondieron; cero errores de página.
- Presentación HTML recorrida en Chromium; navegación, transiciones, ranking animado y simulador de costos funcionaron; cero errores de página. Las doce láminas se revisaron en contacto visual y se exportaron a PPTX/PDF.

## Acciones manuales antes de Canvas

1. Confirmar que la base está inscrita y guardar evidencia.
2. El Grupo 14 y los integrantes Joaquín Rivas y Matías Ortega ya figuran en la ficha, el notebook y la presentación.
3. Publicar `app.py`, `requirements.txt` y `resultados/` en Streamlit Community Cloud.
4. Abrir la URL pública desde otro dispositivo.
5. Importar `PRESENTACION_CERTAMEN.pdf` vectorial en Canva, revisar cada lámina y publicar enlace de visualización.
6. Ensayar con `GUION_EXPOSICION.md` y sortear al presentador en cada ensayo.
