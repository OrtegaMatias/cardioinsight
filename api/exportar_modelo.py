"""Extrae el pipeline entrenado para inferencia, sin repetir el entrenamiento.

Ejecutar solo sobre el modelo_final.joblib generado localmente por entrenar_modelo.py.
La serialización original conserva dos funciones del módulo __main__ del entrenador;
este proceso las resuelve y guarda únicamente el pipeline con referencia estable a main.
"""

import sys
from pathlib import Path

import joblib
from sklearn.metrics import confusion_matrix

from main import recortar_bmi


SOURCE = Path('/app/resultados/modelo_final.joblib')
TARGET = Path('/app/resultados/modelo_inferencia.joblib')


def costo(y_true, y_pred, c_fp=100_000, c_fn=1_000_000):
    _, fp, fn, _ = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
    return c_fp * fp + c_fn * fn


def exportar() -> None:
    # joblib/pickle solo admite artefactos propios: nunca cargar archivos de visitantes.
    sys.modules['__main__'].recortar_bmi = recortar_bmi
    sys.modules['__main__'].costo = costo
    original = joblib.load(SOURCE)
    estimador = original['mejor_con_umbral'].estimator_
    if not callable(getattr(estimador, 'predict_proba', None)):
        raise ValueError('El artefacto de entrenamiento no contiene el estimador esperado')
    temporal = TARGET.with_suffix('.joblib.tmp')
    joblib.dump(estimador, temporal, compress=3)
    temporal.replace(TARGET)
    print(f'Modelo de inferencia exportado: {TARGET} ({TARGET.stat().st_size} bytes)')


if __name__ == '__main__':
    exportar()
