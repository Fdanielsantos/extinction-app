"""
Serviço de inferência RF018 -- classificação de espécie via BioCLIP 2
(hf-hub:imageomics/bioclip-2, https://huggingface.co/imageomics/bioclip-2), rodando
localmente no lado servidor (chamado pelo backend Java via HTTP, não pelo
cliente/app). Substitui o classificador TensorFlow treinado localmente (ver
com.extinction.api.ai.BioClipModel no backend e ml/README.md para o pipeline antigo).

Usa a lib oficial `pybioclip` (TreeOfLifeClassifier), que já vem com embeddings de
texto pré-calculados pra milhões de espécies (Tree of Life) -- não depende de uma
lista de candidatas própria do projeto nem calcula nada localmente na primeira
execução, só baixa os embeddings prontos do Hugging Face Hub (cacheados depois).

Nota: a lib pybioclip (até a versão atual) só tem esses embeddings prontos pras
versões `bioclip` (v1) e `bioclip-2` -- não pro checkpoint mais novo
`bioclip-2.5-vith14`, que não tem taxonomia embutida disponível. Optou-se por usar
`bioclip-2` (com taxonomia embutida) em vez do 2.5-vith14 (sem taxonomia embutida,
exigiria manter uma lista de candidatas nossa e recalcular embeddings localmente).

Rodar:
    pip install -r requirements.txt
    uvicorn main:app --host 0.0.0.0 --port 8000
"""

import io
import logging

from bioclip import Rank, TreeOfLifeClassifier
from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("bioclip_service")

MODEL_STR = "hf-hub:imageomics/bioclip-2"
TOP_K = 5

app = FastAPI(title="BioCLIP species identification service")

_estado = {}


class Predicao(BaseModel):
    nome_cientifico: str
    confianca_percentual: float


@app.on_event("startup")
def carregar_modelo() -> None:
    import torch

    device = "cuda" if torch.cuda.is_available() else "cpu"
    log.info("BioCLIP: carregando %s em %s (taxonomia embutida)", MODEL_STR, device)
    _estado["classifier"] = TreeOfLifeClassifier(model_str=MODEL_STR, device=device)
    _estado["device"] = device
    log.info("BioCLIP: pronto")


@app.get("/health")
def health():
    return {"status": "ok" if "classifier" in _estado else "carregando", "device": _estado.get("device")}


@app.post("/identificar", response_model=list[Predicao])
async def identificar(imagem: UploadFile = File(...)):
    if "classifier" not in _estado:
        raise HTTPException(status_code=503, detail="Modelo ainda carregando")

    conteudo = await imagem.read()
    try:
        img = Image.open(io.BytesIO(conteudo)).convert("RGB")
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Imagem inválida") from exc

    # predict() espera uma lista de imagens (itera sobre `images`) -- passar um
    # único PIL.Image direto quebra com "'Image' object is not iterable".
    predicoes = _estado["classifier"].predict([img], Rank.SPECIES, k=TOP_K)

    return [
        Predicao(
            nome_cientifico=p["species"],
            confianca_percentual=round(p["score"] * 100, 2),
        )
        for p in predicoes
    ]
