# monitoreATE

Observatorio web de indicadores económicos y laborales relevantes para trabajadores del sector público argentino. La interfaz compara salarios, precios y poder adquisitivo con una metodología común: **diciembre de 2023 = 100**.

## Estado de los datos

El dashboard principal publica series oficiales de **INDEC** transformadas de manera reproducible desde los cuatro CSV auditados y conservados en `data/raw/indec/`. No descarga archivos durante la generación. Empleo público y paritarias continúan como “Datos pendientes de incorporación”: no contienen datos inventados ni se consideran series DEMO.

| Indicador | Selección oficial | Cobertura publicada |
| --- | --- | --- |
| IPC general | `Codigo=0`, `Descripcion=NIVEL GENERAL`, clasificador COICOP, región Nacional | 2023-12 a 2026-08 |
| IPC alimentos | `Codigo=01`, “Alimentos y bebidas no alcohólicas”, clasificador COICOP, región Nacional | 2023-12 a 2026-08 |
| IPC servicios | `Codigo=S`, clasificador “Bienes y servicios”, región Nacional | 2023-12 a 2026-08 |
| Salario público | Columna `IS_sector_publico` | 2023-12 a 2026-07 |

“Servicios” es la denominación usada por monitoreATE para el agregado oficial `Codigo=S`. Su campo `Descripcion` está vacío en el CSV: la serie se selecciona por código, clasificador y región, y **no** se construye sumando divisiones. No se publican índices para los subsectores público nacional y provincial porque los archivos auditados sólo incluyen sus variaciones, no niveles oficiales; monitoreATE no reconstruye esos niveles.

## Flujo reproducible de actualización

```text
CSV oficial INDEC local → scripts/update-data.py → JSON normalizado → validación → visualización
```

Para una futura actualización:

1. Reemplazar los CSV de `data/raw/indec/` por las nuevas versiones oficiales, conservando los nombres esperados.
2. Ejecutar `python3 scripts/update-data.py`.
3. Ejecutar `python3 scripts/validate-data.py` y `npm test`.
4. Revisar el diff, los últimos períodos, los valores de control y la visualización local.
5. Publicar únicamente después de que todos los controles resulten satisfactorios.

El transformador contempla archivos IPC en Windows-1252, separador `;` y coma decimal. Identifica las columnas por encabezado y las filas por filtros explícitos, recorta desde diciembre de 2023, ordena cronológicamente y rechaza duplicados. Produce `data/inflacion.json` y `data/salarios.json` sin intervención manual.

## Metodología y esquema

Cada observación conserva el nivel de origen y el índice derivado:

```json
{
  "period": "2024-01",
  "officialValue": 1234.56,
  "indexDec2023": 104.2
}
```

Cada serie incluye `sourceName`, `sourceUrl`, `lastUpdated` y la selección o columna oficial utilizada. Las fórmulas son:

```text
indexDec2023(t) = officialValue(t) / officialValue(2023-12) × 100
ISR(t) = indexSalary(t) / indexIPCGeneral(t) × 100
```

Diciembre de 2023 queda exactamente en 100. El salario real se calcula en el navegador sólo para la intersección de períodos: IPC puede continuar hasta agosto de 2026 mientras salario público e ISR terminan en julio. No se crean, interpolan ni arrastran observaciones. Las variaciones mensual, interanual y acumulada se calculan desde `officialValue`, no desde índices redondeados.

Fuentes oficiales:

- [IPC nacional — INDEC](https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-5-31)
- [Índice de salarios — INDEC](https://www.indec.gob.ar/indec/web/Nivel4-Tema-4-31-61)

## Validaciones

```bash
python3 scripts/update-data.py
python3 scripts/validate-data.py
npm test
```

El validador comprueba fuente oficial, metadatos, base exacta, orden, duplicados, continuidad mensual, valores finitos, consistencia del rebasing y valores finales de control. También confirma que el ISR termina en julio de 2026 alrededor de 100,12.

## Ejecutar localmente

```bash
python3 -m http.server 8000
```

Visitar `http://localhost:8000/`. Los recursos usan rutas relativas compatibles con GitHub Pages.

## Estructura

```text
index.html                 Interfaz y metodología
css/styles.css             Estilos responsive
js/app.js                  Carga, validación, tarjetas, tabla y calculadora
js/charts.js               Gráficos Canvas con períodos propios por serie
js/calculations.js         Rebasing, ISR y variaciones desde niveles oficiales
data/raw/indec/            CSV oficiales locales auditados
data/inflacion.json        Series normalizadas oficiales de precios
data/salarios.json         Serie normalizada oficial de salario público
scripts/update-data.py     Transformación reproducible CSV → JSON
scripts/validate-data.py   Validación reproducible de los JSON
tests/                     Pruebas de cálculo y validación
```
