# Banzai Admin

Panel de administración standalone para gestionar Banzai desde una interfaz separada.

## Requisitos
- Banzai corriendo en http://127.0.0.1:5000
- Python 3.10+

## Instalación

```bash
cd banzai_admin
py -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # Mac/Linux
pip install -r requirements.txt
py admin.py
```

## Uso

1. Abrí http://127.0.0.1:5001
2. Ingresá con las mismas credenciales de tu workspace en Banzai
3. Desde "Rubros del Agente" podés agregar/editar los 30+ rubros del Sales Agent
4. Desde "IA Asistente" podés pedirle a la IA que cree rubros y los aplique con un click

## Configuración OPENAI (opcional pero recomendado)

Copiá .env.example a .env y agregá tu OPENAI_API_KEY para activar el asistente IA.
