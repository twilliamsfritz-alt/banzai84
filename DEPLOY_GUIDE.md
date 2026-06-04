# Banzai — Guía completa de despliegue e integración

## Índice
1. [Ejecutar localmente](#1-ejecutar-localmente)
2. [Integrar OpenAI](#2-integrar-openai)
3. [Integrar WhatsApp Business](#3-integrar-whatsapp-business)
4. [Integrar Stripe](#4-integrar-stripe)
5. [Desplegar a producción (Railway)](#5-desplegar-a-producción-railway)
6. [Desplegar a producción (Render)](#6-desplegar-a-producción-render)
7. [Desplegar a producción (VPS propio)](#7-desplegar-a-producción-vps-propio)
8. [Checklist final de producción](#8-checklist-final-de-producción)

---

## 1. Ejecutar localmente

### Requisitos
- Python 3.10+
- Conexión a internet (solo para las integraciones externas)

### Pasos

```bash
# Clonar o extraer el proyecto
cd Banzai_INTEGRATION_READY_COMPLETE

# Crear entorno virtual
python -m venv .venv

# Activar (Windows)
.venv\Scripts\activate

# Activar (Mac / Linux)
source .venv/bin/activate

# Instalar dependencias
pip install -r requirements.txt

# Crear la base de datos y seed de datos
python migrate.py

# Arrancar
python app.py
```

Abrí `http://127.0.0.1:5000` en tu navegador.

**Usuarios de prueba:**
| Email | Contraseña | Workspace |
|---|---|---|
| owner@banzai.local | demo1234 | Vantis Patagonia (AR / ARS) |
| owner@northbridge.local | demo1234 | Northbridge Commerce (US / USD) |
| owner@auroraops.local | demo1234 | Aurora Ops (BR / BRL) |

### Verificar que todo funciona
```bash
# Health check
curl http://127.0.0.1:5000/api/health

# Estado de integraciones
curl http://127.0.0.1:5000/api/integrations/status
```

---

## 2. Integrar OpenAI

### Qué hace
Cuando `OPENAI_API_KEY` está configurada, el backend llama a GPT-4o-mini para generar respuestas. Si la clave no está o hay un error, cae automáticamente al motor local (sin interrumpir el servicio).

### Pasos

1. Creá tu cuenta en [platform.openai.com](https://platform.openai.com)
2. Andá a **API Keys** → **Create new secret key**
3. Copiá la clave

4. Copiá `.env.example` a `.env` y pegá la clave:
```bash
cp .env.example .env
```

```ini
# .env
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-4o-mini
```

5. Reiniciá el servidor. La próxima respuesta desde el webchat o `/api/ai/reply` ya usa OpenAI.

### Probar
```bash
# Loguearse primero para obtener la sesión
curl -c cookies.txt -X POST http://127.0.0.1:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@banzai.local","password":"demo1234"}'

# Probar la ruta de AI
curl -b cookies.txt -X POST http://127.0.0.1:5000/api/ai/reply \
  -H "Content-Type: application/json" \
  -d '{"text":"Necesito precio de lavandina 5L"}'
```

La respuesta incluirá `"provider": "openai"` si la integración funciona, o `"provider": "local_fallback"` si no.

### Costos estimados
Con gpt-4o-mini: ~$0.00015 por 1000 tokens de entrada, ~$0.0006 por 1000 tokens de salida. Un workspace activo con 200 conversaciones/día ≈ $1–3/mes.

---

## 3. Integrar WhatsApp Business

### Requisitos previos
- Cuenta de Meta Business Suite verificada
- Número de teléfono dedicado para WhatsApp Business
- App desplegada con HTTPS público (WhatsApp no acepta `localhost`)

### Paso 1 — Crear la app en Meta

1. Ir a [developers.facebook.com](https://developers.facebook.com) → **My Apps** → **Create App**
2. Tipo: **Business**
3. Nombre: el que quieras (ej. "Banzai Bot")
4. Agregar el producto **WhatsApp** a la app

### Paso 2 — Configurar el número

1. En **WhatsApp → Getting Started**, copiá:
   - `Phone Number ID` → `WHATSAPP_PHONE_NUMBER_ID`
   - `WhatsApp Business Account ID` → `WHATSAPP_WABA_ID`
2. Generá un **System User access token** permanente:
   - Business Suite → **Settings** → **System Users** → **Add** → **Generate Token**
   - Permisos necesarios: `whatsapp_business_messaging`, `whatsapp_business_management`
   - Copialo como `WHATSAPP_ACCESS_TOKEN`

### Paso 3 — Configurar el webhook

1. En **WhatsApp → Configuration → Webhook**:
   - **Callback URL**: `https://TU-DOMINIO/api/webhooks/whatsapp`
   - **Verify Token**: inventá una cadena segura (ej. `vantis-verify-abc123`)
   - Copiala como `WHATSAPP_VERIFY_TOKEN`
   - **Subscribe** a: `messages`

2. Hacé clic en **Verify and Save**. Meta va a hacer un GET a tu URL con el token.

### Paso 4 — Configurar .env

```ini
WHATSAPP_VERIFY_TOKEN=vantis-verify-abc123
WHATSAPP_ACCESS_TOKEN=EAAxxxxxxxxxxxxxxxxxx
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_WABA_ID=987654321098765
DEFAULT_WHATSAPP_WORKSPACE_SLUG=patagonia-trading
```

### Paso 5 — Probar envío

```bash
curl -b cookies.txt -X POST http://127.0.0.1:5000/api/whatsapp/send-test \
  -H "Content-Type: application/json" \
  -d '{"to":"549XXXXXXXXXX","text":"Hola, este es un mensaje de prueba de Banzai."}'
```

El número de destino debe estar en formato internacional sin `+` (ej. `5491112345678` para Argentina).

### Cómo funciona el flujo completo

```
Cliente escribe en WhatsApp
         ↓
Meta envía POST a /api/webhooks/whatsapp
         ↓
App extrae número + texto del mensaje
         ↓
Busca o crea conversación en DB
         ↓
Genera respuesta (OpenAI o motor local)
         ↓
Guarda mensajes en DB
         ↓
Envía respuesta de vuelta por WhatsApp API
         ↓
Registra todo en traces
```

---

## 4. Integrar Stripe

### Qué hace
Permite crear sesiones de pago (checkout) para cobrar suscripciones a tus clientes. Ideal para el modelo Setup + Monthly de Banzai.

### Paso 1 — Crear productos en Stripe

1. Ir a [dashboard.stripe.com](https://dashboard.stripe.com)
2. **Products** → **Add product**
3. Crear uno por plan, por ejemplo:
   - "Banzai Starter" → $99/mes → copiar el `price_id` (empieza con `price_`)
   - "Banzai Growth" → $199/mes → copiar el `price_id`

### Paso 2 — Obtener las claves

1. **Developers** → **API Keys**:
   - `Secret key` (sk_test_... en modo test, sk_live_... en producción) → `STRIPE_SECRET_KEY`
   - `Publishable key` → `STRIPE_PUBLISHABLE_KEY`

2. **Developers** → **Webhooks** → **Add endpoint**:
   - URL: `https://TU-DOMINIO/api/webhooks/stripe`
   - Eventos a escuchar: `checkout.session.completed`, `invoice.paid`, `customer.subscription.deleted`
   - Copiar el **Signing secret** → `STRIPE_WEBHOOK_SECRET`

### Paso 3 — Configurar .env

```ini
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxx
```

### Paso 4 — Crear una sesión de checkout

```bash
curl -b cookies.txt -X POST http://127.0.0.1:5000/api/billing/create-checkout-session \
  -H "Content-Type: application/json" \
  -d '{"email":"cliente@empresa.com","price_id":"price_1XXXXXXXXXXXXXXXXX"}'
```

La respuesta incluye `"url"` — ese es el link de pago de Stripe que le mandás al cliente.

---

## 5. Desplegar a producción (Railway)

Railway es la opción más rápida (< 10 minutos).

### Paso 1 — Preparar el proyecto

Crear `Procfile` en la raíz:
```
web: python app.py
```

O mejor, con gunicorn (más robusto):
```
web: gunicorn app:app --bind 0.0.0.0:$PORT --workers 2
```

Agregar gunicorn a requirements.txt:
```
gunicorn==21.2.0
```

Y cambiar la línea final de `app.py` para respetar el PORT de Railway:
```python
if __name__ == "__main__":
    init_db()
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
```

### Paso 2 — Subir a Railway

1. Ir a [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub**
2. Conectar tu repositorio (o usar **Deploy from local** con la CLI de Railway)
3. Railway detecta automáticamente el `Procfile`

### Paso 3 — Variables de entorno en Railway

En el panel de Railway → **Variables**, agregar:

```
BANZAI_SECRET_KEY=una-clave-larga-y-segura
FLASK_ENV=production
APP_URL=https://tu-app.up.railway.app
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o-mini
WHATSAPP_VERIFY_TOKEN=...
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_WABA_ID=...
STRIPE_SECRET_KEY=...
STRIPE_PUBLISHABLE_KEY=...
STRIPE_WEBHOOK_SECRET=...
```

### Paso 4 — Base de datos

**Importante:** Railway tiene sistema de archivos efímero. La base de datos SQLite se pierde en cada redeploy. Opciones:

**Opción A (simple, para pilotos):** Usar Railway Volume:
- Panel → **Add Volume** → montarlo en `/app/data`
- Cambiar `DB_PATH` en `app.py`:
  ```python
  DB_PATH = Path(os.environ.get("DB_DIR", BASE_DIR)) / "banzai.db"
  ```
  Y en Railway variables: `DB_DIR=/app/data`

**Opción B (recomendada para producción):** Migrar a PostgreSQL:
- Railway → **New** → **PostgreSQL**
- Instalar `psycopg2-binary` y adaptar las queries (los `?` de SQLite se convierten en `%s`)

### Verificar
```bash
curl https://tu-app.up.railway.app/api/health
curl https://tu-app.up.railway.app/api/integrations/status
```

---

## 6. Desplegar a producción (Render)

Muy similar a Railway.

1. Ir a [render.com](https://render.com) → **New Web Service**
2. Conectar el repositorio
3. Configuración:
   - **Build command:** `pip install -r requirements.txt && python migrate.py`
   - **Start command:** `gunicorn app:app --bind 0.0.0.0:$PORT`
4. Agregar las variables de entorno en el panel de Render
5. Para persistencia: usar **Render Disk** (igual que Railway Volume)

---

## 7. Desplegar a producción (VPS propio)

Para control máximo. Ejemplo con Ubuntu 22.04.

```bash
# En el servidor
sudo apt update && sudo apt install python3-pip python3-venv nginx certbot python3-certbot-nginx -y

# Clonar proyecto
git clone tu-repo /opt/vantisone
cd /opt/vantisone

# Entorno virtual
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt gunicorn
python migrate.py

# Configurar .env
cp .env.example .env
nano .env  # completar con tus credenciales

# Servicio systemd
sudo nano /etc/systemd/system/vantisone.service
```

```ini
[Unit]
Description=Banzai
After=network.target

[Service]
User=www-data
WorkingDirectory=/opt/vantisone
Environment="PATH=/opt/vantisone/.venv/bin"
ExecStart=/opt/vantisone/.venv/bin/gunicorn app:app --bind 127.0.0.1:5000 --workers 2
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable vantisone
sudo systemctl start vantisone

# Nginx reverse proxy
sudo nano /etc/nginx/sites-available/vantisone
```

```nginx
server {
    server_name tudominio.com;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/vantisone /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# SSL gratuito con Let's Encrypt
sudo certbot --nginx -d tudominio.com
```

---

## 8. Checklist final de producción

### Seguridad
- [ ] `BANZAI_SECRET_KEY` cambiada (mínimo 32 caracteres aleatorios)
- [ ] `FLASK_ENV=production` (deshabilita el debugger)
- [ ] `APP_URL` apunta al dominio real con HTTPS
- [ ] El puerto 5000 no está expuesto directamente (solo Nginx/proxy)

### Base de datos
- [ ] `python migrate.py` ejecutado en producción
- [ ] Backups automáticos programados (cron + `/api/backup`)
- [ ] El archivo `banzai.db` no está en el repositorio git

### Integraciones
- [ ] `/api/health` responde `{"ok": true}`
- [ ] `/api/integrations/status` muestra `"configured": true` para las integraciones activas
- [ ] OpenAI probado con `/api/ai/reply`
- [ ] WhatsApp verificado con Meta (webhook activo)
- [ ] Stripe checkout probado en modo test

### WhatsApp para producción real
- [ ] App de Meta en modo **Live** (no en Development)
- [ ] Número de teléfono agregado y verificado en Meta
- [ ] Template messages aprobados (para mensajes de iniciativa)
- [ ] `DEFAULT_WHATSAPP_WORKSPACE_SLUG` apunta al workspace correcto

### Monitoreo
- [ ] Revisar la tabla `traces` en la DB regularmente (logs de flujos)
- [ ] Configurar alertas en Railway/Render si el servicio cae

---

## Bugs corregidos en esta versión

| Bug | Descripción | Fix aplicado |
|---|---|---|
| `client.responses.create` | La API de OpenAI no tiene ese método — lanza `AttributeError` silenciosamente y cae al fallback local, nunca usa OpenAI | Cambiado a `client.chat.completions.create` |
| `if False else None` en profile | El perfil del workspace nunca se cargaba en el prompt de OpenAI | Corregido para cargar el perfil real |
| `gpt-5.4-mini` | Nombre de modelo inexistente | Cambiado al default real: `gpt-4o-mini` |
| WhatsApp inbound solo logueaba | Los mensajes de WhatsApp llegaban pero no se respondían ni guardaban | Implementado parseo completo del payload Meta + auto-reply + guardado en DB |

