# Configuración de Auth en Supabase — registro y recuperación de contraseña

El código ya está listo. Falta cargar el enrutamiento en el dashboard de
Supabase, si no los mails salen apuntando a cualquier lado.

Proyecto: `zkltjvgbpzelwzsphurg`

---

## 1. Aplicar la migración

```bash
supabase db push
```

O, si trabajás desde el dashboard: pegar el contenido de
`migrations/20260827120000_auth_signup_profile_trigger.sql` en
**SQL Editor → New query → Run**.

Qué hace:

- Reemplaza el trigger `on_auth_user_created` sobre `auth.users`, que arma la
  fila de `public.profiles` en el momento del alta usando la metadata del
  signUp. El perfil nace con `registered = false`.
- Crea el trigger `on_auth_user_confirmed`, que pasa `registered` a `true`
  cuando el cliente confirma el mail. Es el que cierra el circuito: la app usa
  ese campo como "tiene cuenta", así que sin él el cliente confirma y la app lo
  sigue tratando como no registrado.
- **Backfill** de cuentas sin fila en `profiles`. Es idempotente y hoy no toca
  nada (verificado contra la base remota: 0 huérfanos); queda como red por si
  un alta futura falla dentro del `exception` del trigger.
- Limpia dos policies duplicadas y deja el `WITH CHECK` escrito explícitamente
  en la de `UPDATE`. No arregla ningún agujero — Postgres reusa `USING` como
  check cuando falta `WITH CHECK` — es sólo para que no se lea como un
  descuido en la próxima revisión.

Verificación rápida:

```sql
-- Los dos triggers, presentes
select tgname from pg_trigger
where tgrelid = 'auth.users'::regclass and not tgisinternal;

-- Debe devolver 0 (perfiles huérfanos)
select count(*) from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- Debe devolver 0: mail confirmado pero perfil sin validar
select count(*) from auth.users u
join public.profiles p on p.id = u.id
where u.email_confirmed_at is not null and p.registered is not true;
```

---

## 2. Authentication → Providers → Email

| Opción | Valor |
|---|---|
| Enable Email provider | **ON** |
| **Confirm email** | **ON** ← esto es lo que dispara el mail de validación |
| Secure email change | ON |
| Minimum password length | **6** (el formulario de la app pide 6) |

> Si `Confirm email` está en OFF, el cliente entra directo sin mail. El código
> soporta las dos configuraciones, pero el pedido es que llegue el mail: dejalo
> en ON.

---

## 3. Authentication → URL Configuration

**Site URL** — el dominio de producción de la WebApp:

```
https://TU-DOMINIO.vercel.app
```

**Redirect URLs** — hay que agregar las cuatro. Sin esto Supabase ignora el
`redirectTo` y manda todo al Site URL, y el link "no hace nada":

```
https://TU-DOMINIO.vercel.app/auth/callback
https://TU-DOMINIO.vercel.app/auth/callback?next=reset
http://localhost:5173/auth/callback
http://localhost:5173/auth/callback?next=reset
```

Si el bar usa dominio propio (ej. `https://bizarren.app`), agregá también sus
dos variantes. También sirve el comodín `https://TU-DOMINIO.vercel.app/auth/**`.

> Reemplazá `TU-DOMINIO.vercel.app` por el dominio real antes de cargarlo.

---

## 4. Authentication → Email Templates

Las plantillas por defecto funcionan tal cual: `{{ .ConfirmationURL }}` ya
respeta el `redirectTo` que manda la app. Solo conviene traducirlas.

### Confirm signup

Asunto: `Confirmá tu cuenta de BizarrApp 🎉`

```html
<h2>¡Bienvenido a BizarrApp!</h2>
<p>Tocá el botón para confirmar tu cuenta y entrar a jugar:</p>
<p><a href="{{ .ConfirmationURL }}">Confirmar mi cuenta</a></p>
<p>Si no fuiste vos, ignorá este mail.</p>
```

### Reset password

Asunto: `Recuperá tu contraseña de BizarrApp 🔑`

```html
<h2>¿Te olvidaste la contraseña?</h2>
<p>Tocá el botón para elegir una nueva. El link vence en 1 hora.</p>
<p><a href="{{ .ConfirmationURL }}">Elegir contraseña nueva</a></p>
<p>Si no lo pediste vos, ignorá este mail: tu contraseña no cambia.</p>
```

### Variante opcional, más robusta

Algunos clientes de correo (Outlook, antivirus corporativos) **abren los links
automáticamente** para escanearlos y queman el token de un solo uso: el cliente
toca el botón y le dice "link vencido". Para evitarlo se puede usar la variante
con `token_hash`, que la app también soporta:

```html
<a href="{{ .SiteURL }}/auth/callback?next=novedades&token_hash={{ .TokenHash }}&type=signup">
  Confirmar mi cuenta
</a>
```

```html
<a href="{{ .SiteURL }}/auth/callback?next=reset&token_hash={{ .TokenHash }}&type=recovery">
  Elegir contraseña nueva
</a>
```

No hace falta tocar nada del código para cambiar de una a otra.

---

## 5. SMTP propio (importante para el bar)

**Authentication → Emails → SMTP Settings**

El SMTP de prueba de Supabase manda **~2 mails por hora** y solo a miembros del
proyecto. Con eso el registro de clientes no funciona en la práctica: la mayoría
nunca recibe el mail.

Configurá un SMTP real (Resend, SendGrid, Brevo, Postmark…) con el dominio del
bar y un remitente tipo `hola@bizarren.app`. Después subí los límites en
**Authentication → Rate Limits** (por defecto son 30 mails/hora).

---

## 6. Deploy

`vercel.json` ya reescribe todas las rutas a `index.html`, así que
`/auth/callback` funciona sin tocar nada en Vercel.

---

## Circuito completo, de punta a punta

**Registro**

1. Paso 4 del registro → `signUp()` con `emailRedirectTo=/auth/callback?next=novedades`
   y el perfil en `options.data` (claves: `name`, `team`, `phone`, `avatar_id`,
   `avatar_emoji` — las mismas cinco que lee el trigger).
2. El trigger `handle_new_user` crea la fila de `profiles` con `registered=false`.
3. La app muestra "📬 Confirmá tu cuenta" con botón de reenvío.
4. Llega el mail → el cliente toca el link → cae en `/auth/callback`.
5. Supabase marca `email_confirmed_at` → el trigger `handle_user_confirmed`
   pasa `registered` a `true`.
6. `AuthCallbackView` canjea la sesión y llama a `hydrateProfile`, que sube la
   foto que quedó en el celular y, si la fila todavía dice `registered=false`
   (lectura anticipada o migración sin aplicar), la corrige. Redirige a
   `/?view=novedades&confirmed=1`.
7. **La app abre en el menú Noti** con el cartel "🎉 ¡Cuenta confirmada!".

> Los pasos 5 y 6 hacen lo mismo a propósito. El trigger es el que manda —
> cubre al cliente que confirma en la compu y vuelve desde el celular, sin
> pasar nunca por el callback. El chequeo del cliente sólo evita la ventana en
> la que el callback lee la fila antes de que el trigger commitee.

**Recuperar contraseña**

1. Login → "Olvidé mi contraseña" → email → `resetPasswordForEmail()` con
   `redirectTo=/auth/callback?next=reset`.
2. Llega el mail → el cliente toca el link → cae en `/auth/callback`.
3. `AuthCallbackView` detecta `next=reset` y muestra el formulario
   **contraseña + repetir contraseña**.
4. Guarda → `updateUser({ password })` → redirige a
   `/?view=novedades&passwordChanged=1`, ya con la sesión iniciada.

**Cambio de contraseña estando logueado**

Perfil (paso 5) → tarjeta "🔑 Contraseña" → contraseña actual + nueva + repetir.
Pide la actual a propósito: el celular suele quedar abierto sobre la mesa.
