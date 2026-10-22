export type Summary = {
  base: string; variable_objetivo: string; registros: number; registros_originales: number;
  duplicados_encontrados: number; duplicados_eliminados: boolean; predictoras: number;
  prop_minoritaria: number; n_train: number; n_test: number; semilla: number;
  n_sub: number; n_iter: number; cv_folds: number; mejor_modelo: string;
  mejor_etapa: string; mejor_f1_cv: number; mejor_desv_cv: number; mejor_f1_test: number;
  mejor_brecha: number; mejor_hiperparametros: Record<string, string | number>;
  mejor_modelo_B: string; c_fp: number; c_fn: number; p_star: number; umbral_empirico: number;
};
export type Comparison = {
  Nombre: string; Modelo: string; Etapa: string; F1_cv: number; Desv_cv: number;
  F1_train: number; F1_test: number; Brecha: number; Recall_test: number;
  Precision_test: number; AUC_test: number; PR_AUC_test: number;
  Tiempo_busqueda_s: number; Hiperparametros: string;
};
export type Fold = { Nombre: string; Fold: number; F1: number };
export type Importance = { Variable: string; Importancia: number };
export type Strategy = {
  Estrategia: string; VN: number; FP: number; FN: number; VP: number;
  Recall: number; Precision: number; Costo_total: number; Ahorro_vs_0_5: number;
};
export type Sensitivity = {
  Razon_FN_FP: number; p_teorico: number; Umbral_empirico: number;
  Costo_0_5: number; Costo_teorico: number; Costo_empirico: number; Ahorro_empirico_vs_0_5: number;
};
export type DashboardData = {
  resumen: Summary; comparacion: Comparison[]; tabla_cv: Fold[]; importancias: Importance[];
  estrategias: Strategy[]; sensibilidad: Sensitivity[];
  datos_dashboard: { y_true: number[]; proba: number[]; proba_B: number[] };
};
