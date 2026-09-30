#!/usr/bin/env python3
"""Transforma los CSV locales de INDEC en los JSON publicados por monitoreATE."""

import csv
import json
import re
import zipfile
from datetime import datetime, timedelta
from pathlib import Path
from xml.etree import ElementTree


ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw" / "indec"
BASE_PERIOD = "2023-12"
IPC_SOURCE_URL = "https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-5-31"
SALARY_SOURCE_URL = "https://www.indec.gob.ar/indec/web/Nivel4-Tema-4-31-61"
EMPLOYMENT_SOURCE_URL = "https://www.indec.gob.ar/"
EMPLOYMENT_TITLE = "Dotación de personal de la Administración Pública Nacional, empresas y sociedades"
XLSX_NS = {"main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
           "rel": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"}


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


def xlsx_cells(path: Path, sheet_name: str):
    """Lee valores de una hoja XLSX con la biblioteca estándar, sin modificar el original."""
    with zipfile.ZipFile(path) as book:
        shared_root = ElementTree.fromstring(book.read("xl/sharedStrings.xml"))
        shared = ["".join(node.text or "" for node in item.iter(f"{{{XLSX_NS['main']}}}t"))
                  for item in shared_root.findall("main:si", XLSX_NS)]
        workbook = ElementTree.fromstring(book.read("xl/workbook.xml"))
        relationships = ElementTree.fromstring(book.read("xl/_rels/workbook.xml.rels"))
        targets = {item.attrib["Id"]: item.attrib["Target"].lstrip("/") for item in relationships}
        sheets = {item.attrib["name"]: targets[item.attrib[f"{{{XLSX_NS['rel']}}}id"]]
                  for item in workbook.find("main:sheets", XLSX_NS)}
        if sheet_name not in sheets:
            raise ValueError(f"{path.name}: no se encontró la hoja {sheet_name!r}")
        target = sheets[sheet_name]
        if not target.startswith("xl/"):
            target = f"xl/{target}"
        root = ElementTree.fromstring(book.read(target))
        cells = {}
        for cell in root.findall(".//main:c", XLSX_NS):
            raw_node = cell.find("main:v", XLSX_NS)
            raw = raw_node.text if raw_node is not None else None
            kind = cell.attrib.get("t", "n")
            if kind == "s" and raw is not None:
                value = shared[int(raw)]
            elif kind == "inlineStr":
                value = "".join(node.text or "" for node in cell.iter(f"{{{XLSX_NS['main']}}}t"))
            elif raw is None:
                value = None
            else:
                value = float(raw)
                if value.is_integer():
                    value = int(value)
            cells[cell.attrib["r"]] = value
        return cells


def excel_column(reference: str) -> str:
    return re.match(r"[A-Z]+", reference).group()


def excel_row(reference: str) -> int:
    return int(re.search(r"\d+", reference).group())


def employment_payload(path: Path):
    cells = xlsx_cells(path, "serie  cuadro 1")
    total_headers = [ref for ref, value in cells.items() if value == "Dotación total"]
    total_rows = [ref for ref, value in cells.items() if value == "Total"]
    if len(total_headers) != 1 or len(total_rows) != 1:
        raise ValueError(f"{path.name}: no se pudo identificar inequívocamente la fila de dotación total")
    header_row = excel_row(total_headers[0])
    period_row = header_row + 1
    total_row = excel_row(total_rows[0])

    month_names = {"ene": 1, "feb": 2, "mar": 3, "abr": 4, "may": 5, "jun": 6,
                   "jul": 7, "ago": 8, "sep": 9, "sept": 9, "oct": 10, "nov": 11, "dic": 12}
    values = []
    original_labels = {}
    for reference, raw_label in cells.items():
        if excel_row(reference) != period_row or raw_label is None:
            continue
        column = excel_column(reference)
        estimated = isinstance(raw_label, str) and "(i)" in raw_label
        if isinstance(raw_label, (int, float)):
            date = datetime(1899, 12, 30) + timedelta(days=raw_label)
            period = date.strftime("%Y-%m")
            label = date.strftime("%b-%y")
        elif isinstance(raw_label, str):
            match = re.fullmatch(r"([a-z]+)-(\d{2})(?: \(i\))?", raw_label.strip().lower())
            if not match or match.group(1) not in month_names:
                continue
            period = f"20{match.group(2)}-{month_names[match.group(1)]:02d}"
            label = raw_label
        else:
            continue
        value_reference = f"{column}{total_row}"
        value = cells.get(value_reference)
        if not isinstance(value, (int, float)):
            raise ValueError(f"{path.name}: dotación total ausente o no numérica en {value_reference}")
        values.append((period, int(value), estimated))
        original_labels[period] = label

    values.sort()
    periods = [period for period, _, _ in values]
    if len(periods) != len(set(periods)) or BASE_PERIOD not in periods:
        raise ValueError(f"{path.name}: períodos duplicados o falta {BASE_PERIOD}")
    base = dict((period, value) for period, value, _ in values)[BASE_PERIOD]
    observations = []
    previous = None
    for period, value, estimated in values:
        if period < BASE_PERIOD:
            continue
        observations.append({
            "period": period,
            "value": value,
            "monthlyChange": None if previous is None else value - previous,
            "monthlyChangePct": None if previous is None else (value / previous - 1) * 100,
            "changeFromBase": value - base,
            "changeFromBasePct": (value / base - 1) * 100,
            "estimatedByImputation": estimated,
            "originalLabel": original_labels[period],
        })
        previous = value
    return {
        "demo": False,
        "source": "INDEC",
        "sourceUrl": EMPLOYMENT_SOURCE_URL,
        "title": EMPLOYMENT_TITLE,
        "unit": "personas",
        "basePeriod": BASE_PERIOD,
        "latestPeriod": observations[-1]["period"],
        "generatedFrom": str(path.relative_to(ROOT)),
        "officialLocation": f"Hoja 'serie  cuadro 1', períodos en fila {period_row} y dotación total en fila {total_row}",
        "series": observations,
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
    employment_path = RAW / "serie_dotacion_apn.xlsx"
    write_json("empleo.json", employment_payload(employment_path))


if __name__ == "__main__":
    main()
