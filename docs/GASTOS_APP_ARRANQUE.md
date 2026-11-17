# App de Gastos ("Feria", nombre provisional) — requisitos (actualizado 16-nov-2026, v4)

Preview HTML: `feria_preview.html` v4. Arranca vacío, sin datos de ejemplo. Es la referencia visual y funcional para Claude Code.

## Base técnica
- Next.js + TypeScript + Tailwind en **Vercel** (proyecto propio, Hobby) + **Supabase**.
- Supabase: proyecto compartido `isra-apps`, schema propio **`gastos`**. Login compartido. **Sin conexión con la app del portafolio.**
- Sin backups en el plan gratis → export semanal (CSV/JSON).
- PWA en iPhone (en laptop se ve como columna angosta y está bien así). Usuario único. UI en español.
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
Bolsa de dólares con "Cambiar", ritmo semanal de Eat/drink contra el promedio, chamba por noche (viernes vs sábado), vista Mes (big one, wagered, meta de emergencia, categorías, semana por semana, pesos vs dólares). En Reglas está "Borrar todo y empezar de cero", con Deshacer.

## Pendiente
- Atajo de iPhone → `/api/gastos` (después de la app).
- Presupuesto por categoría con alertas: sin decidir.
- TC en vivo del lado del servidor (Banxico FIX u open.er-api), cacheado.
- En la base, las mensualidades se derivan del plan (no se guardan como filas). Los pagos van dentro del plan como `pagos [{fecha, monto, tipo: cuota|capital}]`: los de cuota cubren las mensualidades en orden y los de capital se restan de las últimas. Los reembolsos guardan `msiPart {plan, monto}`.
