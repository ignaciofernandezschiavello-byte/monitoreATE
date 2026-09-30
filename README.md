# monitoreATE

Observatorio web de indicadores económicos y laborales relevantes para trabajadores del sector público argentino. La interfaz compara salarios, precios y poder adquisitivo con una metodología común: **diciembre de 2023 = 100**.

> **Estado de los datos (30/09/2026):** los archivos publicados siguen siendo **DEMO**. En esta sesión el acceso de red a `indec.gob.ar` fue rechazado con HTTP 403 antes de recibir los archivos. Para respetar el criterio de no inventar cifras, no se reemplazó ninguna observación ni se desactivó la advertencia. La aplicación y los validadores ya están preparados para rechazar mezclas de datos oficiales y DEMO.

## Funcionalidades

- Dashboard responsive con cinco indicadores, gráficos interactivos y fecha final independiente por serie.
- Comparación de salario público, IPC general, alimentos y servicios.
- Índice monitoreATE de Salario Real, calculado sólo para períodos comunes entre salario e IPC.
- Calculadora de poder adquisitivo, tablas y descarga de CSV.
- Enlaces de fuente en las tarjetas cuando el JSON contiene una URL oficial.
- Empleo público y paritarias permanecen identificados como pendientes.

## Fuentes oficiales previstas

| Indicador | Archivo/categoría que debe verificarse antes de publicar |
| --- | --- |
| IPC nivel general | Serie histórica de **IPC nacional**, categoría “Nivel general”, publicada en la [página oficial del IPC](https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-5-31) |
| IPC alimentos | Serie histórica de **IPC nacional**, división “Alimentos y bebidas no alcohólicas”, misma página oficial |
| IPC servicios | Serie histórica de **IPC nacional**, categoría “Servicios”, misma página oficial |
| Salario público | [`indice_salarios.csv`](https://www.indec.gob.ar/ftp/cuadros/sociedad/indice_salarios.csv), columna de sector público que debe seleccionarse por el texto exacto de su encabezado |
| Variaciones salariales (control) | [`variacion_indice_salarios.csv`](https://www.indec.gob.ar/ftp/cuadros/sociedad/variacion_indice_salarios.csv); no sustituye al índice original |

No se documenta aún un nombre de columna salarial ni valores finales porque no pudieron inspeccionarse los archivos oficiales. Total, Nacional y Provincial se incorporarán únicamente si sus encabezados y cobertura desde 2023-12 se verifican de forma consistente.

## Metodología y esquema normalizado

Los valores de origen nunca se sobrescriben. Cada observación oficial debe conservar:

```json
{
  "period": "2024-01",
  "officialValue": 1234.56,
  "indexDec2023": 104.2
}
```

La serie conserva además `sourceName`, `sourceUrl` y `lastUpdated`. El índice visible se calcula (y se valida contra `indexDec2023`) así:

```text
indexDec2023(t) = officialValue(t) / officialValue(2023-12) * 100
ISR(t) = indexSalary(t) / indexIPCGeneral(t) * 100
```

Diciembre de 2023 debe resultar exactamente 100. El ISR no se almacena: se obtiene dinámicamente mediante la intersección de períodos. No se crean meses ausentes, no se interpolan valores y no se arrastra el último dato. Las variaciones mensual e interanual se calculan a partir de los valores oficiales (el rebasing no altera esas tasas).

## Flujo de actualización preparado

```text
fuente oficial INDEC → inspección/transformación reproducible → JSON normalizado → validación → visualización
```

Antes de cambiar `demo` y `CONFIG.demoMode` a `false` se debe:

1. Descargar personalmente los archivos enlazados arriba desde INDEC.
2. Identificar columnas por encabezado, nunca por posición, y documentarlas.
3. Generar observaciones desde 2023-12 hasta el último período propio de cada serie.
4. Ejecutar `python3 scripts/validate-data.py` y las pruebas.
5. Contrastar varias filas con la publicación de INDEC y registrar fecha, valor base y último valor.
6. Desactivar modo DEMO sólo cuando las cuatro series principales sean oficiales.

No se agregó un cron: primero deben confirmarse la estructura y estabilidad de los endpoints. `scripts/validate-data.py` es deliberadamente estricto y termina con error; nunca corrige ni sustituye datos.

## Validaciones

```bash
npm test
python3 scripts/validate-data.py                 # debe fallar mientras los JSON sean DEMO
python3 scripts/validate-data.py --allow-demo    # control transitorio de estructura
```

Se comprueba base presente y exactamente igual a 100, orden, duplicados, valores nulos, metadatos de fuente, consistencia del índice rebasado y ausencia de DEMO en modo oficial. La función de salario real alinea por período, de modo que no puede extenderse más allá del último mes común.

## Ejecutar localmente

```bash
python3 -m http.server 8000
```

Visitar `http://localhost:8000/`. Los recursos usan rutas relativas compatibles con GitHub Pages.

## Estructura

```text
index.html                 Interfaz y metodología
css/styles.css             Estilos responsive
js/app.js                  Carga, validación, renderizado e interacciones
js/charts.js               Gráficos Canvas
js/calculations.js         Rebasing, validaciones, ISR y variaciones
data/inflacion.json        Series DEMO transitorias de precios
data/salarios.json         Serie DEMO transitoria salarial
scripts/validate-data.py   Validación reproducible de JSON normalizados
tests/                     Pruebas de cálculo y validación
```
