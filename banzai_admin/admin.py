"""
Banzai Admin Panel — standalone app that connects to a running Banzai instance.
Run on a different port: python admin.py (default port 5001)
"""
from flask import Flask, render_template, jsonify, request, session
import os, requests as req
from functools import wraps

app = Flask(__name__)
app.secret_key = os.environ.get("ADMIN_SECRET", "banzai84-admin-2026-ultra-secret")

BANZAI_URL = os.environ.get("BANZAI_URL", "http://127.0.0.1:5000")

# ── Admin credentials (independent of Banzai) ─────────────────────────────
# Your personal admin credentials — change in .env for production
ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "superadmin@banzai84.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Banzai84#Admin2026")

# ── Banzai owner credentials for auto-connect ──────────────────────────────
# Set these to match whatever you used in the Banzai setup wizard
BANZAI_OWNER_EMAIL    = os.environ.get("BANZAI_OWNER_EMAIL", "twilliams@banzai.com")
BANZAI_OWNER_PASSWORD = os.environ.get("BANZAI_OWNER_PASSWORD", "")

def banzai_api(method, path, **kwargs):
    """Proxy a request to the Banzai backend. Auto-reconnects if session expired."""
    cookies = session.get("banzai_cookies", {})

    # Auto-connect if not connected yet
    if not session.get("banzai_connected") or not cookies:
        # Try stored banzai credentials first, then admin credentials
        for email, pwd in [
            (session.get("banzai_email",""), session.get("banzai_password","")),
            (BANZAI_OWNER_EMAIL, BANZAI_OWNER_PASSWORD),
            (ADMIN_USERNAME, ADMIN_PASSWORD),
        ]:
            if not email or not pwd:
                continue
            try:
                r = req.post(f"{BANZAI_URL}/api/login",
                            json={"email": email, "password": pwd}, timeout=5)
                if r.status_code == 200:
                    session["banzai_cookies"] = dict(r.cookies)
                    session["banzai_connected"] = True
                    cookies = dict(r.cookies)
                    break
            except Exception:
                pass

    url = f"{BANZAI_URL}{path}"
    try:
        r = req.request(method, url, cookies=cookies, timeout=10, **kwargs)
        # If session expired, reconnect and retry once
        if r.status_code == 401:
            try:
                r2 = req.post(f"{BANZAI_URL}/api/login",
                             json={"email": ADMIN_USERNAME, "password": ADMIN_PASSWORD},
                             timeout=5)
                if r2.status_code == 200:
                    session["banzai_cookies"] = dict(r2.cookies)
                    session["banzai_connected"] = True
                    cookies = dict(r2.cookies)
                    r = req.request(method, url, cookies=cookies, timeout=10, **kwargs)
            except Exception:
                pass
        return r
    except Exception as e:
        class _FakeResp:
            status_code = 503
            def json(self): return {"ok": False, "error": f"Banzai offline: {e}", "industries":[], "plans":[], "payments":[], "users":[], "surveys":[], "releases":[], "events":[], "logs":[], "dashboard":{"kpis":{},"conversations":[],"products":[]}}
        return _FakeResp()


def banzai_connected():
    """Check if Banzai is reachable."""
    try:
        r = req.get(f"{BANZAI_URL}/api/health", timeout=3)
        return r.status_code == 200
    except Exception:
        return False


@app.route("/")
def index():
    if not session.get("admin_logged_in"):
        return render_template("admin_login.html", banzai_url=BANZAI_URL)
    return render_template("admin.html")


@app.post("/api/admin-login")
def admin_login():
    payload = request.get_json(force=True)
    email    = (payload.get("email","") or "").strip().lower()
    password = (payload.get("password","") or "").strip()

    # Check admin credentials (independent of Banzai)
    if email != ADMIN_USERNAME.lower() or password != ADMIN_PASSWORD:
        return jsonify({"ok": False, "error": "Credenciales incorrectas"}), 401

    session["admin_logged_in"] = True
    session["admin_email"] = email

    # Store banzai credentials if provided in login form
    banzai_email_form    = (payload.get("banzai_email","") or "").strip()
    banzai_password_form = (payload.get("banzai_password","") or "").strip()
    if banzai_email_form and banzai_password_form:
        session["banzai_email"] = banzai_email_form
        session["banzai_password"] = banzai_password_form

    # Try to connect to Banzai automatically
    banzai_ok = False
    connect_attempts = []
    if banzai_email_form and banzai_password_form:
        connect_attempts.append((banzai_email_form, banzai_password_form))
    if BANZAI_OWNER_EMAIL and BANZAI_OWNER_PASSWORD:
        connect_attempts.append((BANZAI_OWNER_EMAIL, BANZAI_OWNER_PASSWORD))
    connect_attempts.append((email, password))

    for b_email, b_pass in connect_attempts:
        try:
            r = req.post(f"{BANZAI_URL}/api/login",
                         json={"email": b_email, "password": b_pass}, timeout=5)
            if r.status_code == 200:
                session["banzai_cookies"] = dict(r.cookies)
                session["banzai_connected"] = True
                session["banzai_email"] = b_email
                session["banzai_password"] = b_pass
                banzai_ok = True
                break
        except Exception:
            pass

    return jsonify({
        "ok": True,
        "user": {"email": email, "name": "Super Admin", "role": "superadmin"},
        "banzai_connected": banzai_ok,
        "message": "Conectado a Banzai ✓" if banzai_ok else "Admin activo — Banzai offline (algunas funciones requieren Banzai corriendo)",
    })


@app.post("/api/admin-banzai-connect")
def admin_banzai_connect():
    """Connect admin to Banzai with workspace owner credentials."""
    if not session.get("admin_logged_in"):
        return jsonify({"ok": False, "error": "Not authenticated"}), 401
    payload = request.get_json(force=True)
    banzai_email = payload.get("email","").strip()
    banzai_pass  = payload.get("password","").strip()
    try:
        r = req.post(f"{BANZAI_URL}/api/login",
                     json={"email": banzai_email, "password": banzai_pass}, timeout=10)
        if r.status_code != 200:
            return jsonify({"ok": False, "error": "Credenciales de Banzai incorrectas"}), 401
        session["banzai_cookies"] = dict(r.cookies)
        session["banzai_connected"] = True
        session["banzai_email"] = banzai_email
        session["banzai_password"] = banzai_pass
        return jsonify({"ok": True, "message": "Conectado a Banzai ✓"})
    except Exception as e:
        return jsonify({"ok": False, "error": f"Banzai no disponible: {e}"}), 503


@app.get("/api/admin-status")
def admin_status():
    return jsonify({
        "ok": True,
        "admin_logged_in": bool(session.get("admin_logged_in")),
        "banzai_connected": bool(session.get("banzai_connected")),
        "banzai_online": banzai_connected(),
        "banzai_url": BANZAI_URL,
    })


@app.post("/api/admin-logout")
def admin_logout():
    session.clear()
    return jsonify({"ok": True})

@app.get("/api/proxy/industries")
def proxy_industries():
    r = banzai_api("GET", "/api/industries")
    return jsonify(r.json()), r.status_code

@app.post("/api/proxy/industries")
def proxy_industries_create():
    r = banzai_api("POST", "/api/industries", json=request.get_json(force=True))
    return jsonify(r.json()), r.status_code

@app.put("/api/proxy/industries/<slug>")
def proxy_industries_update(slug):
    r = banzai_api("PUT", f"/api/industries/{slug}", json=request.get_json(force=True))
    return jsonify(r.json()), r.status_code

@app.delete("/api/proxy/industries/<slug>")
def proxy_industries_delete(slug):
    r = banzai_api("DELETE", f"/api/industries/{slug}")
    return jsonify(r.json()), r.status_code

@app.get("/api/proxy/dashboard")
def proxy_dashboard():
    r = banzai_api("GET", "/api/dashboard")
    return jsonify(r.json()), r.status_code

@app.get("/api/proxy/reports")
def proxy_reports():
    r = banzai_api("GET", "/api/reports/summary")
    return jsonify(r.json()), r.status_code

@app.get("/api/proxy/agents/events")
def proxy_agent_events():
    r = banzai_api("GET", "/api/agents/events?limit=20")
    return jsonify(r.json()), r.status_code

@app.post("/api/proxy/agents/audit")
def proxy_audit():
    r = banzai_api("POST", "/api/agents/audit")
    return jsonify(r.json()), r.status_code

@app.get("/api/proxy/products")
def proxy_products():
    r = banzai_api("GET", "/api/products")
    return jsonify(r.json()), r.status_code

@app.get("/api/proxy/invoices")
def proxy_invoices():
    r = banzai_api("GET", "/api/invoices")
    return jsonify(r.json()), r.status_code

@app.post("/api/ai-chat")
def admin_ai_chat():
    """Admin AI — deep expert on Banzai and all business/sales/tech domains."""
    payload = request.get_json(force=True)
    message = payload.get("message", "").strip()
    history = payload.get("history", [])
    if not message:
        return jsonify({"ok": False, "error": "Message required"}), 400

    # ── Collect rich live context from ALL Banzai modules ──────────────────
    ctx = {}
    endpoints = [
        ("dashboard",   "GET", "/api/dashboard"),
        ("industries",  "GET", "/api/industries"),
        ("reports",     "GET", "/api/reports/summary"),
        ("pipeline",    "GET", "/api/pipeline"),
        ("goals",       "GET", "/api/goals"),
        ("automations", "GET", "/api/automations"),
        ("contacts",    "GET", "/api/contacts"),
        ("users",       "GET", "/api/users"),
        ("surveys",     "GET", "/api/surveys"),
        ("products",    "GET", "/api/products"),
        ("advisor",     "GET", "/api/advisor/insights"),
    ]
    for key, method, path in endpoints:
        try:
            r = banzai_api(method, path)
            if r.status_code == 200:
                ctx[key] = r.json()
        except Exception:
            pass

    # Build a rich context summary
    kpis   = ctx.get("dashboard", {}).get("dashboard", {}).get("kpis", {})
    pl     = ctx.get("reports", {}).get("pl", {})
    inds   = [i["slug"] for i in ctx.get("industries", {}).get("industries", [])]
    autos  = ctx.get("automations", {}).get("automations", [])
    goals  = ctx.get("goals", {}).get("goals", [])
    users  = ctx.get("users", {}).get("users", [])
    contacts_n = len(ctx.get("contacts", {}).get("contacts", []))
    products_n = len(ctx.get("products", {}).get("products", []))
    pipeline_stats = ctx.get("pipeline", {}).get("stats", {})
    advisor_insights = ctx.get("advisor", {}).get("rule_insights", [])

    live_summary = (
        f"KPIs: conversaciones={kpis.get('open_chats',0)}, ingresos={kpis.get('income',0)}, gastos={kpis.get('expenses',0)}, neto={kpis.get('net',0)}\n"
        f"P&L: ingresos={pl.get('income',0)}, gastos={pl.get('expenses',0)}, margen={pl.get('margin_pct',0)}%\n"
        f"Pipeline: {pipeline_stats.get('total_cards',0)} oportunidades, valor={pipeline_stats.get('total_value',0)}, win_rate={pipeline_stats.get('win_rate',0)}%\n"
        f"Rubros del agente ({len(inds)}): {', '.join(inds[:15])}\n"
        f"Automatizaciones activas: {sum(1 for a in autos if a.get('active'))} de {len(autos)}\n"
        f"Objetivos activos: {len(goals)}\n"
        f"Usuarios: {len(users)} ({', '.join(set(u['role'] for u in users))})\n"
        f"Contactos: {contacts_n} | Productos: {products_n}\n"
        f"Insights del asesor IA: {[i['title'] for i in advisor_insights[:3]]}\n"
    )

    openai_key = os.environ.get("OPENAI_API_KEY", "")
    if not openai_key:
        # Rule-based fallback — still very useful
        fallback = generate_rule_based_response(message, ctx)
        return jsonify({"ok": True, "reply": fallback, "source": "rule_based"})

    try:
        import openai as _openai
        client = _openai.OpenAI(api_key=openai_key)
        system = (
            "Sos el experto de negocios más completo del mundo, integrado en Banzai Admin. "
            "Tenés conocimiento profundo de todas las áreas de negocios y además sos el arquitecto de Banzai — conocés cada línea de código, cada feature, cada integración.\n\n"

            "TU CONOCIMIENTO CUBRE:\n"
            "VENTAS: SPIN selling, Challenger Sale, value-based selling, BANT, MEDDIC, SNAP, GAP selling, negociación Harvard, psicología de precios, cierre de ventas, manejo de objeciones, prospecting, SDR/AE structure\n"
            "MARKETING: funnel de conversión, CAC, LTV, churn, NPS, cohort analysis, growth hacking, content marketing, SEO/SEM, email marketing, social selling, ABM, product-led growth\n"
            "FINANZAS: P&L, balance, flujo de caja, EBITDA, ROI, IRR, NPV, punto de equilibrio, análisis de márgenes, valoración de empresas, due diligence, estructura de capital, venture debt\n"
            "OPERACIONES: lean manufacturing, Six Sigma, OKRs, KPIs, gestión de inventario, supply chain, automatización de procesos, BPO, outsourcing estratégico\n"
            "TECNOLOGÍA: SaaS metrics, arquitectura de software, APIs, integraciones, seguridad, GDPR/LGPD, cloud, AI/ML para negocios\n"
            "ESTRATEGIA: Porter 5 fuerzas, canvas de modelo de negocio, océano azul, disruption, product-market fit, go-to-market, pricing strategy, competitive intelligence\n"
            "RRHH: estructura de incentivos, comisiones, onboarding, retención, cultura, employer branding, performance management\n"
            "LEGAL/FISCAL: contratos, compliance, facturación electrónica, AFIP (AR), IRS (US), Receita Federal (BR), SII (CL), SAT (MX), estructuras societarias, propiedad intelectual\n"
            "LATAM: mercados emergentes, inflación, volatilidad cambiaria, ecosistema emprendedor, programas de financiamiento, fintechs LATAM\n\n"

            "BANZAI — CONOCÉS CADA MÓDULO:\n"
            "- Sales Agent: detecta intención, negocia con márgenes configurables, 30+ rubros, playbooks por industria\n"
            "- Accounting Agent: cierre de deal → factura fiscal → ledger en transacción atómica, compliance AFIP/IRS/Receita\n"
            "- Auditor Agent: escanea orphan deals, comisiones pendientes, facturas sin impuesto\n"
            "- Pipeline Kanban: visual, por etapas, con probabilidad y valor ponderado\n"
            "- Automatizaciones: 8 triggers × 6 acciones, no-code\n"
            "- Objetivos: KPI tracker con progreso en tiempo real\n"
            "- Contactos 360°: perfil completo con deals, facturas, NPS, conversaciones\n"
            "- Asesor IA: insights semanales accionables de todos los datos\n"
            "- Broadcast: mensajes masivos personalizados por WhatsApp o interno\n"
            "- Sistema de roles: owner/seller/viewer/demo con permisos granulares\n"
            "- Facturación propia: planes, pagos manuales, Stripe, MercadoPago\n"
            "- Encuestas + activación de updates: feedback loop con aprobación manual\n\n"

            "CAPACIDADES EN ESTA SESIÓN:\n"
            "1. Crear rubros de industria: generás JSON completo listo para aplicar con 1 click\n"
            "2. Analizar el negocio: interpretás los datos en vivo y dás recomendaciones\n"
            "3. Diseñar automatizaciones: describís el trigger + acción + configuración JSON\n"
            "4. Estrategia de ventas: scripts, objeciones, pricing, segmentación\n"
            "5. Asesoría financiera: análisis de P&L, proyecciones, estructura de costos\n"
            "6. Troubleshooting técnico: explicás cómo funciona cualquier parte de Banzai\n"
            "7. Diseño de objetivos: definís métricas, targets y períodos\n\n"

            "FORMATO CUANDO GENERÁS RUBROS:\n"
            "```json\n"
            "{\n"
            '  "slug": "nombre_sin_espacios",\n'
            '  "name": "Nombre visible",\n'
            '  "tactics": ["táctica específica 1", "táctica 2", "táctica 3"],\n'
            '  "objections": {"caro": "respuesta concreta", "lo pienso": "respuesta"},\n'
            '  "upsell": "frase de upsell específica",\n'
            '  "kpis": ["kpi 1", "kpi 2", "kpi 3"],\n'
            '  "keywords": ["keyword1", "keyword2", "keyword3"]\n'
            "}\n"
            "```\n\n"

            f"DATOS EN VIVO DE BANZAI:\n{live_summary}\n\n"
            "Respondé siempre en español. Sé directo, específico y accionable. "
            "Si hay datos en vivo disponibles, úsalos para personalizar tu respuesta. "
            "Cuando generes JSON de rubros, incluilos en bloques de código para que el botón 'Aplicar' funcione."
        )

        msgs = [{"role": "system", "content": system}]
        for h in history[-8:]:
            msgs.append({"role": h["role"], "content": h["content"]})
        msgs.append({"role": "user", "content": message})

        r = client.chat.completions.create(
            model=os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
            messages=msgs,
            max_tokens=800,
            temperature=0.7
        )
        reply = r.choices[0].message.content or "Sin respuesta."
        return jsonify({"ok": True, "reply": reply, "source": "openai"})
    except Exception as e:
        fallback = generate_rule_based_response(message, ctx)
        return jsonify({"ok": True, "reply": fallback + f"\n\n_(Error OpenAI: {e})_", "source": "rule_based"})


def generate_rule_based_response(message: str, ctx: dict) -> str:
    """Smart rule-based fallback when OpenAI is not configured."""
    msg_l = message.lower()
    pl = ctx.get("reports", {}).get("pl", {})
    pipeline = ctx.get("pipeline", {}).get("stats", {})
    inds = [i["slug"] for i in ctx.get("industries", {}).get("industries", [])]
    goals = ctx.get("goals", {}).get("goals", [])

    if any(w in msg_l for w in ["rubro", "industria", "crear rubro"]):
        return (
            "Para crear un rubro nuevo necesitás este JSON (podés editarlo y usar el botón Aplicar):\n\n"
            "```json\n{\n"
            '  "slug": "tu_rubro",\n'
            '  "name": "Nombre del Rubro",\n'
            '  "tactics": ["táctica 1", "táctica 2", "táctica 3"],\n'
            '  "objections": {"caro": "Reencuadrá en ROI", "lo pienso": "¿Qué info falta para decidir?"},\n'
            '  "upsell": "El pack completo ahorra X%",\n'
            '  "kpis": ["conversión", "ticket promedio", "retención"],\n'
            '  "keywords": ["palabra clave 1", "palabra clave 2"]\n'
            "}\n```\n\n"
            f"Rubros actuales ({len(inds)}): {', '.join(inds[:10])}.\n"
            "Configurá OPENAI_API_KEY en el .env para que la IA genere el rubro completo automáticamente."
        )

    if any(w in msg_l for w in ["kpi", "negocio", "análisis", "como estoy", "cómo estoy"]):
        net = pl.get("net", 0)
        margin = pl.get("margin_pct", 0)
        win = pipeline.get("win_rate", 0)
        lines = ["📊 Resumen de tu negocio en vivo:\n"]
        lines.append(f"• Resultado neto: ${net:,.0f} ({margin}% de margen)")
        lines.append(f"• Pipeline: {pipeline.get('total_cards',0)} oportunidades | Win rate: {win}%")
        lines.append(f"• Revenue cerrado: ${pipeline.get('closed_value',0):,.0f}")
        if goals:
            on_track = [g for g in goals if g.get("on_track")]
            lines.append(f"• Objetivos: {len(on_track)} de {len(goals)} en camino")
        if net < 0:
            lines.append("\n⚠️ Flujo neto negativo. Revisá los gastos operativos en Finanzas → Libro contable.")
        elif margin < 20:
            lines.append("\n💡 Margen bajo. Considerá subir precios o reducir costos fijos.")
        else:
            lines.append("\n✓ Márgenes saludables. Enfocate en escalar el canal de adquisición.")
        lines.append("\nActivá OPENAI_API_KEY para análisis más profundos.")
        return "\n".join(lines)

    if any(w in msg_l for w in ["automatización", "automatizar", "workflow"]):
        return (
            "Las automatizaciones disponibles en Banzai son:\n\n"
            "TRIGGERS: deal_closed, deal_over_value, nps_low, nps_high, new_conversation, stock_low, invoice_issued, no_reply_24h\n\n"
            "ACCIONES: send_whatsapp, create_task, move_pipeline, send_survey, notify_owner, add_to_contacts\n\n"
            "Ejemplo útil — deal cerrado → tarea de seguimiento:\n"
            '```json\n{"title": "Seguimiento post-venta 7 días"}\n```\n\n'
            "Andá a Automatizaciones → Nueva automatización para configurarla."
        )

    if any(w in msg_l for w in ["venta", "cerrar", "cliente", "objeción", "script"]):
        return (
            "Estrategia de cierre rápido para Banzai:\n\n"
            "1. **Abrí con el dolor**: '¿Cuántas horas semanales pierde tu equipo en tareas administrativas?'\n"
            "2. **Demo en vivo**: mensaje entrante → agente negocia → factura emitida en segundos\n"
            "3. **ROI concreto**: 'Tu administrativo cuesta $X. Banzai cuesta $Y. Diferencia desde el mes 1.'\n"
            "4. **Oferta de cierre**: 'Setup esta semana, primera mensualidad a los 30 días si estás conforme'\n"
            "5. **Pregunta de cierre**: '¿Lo arrancamos esta semana o necesitás consultar algo más?'\n\n"
            "La objeción más común es precio. Respuesta: '¿Cuánto te cuesta no tenerlo?' y calculá el costo de oportunidad."
        )

    return (
        "Soy el asistente IA de Banzai Admin. Puedo ayudarte con:\n\n"
        "• **Crear rubros**: 'Creá un rubro para veterinarias'\n"
        "• **Analizar el negocio**: '¿Cómo está el negocio hoy?'\n"
        "• **Diseñar automatizaciones**: 'Qué automatizaciones me recomendás'\n"
        "• **Scripts de venta**: 'Dame un script para cerrar una distribuidora'\n"
        "• **Estrategia**: 'Cómo puedo llegar a $10.000 USD de MRR'\n\n"
        "Configurá OPENAI_API_KEY en el .env para respuestas generadas por GPT-4o-mini con acceso total a tus datos."
    )


@app.get("/api/proxy/billing/plans")
def proxy_billing_plans(): r=banzai_api("GET","/api/billing/plans"); return jsonify(r.json()),r.status_code

@app.post("/api/proxy/billing/plans")
def proxy_billing_plans_create(): r=banzai_api("POST","/api/billing/plans",json=request.get_json(force=True)); return jsonify(r.json()),r.status_code

@app.put("/api/proxy/billing/plans/<int:plan_id>")
def proxy_billing_plans_update(plan_id): r=banzai_api("PUT",f"/api/billing/plans/{plan_id}",json=request.get_json(force=True)); return jsonify(r.json()),r.status_code

@app.delete("/api/proxy/billing/plans/<int:plan_id>")
def proxy_billing_plans_delete(plan_id): r=banzai_api("DELETE",f"/api/billing/plans/{plan_id}"); return jsonify(r.json()),r.status_code

@app.get("/api/proxy/billing/payments")
def proxy_billing_payments(): r=banzai_api("GET","/api/billing/payments"); return jsonify(r.json()),r.status_code

@app.post("/api/proxy/billing/payments")
def proxy_billing_payments_create(): r=banzai_api("POST","/api/billing/payments",json=request.get_json(force=True)); return jsonify(r.json()),r.status_code

@app.get("/api/proxy/surveys")
def proxy_surveys(): r=banzai_api("GET","/api/surveys"); return jsonify(r.json()),r.status_code

@app.post("/api/proxy/surveys/send")
def proxy_surveys_send(): r=banzai_api("POST","/api/surveys/send",json=request.get_json(force=True)); return jsonify(r.json()),r.status_code

@app.post("/api/proxy/surveys/<int:sid>/activate")
def proxy_survey_activate(sid): r=banzai_api("POST",f"/api/surveys/{sid}/activate-update",json=request.get_json(force=True)); return jsonify(r.json()),r.status_code

@app.post("/api/proxy/surveys/<int:sid>/reject")
def proxy_survey_reject(sid): r=banzai_api("POST",f"/api/surveys/{sid}/reject-update",json=request.get_json(force=True)); return jsonify(r.json()),r.status_code

@app.get("/api/proxy/releases")
def proxy_releases(): r=banzai_api("GET","/api/releases"); return jsonify(r.json()),r.status_code

@app.post("/api/proxy/releases")
def proxy_releases_create(): r=banzai_api("POST","/api/releases",json=request.get_json(force=True)); return jsonify(r.json()),r.status_code


@app.get("/api/proxy/users")
def proxy_users(): r=banzai_api("GET","/api/users"); return jsonify(r.json()),r.status_code

@app.post("/api/proxy/users/invite")
def proxy_users_invite(): r=banzai_api("POST","/api/users/invite",json=request.get_json(force=True)); return jsonify(r.json()),r.status_code

@app.put("/api/proxy/users/<int:uid>")
def proxy_users_update(uid): r=banzai_api("PUT",f"/api/users/{uid}",json=request.get_json(force=True)); return jsonify(r.json()),r.status_code

@app.get("/api/proxy/users/<int:uid>/activity")
def proxy_user_activity(uid): r=banzai_api("GET",f"/api/users/{uid}/activity"); return jsonify(r.json()),r.status_code

@app.get("/api/proxy/access-log")
def proxy_access_log(): r=banzai_api("GET","/api/access-log"); return jsonify(r.json()),r.status_code


# ── Pipeline proxies ────────────────────────────────────────────────────────
@app.get("/api/proxy/pipeline")
def proxy_pipeline(): r=banzai_api("GET","/api/pipeline"); return jsonify(r.json()),r.status_code

@app.post("/api/proxy/pipeline/cards")
def proxy_pipeline_card_create(): r=banzai_api("POST","/api/pipeline/cards",json=request.get_json(force=True)); return jsonify(r.json()),r.status_code

@app.put("/api/proxy/pipeline/cards/<int:cid>")
def proxy_pipeline_card_update(cid): r=banzai_api("PUT",f"/api/pipeline/cards/{cid}",json=request.get_json(force=True)); return jsonify(r.json()),r.status_code

@app.delete("/api/proxy/pipeline/cards/<int:cid>")
def proxy_pipeline_card_delete(cid): r=banzai_api("DELETE",f"/api/pipeline/cards/{cid}"); return jsonify(r.json()),r.status_code

# ── Goals proxies ───────────────────────────────────────────────────────────
@app.get("/api/proxy/goals")
def proxy_goals(): r=banzai_api("GET","/api/goals"); return jsonify(r.json()),r.status_code

@app.post("/api/proxy/goals")
def proxy_goals_create(): r=banzai_api("POST","/api/goals",json=request.get_json(force=True)); return jsonify(r.json()),r.status_code

@app.delete("/api/proxy/goals/<int:gid>")
def proxy_goals_delete(gid): r=banzai_api("DELETE",f"/api/goals/{gid}"); return jsonify(r.json()),r.status_code

# ── Contacts proxies ────────────────────────────────────────────────────────
@app.get("/api/proxy/contacts")
def proxy_contacts(): r=banzai_api("GET","/api/contacts"); return jsonify(r.json()),r.status_code

@app.post("/api/proxy/contacts")
def proxy_contacts_create(): r=banzai_api("POST","/api/contacts",json=request.get_json(force=True)); return jsonify(r.json()),r.status_code

@app.get("/api/proxy/contacts/<int:cid>")
def proxy_contact_detail(cid): r=banzai_api("GET",f"/api/contacts/{cid}"); return jsonify(r.json()),r.status_code

@app.post("/api/proxy/contacts/sync")
def proxy_contacts_sync(): r=banzai_api("POST","/api/contacts/sync",json={}); return jsonify(r.json()),r.status_code

# ── Automations proxies ─────────────────────────────────────────────────────
@app.get("/api/proxy/automations")
def proxy_automations(): r=banzai_api("GET","/api/automations"); return jsonify(r.json()),r.status_code

@app.post("/api/proxy/automations")
def proxy_automations_create(): r=banzai_api("POST","/api/automations",json=request.get_json(force=True)); return jsonify(r.json()),r.status_code

@app.put("/api/proxy/automations/<int:aid>")
def proxy_automations_update(aid): r=banzai_api("PUT",f"/api/automations/{aid}",json=request.get_json(force=True)); return jsonify(r.json()),r.status_code

@app.delete("/api/proxy/automations/<int:aid>")
def proxy_automations_delete(aid): r=banzai_api("DELETE",f"/api/automations/{aid}"); return jsonify(r.json()),r.status_code

# ── Advisor + broadcast proxies ─────────────────────────────────────────────
@app.get("/api/proxy/advisor")
def proxy_advisor(): r=banzai_api("GET","/api/advisor/insights"); return jsonify(r.json()),r.status_code

@app.post("/api/proxy/broadcast")
def proxy_broadcast(): r=banzai_api("POST","/api/broadcast",json=request.get_json(force=True)); return jsonify(r.json()),r.status_code

@app.get("/api/proxy/broadcast/history")
def proxy_broadcast_history(): r=banzai_api("GET","/api/broadcast/history"); return jsonify(r.json()),r.status_code


@app.post("/api/proxy/users/quick-create")
def proxy_users_quick_create():
    r = banzai_api("POST", "/api/users/quick-create", json=request.get_json(force=True))
    return jsonify(r.json()), r.status_code


# ── Update System ──────────────────────────────────────────────────────────────

@app.get("/api/updates/status")
def updates_status():
    if not session.get("admin_logged_in"):
        return jsonify({"ok": False, "error": "Unauthorized"}), 401
    return jsonify({
        "ok": True,
        "github_configured": bool(os.environ.get("GITHUB_TOKEN") and os.environ.get("GITHUB_REPO","twilliamsfritz-alt/banzai84")),
        "railway_configured": bool(os.environ.get("RAILWAY_DEPLOY_WEBHOOK","")),
        "github_repo": os.environ.get("GITHUB_REPO","twilliamsfritz-alt/banzai84"),
    })


@app.post("/api/updates/save-config")
def updates_save_config():
    if not session.get("admin_logged_in"):
        return jsonify({"ok": False, "error": "Unauthorized"}), 401
    p = request.get_json(force=True) or {}
    for k,v in [("GITHUB_TOKEN",p.get("github_token")),("GITHUB_REPO",p.get("github_repo")),
                ("RAILWAY_DEPLOY_WEBHOOK",p.get("railway_webhook")),("OPENAI_API_KEY",p.get("openai_key"))]:
        if v: os.environ[k] = v
    return jsonify({"ok": True, "message": "Configuracion guardada"})


@app.get("/api/updates/file")
def updates_get_file():
    if not session.get("admin_logged_in"):
        return jsonify({"ok": False, "error": "Unauthorized"}), 401
    fp = request.args.get("path", "app.py")
    tok = os.environ.get("GITHUB_TOKEN", "")
    repo = os.environ.get("GITHUB_REPO","twilliamsfritz-alt/banzai84")
    if not tok: return jsonify({"ok": False, "error": "GITHUB_TOKEN no configurado"}), 400
    try:
        import base64 as b64
        r = req.get(f"https://api.github.com/repos/{repo}/contents/{fp}",
                    headers={"Authorization": f"token {tok}", "User-Agent": "banzai-admin"}, timeout=10)
        if r.status_code != 200: return jsonify({"ok": False, "error": f"Error {r.status_code}"}), 500
        data = r.json()
        return jsonify({"ok": True, "content": b64.b64decode(data["content"]).decode("utf-8","replace"), "sha": data["sha"]})
    except Exception as e: return jsonify({"ok": False, "error": str(e)}), 500


@app.post("/api/updates/generate")
def updates_generate():
    if not session.get("admin_logged_in"):
        return jsonify({"ok": False, "error": "Unauthorized"}), 401
    p = request.get_json(force=True) or {}
    desc = p.get("description","").strip()
    fp = p.get("file_path","app.py")
    content = p.get("current_content","")
    if not desc: return jsonify({"ok": False, "error": "Descripcion requerida"}), 400
    key = os.environ.get("OPENAI_API_KEY", OPENAI_API_KEY)
    if not key: return jsonify({"ok": False, "error": "OpenAI API key no configurada"}), 400
    preview = (content[:5000] + "\n# ... [TRUNCATED] ...\n" + content[-2000:]) if len(content) > 8000 else content
    lang = "Python/Flask" if fp.endswith(".py") else "JavaScript"
    sys_msg = ("Sos un experto en " + lang + " que trabaja en Banzai84. Tu tarea: modificar " + fp +
               " segun instrucciones. Devuelve SOLO el codigo completo modificado, sin markdown ni backticks.")
    user_msg = "Archivo (" + fp + "):\n" + preview + "\n\n---\nCAMBIO: " + desc
    try:
        import openai as oai
        client = oai.OpenAI(api_key=key)
        resp = client.chat.completions.create(model="gpt-4o-mini",
            messages=[{"role":"system","content":sys_msg},{"role":"user","content":user_msg}],
            max_tokens=4000, temperature=0.1)
        code_out = resp.choices[0].message.content.strip()
        if code_out.startswith("```"): code_out = "\n".join(code_out.split("\n")[1:])
        if code_out.endswith("```"): code_out = "\n".join(code_out.split("\n")[:-1])
        return jsonify({"ok": True, "code": code_out, "file_path": fp})
    except Exception as e: return jsonify({"ok": False, "error": str(e)}), 500


@app.post("/api/updates/deploy")
def updates_deploy():
    if not session.get("admin_logged_in"):
        return jsonify({"ok": False, "error": "Unauthorized"}), 401
    p = request.get_json(force=True) or {}
    code_in = p.get("code","").strip()
    fp = p.get("file_path","app.py")
    msg = p.get("message","Update via Banzai Admin").strip()
    if not code_in: return jsonify({"ok": False, "error": "Codigo requerido"}), 400
    tok = os.environ.get("GITHUB_TOKEN","")
    repo = os.environ.get("GITHUB_REPO","twilliamsfritz-alt/banzai84")
    if not tok: return jsonify({"ok": False, "error": "GITHUB_TOKEN no configurado"}), 400
    try:
        import base64 as b64
        r = req.get(f"https://api.github.com/repos/{repo}/contents/{fp}",
                    headers={"Authorization": f"token {tok}", "User-Agent": "banzai-admin"}, timeout=10)
        if r.status_code != 200: return jsonify({"ok": False, "error": f"No se pudo leer {fp}: {r.status_code}"}), 500
        sha = r.json()["sha"]
        encoded = b64.b64encode(code_in.encode("utf-8")).decode("utf-8")
        pr = req.put(f"https://api.github.com/repos/{repo}/contents/{fp}",
                     headers={"Authorization": f"token {tok}", "User-Agent": "banzai-admin"},
                     json={"message": msg, "content": encoded, "sha": sha}, timeout=15)
        if pr.status_code not in (200,201): return jsonify({"ok": False, "error": f"GitHub {pr.status_code}: {pr.text[:200]}"}), 500
        webhook = os.environ.get("RAILWAY_DEPLOY_WEBHOOK","")
        triggered = False
        if webhook:
            try: triggered = req.post(webhook, timeout=5).status_code < 300
            except Exception: pass
        return jsonify({"ok": True, "message": "Actualizado: " + fp, "railway_triggered": triggered,
                        "commit_url": pr.json().get("commit",{}).get("html_url","")})
    except Exception as e: return jsonify({"ok": False, "error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("ADMIN_PORT", 5001))
    print(f"Banzai Admin arrancando en http://127.0.0.1:{port}")
    print(f"Conectado a Banzai en {BANZAI_URL}")
    app.run(host="0.0.0.0", port=port, debug=False)
