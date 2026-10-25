# PRP: Módulo de gestión trimestral de parqueaderos

**Estado:** borrador para revisión (versión consolidada v2)
**Fecha:** 2026-09-27
**Basado en:** auditoría de solo lectura, reglas de negocio confirmadas y aclaraciones sobre la balota blanca

> Todos los nombres de tablas, columnas, rutas y archivos de este PRP son **provisionales** y requieren confirmación. Este documento no incluye SQL ejecutable, comandos ni instrucciones para aplicar migraciones.
>
> Las reglas ambiguas se marcan como **DP-xx** (decisión pendiente) y se resumen en la sección 18. 🔴 indica que la decisión cambia el algoritmo del sorteo.

---

## 1. Objetivo y alcance

### Objetivo
Reemplazar el sorteo manual en reunión por un proceso dentro de la aplicación que cubra todo el trimestre:
- Postulación con acuse de recibido.
- Habilitación según el estado de pagos, con la razón de cada exclusión.
- Asignación directa por balota blanca.
- Sorteo reproducible y auditable, con rotación por zonas.
- Asignación aleatoria del puesto físico.
- Verificación de placas en portería.
- Historial completo.

### Dentro del alcance
- Registro de unidades (bloque y casa), residentes (propietario o arrendatario) y vehículos (códigos `VEH-###` y `MOT-###`, placa y modelo).
- Carga de documentos del vehículo: tarjeta de propiedad y SOAT para vehículos nuevos.
- Periodos trimestrales agrupados en un ciclo anual de rotación.
- Estado de pagos por unidad y trimestre, e informe de solicitudes habilitadas y no habilitadas con su motivo.
- Capacidad de **96 espacios para carros** y **25 para motos**.
- Balota blanca con asignación directa, sorteo general, rotación y espacios especiales para vehículos grandes.
- Auditoría, historial y notificaciones dentro de la aplicación.
- Consulta de placa en portería y registro de amonestaciones.

### Fuera del alcance (por ahora)
- Integración automática con el software contable o de cartera (DP-03).
- Parqueaderos de visitantes.
- Cobro de cuotas de parqueadero.
- Lectura automática de placas (OCR o cámaras).
- Cambios en el chat de IA existente.

---

## 2. Actores y roles

| Rol (provisional) | Qué puede hacer |
|---|---|
| **Residente** (propietario o arrendatario) | Registrar su unidad y sus vehículos, cargar documentos, postularse, ver su acuse, su estado de habilitación, su balota blanca y su asignación |
| **Administración** | Gestionar ciclos, periodos, espacios, zonas y estado de pagos; revisar documentos; cerrar postulaciones; ejecutar el sorteo; publicar resultados; reasignar espacios |
| **Portería / vigilancia** | Consultar por placa si el vehículo corresponde al espacio y registrar incidencias |
| **Consejo / auditor** | Solo lectura: resultados, bitácora de auditoría y verificación del sorteo |
| **Sistema** | Tareas programadas (cierre de postulaciones, ejecución automática del sorteo si se aprueba en DP-15) y notificaciones |

- **DP-01:** ¿Una misma persona puede tener varios roles (por ejemplo, residente y miembro del consejo)? ¿Quién asigna los roles?
- **DP-02:** ¿Cómo se vincula una cuenta de Google con una unidad? Opciones: invitación de la administración, código de la unidad o validación manual. Hoy cualquier cuenta de Google puede iniciar sesión.

---

## 3. Flujo completo del trimestre

| Etapa | Estado del periodo | Qué ocurre |
|---|---|---|
| 1. Preparación | `borrador` | La administración crea el periodo dentro del ciclo anual (trimestre, fechas, capacidad: 96 carros y 25 motos) y revisa espacios, zonas y espacios especiales disponibles |
| 2. Postulaciones abiertas | `postulacion_abierta` | El residente selecciona un vehículo ya registrado o registra uno nuevo con sus documentos, indica si es propietario o arrendatario y si el vehículo es nuevo o antiguo, y envía el formulario. El sistema genera la **confirmación de diligenciamiento** y el **acuse de recibido** (número consecutivo con fecha y hora). Los titulares de balota blanca **deben postularse de nuevo** para usarla |
| 3. Cierre de postulaciones | `postulacion_cerrada` | Ya no se reciben ni modifican solicitudes. Se toma la fotografía de pagos (DP-04) |
| 4. Habilitación | `habilitacion` | Se evalúan las reglas generales (sección 5) y las de asignación directa (B01 a B06). Se genera el listado de habilitadas y no habilitadas con motivos concretos. La administración lo revisa y lo publica. Periodo de reclamaciones: DP-05 |
| 5. Compromiso del sorteo | `sorteo_comprometido` | Se congela la lista de participantes y balotas (instantánea con huella digital) y se publica el **hash de la semilla** (sección 7) |
| 6. Sorteo | `sorteo_ejecutado` | Asignación directa, sorteo general, balotas nuevas y asignación del puesto físico. Lo ejecuta la administración o una tarea programada (DP-15) |
| 7. Publicación | `publicado` | Se revela la semilla, se publican los resultados y se notifica a cada residente |
| 8. Vigencia | `vigente` | Verificación de placas en portería, incidencias y reasignaciones por espacios que dejan de estar disponibles (sección 12) |
| 9. Cierre | `cerrado` | Las asignaciones vencen, incluidas las obtenidas por balota blanca. El historial queda disponible para la rotación |

Las transiciones solo avanzan, y cada una queda registrada en la auditoría. Para retroceder hace falta una acción administrativa con justificación (DP-16).

---

## 4. Modelo de datos propuesto (conceptual, sin SQL)

Todos los nombres son provisionales. Las claves primarias son UUID. Las referencias al historial **no se borran en cascada**: se usan borrado lógico y restricciones.

| Entidad | Campos principales | Relaciones y restricciones |
|---|---|---|
| **unidad** | `bloque`, `casa`, `activa` | Única por (bloque, casa) |
| **perfil_residente** | `user_id`, `unidad_id`, `tipo_ocupante` (propietario / arrendatario), `activo`, vigencia | → `auth.users`, → unidad |
| **rol_usuario** | `user_id`, `rol` | Única por (user_id, rol) |
| **vehiculo** | `codigo` (`VEH-###` / `MOT-###`), `tipo` (carro / moto), `placa` (normalizada), `modelo` (DP-44), `es_grande`, `condicion` (nuevo / antiguo), `unidad_id`, `activo` | Código único y con formato válido. Placa única entre vehículos activos. → unidad |
| **documento_vehiculo** | `vehiculo_id`, `tipo_documento` (tarjeta de propiedad / SOAT), ruta en almacenamiento privado, `vence_el`, `estado_revision`, `revisado_por` | → vehiculo |
| **zona** | `nombre`, `descripcion` | — |
| **espacio** | `codigo`, `zona_id`, `tipo` (carro / moto), `apto_grande`, `estado` (disponible / mantenimiento / inhabilitado) | Código único. → zona |
| **ciclo_rotacion** | `anio`, `inicio`, `fin`, `estado` | Agrupa los periodos del ciclo anual (DP-41) |
| **periodo** | `ciclo_rotacion_id`, `anio`, `trimestre`, fechas de vigencia y de postulación, `capacidad_carros` (96), `capacidad_motos` (25), `estado` | Único por (año, trimestre). → ciclo_rotacion |
| **estado_pago** | `unidad_id`, `periodo_id`, `al_dia`, `estado_acuerdo` (sin acuerdo / vigente y al día / incumplido), `fecha_corte`, `fuente`, `cargado_por` | Único por (unidad, periodo). Ver DP-40 |
| **postulacion** | `periodo_id`, `vehiculo_id`, `unidad_id`, `perfil_id`, `numero_acuse`, `enviada_en`, `estado` | Única por (periodo, vehículo). Límite por unidad: DP-10 |
| **evaluacion_elegibilidad** | `postulacion_id`, `habilitada`, `motivos` (lista de códigos y detalle legible), `apta_asignacion_directa`, `motivos_directa`, `evaluada_en`, `version_reglas` | 1 a 1 con postulación |
| **balota_blanca** | `ciclo_rotacion_id`, `tipo_vehiculo`, `periodo_origen_id`, `sorteo_origen_id`, `periodo_destino_id`, `perfil_id`, `unidad_id`, `vehiculo_id`, `placa_registrada`, `modelo_registrado`, `estado` (`vigente` → `usada` / `no_usada_sin_postulacion` / `no_usada_incumple` / `vencida`), `motivo_no_uso` | Una por titular y ciclo, salvo la excepción de DP-43. La marca nunca se borra, solo cambia de estado. Titular: DP-44 |
| **sorteo** | `periodo_id`, `tipo_vehiculo`, `hash_semilla`, `semilla` (visible tras revelarse), `version_algoritmo`, `hash_instantanea`, `hash_resultado`, `ejecutado_por`, `ejecutado_en`, `estado` | Un solo sorteo válido por (periodo, tipo_vehiculo) |
| **participante_sorteo** | `sorteo_id`, `postulacion_id`, `via` (directa / general), `posicion_final`, `resultado` (asignado / balota nueva / sin asignación) | Es la instantánea congelada |
| **asignacion** | `periodo_id`, `espacio_id`, `vehiculo_id`, `unidad_id`, `origen` (balota blanca / sorteo / especial / reasignación), `sorteo_id`, `balota_blanca_id`, `vigente` | Una asignación vigente por espacio y periodo. Una por vehículo y periodo. Por unidad: DP-10 |
| **incidencia** | `espacio_id`, `placa_observada`, `vehiculo_esperado_id`, `tipo`, `amonestacion`, `registrada_por`, `evidencia` | — |
| **evento_auditoria** | `actor_id`, `accion`, `entidad`, `entidad_id`, `antes`, `despues`, `ocurrido_en`, `hash_previo` | Solo se agregan registros. `hash_previo` encadena cada evento con el anterior (opcional, DP-17) |
| **notificacion** | `user_id`, `tipo`, `contenido`, `leida`, `enviada_en` | — |

Las tablas `conversations` y `messages` no se tocan.

---

## 5. Reglas de elegibilidad

### 5.1 Reglas generales
Una postulación queda **habilitada** solo si cumple todas estas condiciones. Si falla alguna, se registran **todos** los motivos, no solo el primero.

| Código (provisional) | Regla | Motivo que se muestra |
|---|---|---|
| `E01_SIN_POSTULACION` | Hay postulación dentro del plazo | "No se diligenció el formulario en el periodo X" |
| `E02_PAGO_NO_AL_DIA` | La unidad está al día en la fecha de corte | "La unidad no está al día a la fecha de corte DD/MM" |
| `E03_ACUERDO_PAGO` | La unidad no tiene acuerdo de pago (alcance según DP-40) | "La unidad tiene un acuerdo de pago …" |
| `E04_DOCUMENTOS` | Si el vehículo es nuevo: tarjeta de propiedad y SOAT cargados, aprobados y vigentes | "Falta el SOAT" / "La tarjeta de propiedad fue rechazada: …" |
| `E05_VEHICULO_INVALIDO` | El vehículo está activo, pertenece a la unidad y tiene código y placa válidos | "El vehículo no está asociado a la unidad" |
| `E06_RESIDENTE_INACTIVO` | El perfil está activo y vinculado a la unidad | "El residente no está vinculado a la unidad" |
| `E07_DUPLICADO` | Se respeta el límite de postulaciones por unidad (DP-10) | "La unidad ya tiene una postulación para este periodo" |

### 5.2 Reglas para la asignación directa por balota blanca
Además de las reglas generales, quien tiene una balota blanca vigente se evalúa con estas reglas. Cada falla se muestra con su motivo.

| Código | Regla |
|---|---|
| `B01_SIN_POSTULACION` | Presentó una nueva solicitud en el periodo destino |
| `B02_REQUISITOS` | Cumple todos los requisitos generales (E02 a E07) |
| `B03_ACUERDO_INCUMPLIDO` | No tiene un acuerdo de pago incumplido (DP-40) |
| `B04_RELACION_UNIDAD` | Mantiene una relación válida con el mismo bloque y la misma casa |
| `B05_VEHICULO_DISTINTO` | Postula el mismo vehículo, con la misma **placa y modelo** que quedaron congelados en la balota |
| `B06_BALOTA_NO_VIGENTE` | La balota está en estado `vigente`, corresponde a este periodo destino y pertenece al ciclo actual |

### Decisiones pendientes
- **DP-03:** ¿De dónde sale el estado de pagos? ¿Carga manual de la administración, archivo CSV o integración con otro sistema?
- **DP-04:** ¿"Al día durante el trimestre" se evalúa en una fecha de corte? ¿Cuál? ¿Qué pasa si la unidad se pone al día o entra en mora después del corte?
- **DP-05:** ¿Hay periodo de reclamación sobre el listado? ¿Cuántos días? ¿Quién resuelve?
- **DP-11:** ¿Los vehículos antiguos también deben tener el SOAT vigente?
- **DP-12:** ¿Qué es un vehículo "nuevo"? ¿Nuevo en el conjunto, recién comprado, o sin participación previa?
- **DP-19:** ¿Ser propietario o arrendatario cambia la elegibilidad o la prioridad? ¿El arrendatario necesita autorización del propietario?
- 🔴 **DP-40:** la regla original excluye a quien tenga **cualquier** acuerdo de pago; la regla de balota blanca habla solo de acuerdos **incumplidos**. ¿Un acuerdo vigente y al día excluye del sorteo general, de la asignación directa, de ambos o de ninguno?

---

## 6. Balota blanca y exclusión

### Reglas confirmadas
1. **Otorgamiento:** recibe una balota blanca nueva quien participó en el sorteo general, estaba habilitado, no obtuvo parqueadero y **nunca ha tenido balota blanca en el ciclo**. Al otorgarla se congelan la placa, el modelo, el bloque, la casa y el vehículo.
2. **Límite:** nadie recibe una segunda balota blanca en el ciclo mientras haya participantes habilitados que nunca hayan recibido una (DP-43).
3. **Uso:** la balota del sorteo anterior da **asignación directa** en el sorteo siguiente, si se cumplen B01 a B06.
4. **Capacidad:** las asignaciones directas se hacen **antes** del sorteo general y se descuentan de la capacidad del periodo (96 carros o 25 motos).
5. **Sorteo general:** los espacios restantes se sortean entre los demás habilitados **sin balota blanca vigente** (DP-42).
6. **Si no se usa:** si el titular no se postula o no cumple los requisitos, no recibe asignación directa ni parqueadero en ese periodo. La balota pasa a `no_usada_*` con su motivo, y la marca se conserva para la rotación (el titular "ya tuvo balota" en este ciclo).
7. **Vigencia:** la balota vale dentro del ciclo anual. La asignación obtenida con ella es **trimestral**: vence al cerrar el periodo y exige nueva postulación y validación en cada periodo.

### Decisiones pendientes
- 🔴 **DP-39:** la regla original decía "los excluidos del sorteo anterior ingresan automáticamente al nuevo sorteo si están al día". ¿Queda reemplazada por la asignación directa con postulación obligatoria, o se refiere a otro grupo (por ejemplo, los no habilitados por mora)?
- 🔴 **DP-41:** ¿El ciclo anual coincide con el año calendario (Q1 a Q4)? Una balota otorgada en el sorteo de Q4, ¿da asignación directa en Q1 del ciclo siguiente o vence? ¿Las marcas se reinician al empezar un ciclo nuevo?
- 🔴 **DP-42:** un titular de balota que no cumple B01 a B06 (por ejemplo, cambió de vehículo pero está habilitado), ¿puede participar en el sorteo general de ese periodo o queda fuera?
- 🔴 **DP-43:** "mientras existan participantes habilitados que nunca hayan recibido una", ¿se refiere a los participantes **de ese sorteo** o a **todo el conjunto** en el ciclo? Si todos los perdedores ya tuvieron balota, ¿reciben una segunda?
- 🔴 **DP-45:** si los titulares que cumplen requisitos superan la capacidad (por ejemplo, 120 perdedores en Q1 y solo 96 cupos en Q2), ¿se sortea entre ellos? ¿Y qué pasa con los que no alcanzan cupo?
- **DP-44:** "modelo", ¿se refiere al año modelo, o a marca y línea? ¿"Propietario" es literal (los arrendatarios no pueden tener balota), o se refiere al titular de la solicitud? ¿La balota pertenece a la persona, a la unidad o al vehículo?
- **DP-20:** confirmar que las motos siguen exactamente las mismas reglas de balota blanca y rotación que los carros.

---

## 7. Algoritmo de asignación auditable y reproducible

### Principios
1. **Determinista:** con los mismos datos de entrada, la misma semilla y la misma versión del algoritmo, el resultado debe ser idéntico bit a bit.
2. **Compromiso previo:**
   - Antes de ejecutar el sorteo se publica el hash SHA-256 de la semilla.
   - Después se revela la semilla, y cualquiera con rol de auditor puede volver a calcular el resultado.
   - La semilla se genera en el servidor con un generador criptográfico.
   - **DP-13:** ¿Se combina además con un valor público externo publicado después del compromiso, para que nadie, ni siquiera la administración, pueda anticipar el resultado?
3. **Sin sesgo:**
   - Se reemplaza `sort(() => Math.random() - 0.5)` por **Fisher–Yates**.
   - Los números aleatorios salen de un flujo determinista derivado de la semilla: SHA-256 de (semilla ‖ contador).
   - Los enteros uniformes se obtienen por **muestreo por rechazo**, para no introducir sesgo con el módulo.
4. **Lógica pura:** una función en `features/parqueaderos/` sin acceso a base de datos ni reloj, probada con tests unitarios.
5. **Versionado:** `version_algoritmo` queda guardada con cada sorteo, y los cambios futuros no alteran la verificación de sorteos anteriores.

### Pasos (se ejecutan por separado para carros, capacidad 96, y motos, capacidad 25)

**Paso 0 — Instantánea**
- Se reúnen las postulaciones habilitadas, las balotas blancas vigentes del sorteo anterior, el historial de balotas del ciclo, los espacios disponibles con su zona y si son aptos para vehículos grandes, y el historial de asignaciones.
- Se ordenan de forma canónica por ID y se calcula `hash_instantanea`.

**Paso 1 — Asignación directa por balota blanca**
- Se evalúa B01 a B06 para cada balota vigente.
- Quien cumple recibe cupo directo y su balota pasa a `usada`.
- Quien no cumple: su balota pasa a `no_usada_*` con su motivo y no recibe cupo.
- Si hay más titulares que cumplen que capacidad disponible: DP-45.

**Paso 2 — Capacidad restante**
Capacidad del periodo menos las asignaciones directas.

**Paso 3 — Espacios especiales**
- Los vehículos grandes (`es_grande`) solo pueden ir en espacios `apto_grande`.
- **DP-14:** ¿"Conservar" su espacio significa que un vehículo grande mantiene el mismo espacio cada trimestre sin sorteo? ¿Cuenta dentro de la capacidad? ¿Qué pasa si hay más vehículos grandes que espacios especiales?
- **DP-47:** si un titular de balota tiene un vehículo grande, ¿qué se aplica primero: el espacio especial o la asignación directa?

**Paso 4 — Sorteo general**
- Participan los habilitados sin balota vigente (DP-42), ordenados de forma canónica.
- Se barajan con Fisher–Yates usando la semilla.
- Los primeros, hasta cubrir la capacidad restante, ganan.

**Paso 5 — Balotas nuevas**
- Los perdedores que nunca han tenido balota en el ciclo reciben una nueva, con placa y modelo congelados, válida para el periodo siguiente.
- Los perdedores que ya tuvieron una no reciben otra (DP-43).

**Paso 6 — Puesto físico** (se aplica a todos los ganadores: primero los directos, luego los del sorteo en el orden de la baraja)
1. Candidatos: espacios disponibles, sin asignación en este periodo, del tipo correcto y compatibles con el tamaño del vehículo.
2. Se aplica la restricción de rotación: se excluyen los espacios de la zona que ese vehículo o unidad tuvo en el sorteo anterior (DP-21).
3. Se elige un candidato uniformemente con la semilla.
4. Si no queda ninguno por la restricción de rotación, se relaja según DP-22 y se registra la relajación como evento.
5. Si no queda ningún espacio compatible, se registra el caso para la administración; nunca se asigna un espacio ocupado.
- **DP-46:** ¿las asignaciones directas eligen el puesto físico al azar y con rotación de zonas, igual que el resto?

**Paso 7 — Resultado**
- Se calcula `hash_resultado` sobre las asignaciones, las balotas nuevas y los cambios de estado de las balotas, todo ordenado.
- Todo se guarda en una sola transacción (sección 12).

### Verificación
El auditor vuelve a ejecutar la misma función con la instantánea y la semilla revelada. Debe obtener el mismo `hash_resultado`, y el hash de la semilla debe coincidir con el publicado.

---

## 8. Estrategia de rotación

- **Rotación de beneficiarios:** la balota blanca es el mecanismo principal. Quien pierde recibe asignación directa en el sorteo siguiente, y nadie recibe una segunda balota mientras otros no hayan tenido la primera.
  - **DP-48:** además de la balota, ¿se mantiene alguna restricción para que un ganador del sorteo general no vuelva a ganarlo antes de que los demás tengan oportunidad?
  - **DP-18:** ¿la rotación se mide por persona, por unidad o por vehículo? Ver también DP-44.
- **Rotación de zonas:** ningún vehículo o unidad recibe la misma zona que en el sorteo inmediatamente anterior, siempre que sea posible.
  - **DP-21:** ¿el sujeto de la restricción es el vehículo, la unidad o ambos?
  - **DP-22:** si no hay espacios fuera de la zona anterior, ¿se permite repetir zona o el participante queda sin espacio?
  - **DP-23:** "deben rotar según bloque, casa y vehículo", ¿significa que la restricción de zona se aplica al vehículo **y** a la casa? ¿O hay además una relación entre bloques y zonas, como zonas cercanas o equilibrio entre bloques?
- Las asignaciones duran un solo trimestre y vencen al cerrar el periodo. Nunca se renuevan en automático, incluidas las obtenidas por balota blanca, salvo la excepción de vehículos grandes si DP-14 lo confirma.

---

## 9. Validaciones de vehículos y documentos

### Código del vehículo
- Formato `VEH-###` para carros y `MOT-###` para motos.
- El prefijo debe coincidir con el tipo de vehículo, y el código es único.
- **DP-24:** ¿lo asigna el sistema (consecutivo) o la administración? ¿Qué pasa al llegar a 999? ¿Un código se reutiliza cuando el vehículo se da de baja?

### Placa y modelo
- La placa se normaliza (mayúsculas, sin espacios ni guiones) y se valida el formato colombiano: carro `AAA123`, moto `AAA12A`.
  - **DP-25:** confirmar formatos, incluidos vehículos diplomáticos o extranjeros.
- La placa es única entre vehículos activos.
- El modelo se registra con el vehículo y se congela en la balota blanca (DP-44).

### Documentos del vehículo nuevo
- Tarjeta de propiedad y SOAT, en PDF o imagen, con tamaño máximo definido.
- Se guardan en un bucket privado con acceso por unidad.
- El SOAT tiene fecha de vencimiento.
- La administración los revisa: aprobado o rechazado con motivo.

### Coincidencia entre placa y documentos
La administración verifica al revisar que la placa y el modelo del formulario coincidan con la tarjeta de propiedad. La verificación automática queda para mejoras posteriores.

### Verificación en portería
- Se ingresa la placa y el sistema responde: espacio asignado, vigencia, zona y si corresponde o no.
- Si el vehículo no corresponde al espacio que ocupa, se registra una incidencia con posible amonestación.
- **DP-26:** ¿qué consecuencias tiene la amonestación? ¿Acumular amonestaciones afecta la elegibilidad futura? ¿Quién la confirma?

### Validación de entradas
Todas las entradas se validan con Zod en el servidor.

---

## 10. API, páginas y componentes

### Páginas (provisionales)

| Ruta | Rol | Contenido |
|---|---|---|
| `/parqueaderos` | Residente | Panel: estado del periodo, su postulación, acuse, habilitación, balota blanca y asignación |
| `/parqueaderos/vehiculos` | Residente | Registro de vehículos y carga de documentos |
| `/parqueaderos/postulacion` | Residente | Formulario de postulación (propietario o arrendatario, nuevo o antiguo) |
| `/parqueaderos/resultados/[periodo]` | Residente y auditor | Resultados publicados (visibilidad: DP-27) |
| `/parqueaderos/verificacion/[sorteo]` | Auditor | Hash de la semilla, semilla revelada, hashes y verificación |
| `/admin/parqueaderos/periodos` | Administración | Ciclos y periodos; cambios de estado |
| `/admin/parqueaderos/espacios` | Administración | Espacios, zonas y espacios aptos para grandes |
| `/admin/parqueaderos/pagos` | Administración | Estado de pagos por unidad (según DP-03) |
| `/admin/parqueaderos/habilitacion` | Administración | Listado de habilitadas y no habilitadas con motivos, incluida la aptitud para asignación directa; exportación |
| `/admin/parqueaderos/balotas` | Administración y auditor | Balotas blancas del ciclo y su estado |
| `/admin/parqueaderos/documentos` | Administración | Revisión de documentos |
| `/admin/parqueaderos/sorteo` | Administración | Compromiso, ejecución y publicación del sorteo |
| `/admin/parqueaderos/auditoria` | Administración y auditor | Bitácora de eventos |
| `/porteria` | Portería | Consulta por placa y registro de incidencias |

### Endpoints (Route Handlers)
Todos verifican la sesión y el rol en el servidor.

| Endpoint | Uso |
|---|---|
| `GET/POST /api/parqueaderos/vehiculos` | Consultar y registrar vehículos |
| `POST /api/parqueaderos/vehiculos/[id]/documentos` | Cargar documentos |
| `GET/POST /api/parqueaderos/postulaciones` | Consultar y crear postulaciones (devuelve el acuse) |
| `GET/POST/PATCH /api/parqueaderos/periodos` | Gestionar periodos; transiciones de estado en `/api/parqueaderos/periodos/[id]/transicion` |
| `POST /api/parqueaderos/periodos/[id]/elegibilidad` | Evaluar y publicar la habilitación |
| `GET /api/parqueaderos/balotas` | Consultar balotas blancas (filtradas por rol) |
| `POST /api/parqueaderos/periodos/[id]/sorteo/compromiso` | Congelar la instantánea y publicar el hash de la semilla |
| `POST /api/parqueaderos/periodos/[id]/sorteo/ejecucion` | Ejecutar el sorteo |
| `POST /api/parqueaderos/periodos/[id]/sorteo/revelacion` | Revelar la semilla |
| `GET /api/parqueaderos/sorteos/[id]/verificacion` | Datos para verificar el sorteo |
| `POST /api/parqueaderos/asignaciones/[id]/reasignacion` | Reasignar un espacio |
| `GET /api/parqueaderos/porteria/placa/[placa]` | Consulta de portería |
| `POST /api/parqueaderos/incidencias` | Registrar incidencias |
| `GET/PATCH /api/parqueaderos/estado-pagos` | Consultar y cargar el estado de pagos |

El `app/api/parqueaderos/route.ts` actual se reemplaza o se reorganiza bajo esta estructura.

### Componentes (`features/parqueaderos/components/`)
`FormularioPostulacion`, `FormularioVehiculo`, `CargaDocumentos`, `AcuseRecibido`, `EstadoPostulacion`, `EstadoBalotaBlanca`, `TablaElegibilidad` (con motivos), `TablaBalotas`, `PanelSorteo`, `TablaResultados`, `VerificacionSorteo`, `GestionEspacios`, `ConsultaPlaca`, `FormularioIncidencia` y `BitacoraAuditoria`.

**Navegación:** hoy el sidebar solo lista conversaciones de chat. **DP-28:** ¿se crea un layout y sidebar propio para parqueaderos? ¿El chat de IA se mantiene visible en la app?

---

## 11. RLS y permisos propuestos

- **RLS activo en todas las tablas nuevas**, con acceso por defecto denegado.
- **Roles:** se guardan en la tabla de roles y se consultan con una función auxiliar de solo lectura en las políticas. Si esa función necesita `SECURITY DEFINER`, se revisa con cuidado: `search_path` fijo y ninguna escritura.
- **Sin `SUPABASE_SERVICE_KEY` por defecto.** Las operaciones corren con la sesión del usuario y las políticas por rol. Las operaciones privilegiadas (ejecutar el sorteo, transiciones de estado, cambios de estado de balotas) se proponen como funciones de base de datos que **validan el rol del llamante por dentro**. Si en algún caso excepcional se propone usar la clave de servicio, se documenta y se aprueba aparte (DP-29).

| Entidad | Residente | Administración | Portería | Auditor |
|---|---|---|---|---|
| Unidad y perfil | Leer los propios | Todo | — | Leer |
| Vehículo | Leer y crear los de su unidad; editar mientras la postulación esté abierta | Todo | Leer placa, código y unidad | Leer |
| Documentos (tabla y bucket) | Leer y cargar los de su unidad | Leer y revisar | — | — (DP-30) |
| Estado de pagos | Leer el de su unidad (DP-31) | Todo | — | Leer |
| Postulación | Crear y leer las propias; sin cambios tras el cierre | Leer todas | — | Leer |
| Elegibilidad | Leer la propia | Todo | — | Leer |
| Balota blanca | Leer la propia | Leer; cambios solo mediante el sorteo | — | Leer |
| Sorteo y participantes | Leer los publicados | Crear mediante función controlada | — | Leer |
| Asignación | Leer la propia y las publicadas (DP-27) | Crear mediante sorteo o reasignación | Leer las vigentes | Leer |
| Incidencia | Leer las de su unidad | Todo | Crear y leer | Leer |
| Evento de auditoría | — | Leer | — | Leer |

- En la tabla de auditoría **nadie puede editar ni borrar** registros; solo se agregan mediante triggers o funciones controladas.
- Las balotas blancas no se crean ni se editan a mano: solo cambian dentro de la transacción del sorteo o por una corrección administrativa auditada (DP-16).
- Se corrigen los riesgos de la auditoría:
  - Reactivar la protección del middleware y del layout.
  - Proteger las rutas `/parqueaderos`, `/admin` y `/porteria`.
  - Quitar el usuario simulado.
  - Manejar el error en `auth/callback`.

---

## 12. Concurrencia y espacios ocupados

**Restricciones de unicidad en la base de datos**
Son la defensa final:
- Una asignación vigente por (periodo, espacio).
- Una por (periodo, vehículo).
- Un sorteo válido por (periodo, tipo de vehículo).
- Una postulación por (periodo, vehículo).
- Una balota por (titular, ciclo), salvo lo que se decida en DP-43.

**Ejecución atómica del sorteo**
- El algoritmo en TypeScript calcula el resultado.
- La persistencia ocurre en **una sola transacción**, que:
  - bloquea la fila del periodo;
  - verifica el estado `sorteo_comprometido`;
  - verifica que el hash de la instantánea coincida;
  - inserta las asignaciones y las balotas nuevas y actualiza el estado de las balotas usadas o no usadas;
  - cambia el estado del periodo.
- Si falla cualquier restricción, se revierte todo y queda un evento de error.

**Idempotencia**
Cada ejecución lleva una clave única. Un doble clic o un reintento devuelve el resultado ya guardado y no ejecuta un segundo sorteo.

**Espacio ya asignado o no disponible**
- Durante el sorteo, los candidatos excluyen espacios asignados o en mantenimiento.
- Si al guardar aparece un conflicto (un espacio que cambió de estado después de la instantánea), la transacción falla y el sorteo **se re-ejecuta con la misma semilla** sobre una instantánea nueva.
  - **DP-32:** ¿se permite, o se exige un compromiso nuevo?
- En una reasignación durante el trimestre (un espacio pasa a mantenimiento), se busca otro espacio compatible con el mismo procedimiento aleatorio. La semilla derivada y el motivo quedan registrados.

**Postulaciones**
- La fecha de envío la pone el servidor.
- El cierre se compara con la hora del servidor en zona `America/Bogota` (DP-33).
- Si se envían dos formularios a la vez, la restricción de unicidad los resuelve.

---

## 13. Auditoría, historial y notificaciones

**Eventos auditados:**
- Cambios de estado del ciclo y del periodo.
- Postulaciones y acuses.
- Cambios de pagos.
- Revisión de documentos.
- Evaluación de elegibilidad (general y de asignación directa) y reclamaciones.
- Otorgamiento, uso, no uso y vencimiento de balotas blancas.
- Compromiso, ejecución y revelación del sorteo.
- Reasignaciones.
- Relajaciones de la regla de rotación.
- Incidencias.
- Cambios de rol.

**Bitácora:** se guarda quién, cuándo, qué, y el antes y después, sin datos sensibles innecesarios. Encadenar los eventos por hash es opcional (DP-17).

**Historial:** las asignaciones y balotas blancas de periodos y ciclos anteriores nunca se borran; son la base de la rotación. Las bajas de usuarios, unidades o vehículos son lógicas.

**Notificaciones (MVP dentro de la app):**
- Acuse de postulación.
- Resultado de habilitación, con motivo.
- Resultado de la validación para asignación directa, con motivo si no aplica.
- Resultado del sorteo: espacio y zona, o balota blanca nueva.
- Recordatorio a los titulares de balota blanca de que deben postularse de nuevo.
- Reasignación.
- Incidencia.
- Correo electrónico: DP-34.

**Privacidad:** la placa, los documentos y el estado de pagos son datos personales. **DP-35:** revisión de política de tratamiento de datos (Ley 1581 de 2012), plazo de conservación y qué se publica a todos los residentes.

---

## 14. Casos límite

1. Las solicitudes habilitadas son iguales o menores que la capacidad: no hay balotas nuevas, pero la asignación del puesto sigue siendo aleatoria.
2. Hay más titulares de balota que cumplen requisitos que capacidad disponible (DP-45).
3. Todos los perdedores de un sorteo ya tuvieron balota en el ciclo (DP-43).
4. Un titular de balota cambia de vehículo, de placa o de modelo: B05 falla, no hay asignación directa y la marca se conserva. ¿Puede participar en el sorteo general con el vehículo nuevo? (DP-42)
5. El titular se muda de casa o deja de ser propietario (DP-19 y DP-44).
6. El titular de una balota de carro se postula con una moto: B05 falla.
7. Balotas otorgadas en el último trimestre del ciclo (DP-41).
8. Todos los espacios compatibles están en la zona anterior del vehículo (DP-22).
9. Hay más vehículos grandes que espacios especiales (DP-14), o un titular de balota con vehículo grande (DP-47).
10. Una unidad tiene varios vehículos o varias postulaciones (DP-10).
11. Se cambia de vehículo o de placa durante el trimestre (DP-36).
12. El arrendatario se muda o se vende la unidad durante el trimestre (DP-37).
13. El estado de pagos cambia después del corte (DP-04), o un acuerdo de pago pasa de vigente a incumplido (DP-40).
14. Un espacio pasa a mantenimiento después del sorteo (reasignación).
15. Se intenta ejecutar el sorteo dos veces, o dos administradores lo ejecutan a la vez.
16. Se envía una postulación justo en el cierre (zona horaria y hora del servidor).
17. El SOAT vence durante el trimestre (DP-11).
18. El usuario tiene sesión pero no está vinculado a ninguna unidad.
19. Nadie se postula, o no hay espacios disponibles.
20. Error de la administración detectado después de publicar (DP-16).
21. Se agotan los 999 códigos de un tipo (DP-24).
22. Primer periodo del primer ciclo: no hay balotas previas ni historial de zonas, así que no hay asignación directa ni restricción de zona.

---

## 15. Criterios de aceptación verificables

### Algoritmo
- [ ] Con la misma instantánea, semilla y versión, el algoritmo produce el mismo `hash_resultado` en 1.000 ejecuciones.
- [ ] Una prueba estadística del orden aleatorio (frecuencia de posiciones en N repeticiones con semillas distintas) no muestra sesgo significativo.
- [ ] El auditor puede verificar que la semilla revelada coincide con el hash publicado y que el resultado se reproduce.

### Capacidad y asignación
- [ ] Ningún espacio tiene dos asignaciones vigentes en el mismo periodo, garantizado por la base de datos y cubierto por un test.
- [ ] Ningún vehículo grande queda en un espacio no apto.
- [ ] El total de asignaciones nunca supera 96 para carros ni 25 para motos.
- [ ] Nadie recibe la misma zona que en el trimestre anterior salvo relajación registrada.
- [ ] Una ejecución duplicada del sorteo no crea un segundo resultado.

### Balota blanca
- [ ] Las asignaciones directas se registran antes del sorteo general y se descuentan de la capacidad.
- [ ] Un titular de balota que no se postula no recibe cupo, y su balota queda como `no_usada_sin_postulacion` sin perder la marca.
- [ ] Un titular que postula un vehículo con otra placa u otro modelo no recibe asignación directa (motivo B05).
- [ ] Un titular con acuerdo de pago incumplido no recibe asignación directa (motivo B03).
- [ ] Ningún titular de balota vigente participa en el sorteo general del mismo periodo (salvo lo que se decida en DP-42).
- [ ] Todo perdedor habilitado sin balota previa en el ciclo recibe una balota nueva, con placa y modelo congelados.
- [ ] Nadie recibe una segunda balota en el ciclo mientras exista un participante habilitado que nunca la haya recibido.
- [ ] La asignación obtenida por balota vence al terminar el trimestre.

### Elegibilidad y postulación
- [ ] Toda postulación no habilitada muestra al menos un motivo concreto con código y texto.
- [ ] Una unidad con acuerdo de pago queda no habilitada con el motivo `E03`, según lo que se decida en DP-40.
- [ ] Un vehículo nuevo sin SOAT o sin tarjeta de propiedad aprobada queda no habilitado con el motivo `E04`.
- [ ] Al enviar la postulación se muestra el acuse con número, fecha y hora, y queda guardado.
- [ ] Los códigos fuera del formato `VEH-###` o `MOT-###`, o con un prefijo que no coincide con el tipo, se rechazan.

### Seguridad y operación
- [ ] Un residente no puede leer postulaciones, documentos, balotas ni pagos de otra unidad (test de RLS con dos usuarios).
- [ ] Un residente no puede ejecutar el sorteo, cambiar estados ni modificar balotas (403, y RLS lo bloquea).
- [ ] La consulta de placa en portería responde si el vehículo corresponde, y permite registrar la incidencia.
- [ ] Las rutas `/parqueaderos`, `/admin` y `/porteria` redirigen a `/login` si no hay sesión.

---

## 16. Plan por fases

### Fase 0 — Prerrequisitos (bloqueantes)
- Actualizar `CLAUDE.md` con los datos reales del proyecto.
- Reactivar la autenticación (middleware y layout).
- Definir la vinculación de usuarios con unidades (DP-02).
- Instalar la infraestructura de tests y los scripts de lint y typecheck.
- Resolver las decisiones marcadas con 🔴 y además DP-03, DP-04, DP-13, DP-14, DP-18, DP-21 a DP-23 y DP-44.
- Confirmar los nombres de tablas.

### Fase 1 — MVP
- Roles, unidades, residentes, vehículos (con placa y modelo), espacios y zonas.
- Ciclos anuales y periodos con sus estados; capacidades de 96 y 25.
- Estado de pagos con carga manual de la administración, incluido el estado del acuerdo de pago.
- Postulación con acuse; documentos con revisión manual.
- Evaluación de elegibilidad (E01 a E07) y de asignación directa (B01 a B06) con motivos y listado exportable.
- Algoritmo determinista: asignación directa, Fisher–Yates con semilla, balotas nuevas, rotación de zonas y espacios grandes, con tests unitarios.
- Compromiso y revelación de la semilla.
- Ejecución atómica e idempotente.
- Resultados, estado de balotas y verificación para el auditor.
- Bitácora de auditoría.
- Notificaciones dentro de la app.
- RLS completo con tests.

### Fase 2 — Operación
- Portería: consulta por placa, incidencias y amonestaciones.
- Reasignaciones durante el trimestre.
- Reclamaciones sobre la habilitación (DP-05).
- Exportación en PDF o Excel.
- Notificaciones por correo (DP-34).

### Fase 3 — Automatización y mejoras
- Cierre y sorteo programados (DP-15).
- Semilla combinada con un valor público externo (DP-13).
- Integración con cartera (DP-03).
- Encadenamiento de la bitácora por hash (DP-17).
- Verificación asistida de documentos.
- Reportes históricos de rotación y de balotas por ciclo.

---

## 17. Archivos

### Existentes que se modificarían

| Archivo | Cambio |
|---|---|
| `features/parqueaderos/sorteo.ts` | Se reescribe o reemplaza: UUID, Fisher–Yates con semilla, asignación directa, balota blanca y rotación |
| `app/api/parqueaderos/route.ts` | Se reemplaza por la estructura de la sección 10 |
| `middleware.ts` | Reactivar la protección y agregar `/parqueaderos`, `/admin` y `/porteria` |
| `app/chat/layout.tsx` | Quitar el usuario simulado y reactivar la redirección |
| `app/auth/callback/route.ts` | Manejar el error y definir el destino tras el login |
| `app/page.tsx` | Destino inicial (DP-28) |
| `app/login/page.tsx` | Textos en español del dominio de parqueaderos |
| `app/layout.tsx` | `lang="es"`, título y metadatos |
| `app/chat/ClientLayout.tsx` y `features/conversations/components/ConversationList.tsx` | Solo si se decide compartir el sidebar (DP-28) |
| `package.json` | Scripts y dependencias de test y typecheck, con autorización |
| `CLAUDE.md` | Actualización, con autorización |
| `supabase-schema.sql` | Según se decida entre este archivo y migraciones separadas (DP-38) |

### Nuevos (provisionales)

```
features/parqueaderos/
├── components/        (componentes de la sección 10)
├── services/          (acceso a Supabase por entidad)
├── lib/
│   ├── prng.ts             (flujo determinista SHA-256 y muestreo por rechazo)
│   ├── barajar.ts          (Fisher–Yates con semilla)
│   ├── asignacion.ts       (algoritmo puro de la sección 7)
│   ├── balota-blanca.ts    (reglas B01–B06, otorgamiento y límite por ciclo)
│   ├── elegibilidad.ts     (reglas E01–E07)
│   └── validaciones.ts     (esquemas Zod: placa, código, modelo, formulario)
├── types/
└── __tests__/         (algoritmo, balota blanca, elegibilidad, validaciones)
app/parqueaderos/…     (páginas de residente y auditor)
app/admin/parqueaderos/…
app/porteria/…
app/api/parqueaderos/… (endpoints de la sección 10)
supabase/migrations/…  (o sección nueva en supabase-schema.sql, según DP-38)
```

---

## 18. Decisiones pendientes

### Resueltas con las aclaraciones sobre la balota blanca

| DP | Resolución |
|---|---|
| DP-06 | Nadie recibe asignación directa sin una nueva postulación. La regla original de "ingreso automático" pasa a DP-39 |
| DP-07 | Las asignaciones directas se hacen antes del sorteo general y se descuentan de la capacidad del periodo |
| DP-08 | La balota blanca da asignación directa, sin sorteo |
| DP-09 | Si el titular no se postula o no cumple, no recibe parqueadero ese periodo, pero su marca se conserva para la rotación |
| DP-18 (parcial) | El ciclo de rotación es anual |
| DP-20 (parcial) | Motos: capacidad de 25. Falta confirmar que aplican las mismas reglas |

### Abiertas

| ID | Tema |
|---|---|
| 🔴 **DP-39** | Contradicción: "ingreso automático" de los excluidos frente a la postulación obligatoria |
| 🔴 **DP-40** | Contradicción: cualquier acuerdo de pago frente a solo acuerdo incumplido |
| 🔴 **DP-41** | Límites del ciclo anual y destino de las balotas de Q4 |
| 🔴 **DP-42** | Si un titular de balota que no cumple B01 a B06 puede participar en el sorteo general |
| 🔴 **DP-43** | Alcance de "participantes que nunca hayan recibido una" y posibilidad de segunda balota |
| 🔴 **DP-45** | Más titulares de balota aptos que capacidad disponible |
| DP-01 / DP-02 | Asignación de roles y vinculación de la cuenta con la unidad |
| DP-03 / DP-04 | Fuente del estado de pagos y fecha de corte |
| DP-05 | Reclamaciones sobre la habilitación |
| DP-10 | Número de vehículos o postulaciones por unidad |
| DP-11 / DP-12 | Documentos de vehículos antiguos; definición de vehículo "nuevo" |
| DP-13 | Fuente de aleatoriedad pública adicional |
| DP-14 | Vehículos grandes: si conservan su espacio, si cuentan en la capacidad, si hay escasez |
| DP-15 / DP-16 | Sorteo automático; corrección tras publicar |
| DP-17 | Encadenamiento de la bitácora por hash |
| DP-18 | Unidad de rotación (persona, unidad o vehículo) |
| DP-19 | Efecto de ser propietario o arrendatario |
| DP-20 | Confirmar que las motos siguen las mismas reglas |
| DP-21 / DP-22 / DP-23 | Sujeto de la rotación de zonas, relajación cuando no se puede, relación entre bloques y zonas |
| DP-24 / DP-25 | Asignación de códigos; formatos de placa |
| DP-26 | Consecuencias de las amonestaciones |
| DP-27 | Visibilidad pública de los resultados |
| DP-28 | Navegación y relación con el chat de IA |
| DP-29 | Excepciones al uso de la clave de servicio |
| DP-30 / DP-31 | Acceso del auditor a documentos; visibilidad de pagos para el residente |
| DP-32 | Re-ejecución tras un conflicto |
| DP-33 | Zona horaria |
| DP-34 | Notificaciones por correo |
| DP-35 | Tratamiento de datos personales |
| DP-36 / DP-37 | Cambio de vehículo; mudanza o venta durante el trimestre |
| DP-38 | Esquema en archivo único o en migraciones |
| DP-44 | Significado de "modelo"; "propietario" literal o titular; a quién pertenece la balota |
| DP-46 | Puesto físico aleatorio y rotación también para las asignaciones directas |
| DP-47 | Orden entre espacio especial y asignación directa |
| DP-48 | Restricción adicional para ganadores del sorteo general |

---

## 19. Validación (sin comandos)

- **Nivel 1:** lint y verificación de tipos sin errores. Hoy no existe el script de typecheck; se crea en la fase 0.
- **Nivel 2:** tests unitarios del algoritmo (reproducibilidad, ausencia de sesgo, capacidad, asignación directa, balotas nuevas y límite por ciclo, rotación, espacios grandes), de elegibilidad y de validaciones.
- **Nivel 3:** tests de integración de RLS con usuarios de distintos roles y de la ejecución atómica e idempotente del sorteo.
- **Nivel 4:** recorrido completo de al menos dos periodos consecutivos (para probar la balota blanca) en un entorno de pruebas, nunca contra la base de datos de producción.

---

## Confianza de implementación: 6/10

- ✅ El stack está claro, la lógica central es pura y fácil de probar, los riesgos ya están identificados en la auditoría y las reglas de la balota blanca ya están definidas.
- ⚠️ Faltan resolver las decisiones marcadas con 🔴 (DP-39 a DP-43 y DP-45). Todavía no hay infraestructura de tests, no hay roles y la autenticación está desactivada.
- 📋 Con las decisiones 🔴 resueltas, la confianza sube a 7/10 aproximadamente; con DP-14, DP-21 a DP-23 y DP-44 resueltas también, a 8/10.
