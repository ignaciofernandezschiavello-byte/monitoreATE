#!/usr/bin/env python3
"""Transforma los CSV locales de INDEC en los JSON publicados por monitoreATE."""

import csv
import json
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw" / "indec"
BASE_PERIOD = "2023-12"
IPC_SOURCE_URL = "https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-5-31"
SALARY_SOURCE_URL = "https://www.indec.gob.ar/indec/web/Nivel4-Tema-4-31-61"


def read_csv(path: Path, required_headers: set[str], encodings=("utf-8-sig", "cp1252")):
    last_error = None
    for encoding in encodings:
        try:
            with path.open(encoding=encoding, newline="") as stream:
                reader = csv.DictReader(stream, delimiter=";")
                headers = set(reader.fieldnames or [])
                missing = required_headers - headers
                if missing:
                    raise ValueError(f"{path.name}: faltan encabezados: {', '.join(sorted(missing))}")
                return list(reader)
        except UnicodeDecodeError as error:
            last_error = error
    raise ValueError(f"{path.name}: no se pudo decodificar") from last_error


def decimal(value: str) -> float:
    if not value or value.strip().upper() == "NA":
        raise ValueError("valor numérico ausente")
    return float(value.strip().replace(".", "").replace(",", "."))


def normalized_observations(values):
    values = sorted(values)
    periods = [period for period, _ in values]
    if len(periods) != len(set(periods)):
        raise ValueError("la selección produjo períodos duplicados")
    if BASE_PERIOD not in periods:
        raise ValueError(f"la selección no contiene {BASE_PERIOD}")
    base = dict(values)[BASE_PERIOD]
    observations = []
    for period, official_value in values:
        index = official_value / base * 100
        observations.append({
            "period": period,
            "officialValue": official_value,
            "indexDec2023": 100.0 if period == BASE_PERIOD else index,
        })
    return observations


def ipc_series(rows, *, series_id, name, code, description, classifier):
    selected = []
    for row in rows:
        matches = (
            row["Codigo"] == code
            and row["Clasificador"] == classifier
            and row["Region"] == "Nacional"
            and (description is None or row["Descripcion"] == description)
        )
        if matches:
            period = f'{row["Periodo"][:4]}-{row["Periodo"][4:6]}'
            if period >= BASE_PERIOD:
                selected.append((period, decimal(row["Indice_IPC"])))
    if not selected:
        raise ValueError(f"no se encontró la serie IPC {series_id}")
    observations = normalized_observations(selected)
    return {
        "id": series_id,
        "name": name,
        "sourceName": "INDEC",
        "sourceUrl": IPC_SOURCE_URL,
        "lastUpdated": observations[-1]["period"],
        "officialSeries": {"Codigo": code, "Descripcion": description, "Clasificador": classifier, "Region": "Nacional"},
        "observations": observations,
    }


def salary_series(rows):
    selected = []
    for row in rows:
        date = datetime.strptime(row["periodo"], "%d/%m/%Y")
        period = date.strftime("%Y-%m")
        if period >= BASE_PERIOD:
            selected.append((period, decimal(row["IS_sector_publico"])))
    observations = normalized_observations(selected)
    return {
        "id": "salario_publico",
        "name": "Salario público",
        "sourceName": "INDEC",
        "sourceUrl": SALARY_SOURCE_URL,
        "lastUpdated": observations[-1]["period"],
        "officialColumn": "IS_sector_publico",
        "observations": observations,
    }


def write_json(filename: str, payload):
    path = ROOT / "data" / filename
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Generado {path.relative_to(ROOT)}")


def main():
    ipc_path = RAW / "serie_ipc_divisiones (1).csv"
    ipc_rows = read_csv(ipc_path, {"Codigo", "Descripcion", "Clasificador", "Periodo", "Indice_IPC", "Region"})
    inflation = {
        "demo": False,
        "sourceName": "INDEC",
        "generatedFrom": str(ipc_path.relative_to(ROOT)),
        "series": [
            ipc_series(ipc_rows, series_id="ipc", name="IPC general", code="0", description="NIVEL GENERAL", classifier="Nivel general y divisiones COICOP"),
            ipc_series(ipc_rows, series_id="alimentos", name="IPC alimentos y bebidas no alcohólicas", code="01", description="Alimentos y bebidas no alcohólicas", classifier="Nivel general y divisiones COICOP"),
            # INDEC publica este agregado con Descripcion vacía; no se suman divisiones.
            ipc_series(ipc_rows, series_id="servicios", name="IPC servicios", code="S", description=None, classifier="Bienes y servicios"),
        ],
    }

    salary_path = RAW / "indice_salarios.csv"
    salary_rows = read_csv(salary_path, {"periodo", "IS_sector_publico"})
    salaries = {
        "demo": False,
        "sourceName": "INDEC",
        "generatedFrom": str(salary_path.relative_to(ROOT)),
        "series": [salary_series(salary_rows)],
        "excludedSeries": {
            "subsector_publico_nacional": "El CSV auditado sólo contiene variaciones, no niveles oficiales.",
            "subsector_publico_provincial": "El CSV auditado sólo contiene variaciones, no niveles oficiales.",
        },
    }
    write_json("inflacion.json", inflation)
    write_json("salarios.json", salaries)


if __name__ == "__main__":
    main()
