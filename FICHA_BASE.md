# Ficha de la base

**Grupo 14 — Joaquín Rivas y Matías Ortega**

- **Nombre:** Heart Disease Health Indicators Dataset.
- **Área:** salud cardiovascular.
- **Archivo usado:** `heart_disease_health_indicators_BRFSS2015.csv`.
- **Fuente procesada:** https://www.kaggle.com/datasets/alexteboul/heart-disease-health-indicators-dataset
- **Fuente primaria:** https://www.cdc.gov/brfss/annual_data/annual_2015.html
- **Año:** BRFSS 2015.
- **Registros usados:** 253.680.
- **Variable objetivo:** `HeartDiseaseorAttack` (0/1).
- **Predictoras:** 21.
- **Clase minoritaria:** 9,42% (23.893 casos positivos).
- **Nulos:** 0.
- **Filas con perfiles y target idénticos:** 23.899; se conservan porque la base no contiene identificador y respuestas iguales pueden corresponder a personas distintas.
- **Contexto de negocio:** priorizar derivaciones a evaluación cardiológica.
- **Costo FP:** CLP 100.000; aproximación de consulta cardiológica, ECG y ecocardiograma según Arancel MLE FONASA 2025.
- **Costo FN:** CLP 1.000.000; supuesto gerencial conservador de 10×, respaldado en dirección —no como tarifa— por costos chilenos de UCI cardiovascular.
  - FONASA: https://www.fonasa.cl/sites/fonasa/adjuntos/1%20Libro%20Arancel%20MLE%202025
  - Alvear et al. (2013): https://doi.org/10.4067/S0034-98872013000200009
- **Privacidad:** versión pública, agregada y sin identificadores personales directos.
- **Restricción de uso:** proyecto académico; no constituye diagnóstico ni dispositivo clínico validado.


## Fundamento de los costos

Los costos son **escenarios en pesos chilenos**, no tarifas clínicas universales. Dependen del prestador, cobertura, gravedad y horizonte temporal. El FP se aproxima con un arancel público; el FN es un supuesto gerencial de 10× sometido a sensibilidad.

| Error | Costo base | Naturaleza |
|---|---:|---|
| Falso positivo: derivación innecesaria | CLP 100.000 | Aproximación del costo de recursos |
| Falso negativo: caso no detectado | CLP 1.000.000 | Supuesto, no precio observado |

### Falso positivo: Arancel MLE FONASA 2025

| Componente | Código FONASA | Arancel nivel 1 |
|---|---:|---:|
| Consulta de cardiología | 01-01-301 | CLP 18.890 |
| ECG de reposo | 17-01-001 | CLP 7.490 |
| Ecocardiograma Doppler color | 17-01-045 | CLP 74.710 |
| **Total de referencia** | | **CLP 101.090** |

Se redondea a **CLP 100.000**; no representa el copago exacto de cada paciente. Fuentes: [Libro Arancel MLE FONASA 2025](https://www.fonasa.cl/sites/fonasa/adjuntos/1%20Libro%20Arancel%20MLE%202025) y [copia del Servicio de Salud Metropolitano Sur Oriente](https://redsalud.ssmso.cl/wp-content/uploads/2025/05/1-Libro-Arancel-FONASA-2025.pdf).

### Falso negativo: supuesto explícito

El retraso diagnóstico puede implicar urgencia, hospitalización, medicamentos, secuelas o pérdida de productividad; **no existe una tarifa única** para un FN. Alvear S., Canteros J., Jara J. y Rodríguez P. (2013), [*Costos reales de tratamientos intensivos por paciente y día cama*](https://doi.org/10.4067/S0034-98872013000200009), *Revista Médica de Chile*, 141(2), 202–208, reportaron CLP 423.300 por día UCI cardiovascular y seis días promedio, **en pesos de 2011**. No se afirma que cada FN cause una estancia en UCI: la referencia solo dimensiona una posible complicación.

La razón FN/FP de 10× distingue la decisión gerencial del arancel observado. Se comprueban razones **2×, 5×, 10×, 20× y 50×**; el escenario base produce el umbral teórico `100.000 / (100.000 + 1.000.000) = 0,091`.
