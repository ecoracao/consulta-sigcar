from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from consulta_sigcar_core import consultar_sigcar

app = FastAPI(title="Consulta SIGCAR - Tocantins")

# static e templates
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/api/consulta")
def api_consulta(sigcar: str, ano: str = ""):
    sigcar = (sigcar or "").strip()
    if not sigcar:
        return JSONResponse(
            status_code=400,
            content={"ok": False, "erro": "SIGCAR é obrigatório."},
        )

    ano = (ano or "").strip()
    ano_int = int(ano) if ano.isdigit() else None

    try:
        resultado = consultar_sigcar(sigcar, ano=ano_int)
        return {"ok": True, "resultado": resultado}
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"ok": False, "erro": f"Erro interno: {str(e)}"},
        )
