# -*- coding: utf-8 -*-
"""
Reporte interactivo del Certamen 1 (Streamlit).

Lee los archivos que genera `entrenar_modelo.py` en la carpeta `resultados/`:
    resumen.json, comparacion.csv, tabla_cv.csv, importancias.csv, estrategias.csv,
    sensibilidad.csv y datos_dashboard.csv

Ejecutar:   streamlit run app.py
"""
import json
import os
from pathlib import Path

import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

st.set_page_config(
    page_title="CardioInsight | Reporte de riesgo cardiovascular",
    page_icon="🫀",
    layout="wide",
    initial_sidebar_state="expanded",
)

CARPETA = Path(os.environ.get("RESULTADOS_DIR", Path(__file__).parent / "resultados"))


# ------------------------------- Identidad visual --------------------------------
COLORES = {
    "navy": "#102A43",
    "teal": "#168C8C",
    "blue": "#60A5FA",
    "green": "#2E9D75",
    "coral": "#E76F61",
    "amber": "#D99A27",
    "gray": "#64748B",
    "grid": "#E5EBF1",
    "background": "#F3F6FA",
}
TEMA = "plotly_white"

st.markdown("""
<style>
    .stApp { background: #F3F6FA; }
    .block-container { padding-top: 1.35rem; padding-bottom: 2.5rem; max-width: 1500px; }
    [data-testid="stSidebar"] { background: #E7EEF5; border-right: 1px solid #D8E2EC; }
    [data-testid="stMetric"] {
        background: #FFFFFF; border: 1px solid #E2E8F0; padding: 16px 18px;
        border-radius: 14px; box-shadow: 0 2px 8px rgba(16,42,67,.04);
    }
    [data-testid="stMetricLabel"] { color: #52677D; font-weight: 600; }
    [data-testid="stMetricValue"] { color: #102A43; font-size: clamp(1.25rem, 2vw, 2rem); }
    div[data-testid="stTabs"] button { font-weight: 650; }
    div[data-testid="stTabs"] button[aria-selected="true"] {
        color: #168C8C; border-bottom-color: #168C8C;
    }
    .hero {
        padding: 25px 28px; border-radius: 18px; margin: 0 0 18px 0;
        color: white; background: linear-gradient(115deg, #102A43 0%, #145B70 62%, #168C8C 100%);
        box-shadow: 0 8px 22px rgba(16,42,67,.12);
    }
    .hero h1 { color: white; font-size: 2rem; margin: 0 0 8px 0; }
    .hero p { color: #E4F3F6; margin: 0; font-size: 1rem; }
    .section-note {
        padding: 12px 15px; background: #FFFFFF; border-left: 4px solid #168C8C;
        border-radius: 8px; color: #334E68; margin: 8px 0 16px 0;
    }
    .small-muted { color: #64748B; font-size: .88rem; }
    div[data-testid="stDataFrame"] { border: 1px solid #E2E8F0; border-radius: 10px; overflow: hidden; }
</style>
""", unsafe_allow_html=True)


def aplicar_estilo(fig, altura=430):
    """Aplica formato consistente y legible a los gráficos Plotly."""
    fig.update_layout(
        template=TEMA,
        height=altura,
        font=dict(family="Arial, sans-serif", size=13, color=COLORES["navy"]),
        title_font=dict(size=18, color=COLORES["navy"]),
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        margin=dict(l=20, r=20, t=65, b=35),
        hoverlabel=dict(bgcolor="white", font_color=COLORES["navy"]),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
    )
    fig.update_xaxes(showgrid=True, gridcolor=COLORES["grid"], zeroline=False, linecolor="#CBD5E1")
    fig.update_yaxes(showgrid=False, zeroline=False, linecolor="#CBD5E1")
    return fig


def mostrar_figura(fig, altura=430):
    fig = aplicar_estilo(fig, altura=altura)
    st.plotly_chart(
        fig,
        width="stretch",
        config={"displaylogo": False, "responsive": True, "modeBarButtonsToRemove": ["lasso2d", "select2d"]},
    )


@st.cache_data
def cargar(carpeta):
    c = Path(carpeta)
    with open(c / "resumen.json", encoding="utf-8") as f:
        resumen = json.load(f)
    datos = {"resumen": resumen}
    for nombre in ["comparacion", "tabla_cv", "importancias", "estrategias", "sensibilidad", "datos_dashboard"]:
        datos[nombre] = pd.read_csv(c / f"{nombre}.csv")
    return datos


if not (CARPETA / "resumen.json").exists():
    st.title("🫀 CardioInsight")
    st.error(f"No encuentro los resultados en `{CARPETA}`.")
    st.markdown("Primero ejecuta el entrenamiento y luego abre esta app:\n\n"
                "```\npython entrenar_modelo.py --csv heart_disease_health_indicators_BRFSS2015.csv\n"
                "streamlit run app.py\n```")
    st.stop()

D = cargar(str(CARPETA))
R, comp, tcv, imp = D["resumen"], D["comparacion"], D["tabla_cv"], D["importancias"]
est, sens, dash = D["estrategias"], D["sensibilidad"], D["datos_dashboard"]


def clp(x):
    """Formatea pesos chilenos sin activar el parser de fórmulas de Markdown."""
    return f"CLP {x:,.0f}".replace(",", ".")


st.markdown("""
<div class="hero">
  <h1>🫀 CardioInsight</h1>
  <p>Reporte interactivo de modelos predictivos · Riesgo cardiovascular · Apoyo al análisis y la toma de decisiones</p>
</div>
""", unsafe_allow_html=True)
st.caption(f"Base de datos: {R['base']}  ·  Variable objetivo: `{R['variable_objetivo']}`  ·  Semilla experimental: {R['semilla']}")
st.markdown(
    '<div class="section-note"><b>Lectura responsable:</b> este tablero presenta resultados experimentales de modelos '
    'de aprendizaje automático. No constituye una herramienta clínica validada ni reemplaza la evaluación de profesionales de salud.</div>',
    unsafe_allow_html=True,
)

# ------------------------------- Controles (barra lateral) -------------------------------
st.sidebar.title("Panel de simulación")
st.sidebar.caption("Ajusta los supuestos económicos y observa cómo cambia la decisión.")
st.sidebar.markdown("### 1 · Costos hipotéticos (CLP)")
c_fp = st.sidebar.slider("Costo de un falso positivo (derivación innecesaria)", 25_000, 300_000, int(R["c_fp"]), 5_000)
c_fn = st.sidebar.slider("Costo de un falso negativo (caso no detectado)", 200_000, 10_000_000, int(R["c_fn"]), 50_000)
p_star = c_fp / (c_fp + c_fn)
st.sidebar.metric("Umbral teórico p* = C_FP / (C_FP + C_FN)", f"{p_star:.3f}")
st.sidebar.markdown("### 2 · Umbral de decisión")
umbral = st.sidebar.slider("Umbral de decisión", 0.0, 1.0, 0.50, 0.01)
st.sidebar.caption("Los cambios se reflejan en la pestaña «Costo y umbral». Los costos son supuestos de simulación, no costos clínicos observados.")

tab1, tab2, tab3, tab4, tab5, tab6, tab7 = st.tabs(
    ["Resumen", "10 combinaciones", "Mejor modelo", "Costo y umbral", "Sensibilidad", "Calibración", "ROC e iso-costo"])

# ===================================== 1. RESUMEN =====================================
with tab1:
    st.subheader("Resumen ejecutivo")
    st.caption("Vista rápida del conjunto de datos, el diseño experimental y el desempeño reportado.")
    k1, k2, k3, k4 = st.columns(4)
    k1.metric("Registros (tras limpieza)", f"{R['registros']:,}")
    k2.metric("Clase minoritaria (enfermos)", f"{R['prop_minoritaria']:.2%}")
    k3.metric("Variables predictoras", R["predictoras"])
    k4.metric("Train / Test", f"{R['n_train']:,} / {R['n_test']:,}")

    repetidas = (
        f"Se eliminaron {R['duplicados_encontrados']:,} filas idénticas"
        if R["duplicados_eliminados"]
        else f"Se detectaron {R['duplicados_encontrados']:,} filas idénticas y se conservaron porque la base no identifica personas"
    )
    st.markdown(f"""
**Problema de negocio.** Decidir a quién derivar a un estudio cardiológico.
Un **falso positivo** es derivar a una persona sana (consulta y exámenes innecesarios; supuesto {clp(R['c_fp'])}).
Un **falso negativo** es no detectar a una persona enferma (tratamiento tardío y complicaciones; supuesto {clp(R['c_fn'])}).

**Preparación.** {repetidas}. La partición es 80/20 estratificada y la limpieza se ejecuta dentro del pipeline.
La búsqueda de hiperparámetros usó una submuestra de {R['n_sub']:,} filas, {R['n_iter']} combinaciones por modelo y {R['cv_folds']} folds.
""")
    st.caption(
        "Referencia FP: Arancel MLE FONASA 2025, aproximación de consulta cardiológica + ECG + ecocardiograma. "
        "FN: supuesto gerencial conservador de 10×; no es una tarifa clínica. La sensibilidad cubre razones de 2× a 50×."
    )
    st.markdown(
        f'<div class="section-note"><b>Modelo líder según F1 de validación cruzada:</b> '
        f'{R["mejor_modelo"]} · {R["mejor_etapa"]} &nbsp; | &nbsp; '
        f'F1 CV {R["mejor_f1_cv"]:.3f} ± {R["mejor_desv_cv"]:.3f} &nbsp; | &nbsp; '
        f'F1 test {R["mejor_f1_test"]:.3f} &nbsp; | &nbsp; brecha train–test {R["mejor_brecha"]:.3f}</div>',
        unsafe_allow_html=True,
    )

    st.markdown("#### Comparación económica de estrategias")
    st.caption("Valores ilustrativos calculados sobre el conjunto de test con los costos definidos durante el entrenamiento.")
    e = est.copy()
    e["Costo_total"] = e["Costo_total"].map(clp)
    e["Ahorro_vs_0_5"] = e["Ahorro_vs_0_5"].map(clp)
    e["Recall"] = e["Recall"].round(3)
    e["Precision"] = e["Precision"].round(3)
    st.dataframe(e, hide_index=True, width="stretch", height=min(420, 40 + 36 * len(e)))
    mejor_fila = est.loc[est["Costo_total"].idxmin()]
    st.markdown(
        f'<div class="section-note"><b>Menor costo observado en esta comparación:</b> '
        f'{mejor_fila["Estrategia"]} · ahorro estimado de {clp(mejor_fila["Ahorro_vs_0_5"])} frente al umbral 0,5.</div>',
        unsafe_allow_html=True,
    )

# ================================ 2. DIEZ COMBINACIONES ================================
with tab2:
    st.subheader("Comparación de modelos")
    st.caption("Cinco algoritmos evaluados bajo dos estrategias para abordar el desbalance de clases.")
    st.caption("F1 de la clase minoritaria. `F1 CV` se calcula en la submuestra de búsqueda; "
               "`F1 train` y `F1 test` corresponden al modelo reentrenado con todo el train. "
               "Brecha = F1 train − F1 test.")
    cols = ["Nombre", "F1_cv", "Desv_cv", "F1_train", "F1_test", "Brecha", "Recall_test", "Precision_test",
            "AUC_test", "PR_AUC_test", "Tiempo_busqueda_s"]
    tabla = comp[cols].sort_values("F1_cv", ascending=False).round(3)
    st.dataframe(tabla, hide_index=True, width="stretch", height=420)

    largo = comp.melt(id_vars="Nombre", value_vars=["F1_train", "F1_cv", "F1_test"],
                      var_name="Conjunto", value_name="F1")
    fig = px.bar(largo, y="Nombre", x="F1", color="Conjunto", barmode="group", orientation="h", height=520,
                 title="F1: entrenamiento vs validación cruzada vs test")
    mostrar_figura(fig, altura=520)

    izq, der = st.columns(2)
    with izq:
        st.markdown("**SMOTE vs. pesos (promedio por etapa)**")
        prom = comp.groupby("Etapa")[["F1_cv", "F1_test", "Recall_test", "Precision_test", "AUC_test",
                                       "Tiempo_busqueda_s"]].mean().round(3)
        st.dataframe(prom, width="stretch")
        st.caption("Los pesos suelen subir el recall y bajar la precisión; el AUC cambia poco: "
                   "lo que cambia es dónde queda la línea de 0,5.")
    with der:
        st.markdown("**Estabilidad entre folds (F1 por fold)**")
        fig2 = px.strip(
            tcv, y="Nombre", x="F1", color="Nombre", height=360,
            title="Distribución de F1 entre folds",
            color_discrete_sequence=[COLORES["teal"], COLORES["blue"], COLORES["green"], COLORES["coral"], COLORES["gray"]],
        )
        fig2.update_layout(showlegend=False, xaxis_title="F1 por fold", yaxis_title="")
        mostrar_figura(fig2, altura=360)

    st.markdown("**Hiperparámetros ganadores**")
    hp = comp[["Nombre", "Hiperparametros"]].copy()
    st.dataframe(hp, hide_index=True, width="stretch")

# ===================================== 3. MEJOR MODELO =====================================
with tab3:
    st.subheader(f"Análisis del modelo líder · {R['mejor_modelo']} ({R['mejor_etapa']})")
    st.markdown("Elegido por el **F1 de validación cruzada**, no por el test (el test solo confirma).")
    a, b, c = st.columns(3)
    a.metric("F1 CV", f"{R['mejor_f1_cv']:.3f}", f"± {R['mejor_desv_cv']:.3f}", delta_color="off")
    b.metric("F1 test", f"{R['mejor_f1_test']:.3f}")
    c.metric("Brecha train–test", f"{R['mejor_brecha']:.3f}")
    st.markdown("**Hiperparámetros:**")
    with st.expander("Ver hiperparámetros del modelo", expanded=False):
        st.json(R["mejor_hiperparametros"])
    top = imp.head(12).iloc[::-1]
    fig3 = px.bar(
        top, x="Importancia", y="Variable", orientation="h", height=480,
        title="Variables con mayor importancia en el modelo",
        color="Importancia", color_continuous_scale=["#B7E4E4", COLORES["teal"], COLORES["navy"]],
    )
    fig3.update_layout(coloraxis_showscale=False, xaxis_title="Importancia relativa", yaxis_title="")
    mostrar_figura(fig3, altura=480)
    st.caption("Importancia no es causalidad: indica qué variables usó más el modelo para separar enfermos de sanos.")

# ===================================== 4. COSTO Y UMBRAL =====================================
with tab4:
    st.subheader("Simulador de umbral y costo")
    st.caption("Mueve el umbral en la barra lateral para explorar el equilibrio entre detecciones, falsos positivos y falsos negativos.")
    y = dash["y_true"].to_numpy().astype(int)
    p = dash["proba"].to_numpy()

    def conteos(t, prob=p):
        pred = prob >= t
        tp = int((pred & (y == 1)).sum())
        fp = int((pred & (y == 0)).sum())
        fn = int((~pred & (y == 1)).sum())
        tn = int((~pred & (y == 0)).sum())
        return tn, fp, fn, tp

    ts = np.linspace(0, 1, 201)
    costos = np.array([c_fp * conteos(t)[1] + c_fn * conteos(t)[2] for t in ts])
    t_opt = float(ts[costos.argmin()])

    tn, fp, fn, tp = conteos(umbral)
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    precision = tp / (tp + fp) if (tp + fp) else 0.0
    costo_sel = c_fp * fp + c_fn * fn
    tn5, fp5, fn5, tp5 = conteos(0.5)
    costo_05 = c_fp * fp5 + c_fn * fn5

    k1, k2, k3, k4 = st.columns(4)
    k1.metric("Recall", f"{recall:.1%}")
    k2.metric("Precisión", f"{precision:.1%}")
    k3.metric("Costo total", clp(costo_sel))
    k4.metric("Ahorro vs. umbral 0,5", clp(costo_05 - costo_sel))

    izq, der = st.columns([3, 2])
    with izq:
        fig4 = go.Figure(go.Scatter(x=ts, y=costos, mode="lines", name="Costo total"))
        fig4.add_vline(x=0.5, line_dash="dot", line_color="gray", annotation_text="0,5")
        fig4.add_vline(x=p_star, line_dash="dash", line_color="green", annotation_text=f"p* = {p_star:.3f}")
        fig4.add_vline(x=t_opt, line_dash="dash", line_color="red",
                       annotation_text=f"mínimo test = {t_opt:.2f}", annotation_position="bottom")
        fig4.add_vline(x=R["umbral_empirico"], line_dash="dashdot", line_color="blue",
                       annotation_text=f"CV train = {R['umbral_empirico']:.2f}", annotation_position="bottom right")
        fig4.add_vline(x=umbral, line_color="black", annotation_text="manual", annotation_position="top left")
        fig4.update_layout(
            title="Costo total estimado según umbral",
            xaxis_title="Umbral de decisión",
            yaxis_title="Costo total hipotético (CLP)",
            hovermode="x unified",
        )
        fig4.update_traces(line=dict(color=COLORES["teal"], width=3), fill="tozeroy",
                           fillcolor="rgba(22,140,140,0.10)")
        mostrar_figura(fig4, altura=430)
    with der:
        st.markdown("**Matriz de confusión del umbral elegido**")
        valores_cm = np.array([[tn, fp], [fn, tp]])
        etiquetas_cm = [
            [f"VN<br><b>{tn:,}</b><br>Sin costo directo", f"FP<br><b>{fp:,}</b><br>{clp(c_fp * fp)}"],
            [f"FN<br><b>{fn:,}</b><br>{clp(c_fn * fn)}", f"VP<br><b>{tp:,}</b><br>Sin costo directo"],
        ]
        fig_cm = go.Figure(data=go.Heatmap(
            z=valores_cm,
            x=["Predicho: sano", "Predicho: enfermo"],
            y=["Real: sano", "Real: enfermo"],
            text=etiquetas_cm,
            texttemplate="%{text}",
            textfont={"size": 13, "color": COLORES["navy"]},
            colorscale=[[0, "#E7F4F4"], [0.5, "#8BCBCB"], [1, COLORES["teal"]]],
            showscale=False,
            hovertemplate="Real: %{y}<br>%{x}<br>Casos: %{z:,}<extra></extra>",
        ))
        fig_cm.update_layout(xaxis_title="", yaxis_title="", height=320, margin=dict(l=5, r=5, t=20, b=20))
        mostrar_figura(fig_cm, altura=320)
        st.caption(f"Costo FP: {clp(c_fp * fp)} · Costo FN: {clp(c_fn * fn)}")

    st.markdown("#### Comparación de estrategias con los costos actuales")
    n_sanos, n_enfermos = int((y == 0).sum()), int((y == 1).sum())
    estrategias = [
        ("No hacer nada (todo 0)", (n_sanos, 0, n_enfermos, 0)),
        ("Umbral 0,5", conteos(0.5)),
        (f"Umbral teórico ({p_star:.3f})", conteos(p_star)),
        (f"Mínimo retrospectivo en test ({t_opt:.2f})", conteos(t_opt)),
        (f"Umbral manual ({umbral:.2f})", conteos(umbral)),
    ]
    tabla_e = []
    for nombre, (tn_, fp_, fn_, tp_) in estrategias:
        tabla_e.append({"Estrategia": nombre, "VN": tn_, "FP": fp_, "FN": fn_, "VP": tp_,
                        "Recall": round(tp_ / (tp_ + fn_), 3) if (tp_ + fn_) else 0.0,
                        "Precisión": round(tp_ / (tp_ + fp_), 3) if (tp_ + fp_) else 0.0,
                        "Costo total": c_fp * fp_ + c_fn * fn_})
    if "proba_B" in dash.columns:
        tn_, fp_, fn_, tp_ = conteos(0.5, dash["proba_B"].to_numpy())
        tabla_e.append({"Estrategia": f"Modelo con pesos – Etapa B ({R['mejor_modelo_B']}, 0,5)", "VN": tn_, "FP": fp_,
                        "FN": fn_, "VP": tp_, "Recall": round(tp_ / (tp_ + fn_), 3),
                        "Precisión": round(tp_ / (tp_ + fp_), 3) if (tp_ + fp_) else 0.0,
                        "Costo total": c_fp * fp_ + c_fn * fn_})
    tabla_e = pd.DataFrame(tabla_e)
    tabla_e["Ahorro vs 0,5"] = costo_05 - tabla_e["Costo total"]
    mostrar = tabla_e.copy()
    mostrar["Costo total"] = mostrar["Costo total"].map(clp)
    mostrar["Ahorro vs 0,5"] = mostrar["Ahorro vs 0,5"].map(clp)
    st.dataframe(mostrar, hide_index=True, width="stretch")
    st.warning(
        "Como en el notebook de costos del profesor, el mínimo de la curva se calcula sobre test solo para ilustrar. "
        "La decisión válida para reportar es el umbral empírico seleccionado con validación cruzada usando únicamente train "
        f"({R['umbral_empirico']:.2f}); el test se usa una vez para confirmar su resultado."
    )
    st.caption("El umbral empírico seleccionado durante el entrenamiento se informa en la pestaña Resumen.")

# ===================================== 5. SENSIBILIDAD =====================================
with tab5:
    st.subheader("Análisis de sensibilidad")
    st.caption("Evalúa cómo cambia el umbral cuando cambia la importancia relativa de evitar falsos negativos.")
    st.caption("Se mantiene el costo del FP y se varía el del FN. El umbral empírico de cada escenario se busca solo con el train.")
    s = sens.copy()
    fig5 = go.Figure()
    fig5.add_trace(go.Scatter(x=s["Razon_FN_FP"], y=s["Umbral_empirico"], mode="lines+markers", name="Umbral empírico"))
    fig5.add_trace(go.Scatter(x=s["Razon_FN_FP"], y=s["p_teorico"], mode="lines+markers", name="Umbral teórico p*"))
    fig5.update_layout(
        title="Umbral estimado ante distintos costos relativos",
        xaxis_title="Razón de costo FN / costo FP (escala logarítmica)",
        yaxis_title="Umbral",
        xaxis_type="log",
        hovermode="x unified",
    )
    fig5.update_traces(line=dict(width=3))
    mostrar_figura(fig5, altura=390)
    for col in ["Costo_0_5", "Costo_teorico", "Costo_empirico", "Ahorro_empirico_vs_0_5"]:
        s[col] = s[col].map(clp)
    s["p_teorico"] = s["p_teorico"].round(3)
    s["Umbral_empirico"] = s["Umbral_empirico"].round(2)
    st.dataframe(s, hide_index=True, width="stretch")
    st.markdown("Mientras más caro es un falso negativo respecto del falso positivo, **más bajo es el umbral óptimo** "
                "y más dinero se ahorra frente al umbral 0,5.")

# ===================================== 6. CALIBRACIÓN =====================================
with tab6:
    st.subheader("Calibración de probabilidades")
    st.caption("Una buena clasificación no garantiza que las probabilidades estimadas coincidan con la frecuencia observada.")
    st.markdown("El umbral teórico `p* = C_FP / (C_FP + C_FN)` supone que la probabilidad del modelo es la probabilidad **real**. "
                "Aquí se compara la probabilidad que da el modelo con la proporción real de enfermos en cada tramo.")
    dfc = pd.DataFrame({"proba": p, "y": y})
    try:
        dfc["tramo"] = pd.qcut(dfc["proba"], 10, duplicates="drop")
    except ValueError:
        dfc["tramo"] = pd.cut(dfc["proba"], 10)
    cal = dfc.groupby("tramo", observed=True).agg(proba_media=("proba", "mean"), tasa_real=("y", "mean"),
                                                  n=("y", "size")).reset_index(drop=True)
    fig6 = go.Figure()
    fig6.add_trace(go.Scatter(x=cal["proba_media"], y=cal["tasa_real"], mode="lines+markers", name="Modelo"))
    fig6.add_trace(go.Scatter(x=[0, max(cal["proba_media"].max(), cal["tasa_real"].max())],
                              y=[0, max(cal["proba_media"].max(), cal["tasa_real"].max())],
                              mode="lines", line=dict(dash="dash", color="gray"), name="Calibración perfecta"))
    fig6.update_layout(
        title="Probabilidad estimada vs. frecuencia observada",
        xaxis_title="Probabilidad promedio estimada",
        yaxis_title="Proporción observada de casos positivos",
        hovermode="closest",
    )
    fig6.update_traces(line=dict(color=COLORES["teal"], width=3), marker=dict(size=9))
    mostrar_figura(fig6, altura=420)
    st.dataframe(cal.round(3), hide_index=True, width="stretch")
    st.markdown(f"Probabilidad mínima del modelo: **{p.min():.3f}** · promedio: **{p.mean():.3f}** · "
                f"tasa real de enfermos: **{y.mean():.3f}**. "
                f"Si la probabilidad mínima es mayor que p* ({R['p_star']:.3f}), el umbral teórico marca a todos como positivos: "
                "no es un error de código, es falta de calibración. Por eso se usa también el umbral empírico.")


# ===================================== 7. ROC E ISO-COSTO =====================================
with tab7:
    st.subheader("Curva ROC y recta de iso-costo")
    st.caption("Elemento opcional del certamen. La geometría se muestra sobre test de forma retrospectiva, como en el notebook del profesor.")

    orden = np.argsort(-p, kind="stable")
    y_ordenado, scores = y[orden], p[orden]
    finales_grupo = np.r_[np.flatnonzero(np.diff(scores) != 0), len(scores) - 1]
    tp_acum = np.cumsum(y_ordenado == 1)[finales_grupo]
    fp_acum = np.cumsum(y_ordenado == 0)[finales_grupo]
    positivos, negativos = int((y == 1).sum()), int((y == 0).sum())
    tpr = np.r_[0.0, tp_acum / positivos]
    fpr = np.r_[0.0, fp_acum / negativos]
    auc = float(np.trapezoid(tpr, fpr))

    costo_roc = c_fn * positivos * (1 - tpr) + c_fp * negativos * fpr
    k = int(np.argmin(costo_roc))
    pendiente = (c_fp * negativos) / (c_fn * positivos)
    x_iso = np.linspace(0, 1, 100)
    y_iso = tpr[k] + pendiente * (x_iso - fpr[k])

    tn_m, fp_m, fn_m, tp_m = conteos(umbral)
    fpr_manual = fp_m / (fp_m + tn_m) if (fp_m + tn_m) else 0.0
    tpr_manual = tp_m / (tp_m + fn_m) if (tp_m + fn_m) else 0.0

    fig7 = go.Figure()
    fig7.add_trace(go.Scatter(x=fpr, y=tpr, mode="lines", name=f"ROC (AUC = {auc:.3f})",
                              line={"color": COLORES["teal"], "width": 3}))
    fig7.add_trace(go.Scatter(x=[0, 1], y=[0, 1], mode="lines", name="Azar",
                              line={"color": COLORES["gray"], "dash": "dash"}))
    fig7.add_trace(go.Scatter(x=x_iso, y=y_iso, mode="lines", name=f"Iso-costo (m = {pendiente:.2f})",
                              line={"color": COLORES["navy"], "dash": "dot"}))
    fig7.add_trace(go.Scatter(x=[fpr[k]], y=[tpr[k]], mode="markers", name="Mínimo retrospectivo",
                              marker={"size": 15, "symbol": "circle-open", "color": COLORES["coral"], "line": {"width": 3}}))
    fig7.add_trace(go.Scatter(x=[fpr_manual], y=[tpr_manual], mode="markers", name=f"Manual ({umbral:.2f})",
                              marker={"size": 12, "symbol": "star", "color": COLORES["amber"]}))
    fig7.update_layout(
        title="ROC del modelo en proporción real e iso-costo",
        xaxis_title="FPR (1 − especificidad)",
        yaxis_title="TPR (recall)",
        xaxis={"range": [0, 1]},
        yaxis={"range": [0, 1.02]},
    )
    mostrar_figura(fig7, altura=520)
    st.markdown(
        f"La pendiente es `C_FP × N / (C_FN × P) = {pendiente:.2f}`. "
        "Al aumentar el costo de FN, la recta se aplana y favorece puntos de mayor recall."
    )

st.divider()
st.caption(
    "CardioInsight · Grupo 14 · Joaquín Rivas y Matías Ortega · Proyecto académico de analítica predictiva. "
    "Los resultados dependen de la base utilizada, la preparación de datos y los supuestos de simulación. "
    "No usar para diagnosticar, descartar enfermedad ni decidir tratamientos."
)
