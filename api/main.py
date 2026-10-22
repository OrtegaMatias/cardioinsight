"""API privada para el reporte histórico y la simulación educativa BRFSS.

Los archivos de resultados y el modelo son datos locales de confianza montados en el
servidor; jamás se envían al navegador salvo los resultados JSON explícitos.
"""

import base64
from collections import OrderedDict, deque
import csv
from datetime import datetime, timezone
from functools import lru_cache
import hashlib
import hmac
import json
from ipaddress import ip_address
import math
import os
from pathlib import Path
import re
import secrets
from threading import Lock
from time import monotonic
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, StrictInt


RESULTADOS_DIR = Path(os.environ.get("RESULTADOS_DIR", "/app/resultados"))
MODEL_PATH = Path(os.environ.get("MODEL_PATH", "/app/resultados/modelo_inferencia.joblib"))
ARCHIVO_CLAVE = Path(os.environ.get("ARCHIVO_CLAVE", "/app/acceso/clave"))
COOKIE_NAME = "cardioinsight_session"
SESSION_SECONDS = 8 * 60 * 60
ACCESS_WINDOW_SECONDS = 10 * 60
PER_CLIENT_FAILURE_LIMIT = 5
GLOBAL_FAILURE_LIMIT = 30
MAX_ACCESS_CLIENTS = 1024
MAX_BODY_BYTES = 8192
NOTICE = (
    "Simulación educativa con datos BRFSS 2015; no es un diagnóstico, no recomienda "
    "tratamientos ni sustituye una evaluación profesional. Las respuestas no se almacenan."
)

app = FastAPI(title="CardioInsight API", docs_url=None, redoc_url=None, openapi_url=None)


@app.middleware("http")
async def protect_http(request: Request, call_next):
    if request.url.path in ("/api/access", "/api/predict"):
        length = request.headers.get("content-length")
        if length is not None and (not length.isdigit() or int(length) > MAX_BODY_BYTES):
            return JSONResponse({"detail": "Solicitud demasiado grande."}, status_code=413)
        size = 0
        chunks = []
        async for chunk in request.stream():
            size += len(chunk)
            if size > MAX_BODY_BYTES:
                return JSONResponse({"detail": "Solicitud demasiado grande."}, status_code=413)
            chunks.append(chunk)
        request._body = b"".join(chunks)
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


@app.exception_handler(RequestValidationError)
async def validation_error(_request: Request, _exc: RequestValidationError):
    # Pydantic's default validation errors can echo the submitted health answers.
    return JSONResponse(
        {"detail": "Revise los campos y sus rangos permitidos."},
        status_code=422,
        headers={"Cache-Control": "no-store"},
    )


def _key_bytes() -> bytes:
    try:
        with ARCHIVO_CLAVE.open("rb") as source:
            raw = source.read(4097)
        if len(raw) > 4096:
            raise ValueError("oversized key")
        key = raw.rstrip(b"\r\n")
        # A random 32+ character password is expected (not a human-chosen password).
        if not 24 <= len(key) <= 256 or any(c < 33 or c > 126 for c in key):
            raise ValueError("invalid key")
    except (OSError, ValueError) as exc:
        raise HTTPException(status_code=503, detail="Acceso temporalmente no disponible.") from exc
    return key


def _signing_key(key: bytes) -> bytes:
    return hmac.digest(key, b"cardioinsight-session-v1", "sha256")


def _encode_session(key: bytes) -> str:
    issued = str(int(datetime.now(timezone.utc).timestamp()))
    nonce = base64.urlsafe_b64encode(secrets.token_bytes(16)).rstrip(b"=").decode("ascii")
    message = f"{issued}.{nonce}"
    signature = base64.urlsafe_b64encode(
        hmac.digest(_signing_key(key), message.encode("ascii"), "sha256")
    ).rstrip(b"=").decode("ascii")
    return f"{message}.{signature}"


def _valid_session(token: str | None, key: bytes) -> bool:
    if not token or not re.fullmatch(r"[0-9]{10,12}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}", token):
        return False
    issued, nonce, signature = token.split(".")
    now = int(datetime.now(timezone.utc).timestamp())
    if not 0 <= now - int(issued) <= SESSION_SECONDS:
        return False
    expected = base64.urlsafe_b64encode(
        hmac.digest(_signing_key(key), f"{issued}.{nonce}".encode("ascii"), "sha256")
    ).rstrip(b"=").decode("ascii")
    return hmac.compare_digest(signature, expected)


def require_session(request: Request) -> None:
    if not _valid_session(request.cookies.get(COOKIE_NAME), _key_bytes()):
        raise HTTPException(status_code=401, detail="Se requiere una clave de acceso vigente.")


class AccessRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    key: str = Field(min_length=1, max_length=256)


# CF-Connecting-IP is set by Cloudflare Tunnel; the origin is reachable only
# through the local Next.js proxy. Keep a global ceiling for forged headers.
_failures: OrderedDict[str, deque[float]] = OrderedDict()
_all_failures: deque[float] = deque()
_failure_lock = Lock()


def _check_and_record_attempt(client: str, valid: bool) -> bool:
    now = monotonic()
    with _failure_lock:
        while _all_failures and now - _all_failures[0] >= ACCESS_WINDOW_SECONDS:
            _all_failures.popleft()
        events = _failures.get(client)
        if events is None:
            if len(_failures) >= MAX_ACCESS_CLIENTS:
                _failures.popitem(last=False)
            events = deque()
            _failures[client] = events
        else:
            _failures.move_to_end(client)
        while events and now - events[0] >= ACCESS_WINDOW_SECONDS:
            events.popleft()
        if valid:
            return True  # bad guesses must never lock out someone holding the actual key
        if len(events) >= PER_CLIENT_FAILURE_LIMIT or len(_all_failures) >= GLOBAL_FAILURE_LIMIT:
            return False
        events.append(now)
        _all_failures.append(now)
        return True


@app.get("/api/session")
def session(request: Request):
    return {"authenticated": _valid_session(request.cookies.get(COOKIE_NAME), _key_bytes())}


@app.post("/api/access")
def access(body: AccessRequest, request: Request, response: Response):
    key = _key_bytes()
    provided = body.key.encode("utf-8")
    valid = hmac.compare_digest(hashlib.sha256(provided).digest(), hashlib.sha256(key).digest())
    client = request.headers.get("cf-connecting-ip", "")
    try:
        client = str(ip_address(client))
    except ValueError:
        client = request.client.host if request.client is not None else "unknown"
    if not _check_and_record_attempt(client, valid):
        raise HTTPException(status_code=429, detail="Demasiados intentos. Pruebe más tarde.")
    if not valid:
        raise HTTPException(status_code=401, detail="Clave incorrecta.")
    response.set_cookie(
        COOKIE_NAME, _encode_session(key), max_age=SESSION_SECONDS, path="/",
        secure=True, httponly=True, samesite="strict",
    )
    return {"authenticated": True}


@app.post("/api/logout")
def logout(response: Response):
    response.delete_cookie(COOKIE_NAME, path="/", secure=True, httponly=True, samesite="strict")
    return {"authenticated": False}


TABLES = ("comparacion", "tabla_cv", "importancias", "estrategias", "sensibilidad")
TABLE_TEXT_COLUMNS = {"Nombre", "Modelo", "Etapa", "Variable", "Estrategia", "Hiperparametros"}
_dashboard_json: bytes | None = None
_dashboard_lock = Lock()


def _bounded_file(name: str, maximum: int) -> Path:
    path = RESULTADOS_DIR / name
    if path.stat().st_size > maximum:
        raise ValueError("oversized results file")
    return path


def _read_table(name: str) -> list[dict]:
    rows: list[dict] = []
    with _bounded_file(f"{name}.csv", 2 * 1024 * 1024).open(encoding="utf-8", newline="") as source:
        reader = csv.DictReader(source)
        if not reader.fieldnames or len(reader.fieldnames) != len(set(reader.fieldnames)):
            raise ValueError("invalid table header")
        for row in reader:
            if len(rows) >= 1000 or None in row:
                raise ValueError("invalid table size or row")
            converted = {}
            for column, value in row.items():
                if value is None or len(value) > 8192:
                    raise ValueError("invalid table cell")
                if column in TABLE_TEXT_COLUMNS:
                    converted[column] = value
                elif not value or value.lower() == "nan":
                    converted[column] = None
                else:
                    number = float(value)
                    if not math.isfinite(number):
                        raise ValueError("invalid numeric cell")
                    converted[column] = int(value) if re.fullmatch(r"-?\d+", value) else number
            rows.append(converted)
    return rows


def _read_dashboard_arrays() -> dict[str, list]:
    arrays: dict[str, list] = {"y_true": [], "proba": [], "proba_B": []}
    with _bounded_file("datos_dashboard.csv", 32 * 1024 * 1024).open(encoding="utf-8", newline="") as source:
        reader = csv.DictReader(source)
        if reader.fieldnames != list(arrays):
            raise ValueError("invalid dashboard header")
        for row in reader:
            if len(arrays["y_true"]) >= 300_000 or None in row:
                raise ValueError("invalid dashboard size or row")
            outcome = int(row["y_true"])
            p = float(row["proba"])
            p_b = float(row["proba_B"])
            if outcome not in (0, 1) or not (0 <= p <= 1 and 0 <= p_b <= 1):
                raise ValueError("invalid dashboard value")
            arrays["y_true"].append(outcome)
            arrays["proba"].append(p)
            arrays["proba_B"].append(p_b)
    if not arrays["y_true"]:
        raise ValueError("empty dashboard")
    return arrays


@lru_cache(maxsize=1)
def _summary() -> dict:
    try:
        with _bounded_file("resumen.json", 128 * 1024).open(encoding="utf-8") as source:
            summary = json.load(source)
        threshold = summary["umbral_empirico"]
        if not isinstance(threshold, (float, int)) or not math.isfinite(threshold) or not 0 <= threshold <= 1:
            raise ValueError("invalid training threshold")
        return summary
    except (OSError, ValueError, TypeError, KeyError, OverflowError) as exc:
        raise HTTPException(status_code=503, detail="Resultados no disponibles.") from exc


def _dashboard_bytes() -> bytes:
    global _dashboard_json
    if _dashboard_json is None:
        with _dashboard_lock:
            if _dashboard_json is None:
                try:
                    payload = {"resumen": _summary()}
                    payload.update({name: _read_table(name) for name in TABLES})
                    payload["datos_dashboard"] = _read_dashboard_arrays()
                    _dashboard_json = json.dumps(
                        payload, ensure_ascii=False, allow_nan=False, separators=(",", ":")
                    ).encode("utf-8")
                except (OSError, ValueError, TypeError, csv.Error, KeyError, OverflowError) as exc:
                    raise HTTPException(status_code=503, detail="Resultados no disponibles.") from exc
    return _dashboard_json


@app.get("/api/dashboard", dependencies=[Depends(require_session)])
def dashboard():
    return Response(content=_dashboard_bytes(), media_type="application/json")


def _json_number(value):
    # Permit JSON integers and decimals, never booleans or numeric strings.
    if type(value) not in (int, float):
        raise ValueError("expected JSON number")
    try:
        number = float(value)
    except OverflowError as exc:
        raise ValueError("number outside supported range") from exc
    if not math.isfinite(number):
        raise ValueError("non-finite number")
    return number


JsonNumber = Annotated[float, BeforeValidator(_json_number)]


Binary = Annotated[StrictInt, Field(ge=0, le=1)]
DiabetesCode = Annotated[StrictInt, Field(ge=0, le=2)]
HealthCode = Annotated[StrictInt, Field(ge=1, le=5)]
Days = Annotated[StrictInt, Field(ge=0, le=30)]
AgeCode = Annotated[StrictInt, Field(ge=1, le=13)]
EducationCode = Annotated[StrictInt, Field(ge=1, le=6)]
IncomeCode = Annotated[StrictInt, Field(ge=1, le=8)]


class Features(BaseModel):
    model_config = ConfigDict(extra="forbid")
    HighBP: Binary
    HighChol: Binary
    CholCheck: Binary
    BMI: Annotated[JsonNumber, Field(ge=12, le=98)]
    Smoker: Binary
    Stroke: Binary
    Diabetes: DiabetesCode
    PhysActivity: Binary
    Fruits: Binary
    Veggies: Binary
    HvyAlcoholConsump: Binary
    AnyHealthcare: Binary
    NoDocbcCost: Binary
    GenHlth: HealthCode
    MentHlth: Days
    PhysHlth: Days
    DiffWalk: Binary
    Sex: Binary
    Age: AgeCode
    Education: EducationCode
    Income: IncomeCode


class PredictRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    features: Features
    threshold: Annotated[JsonNumber, Field(ge=0, le=1)] | None = None


# The exported inference pipeline references this pure preprocessing function.
def recortar_bmi(x):
    import numpy as np

    return np.clip(x, 15, 60)


_model = None
_model_lock = Lock()


def _prediction_model():
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                try:
                    import joblib

                    candidate = joblib.load(MODEL_PATH)  # Only load the repository's trusted artifact.
                    if not callable(getattr(candidate, "predict_proba", None)):
                        raise ValueError("invalid model")
                    estimator = candidate.named_steps.get("modelo")
                    if estimator is not None and hasattr(estimator, "n_jobs"):
                        estimator.n_jobs = 1
                    _model = candidate
                except Exception as exc:
                    raise HTTPException(status_code=503, detail="Modelo no disponible.") from exc
    return _model


@app.post("/api/predict", dependencies=[Depends(require_session)])
def predict(body: PredictRequest):
    if "threshold" in body.model_fields_set and body.threshold is None:
        raise HTTPException(status_code=422, detail="Revise los campos y sus rangos permitidos.")
    threshold = body.threshold if body.threshold is not None else _summary()["umbral_empirico"]
    try:
        import pandas as pd

        row = pd.DataFrame([body.features.model_dump()])
        probability = float(_prediction_model().predict_proba(row)[0, 1])
        if not math.isfinite(probability) or not 0 <= probability <= 1:
            raise ValueError("invalid model output")
    except HTTPException:
        raise
    except Exception as exc:
        # Neither submitted health data nor internal model details belong in responses/logs.
        raise HTTPException(status_code=503, detail="Predicción no disponible.") from exc
    decision = probability >= threshold
    return {
        "probability": probability,
        "decision": decision,
        "threshold": threshold,
        "label": ("Señal del modelo por encima del umbral" if decision
                  else "Señal del modelo por debajo del umbral"),
        "notice": NOTICE,
    }
