# EnerFactura

Prototipo funcional de facturación y contabilidad para autónomos y pymes, desarrollado como prueba técnica para Grupo EMAX.

**Demo:** https://emaxthecnicaltest.vercel.app

La demo usa datos ficticios compartidos entre todos los visitantes. El botón **Restablecer datos demo** (barra lateral) vuelve a cargar los datos de ejemplo en cualquier momento.

---

## Qué funciona

Todo el circuito está conectado: lo que se registra en una sección alimenta las demás, y ningún resumen depende de importes escritos a mano.

| Sección | Qué se puede hacer |
|---|---|
| **Inicio** | Ingresos, gastos y balance del trimestre (sin IVA), pendiente de cobro con facturas vencidas, IVA y retenciones estimados, evolución mensual y últimos movimientos. Selector de trimestre. |
| **Facturas** | Crear factura con cliente existente o nuevo (sin salir del formulario), varias líneas con IVA por línea y totales en tiempo real. Numeración correlativa automática (`F2026-0001`). Listado, detalle y cambio de estado de cobro (pendiente / cobrada / vencida). |
| **Gastos** | Registrar facturas recibidas con base, IVA, retención de IRPF, IVA deducible o no, y estado de pago. Historial con desglose. |
| **OCR** | Subir PDF o foto de una factura. Los datos se extraen de verdad, se validan, rellenan el formulario y el usuario revisa, edita y confirma. El documento original queda guardado y se puede consultar. |
| **Impuestos** | Estimaciones de los modelos 303, 111 y 349 por trimestre, con el desglose de los documentos que los componen. |
| **Contactos** | Clientes y proveedores reutilizables, con NIF-IVA para operadores de la UE y marca de profesional sujeto a retención. |

### Automatizaciones
- Al elegir un cliente o proveedor de otro país de la UE, la operación se marca como intracomunitaria (sin IVA en la factura, con autorrepercusión en las compras) y pasa al modelo 349.
- Al elegir un proveedor profesional se propone la retención del 15 %.
- El OCR busca el proveedor por NIF; si no existe, propone crearlo con los datos leídos.
- El vencimiento se rellena a 30 días y el estado "vencida" se calcula solo.
- IVA, retención y totales los recalcula siempre el servidor a partir de la base y los tipos.

### Casos de prueba del enunciado

Los casos A, B y C vienen precargados en los datos de ejemplo y están cubiertos por tests automáticos (`npm test`).

| Caso | Dónde verlo |
|---|---|
| **A** · Factura emitida 1.000 € + 21 % = 1.210 € | Facturas → `F2026-0001`. Suma 210 € de IVA devengado en el 303. |
| **B** · Factura recibida 1.000 € + 21 % − 15 % = 1.060 € | Gastos → Asesoría Fiscal López. 210 € de IVA soportado en el 303 y 150 € en el 111. |
| **C** · Prestación intracomunitaria a Alemania, 2.000 € | Impuestos → modelo 349: `DE123456789`, clave **S**, 2.000 €. |
| **D** · OCR | Gastos → Subir factura. Hay documentos de prueba en [`samples/`](samples/): una factura PDF de profesional con IRPF y la foto de un ticket. |
| **E** · Persistencia | Crea una factura y un gasto y recarga: siguen ahí y los resúmenes cuadran. |

---

## Tecnologías

| Capa | Elección |
|---|---|
| Framework | Next.js 16 (App Router, Server Components, Server Actions), TypeScript, React 19 |
| Interfaz | Tailwind CSS 4, componentes shadcn/ui (Base UI), lucide-react |
| Validación | Zod, con los mismos esquemas en cliente y servidor |
| **Persistencia** | **PostgreSQL en Neon** (región Frankfurt), mediante **Prisma 7**. Los documentos subidos se guardan en la propia base de datos. |
| OCR con IA | API de Anthropic (Claude Sonnet 5.5) con salida estructurada |
| OCR sin IA (alternativa) | `unpdf` (texto del PDF) y Tesseract.js (imágenes), con un extractor heurístico propio |
| Tests | Vitest |
| Despliegue | Vercel (funciones en `fra1`) |

## Arquitectura

```
src/
  domain/        Reglas de negocio en TypeScript puro: dinero en céntimos, facturas,
                 gastos, modelos 303/111/349, trimestres, NIF y lectura de texto de facturas.
                 Sin dependencias de React ni de la base de datos; es lo que cubren los tests.
  schemas/       Esquemas Zod compartidos por formularios y servidor.
  server/
    actions/     Server Actions (crear factura, gasto, contacto, cambiar estados).
    queries/     Lecturas, siempre filtradas por empresa.
    ocr/         Proveedores de extracción (Claude y local) y normalización del resultado.
  app/           Páginas y rutas (/api/ocr, /api/documents/[id]).
  components/    Componentes de interfaz reutilizables.
prisma/          Esquema, migraciones y datos de ejemplo.
```

- **Una sola fuente de cálculo.** El formulario (vista previa), el servidor (al guardar), el panel de inicio y la página de impuestos usan las mismas funciones de `domain/`, así que ninguna cifra puede contradecir a otra.
- **Dinero en céntimos enteros** con redondeo half-up; el IVA se calcula por tipo sobre la base agrupada, como en una factura real.
- **Preparado para multiempresa:** todas las tablas tienen `companyId` y todas las consultas filtran por él. El prototipo trabaja con una única empresa demo.

## Cómo ejecutarlo en local

Requisitos: Node.js 20 o superior y una base de datos PostgreSQL (por ejemplo, un proyecto gratuito en Neon).

```bash
npm install
cp .env.example .env      # rellena DATABASE_URL (y opcionalmente ANTHROPIC_API_KEY)
npx prisma migrate deploy # crea las tablas
npm run db:seed           # datos de ejemplo (opcional: también se crean en la primera visita)
npm run dev
```

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Conexión a PostgreSQL (con pooling en Neon). |
| `DATABASE_URL_UNPOOLED` | Opcional. Conexión directa para las migraciones. |
| `ANTHROPIC_API_KEY` | Opcional. Sin ella, el OCR usa la extracción local. |

Otros comandos: `npm test` (tests del dominio), `npm run lint`, `npm run typecheck`.

---

## Supuestos fiscales

Son estimaciones orientativas, no declaraciones oficiales.

- **Periodo:** trimestre natural según la fecha del documento.
- **Modelo 303:** IVA devengado de las facturas emitidas menos IVA soportado de los gastos marcados como deducibles. Las entregas intracomunitarias van sin IVA y se muestran solo como dato informativo. En las adquisiciones intracomunitarias el IVA se autorrepercute al 21 %: es a la vez devengado y deducible, así que el efecto neto es cero.
- **Modelo 111:** suma de las retenciones de IRPF de las facturas recibidas, con número de perceptores y base.
- **Modelo 349:** operaciones con operadores de otros países de la UE, agrupadas por NIF-IVA y clave (E, S, A, I).
- **Tipos admitidos:** IVA 21 %, 10 %, 4 % y 0 %. IRPF 15 % y 7 %.

## Pendiente o simplificado

- **Autenticación y usuarios:** no hay inicio de sesión; la demo trabaja con una empresa única (el enunciado no lo exige).
- **Edición y borrado** de facturas y gastos: solo se cambia el estado. En una aplicación real una factura emitida no se borra, se rectifica; las facturas rectificativas no están implementadas.
- **No implementado (opcional en el enunciado):** presupuestos, exportación a PDF, bancos, conciliación, multiempresa en la interfaz y configuración.
- **OCR:** extrae un único tipo de IVA por documento; las facturas con varios tipos se registran con el principal y el usuario corrige si hace falta. El OCR local es menos preciso que el de IA y no lee bien fotos de baja calidad.
- **Archivos:** se guardan en PostgreSQL, que sirve para un prototipo con archivos de hasta 4 MB. En producción irían a un almacenamiento de objetos.
- **Límite de uso:** el límite de peticiones del OCR está en memoria, así que cada instancia del servidor lleva su propio contador.

## Tiempo invertido

_[completar con el tiempo efectivo]_

## Dificultades encontradas

- **Next.js 16 con Cache Components.** Cualquier lectura de datos o de la fecha actual debe ir dentro de `<Suspense>`, o el renderizado previo falla. Organicé cada página como una carcasa estática más los bloques con datos, y eso también me dio estados de carga en toda la aplicación.
- **Fechas y zonas horarias.** El driver de PostgreSQL interpreta las columnas `DATE` en la zona horaria del proceso, así que una misma factura podía caer en un trimestre distinto en local que en producción. Lo resolví tratando todas las fechas como días UTC y ejecutando el proceso con `TZ=UTC`.
- **OCR fiable.** Un modelo que devuelve texto libre exige parsearlo. Usé salida estructurada con un esquema Zod, de modo que la respuesta llega ya validada, y después contrasté la aritmética (base + IVA − IRPF = total) para avisar al usuario cuando algo no cuadra.
- **OCR sin dependencia externa.** Para que la demo funcione aunque falle la API, añadí una extracción local. Tesseract no funcionaba empaquetado en funciones serverless; hubo que excluirlo del bundle y llevar su caché a `/tmp`.
- **Importes en formato español.** "1.060 €" son mil sesenta euros, no uno con seis. Lo detectó un test y lo cubrí en el parser de importes.

---

## Preguntas finales

### 1. Arquitectura para miles de empresas

- **Aislamiento de datos:** el `companyId` ya está en todas las tablas; añadiría Row Level Security en PostgreSQL para que el aislamiento no dependa solo del código.
- **Autenticación y permisos:** inicio de sesión real (SSO/OAuth) con roles por empresa (titular, gestor, solo lectura) y auditoría de cada cambio.
- **OCR asíncrono:** las subidas irían a una cola (SQS o BullMQ) procesada por workers, con los archivos en S3 y URLs firmadas. La interfaz recibiría el resultado por notificación en lugar de esperar.
- **Rendimiento:** agregados por trimestre precalculados e invalidados cuando cambia un documento, índices por (`companyId`, fecha), réplicas de lectura y paginación en todos los listados.
- **Cumplimiento:** registro inmutable de facturas emitidas (requisito de Verifactu y TicketBAI), cifrado en reposo, copias de seguridad y observabilidad con OpenTelemetry.

### 2. Mejorar el OCR

- **Procesado por capas:** si el PDF tiene texto, extraer primero de ahí (más barato y exacto) y recurrir a un modelo de visión solo con documentos escaneados.
- **Validación con puntuación de confianza por campo.** Aritmética, NIF y coherencia entre tipos y cuotas. Solo se pide revisión cuando la confianza baja de un umbral; el resto se registra automáticamente.
- **Memoria por proveedor:** reutilizar las correcciones anteriores del usuario como ejemplos para las siguientes facturas del mismo proveedor.
- **Detección de duplicados** por NIF, número e importe.
- **Facturas electrónicas:** leer directamente las estructuradas (Facturae, UBL) cuando existan.
- **Bandeja de correo:** reenviar facturas a una dirección y procesarlas sin intervención.

### 3. Tres mejoras para hacerlo competitivo

1. **Conexión bancaria (PSD2) con conciliación automática.** Es la tarea manual que más tiempo consume y cierra el ciclo de cobros y pagos sin que el usuario haga nada.
2. **Cumplimiento de Verifactu y envío de factura electrónica.** Es obligatorio en España y da confianza a quien no sabe de contabilidad.
3. **Asistente fiscal proactivo:** avisos de plazos, previsión de impuestos y borrador de los modelos listo para que lo revise el gestor. Convierte la herramienta de "donde apunto cosas" en "quien me avisa antes de que haya un problema".
