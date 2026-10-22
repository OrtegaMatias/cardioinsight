# Preguntas y respuestas para la defensa

## ¿Por qué SMOTE/SMOTENC debe ir dentro del pipeline?

Porque cada fold debe crear sintéticos usando únicamente su porción de entrenamiento. Aplicarlo antes de CV permitiría que observaciones sintéticas relacionadas con el fold de validación influyan en el entrenamiento y produciría fuga.

## ¿Por qué SMOTENC y no SMOTE estándar?

Hay 18 variables binarias u ordinales. SMOTE estándar puede interpolarlas y crear categorías como `Stroke=0,37`. SMOTENC interpola las numéricas y asigna categorías válidas, siguiendo la plantilla de Netflix.

## ¿Por qué se conservaron 23.899 filas idénticas?

La base procesada contiene 21 respuestas discretizadas y el objetivo, pero **no tiene ID de encuestado**. Dos personas pueden responder exactamente igual; igualdad de perfil no prueba duplicación administrativa. `drop_duplicates()` cambia la unidad estadística: cada respuesta deja de contar y cada perfil único recibe peso uno, subrepresentando perfiles frecuentes, especialmente sanos.

| Evidencia calculada | Resultado |
|---|---:|
| Respuestas totales | 253.680 |
| Filas excedentes idénticas | 23.899 |
| Perfiles repetidos distintos | 11.187 |
| Filas pertenecientes a grupos repetidos | 35.086 |
| Máxima frecuencia de un perfil | 59 |
| Negativos que se eliminarían | 23.723 |
| Positivos que se eliminarían | 176 |
| Prevalencia original → tras eliminación | 9,42% → 10,32% |

El **99,3%** de las filas eliminadas serían negativas. La prevalencia subiría **0,90 puntos porcentuales**, alrededor de **9,6% en términos relativos**. También se desplazarían los factores de riesgo hacia presión alta, colesterol, diabetes, peor salud e ingresos menores: no es limpieza neutral. El perfil más repetido (59 respuestas) describe personas aparentemente sanas y físicamente activas, con buen estado de salud, educación e ingreso altos; es plausible que varios encuestados compartan ese perfil agrupado.

Solo eliminaríamos filas con evidencia de un ID repetido, reimportación/concatenación duplicada, mismo folio y fecha de un único evento, o documentación que exija perfiles únicos. Nada de ello consta en esta versión. Como límite metodológico, conservar perfiles iguales puede afectar una evaluación de generalización a *perfiles nuevos*; una validación agrupada por perfil sería un análisis adicional, no sustituye el split estratificado exigido ni justifica borrar observaciones.

## ¿Por qué Random Forest + pesos es el ganador?

Porque obtuvo el mayor F1 promedio de validación cruzada: 0,384. La regla estaba fijada antes de mirar test. Su desviación fue 0,006 y la brecha train–test 0,014, sin señal fuerte de sobreajuste.

## ¿Por qué XGBoost no gana si tiene mejor AUC?

La métrica primaria exigida es F1 de la clase 1. AUC y PR-AUC son diagnósticos secundarios. Cambiar la regla después de ver resultados sería selección oportunista.

## ¿Por qué reentrenar sin SMOTE ni pesos?

El umbral teórico supone probabilidades en la prevalencia real. SMOTE y pesos elevan artificialmente la probabilidad de la clase minoritaria. Balancear y bajar el umbral contaría dos veces el mismo costo.

## ¿De dónde sale el umbral teórico?

Predecir 0 tiene costo esperado `p × C_FN`; predecir 1, `(1-p) × C_FP`. Se elige 1 cuando `(1-p)C_FP ≤ pC_FN`, equivalente a `p ≥ C_FP/(C_FP+C_FN)`.

## ¿Por qué usar un umbral empírico además del teórico?

Las probabilidades estimadas no son perfectas. `TunedThresholdClassifierCV` prueba umbrales dentro de train y minimiza el costo promedio de CV, sin utilizar test.

## ¿El dashboard usa test para buscar un mínimo?

Sí, igual que el barrido ilustrativo del notebook del profesor, pero lo rotula como mínimo retrospectivo. No se usa como resultado reportable. El umbral reportado, 0,10, fue aprendido con train/CV.

## ¿Cómo se justifican CLP 100.000 y CLP 1.000.000?

El FP aproxima una consulta cardiológica, ECG y ecocardiograma con valores del Arancel MLE FONASA 2025: CLP 101.090, redondeado a CLP 100.000. Para el FN no hay una tarifa única: CLP 1.000.000 es un supuesto gerencial de 10×, sometido a sensibilidad 2×–50×. Un estudio chileno reportó CLP 423.300 por día UCI cardiovascular en valores de 2011; respalda la dirección del supuesto, no una tarifa individual.

## ¿Qué significa el ahorro?

Con 0,5 el costo del test fue CLP 4.550.700.000. Con el umbral CV 0,10 fue CLP 2.117.800.000. La diferencia bajo los supuestos es CLP 2.432.900.000.

## ¿Por qué cae la precisión al bajar el umbral?

Se clasifican más personas como positivas. Eso reduce FN y aumenta recall, pero también aumenta FP y disminuye precisión. Es aceptable cuando un FN cuesta diez veces un FP.

## ¿Se puede usar clínicamente?

No. Es un ejercicio académico con encuesta autoinformada, costos supuestos y sin validación externa, calibración clínica ni auditoría completa de equidad.
