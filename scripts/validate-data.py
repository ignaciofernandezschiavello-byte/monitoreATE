#!/usr/bin/env python3
"""Valida los JSON normalizados de monitoreATE sin corregirlos silenciosamente."""
import argparse, json, math
from pathlib import Path

BASE_PERIOD = "2023-12"
REQUIRED = {"inflacion.json": {"ipc", "alimentos", "servicios"}, "salarios.json": {"salario_publico"}}

def validate(path: Path, allow_demo: bool = False):
    data = json.loads(path.read_text(encoding="utf-8"))
    errors = []
    if data.get("demo") and not allow_demo:
        errors.append("contiene datos DEMO")
    ids = {s.get("id") for s in data.get("series", [])}
    missing = REQUIRED.get(path.name, set()) - ids
    if missing:
        errors.append(f"faltan series requeridas: {', '.join(sorted(missing))}")
    for series in data.get("series", []):
        sid, observations = series.get("id", "sin_id"), series.get("observations", [])
        periods = [o.get("period") for o in observations]
        if BASE_PERIOD not in periods: errors.append(f"{sid}: falta {BASE_PERIOD}")
        if len(periods) != len(set(periods)): errors.append(f"{sid}: períodos duplicados")
        if periods != sorted(periods): errors.append(f"{sid}: períodos desordenados")
        key = "value" if data.get("demo") else "officialValue"
        if any(not isinstance(o.get(key), (int, float)) or not math.isfinite(o[key]) for o in observations):
            errors.append(f"{sid}: valores {key} nulos o inválidos")
            continue
        if not data.get("demo"):
            if any(not series.get(k) for k in ("sourceName", "sourceUrl", "lastUpdated")):
                errors.append(f"{sid}: metadatos de fuente incompletos")
            base = next(o[key] for o in observations if o["period"] == BASE_PERIOD)
            if not base: errors.append(f"{sid}: base igual a cero")
            else:
                for o in observations:
                    calculated = o[key] / base * 100
                    if "indexDec2023" not in o or abs(o["indexDec2023"] - calculated) > 1e-8:
                        errors.append(f"{sid}: índice rebasado inconsistente en {o['period']}")
                base_row = next(o for o in observations if o["period"] == BASE_PERIOD)
                if base_row.get("indexDec2023") != 100:
                    errors.append(f"{sid}: diciembre de 2023 no es exactamente 100")
    return errors

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--allow-demo", action="store_true", help="permite validar el esquema transitorio DEMO")
    parser.add_argument("files", nargs="*", type=Path, default=[Path("data/inflacion.json"), Path("data/salarios.json")])
    args = parser.parse_args()
    failed = False
    for path in args.files:
        errors = validate(path, args.allow_demo)
        if errors:
            failed = True
            print(f"ERROR {path}:\n  " + "\n  ".join(errors))
        else: print(f"OK {path}")
    raise SystemExit(1 if failed else 0)
if __name__ == "__main__": main()
