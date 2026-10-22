# Guion de exposición — máximo 15 minutos

**Grupo 14 · Joaquín Rivas · Matías Ortega**

## 0:00–2:00 · Contexto y problemática

- Base procesada de Kaggle; fuente primaria CDC BRFSS 2015.
- 253.680 respuestas, 21 predictoras, 9,42% positivos, sin nulos.
- Decisión de negocio: priorizar derivaciones cardiológicas; definir FP y FN antes de comparar modelos.
- Conservar respuestas idénticas: no hay ID; eliminarlas subiría artificialmente la prevalencia de 9,42% a 10,32%.

## 2:00–3:00 · Preparación

- Split 80/20 estratificado, semilla 2026.
- Limpieza dentro de `ColumnTransformer`.
- SMOTENC dentro de `imblearn.Pipeline`; solo ve train de cada fold.
- SMOTENC se usa porque hay variables binarias/ordinales, como enseña la plantilla de Netflix.

## 3:00–7:00 · Parte 1

- Cinco algoritmos × SMOTENC/pesos = diez combinaciones.
- Búsqueda: submuestra estratificada 30.000, diez combinaciones, tres folds, F1.
- Mostrar tabla y gráfico de folds.
- Ganador: Random Forest + pesos, F1-CV 0,384 ± 0,006.
- Test 0,369; brecha 0,014. El test confirma, no selecciona.
- Si preguntan por XGBoost: logró mejor AUC/PR-AUC, pero la rúbrica exige elegir por F1-CV.

## 7:00–10:00 · Parte 2

- “El FP se aproxima en CLP 100 mil con consulta cardiológica, ECG y ecocardiograma del Arancel MLE FONASA 2025. Para el FN no existe tarifa única: usamos el supuesto de CLP 1 millón y probamos sensibilidad entre 2 y 50 veces. La literatura chilena de UCI cardiovascular dimensiona una posible complicación, no una tarifa individual.”
- Explicar `p* = C_FP / (C_FP + C_FN)`.
- Reentrenar Random Forest con proporción real, sin SMOTE ni pesos, mismos hiperparámetros.
- Umbral teórico 0,091; empírico CV 0,10.
- Umbral 0,5: recall 5,0%, costo CLP 4.550.700.000.
- Umbral empírico: recall 83,0%, precisión 23,3%, costo CLP 2.117.800.000.
- Ahorro: CLP 2.432.900.000.
- Sensibilidad: al subir FN/FP, baja el umbral.

## 10:00–13:00 · Demo

1. Abrir Resumen.
2. Ir a Costo y umbral con FP CLP 100.000/FN CLP 1.000.000.
3. Mover FN a CLP 2.000.000 y observar p*, curva y ahorro.
4. Mover el umbral manual y leer matriz/indicadores.
5. Mostrar Sensibilidad y ROC e iso-costo.

Aclarar: el mínimo de test se muestra solo como ilustración retrospectiva, igual que en el notebook del profesor. El umbral válido se selecciona por CV con train.

## 13:00–15:00 · Recomendación y limitaciones

- Regla recomendada académica: Random Forest en proporción real, umbral 0,10.
- Costos supuestos; no hacer inferencia clínica.
- Encuesta autoinformada y posibles sesgos por sexo, edad e ingreso.
- La importancia no es causalidad.
- Cerrar con ahorro, no con F1.

## Preguntas que todo integrante debe poder responder

1. ¿Por qué SMOTE dentro del pipeline evita fuga?
2. ¿Por qué se usa SMOTENC?
3. ¿Por qué el ganador se elige por CV?
4. ¿Por qué se reentrena sin balanceo para costos?
5. ¿De dónde sale el umbral teórico?
6. ¿Qué hace `TunedThresholdClassifierCV`?
7. ¿Por qué el mínimo de la curva de test no es el umbral reportable?
8. ¿Por qué baja el umbral cuando FN se encarece?
9. ¿Por qué XGBoost no se declara ganador aunque tenga mayor AUC?
10. ¿Qué limitaciones impiden uso clínico?

## Secuencia de las 12 láminas

La presentación principal es `PRESENTACION_INTERACTIVA.html`. El PDF y PPTX aún corresponden a una versión anterior; regenerarlos cuando se cierre el diseño. La captura del dashboard es solo respaldo; para la demo se usa `app.py`. La declaración del uso de IA figura en el cierre.

| Lámina | Mensaje para decir en voz alta |
|---|---|
| 1. Portada | Del modelo a una decisión clínica con costo; BRFSS 2015, Grupo 14. |
| 2. Contexto | Encuesta BRFSS 2015: señales de enfermedad cardíaca o infarto, no diagnóstico. Derivar de más usa recursos; omitir casos puede retrasar evaluación. Son 253.680 respuestas, 21 predictoras y 9,42% positivos. |
| 3. Problemática | FP y FN tienen impactos distintos: minimizar `FP × C_FP + FN × C_FN`. |
| 4. Flujo | En seis pasos: 80/20 estratificado → limpieza en pipeline → SMOTENC o pesos → búsqueda CV (30.000 filas, diez configuraciones, tres folds) → elegir por F1-CV → reentrenar sin balanceo y ajustar umbral con train. |
| 5. Resultados | Ranking de F1-CV de diez combinaciones; el test confirma, no selecciona. |
| 6. Ganador | Random Forest + pesos: F1-CV 0,384 ± 0,006; test 0,369. La importancia de variables no prueba causalidad. |
| 7. Costos | FP: arancel FONASA redondeado a CLP 100.000. FN: supuesto de CLP 1.000.000, sometido a sensibilidad. |
| 8. Costo y umbral | Mover costos FP/FN y umbral manual; la curva muestra el costo total. Umbral teórico 0,091; empírico 0,10 elegido en train. |
| 9. ROC y matriz | Los tres controles pequeños replican los de la lámina anterior. ROC completa a la izquierda; recuadro punteado = zoom cercano a 0,10 a la derecha, con teórico (cuadrado), CV (estrella), manual (círculo) e iso-costo. El 0,5 queda fuera del zoom. Abajo: FP/FN y costo en CLP al umbral manual. |
| 10. Sensibilidad | Razones FN/FP de 2× a 50×; a mayor costo de omitir casos, menor umbral. |
| 11. Dashboard | Demo de controles, umbral manual, curva, matriz, ahorro y ROC/iso-costo. |
| 12. Cierre | Regla: derivar desde 0,10. En test, recall 83,0% y ahorro estimado CLP 2.433 millones vs. 0,5. Antes de uso clínico: validar en otra población, revisar sesgos y confirmar costos; declarar uso de IA. |
