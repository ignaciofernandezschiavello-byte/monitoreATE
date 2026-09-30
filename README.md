# monitoreATE

Observatorio web de indicadores económicos y laborales relevantes para trabajadores del sector público argentino. La interfaz compara salarios, precios y poder adquisitivo con una metodología común: **diciembre de 2023 = 100**.

> **Estado de los datos:** esta primera versión contiene exclusivamente series **DEMO**, ficticias y visibles como tales. No deben utilizarse como información económica oficial. Empleo público y paritarias permanecen vacíos hasta incorporar fuentes validadas.

## Funcionalidades

- Dashboard responsive con cinco indicadores y gráficos interactivos accesibles.
- Comparación de salario público, IPC general, alimentos y servicios.
- Índice monitoreATE de Salario Real y brechas contra precios.
- Calculadora de poder adquisitivo basada en las series cargadas.
- Tablas consultables y descarga de CSV por indicador.
- Secciones preparadas para salarios, inflación, empleo público, paritarias, datos y metodología.
- Navegación móvil y rutas relativas compatibles con GitHub Pages en subdirectorios.

## Estructura

```text
index.html              Interfaz y secciones del observatorio
css/styles.css          Sistema visual y estilos responsive
js/app.js               Carga, renderizado e interacciones
js/charts.js            Gráficos Canvas reutilizables
js/calculations.js      Índices, variaciones, salario real y brechas
data/inflacion.json     Series DEMO de precios
data/salarios.json      Serie DEMO salarial
data/empleo.json        Estructura pendiente, sin cifras
data/paritarias.json    Estructura pendiente, sin acuerdos
```

## Ejecutar localmente

Los módulos ES y `fetch` requieren un servidor HTTP (no abrir `index.html` con `file://`):

```bash
python3 -m http.server 8000
```

Luego visitar `http://localhost:8000/`.

## Actualizar datos

1. Reemplazar observaciones en los archivos de `data/`, conservando `period` (`AAAA-MM`) y `value` numérico.
2. Completar en cada serie `sourceName`, `sourceUrl` y `lastUpdated` (`AAAA-MM-DD`).
3. Verificar que exista una observación para `2023-12`; la aplicación convierte automáticamente cualquier valor original a base 100.
4. Cambiar `demo` a `false` en los JSON y `CONFIG.demoMode` a `false` en `js/app.js` solo cuando **todas** las series visibles sean oficiales y estén validadas.
5. Para paritarias, agregar objetos a `agreements`; para empleo, agregar series documentadas. Nunca completar vacíos con estimaciones no identificadas.

## Publicar en GitHub Pages

En **Settings → Pages**, seleccionar `Deploy from a branch`, la rama deseada y la carpeta `/ (root)`. Todos los recursos utilizan rutas relativas, por lo que el sitio funciona tanto en un dominio principal como en una ruta de proyecto (`usuario.github.io/monitoreATE/`).

## Tecnología

HTML, CSS y JavaScript nativo, sin backend ni proceso de compilación. Los gráficos usan Canvas y no dependen de una biblioteca externa.
