#!/usr/bin/env python3
"""Valida los JSON normalizados de monitoreATE sin corregirlos silenciosamente."""
import argparse, json, math
from datetime import datetime
from pathlib import Path

BASE_PERIOD = "2023-12"
REQUIRED = {"inflacion.json": {"ipc", "alimentos", "servicios"}, "salarios.json": {"salario_publico"}}
CONTROLS = {
    "ipc": ("2026-08", 12276.766, 347.47),
    "alimentos": ("2026-08", 13121.2544, 314.38),
    "servicios": ("2026-08", 12830.0223, 525.63),
    "salario_publico": ("2026-07", 8123.88, 342.20),
}

def next_period(period):
    date = datetime.strptime(period, "%Y-%m")
    return f"{date.year + (date.month == 12):04d}-{date.month % 12 + 1:02d}"

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
        if any(current != next_period(previous) for previous, current in zip(periods, periods[1:])):
            errors.append(f"{sid}: existen meses faltantes")
        key = "value" if data.get("demo") else "officialValue"
        if any(not isinstance(o.get(key), (int, float)) or not math.isfinite(o[key]) for o in observations):
            errors.append(f"{sid}: valores {key} nulos o inválidos")
            continue
        if not data.get("demo"):
            if any(not series.get(k) for k in ("sourceName", "sourceUrl", "lastUpdated")):
                errors.append(f"{sid}: metadatos de fuente incompletos")
            if series.get("sourceName") != "INDEC" or "indec.gob.ar" not in series.get("sourceUrl", ""):
                errors.append(f"{sid}: la fuente no es una URL oficial de INDEC")
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
                if sid in CONTROLS:
                    period, expected_official, expected_index = CONTROLS[sid]
                    last = observations[-1]
                    if last.get("period") != period: errors.append(f"{sid}: último período esperado {period}")
                    if not math.isclose(last.get(key), expected_official, abs_tol=1e-4): errors.append(f"{sid}: valor oficial de control incorrecto")
                    if not math.isclose(last.get("indexDec2023"), expected_index, abs_tol=.01): errors.append(f"{sid}: índice de control incorrecto")
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
    validated_names = {path.name for path in args.files}
    if not failed and not args.allow_demo and {"inflacion.json", "salarios.json"} <= validated_names:
        inflation = json.loads(Path("data/inflacion.json").read_text(encoding="utf-8"))
        salaries = json.loads(Path("data/salarios.json").read_text(encoding="utf-8"))
        by_id = {s["id"]: s for s in inflation["series"] + salaries["series"]}
        ipc = {o["period"]: o["indexDec2023"] for o in by_id["ipc"]["observations"]}
        salary = by_id["salario_publico"]["observations"]
        common = [o for o in salary if o["period"] in ipc]
        real_last = common[-1]["indexDec2023"] / ipc[common[-1]["period"]] * 100
        if common[-1]["period"] != "2026-07" or not math.isclose(real_last, 100.12, abs_tol=.01):
            failed = True
            print("ERROR salario real: período o valor final de control incorrecto")
        else:
            print(f"OK salario real {common[-1]['period']}: {real_last:.2f}")
    raise SystemExit(1 if failed else 0)
if __name__ == "__main__": main()
