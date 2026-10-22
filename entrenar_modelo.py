# -*- coding: utf-8 -*-
"""
Certamen 1 - Ensambles, costo de clasificación y umbral óptimo
==============================================================
Base: Heart Disease Health Indicators (CDC BRFSS 2015) | Objetivo: HeartDiseaseorAttack

Este script ejecuta TODO el flujo del certamen y guarda los resultados en la carpeta
`resultados/`, que luego lee la app de Streamlit (app.py) para mostrar el reporte:

    Base > 100.000 -> Pipeline -> 5 modelos x 2 etapas (SMOTE / pesos) -> Mejor modelo
         -> Costos FP y FN -> Umbral óptimo -> Sensibilidad -> Archivos para el dashboard

Uso (en Colab o en tu computador):
    pip install -r requirements_entrenamiento.txt
    python entrenar_modelo.py --csv heart_disease_health_indicators_BRFSS2015.csv

Prueba rápida (pocos minutos, solo para verificar que todo corre):
    python entrenar_modelo.py --csv heart_disease_health_indicators_BRFSS2015.csv \
        --filas-demo 15000 --n-sub 4000 --n-iter 2 --cv-folds 2 --salida resultados_demo
"""
import argparse
import json
import os
import time
import warnings

import joblib
import numpy as np
import pandas as pd

from imblearn.over_sampling import SMOTENC
from imblearn.pipeline import Pipeline
from lightgbm import LGBMClassifier
from sklearn.base import clone
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import AdaBoostClassifier, RandomForestClassifier
from sklearn.metrics import (
    average_precision_score,
    confusion_matrix,
    f1_score,
    make_scorer,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import (
    RandomizedSearchCV,
    StratifiedKFold,
    TunedThresholdClassifierCV,
    cross_val_predict,
    train_test_split,
)
from sklearn.preprocessing import FunctionTransformer, StandardScaler
from sklearn.tree import DecisionTreeClassifier
from xgboost import XGBClassifier

warnings.filterwarnings("ignore")

TARGET = "HeartDiseaseorAttack"
SEED = 2026
COLUMNAS_NUMERICAS = ["BMI", "MentHlth", "PhysHlth"]
COLUMNAS_CATEGORICAS = [
    "HighBP", "HighChol", "CholCheck", "Smoker", "Stroke", "Diabetes",
    "PhysActivity", "Fruits", "Veggies", "HvyAlcoholConsump", "AnyHealthcare",
    "NoDocbcCost", "GenHlth", "DiffWalk", "Sex", "Age", "Education", "Income",
]
MODELOS = ["Árbol de decisión", "Random Forest", "AdaBoost", "XGBoost", "LightGBM"]
ETAPAS = {"A: SMOTE": "smote", "B: Pesos": "pesos"}

# Mismas familias de grillas vistas en la guía del profesor. Todas permiten
# al menos 10 combinaciones para RandomizedSearchCV.
GRILLAS = {
    "Árbol de decisión": {
        "modelo__max_depth": [3, 5, 7, None],
        "modelo__min_samples_leaf": [1, 5, 10],
    },
    "Random Forest": {
        "modelo__n_estimators": [200, 300, 400],
        "modelo__max_depth": [None, 10],
        "modelo__max_features": ["sqrt", 0.5],
    },
    "AdaBoost": {
        "modelo__n_estimators": [100, 200, 300, 400],
        "modelo__learning_rate": [0.1, 0.5, 1.0],
    },
    "XGBoost": {
        "modelo__n_estimators": [200, 300, 400],
        "modelo__learning_rate": [0.05, 0.1],
        "modelo__max_depth": [3, 5],
    },
    "LightGBM": {
        "modelo__n_estimators": [200, 300, 400],
        "modelo__learning_rate": [0.05, 0.1],
        "modelo__num_leaves": [15, 31, 63],
    },
}


def obtener_grilla(nombre, modo):
    """La Etapa B fija el stump ponderado de AdaBoost exigido por el enunciado."""
    grilla = {parametro: list(valores) for parametro, valores in GRILLAS[nombre].items()}
    if nombre == "AdaBoost" and modo == "smote":
        grilla["modelo__estimator__max_depth"] = [1, 2, 3]
    return grilla


# ----------------------------------------------------------------------------------------------
# 1. Pipeline
# ----------------------------------------------------------------------------------------------
def recortar_bmi(x):
    """Recorta el IMC a un rango declarado; la transformación ocurre dentro del pipeline."""
    return np.clip(x, 15, 60)


def crear_limpieza():
    """Limpieza previa a SMOTENC, conservando nombres y datos categóricos originales."""
    limpieza = ColumnTransformer(
        [("bmi", FunctionTransformer(recortar_bmi, feature_names_out="one-to-one"), ["BMI"])],
        remainder="passthrough",
        verbose_feature_names_out=False,
    )
    return limpieza.set_output(transform="pandas")


def crear_preprocesamiento():
    """Escala solo variables numéricas; los árboles reciben las categorías sin alterar."""
    prep = ColumnTransformer(
        [("escalar", StandardScaler(), COLUMNAS_NUMERICAS)],
        remainder="passthrough",
        verbose_feature_names_out=False,
    )
    return prep.set_output(transform="pandas")


def crear_pipeline(modelo, usar_smote=True):
    """limpieza -> (SMOTENC) -> preprocesamiento -> modelo, todo dentro de cada fold."""
    pasos = [("limpieza", crear_limpieza())]
    if usar_smote:
        pasos.append((
            "smote",
            SMOTENC(categorical_features=COLUMNAS_CATEGORICAS, random_state=SEED),
        ))
    pasos.extend([("prep", crear_preprocesamiento()), ("modelo", modelo)])
    return Pipeline(pasos)


def crear_modelo(nombre, modo, neg_pos):
    """modo: 'smote' (sin pesos) | 'pesos' (Etapa B) | 'real' (sin SMOTE ni pesos, Parte 2)."""
    w = (modo == "pesos")
    cw = "balanced" if w else None
    if nombre == "Árbol de decisión":
        return DecisionTreeClassifier(class_weight=cw, random_state=SEED)
    if nombre == "Random Forest":
        return RandomForestClassifier(class_weight=cw, random_state=SEED, n_jobs=1)
    if nombre == "AdaBoost":
        return AdaBoostClassifier(estimator=DecisionTreeClassifier(max_depth=1, class_weight=cw, random_state=SEED),
                                  random_state=SEED)
    if nombre == "XGBoost":
        return XGBClassifier(scale_pos_weight=neg_pos if w else 1, eval_metric="logloss",
                             tree_method="hist", random_state=SEED, n_jobs=1)
    if nombre == "LightGBM":
        return LGBMClassifier(class_weight=cw, random_state=SEED, n_jobs=1, verbose=-1)
    raise ValueError(nombre)


def costo(y_true, y_pred, c_fp=100_000, c_fn=1_000_000):
    _, fp, fn, _ = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
    return c_fp * fp + c_fn * fn


def a_python(v):
    """Convierte tipos de numpy a tipos nativos para guardar en JSON."""
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating,)):
        return float(v)
    if v is None or isinstance(v, (int, float, str, bool)):
        return v
    return str(v)


# ----------------------------------------------------------------------------------------------
# 2. Programa principal
# ----------------------------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description="Entrena los modelos del certamen y guarda los resultados.")
    ap.add_argument("--csv", default="heart_disease_health_indicators_BRFSS2015.csv", help="ruta del CSV")
    ap.add_argument("--salida", default="resultados", help="carpeta donde se guardan los resultados")
    ap.add_argument("--n-sub", type=int, default=30_000, help="filas de la submuestra para la búsqueda")
    ap.add_argument("--n-iter", type=int, default=10, help="combinaciones de RandomizedSearchCV por modelo")
    ap.add_argument("--cv-folds", type=int, default=3, help="folds de la validación cruzada")
    ap.add_argument("--c-fp", type=float, default=100_000, help="costo de un falso positivo (CLP, supuesto informado)")
    ap.add_argument("--c-fn", type=float, default=1_000_000, help="costo de un falso negativo (CLP, supuesto informado)")
    ap.add_argument("--filas-demo", type=int, default=None, help="usar solo N filas (prueba rápida)")
    ap.add_argument(
        "--eliminar-duplicados",
        action="store_true",
        help="eliminar filas idénticas solo si la fuente confirma duplicados administrativos",
    )
    args = ap.parse_args()
    if args.c_fp <= 0 or args.c_fn <= 0:
        ap.error("--c-fp y --c-fn deben ser mayores que cero")
    if args.cv_folds < 2:
        ap.error("--cv-folds debe ser al menos 2")

    os.makedirs(args.salida, exist_ok=True)
    t_inicio = time.time()
    np.random.seed(SEED)

    # ---------------- 1. Carga y exploración ----------------
    df = pd.read_csv(args.csv)
    columnas_requeridas = {TARGET, *COLUMNAS_NUMERICAS, *COLUMNAS_CATEGORICAS}
    faltantes = sorted(columnas_requeridas - set(df.columns))
    if faltantes:
        raise ValueError(f"Faltan columnas requeridas: {faltantes}")
    if not set(df[TARGET].dropna().unique()).issubset({0, 1}):
        raise ValueError(f"{TARGET} debe contener únicamente 0 y 1")

    n_original = len(df)
    n_dups = int(df.duplicated().sum())
    n_nulos = int(df.isna().sum().sum())
    print(f"Registros originales: {n_original:,} | filas repetidas: {n_dups:,} | nulos: {n_nulos}")

    # BRFSS no incluye identificador: respuestas idénticas pueden pertenecer a personas distintas.
    if args.eliminar_duplicados:
        df = df.drop_duplicates().reset_index(drop=True)
    if args.filas_demo:
        df = df.sample(args.filas_demo, random_state=SEED).reset_index(drop=True)
    df[TARGET] = df[TARGET].astype(int)

    n, prop = len(df), float(df[TARGET].mean())
    print(f"Registros analizados: {n:,} (requisito > 100.000: {'OK' if n > 100_000 else 'NO'})")
    print(f"Clase minoritaria: {prop:.2%} (requisito 1%-30%: {'OK' if 0.01 <= prop <= 0.30 else 'NO'})")
    print(f"Predictoras: {df.shape[1] - 1} (requisito >= 8)")

    eda = pd.DataFrame({
        "Variable": df.columns,
        "Tipo": df.dtypes.astype(str).to_numpy(),
        "Nulos": df.isna().sum().to_numpy(),
        "Unicos": df.nunique().to_numpy(),
        "Minimo": [df[c].min() if pd.api.types.is_numeric_dtype(df[c]) else np.nan for c in df],
        "Maximo": [df[c].max() if pd.api.types.is_numeric_dtype(df[c]) else np.nan for c in df],
    })
    eda.to_csv(os.path.join(args.salida, "eda_resumen.csv"), index=False)

    # ---------------- 2. Partición 80/20 estratificada ----------------
    X, y = df.drop(columns=TARGET), df[TARGET]
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, stratify=y, random_state=SEED)
    X_sub, _, y_sub, _ = train_test_split(X_train, y_train, train_size=min(args.n_sub, len(X_train) - 1),
                                          stratify=y_train, random_state=SEED)
    neg_pos = (y_train == 0).sum() / (y_train == 1).sum()
    cv = StratifiedKFold(n_splits=args.cv_folds, shuffle=True, random_state=SEED)
    print(f"Train: {len(y_train):,} ({y_train.mean():.2%} positivos) | Test: {len(y_test):,} ({y_test.mean():.2%} positivos)")

    # ---------------- 3. Parte 1: 5 modelos x 2 etapas ----------------
    finales, busquedas, filas = {}, {}, []
    for etapa, modo in ETAPAS.items():
        for nombre in MODELOS:
            clave = f"{nombre} | {etapa}"
            usar_smote = (modo == "smote")
            grilla = obtener_grilla(nombre, modo)
            busq = RandomizedSearchCV(
                crear_pipeline(crear_modelo(nombre, modo, neg_pos), usar_smote),
                param_distributions=grilla, n_iter=args.n_iter, cv=cv,
                scoring="f1", n_jobs=-1, random_state=SEED, refit=False,
            )
            t0 = time.time()
            busq.fit(X_sub, y_sub)                              # búsqueda en la submuestra
            t_busq = time.time() - t0
            i = busq.best_index_

            final = clone(crear_pipeline(crear_modelo(nombre, modo, neg_pos), usar_smote)).set_params(**busq.best_params_)
            if nombre in ("Random Forest", "XGBoost", "LightGBM"):
                final.set_params(modelo__n_jobs=-1)
            final.fit(X_train, y_train)                          # reentrenar el ganador con TODO el train

            pred_tr, pred_te = final.predict(X_train), final.predict(X_test)
            proba_te = final.predict_proba(X_test)[:, 1]
            filas.append({
                "Nombre": clave, "Modelo": nombre, "Etapa": etapa,
                "F1_cv": busq.best_score_, "Desv_cv": busq.cv_results_["std_test_score"][i],
                "F1_train": f1_score(y_train, pred_tr), "F1_test": f1_score(y_test, pred_te),
                "Recall_test": recall_score(y_test, pred_te),
                "Precision_test": precision_score(y_test, pred_te, zero_division=0),
                "AUC_test": roc_auc_score(y_test, proba_te), "PR_AUC_test": average_precision_score(y_test, proba_te),
                "Tiempo_busqueda_s": t_busq,
                "Hiperparametros": json.dumps({k.replace("modelo__", ""): a_python(v)
                                               for k, v in busq.best_params_.items()}, ensure_ascii=False)})
            finales[clave], busquedas[clave] = final, busq
            print(f"[{etapa}] {nombre:18s} F1_cv={busq.best_score_:.4f} F1_test={filas[-1]['F1_test']:.4f} "
                  f"búsqueda={t_busq:.0f}s")

    comparacion = pd.DataFrame(filas)
    comparacion["Brecha"] = comparacion["F1_train"] - comparacion["F1_test"]
    comparacion.to_csv(os.path.join(args.salida, "comparacion.csv"), index=False)

    tabla_cv = pd.DataFrame([{"Nombre": c, "Fold": f + 1,
                              "F1": b.cv_results_[f"split{f}_test_score"][b.best_index_]}
                             for c, b in busquedas.items() for f in range(args.cv_folds)])
    tabla_cv.to_csv(os.path.join(args.salida, "tabla_cv.csv"), index=False)

    # ---------------- 4. Mejor modelo (por F1 de validación cruzada) ----------------
    mejor = comparacion.loc[comparacion["F1_cv"].idxmax()]
    mejor_clave, mejor_nombre = mejor["Nombre"], mejor["Modelo"]
    comp_B = comparacion[comparacion["Etapa"] == "B: Pesos"]
    mejor_B = comp_B.loc[comp_B["F1_cv"].idxmax()]
    print(f"\nMEJOR MODELO (F1 CV): {mejor_clave} | F1_cv={mejor['F1_cv']:.4f} | F1_test={mejor['F1_test']:.4f}")

    mejor_pipe = finales[mejor_clave]
    imp = pd.DataFrame({"Variable": mejor_pipe.named_steps["prep"].get_feature_names_out(),
                        "Importancia": mejor_pipe.named_steps["modelo"].feature_importances_})
    imp.sort_values("Importancia", ascending=False).to_csv(os.path.join(args.salida, "importancias.csv"), index=False)

    # ---------------- 5. Parte 2: costos y umbral óptimo ----------------
    c_fp, c_fn = args.c_fp, args.c_fn
    p_star = c_fp / (c_fp + c_fn)

    # Mismo modelo y mismos hiperparámetros, pero SIN SMOTE ni pesos -> probabilidades en escala real
    pipe_real = clone(crear_pipeline(crear_modelo(mejor_nombre, "real", neg_pos), usar_smote=False)
                      ).set_params(**busquedas[mejor_clave].best_params_)
    if mejor_nombre in ("Random Forest", "XGBoost", "LightGBM"):
        pipe_real.set_params(modelo__n_jobs=-1)

    scorer_costo = make_scorer(costo, greater_is_better=False, c_fp=c_fp, c_fn=c_fn)
    tuned = TunedThresholdClassifierCV(
        pipe_real, scoring=scorer_costo, response_method="predict_proba",
        thresholds=np.linspace(0.01, 0.99, 99), cv=cv, refit=True,
        n_jobs=1, store_cv_results=True,
    )
    tuned.fit(X_train, y_train)                                  # SOLO train
    umbral_emp = float(tuned.best_threshold_)
    print(f"Umbral teórico p* = {p_star:.4f} | Umbral empírico (train) = {umbral_emp:.4f}")

    proba_real = tuned.estimator_.predict_proba(X_test)[:, 1]
    proba_B = finales[mejor_B["Nombre"]].predict_proba(X_test)[:, 1]

    estrategias = {
        "No hacer nada (todo 0)": np.zeros(len(y_test), dtype=int),
        "Umbral 0,5": (proba_real >= 0.5).astype(int),
        f"Umbral teórico ({p_star:.3f})": (proba_real >= p_star).astype(int),
        f"Umbral empírico ({umbral_emp:.3f})": (proba_real >= umbral_emp).astype(int),
        f"Modelo con pesos - Etapa B ({mejor_B['Modelo']}, 0,5)": (proba_B >= 0.5).astype(int)}
    res = []
    for nom, pred in estrategias.items():
        tn, fp, fn, tp = confusion_matrix(y_test, pred, labels=[0, 1]).ravel()
        res.append({"Estrategia": nom, "VN": tn, "FP": fp, "FN": fn, "VP": tp,
                    "Recall": tp / (tp + fn), "Precision": tp / (tp + fp) if (tp + fp) else 0.0,
                    "Costo_total": c_fp * fp + c_fn * fn})
    res = pd.DataFrame(res)
    costo_05 = res.loc[res["Estrategia"] == "Umbral 0,5", "Costo_total"].iloc[0]
    res["Ahorro_vs_0_5"] = costo_05 - res["Costo_total"]
    res.to_csv(os.path.join(args.salida, "estrategias.csv"), index=False)

    # ---------------- 6. Sensibilidad a la razón FN/FP (umbral empírico buscado solo con el train) ----------------
    proba_oof = cross_val_predict(clone(pipe_real), X_train, y_train, cv=cv, method="predict_proba", n_jobs=1)[:, 1]
    pd.DataFrame({"y_true": y_train.to_numpy(), "proba_oof": proba_oof}).to_csv(
        os.path.join(args.salida, "datos_umbral_train.csv"), index=False
    )
    ts = np.linspace(0.01, 0.99, 99)
    y_tr = y_train.to_numpy()
    FP_t = np.array([((proba_oof >= t) & (y_tr == 0)).sum() for t in ts])
    FN_t = np.array([((proba_oof < t) & (y_tr == 1)).sum() for t in ts])
    sens = []
    for razon in [2, 5, 10, 20, 50]:
        cfn = razon * c_fp
        p_t = c_fp / (c_fp + cfn)
        t_e = float(ts[np.argmin(c_fp * FP_t + cfn * FN_t)])
        fila = {"Razon_FN_FP": razon, "p_teorico": p_t, "Umbral_empirico": t_e}
        for nom, t in [("0_5", 0.5), ("teorico", p_t), ("empirico", t_e)]:
            fila[f"Costo_{nom}"] = costo(y_test, (proba_real >= t).astype(int), c_fp, cfn)
        fila["Ahorro_empirico_vs_0_5"] = fila["Costo_0_5"] - fila["Costo_empirico"]
        sens.append(fila)
    pd.DataFrame(sens).to_csv(os.path.join(args.salida, "sensibilidad.csv"), index=False)

    # ---------------- 7. Archivos para el dashboard ----------------
    pd.DataFrame({"y_true": y_test.to_numpy(), "proba": proba_real, "proba_B": proba_B}
                 ).to_csv(os.path.join(args.salida, "datos_dashboard.csv"), index=False)

    resumen = {
        "base": "Heart Disease Health Indicators (BRFSS 2015, versión procesada de Kaggle)",
        "fuente": "https://www.kaggle.com/datasets/alexteboul/heart-disease-health-indicators-dataset",
        "fuente_primaria": "https://www.cdc.gov/brfss/annual_data/annual_2015.html",
        "variable_objetivo": TARGET,
        "registros_originales": n_original, "duplicados_encontrados": n_dups,
        "duplicados_eliminados": args.eliminar_duplicados, "registros": n,
        "predictoras": int(df.shape[1] - 1), "nulos": n_nulos,
        "prop_minoritaria": prop, "n_train": len(y_train), "n_test": len(y_test),
        "semilla": SEED, "n_sub": int(min(args.n_sub, len(X_train) - 1)),
        "n_iter": args.n_iter, "cv_folds": args.cv_folds,
        "mejor_modelo": mejor_nombre, "mejor_etapa": mejor["Etapa"],
        "mejor_f1_cv": float(mejor["F1_cv"]), "mejor_desv_cv": float(mejor["Desv_cv"]),
        "mejor_f1_test": float(mejor["F1_test"]), "mejor_brecha": float(mejor["Brecha"]),
        "mejor_hiperparametros": json.loads(mejor["Hiperparametros"]),
        "mejor_modelo_B": mejor_B["Modelo"],
        "c_fp": c_fp, "c_fn": c_fn, "moneda": "CLP", "costos_son_supuestos": True,
        "fuente_costo_fp": "Arancel MLE FONASA 2025: consulta cardiología + ECG + ecocardiograma",
        "fuente_costo_fn": "Supuesto conservador 10x; sensibilidad 2x-50x y referencia UCI cardiovascular chilena",
        "p_star": p_star, "umbral_empirico": umbral_emp,
        "minutos_totales": round((time.time() - t_inicio) / 60, 1),
    }
    with open(os.path.join(args.salida, "resumen.json"), "w", encoding="utf-8") as f:
        json.dump(resumen, f, ensure_ascii=False, indent=2)

    joblib.dump(
        {"mejor_balanceado": mejor_pipe, "mejor_con_umbral": tuned},
        os.path.join(args.salida, "modelo_final.joblib"),
    )

    print(f"\nListo en {resumen['minutos_totales']} min. Resultados en la carpeta '{args.salida}/'.")
    print("Siguiente paso:  streamlit run app.py")


if __name__ == "__main__":
    main()
