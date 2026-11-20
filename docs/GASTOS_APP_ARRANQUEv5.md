# App de Gastos ("Feria", nombre provisional) — requisitos (actualizado 19-nov-2026, v5)

**Diseño aprobado:** `feria_dashboard.html`, un dashboard mensual en una sola pantalla. Toda la lógica es la misma de `feria_preview.html` (v4, la vista por semana), que solo sirve de referencia para las pantallas internas. Arranca vacío, sin datos de ejemplo.

## Vista principal: dashboard mensual (nuevo, 19-nov)
- **Enfoque mes a mes** en una sola pantalla, armada con cuadros tipo rompecabezas (bento). Sin pestañas abajo.
- **Layout:** 2 columnas en el iPhone. Desde 680px (iPad y laptop) pasa a 4 columnas, con un ancho máximo de ~1180px.
- **Arriba:** selector de mes ‹ Noviembre 2026 ›. Solo deja ir a meses con datos y nunca después del mes actual; trae un botón "Ir a hoy".
- **Botón +** flotando abajo a la derecha.
- **Pantallas internas** (Movimientos, Tarjeta → MSI / Por cobrar): se abren completas desde sus cuadros y tienen un botón **"← Dashboard"** para regresar. Adentro funcionan igual (deslizar para borrar, tocar para editar, Pago MSI…).
- **La cajita** sigue escondida (3 toques al logo "Feria").

### Cuadros, en orden
1. **El big one del mes** (grande): **Te sobró** (ingresos reales − gastos reales − GBM − emergencia), con Ingresos / Gastos / GBM+emergencia. Abajo, la barra **"A dónde se fue cada peso"** (Gastos · GBM · Emergencia · Sobró, en % de los ingresos), cuánto fue de MSI y la comparación con el mes pasado.
2. **Te queda para gastar · [mes]:** lo que entró al sobre de Gastos en el mes menos lo que gastaste de ese sobre en el mes (incluye lo que la gasolina pasó del apartado). Es la suma de las semanas, vista por mes. Muestra **≈ $X al día** con los días que faltan para cerrar el mes, más una línea de cómo vas esta semana. En meses pasados cambia a **"Así cerró el sobre"**.
3. **Gasolina:** el apartado acumulado; "Apartado $X de $680 · pagaste $Y". **Se pone verde clarito con una palomita discreta SOLO cuando ya pagaste el tanque esa semana.**
4. **Próximo cargo (MSI):** monto, corte y fecha límite, y cuánto falta pagar. **Se pone ámbar cuando faltan 3 días o menos para el pago límite** ("Faltan N días para pagar" / "Hoy es el último día de pago"). Si ya se pasó, sale "Vencida" en rojo. Al tocarlo abre Tarjeta → MSI.
5. **Invertir:** anillo de efectivo vs proyectado, y "Te faltan $X por invertir".
6. **Emergencia:** anillo de efectivo vs meta (6 × gastos reales del mes), con el proyectado.
7. **Semana por semana:** barras de ingresos (teal) contra gastos (terracota) por cada semana del mes. La semana actual va resaltada.
8. **Salidas por categoría:** top 6 en barras; lo que es solo wagered lleva su etiqueta.
9. **Por cobrar:** total, mamá y externos. Al tocarlo abre Tarjeta → Por cobrar.
10. **Dólares:** bolsa en USD ≈ MXN con el TC, y botón **Cambiar**.
11. **Eat/drink del mes:** total y % contra el mes pasado (verde si gastaste igual o menos, terracota si más).
12. **Racha:** semanas cerradas seguidas sin pasarte del sobre de Gastos. Las semanas sin movimientos no cuentan ni la rompen.
13. **Wagered:** lo que entró y lo que salió, con una barra de proporción, más pesos vs dólares guardados. Va en la misma fila que Eat/drink y Racha.
14. **Últimos movimientos:** los 6 más recientes del mes (tocar → editar) y "Ver todos →".
15. **Proyección de cierre** (abajo): "Si sigues gastando como hasta hoy ($X al día)" → gastos a fin de mes, cuánto te sobraría y % contra el mes pasado. En meses pasados se vuelve "Cierre del mes".
16. **Calendario de gastos** (hasta abajo): el mes de domingo a sábado. Cada día se pinta más oscuro (terracota) mientras más gasto real hubo; el día de hoy lleva borde y los días futuros van tenues. Al tocar un día sale "jueves 19 nov: $X de gastos".

- **Se quitó:** "Chamba por noche".
- **Sugerencias pendientes (sin decidir):** anclar "Te queda para gastar" hasta arriba en el iPhone; línea de promedio en el chart semana por semana; esconder o achicar Por cobrar cuando está en $0.

## Base técnica
- Next.js + TypeScript + Tailwind en **Vercel** (proyecto propio, Hobby) + **Supabase**.
- Supabase: proyecto compartido `isra-apps`, schema propio **`gastos`**. Login compartido. **Sin conexión con la app del portafolio.**
- Sin backups en el plan gratis → export semanal (CSV/JSON).
- PWA en iPhone; el dashboard también se adapta a iPad y laptop (4 columnas). Usuario único. UI en español.
- Empieza **en cero**: no se importa nada de Notion ni del Excel.
- La fecha de cada movimiento arranca en la de hoy y se puede cambiar.

## Estética (propia)
Fondo hueso #F3EEE5 / tarjetas #FBF8F2 / tinta #18213A. Modo oscuro navy #0E1424. Acentos: teal (ingresos), terracota (gastos), ámbar (inversión), cobre oxidado/verdín (emergencia), vino (por cobrar/MSI), navy (gasolina). Fuentes: Fraunces (números) + Manrope (UI).

## Semanas
- **Estilo americano: de domingo a sábado.** El domingo o el lunes le cae la feria del fin de semana, y la semana marca cuánto puede gastar hasta el domingo siguiente.

## Moneda
MXN y USD. Si entra un ingreso en USD, sale un pop-up: "Los guardo en dólares" (van a la bolsa de dólares, valuada con el TC en vivo) o "Los cambié" (pide el TC y muestra cuánto ganó o perdió contra el TC en vivo). Los totales se ven por moneda y también convertidos a MXN.

## Categorías
**Ingresos:** Semana mamá (se prellena con $900 y concepto "Semana"), Chamba (un solo ingreso), Regalo (se divide), Reembolso mamá, Reembolso externo, Otro.
**Gastos:** Gasolina, Eat/drink, Gastos (cuentan para Israel) · Inversión GBM · Apartar a emergencia · Pagué por mamá · Pagué por externo (en el concepto va de quién es) · **Pago MSI** · Pago a capital (MSI).
Cada movimiento tiene el switch "Cuenta para Israel", con valor inicial según la categoría.

## Big one vs wagered
- **Big one:** ingresos y gastos reales de Israel.
- **Wagered:** todo lo que entró y todo lo que salió, en totales separados.

## División de ingresos (sobres, por semana)
1. **Gasolina: $680/semana**, se aparta una vez por semana: el primer ingreso de la semana la llena (si no alcanza, el siguiente completa lo que falta) y los demás ingresos ya no aportan.
   - La gasolina **no es una cajita aparte**: es un apartado dentro de lo que gasta. Si no llena el tanque esa semana, el apartado se acumula. Cuando paga gasolina se usa el apartado, y **si paga más de lo apartado, el excedente cuenta en el sobre de Gastos** ("Te queda para gastar"). Nunca sale negativa.
2. El resto, **50/50** entre Gastos e Inversión.
3. De Inversión, **20% a emergencia**.
- Las reglas se editan, y en cada ingreso se pueden mover a mano.
- **Si se pasa del sobre de Gastos**, el exceso se descuenta primero de la proyección de emergencia de esa semana y después del apartado de gasolina.
- **Emergencia:** proyectado (se puede borrar) + efectivo (nunca se borra). **Meta dinámica, no editable:** 6 × el promedio **mensual** de gastos reales (solo lo de Israel: sin wagered, inversión ni emergencia). Usa los meses ya cerrados; si todavía no hay ninguno, usa lo que lleva del mes, sin extrapolar.
- **Invertir:** proyectado (nunca se borra, para motivar) + efectivo, y muestra "te faltan $X".
- **Cajita escondida:** lo que sobra del sobre de Gastos al cerrar cada semana. Es feria guilt-free. Se abre tocando 3 veces el logo "Feria" y tiene "Usar feria de la cajita".

## MSI (pestaña Tarjeta → MSI)
- Corte el **11** y pago límite el **1**; los dos se editan en Reglas.
- En un gasto: switch "A meses sin intereses" → total + meses (**3 por default, o Manual**, por ejemplo para registrar una compra a la que ya le pagó un mes y le quedan 2).
- **Una mensualidad cuenta como gasto cuando la paga**, con la categoría **Pago MSI**: escoge el plan, el monto se prellena con la mensualidad más próxima y se puede cambiar. Si el plan es suyo, sale de "Te queda para gastar"; si es de un externo o de mamá, solo cuenta para wagered. Al pagar, baja el próximo cargo, el anillo avanza y marca "1 de 2 pagadas". Si se pasa la fecha límite sin pagarla, sale como vencida. No se registra sola en el corte (para no contarla doble).
- La pantalla muestra el próximo cargo (con botón "Pagar mensualidad"), el total que falta pagar, una tabla por corte y los planes activos y liquidados con anillo de progreso.
- **Los planes se pueden editar** (total, categoría, meses, concepto, fecha y si cuenta para Israel) y borrar.
- **Pago a capital:** abono de cualquier monto, con botón de "Liquidar todo". Cuenta como gasto y wagered ese día y se descuenta de las **últimas** mensualidades, así que el próximo cargo no cambia.

## Por cobrar (pestaña Tarjeta → Por cobrar)
- Por persona (Mamá / Externos), separado en **gastos sueltos** y **MSI por plan**.
- En un Reembolso, el switch **"Parte es de MSI"** deja escoger el plan y cuánto es de MSI. Esa parte se resta de lo que debe en ese plan y el resto va a gastos sueltos.
- Cada plan muestra cuánto le ha pagado de su total, cuánto le debe de lo que Israel ya pagó, o si va adelantado.

## Movimientos
- Tocar → editar. Deslizar a la izquierda → borrar, estilo Gmail, con "Deshacer". Los pagos de MSI también se borran deslizando, y al tocarlos se abre su plan.
- El formulario trae Cancelar y una X.

## Otras funciones
Todo lo que antes vivía en las pestañas Semana y Mes ahora está en el dashboard (ver arriba). En Reglas (botón de sliders arriba a la derecha) están las reglas de división, el corte y el pago de la tarjeta, los meses default de MSI, el TC manual y "Borrar todo y empezar de cero", con Deshacer. El modo oscuro va en el botón de la luna.

## Pendiente
- Atajo de iPhone → `/api/gastos` (después de la app, Fase 6).
- Presupuesto por categoría con alertas: sin decidir.
- TC en vivo del lado del servidor (Banxico FIX u open.er-api), cacheado.
- En la base, las mensualidades se derivan del plan (no se guardan como filas). Los pagos van dentro del plan como `pagos [{fecha, monto, tipo: cuota|capital}]`: los de cuota cubren las mensualidades en orden y los de capital se restan de las últimas. Los reembolsos guardan `msiPart {plan, monto}`.
