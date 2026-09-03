# bioclip_service (RF018)

Serviço local de inferência via [BioCLIP 2](https://huggingface.co/imageomics/bioclip-2)
(lib [`pybioclip`](https://imageomics.github.io/pybioclip/), `TreeOfLifeClassifier`),
chamado pelo backend Java (`com.extinction.api.ai.BioClipModel`) via HTTP. Substitui o
classificador TensorFlow antigo (`ml/scripts/train_model.py`) -- não é mais necessário
treinar nada, nem manter uma lista de espécies candidatas: o BioCLIP já vem com
taxonomia embutida (embeddings pré-calculados de milhões de espécies via pybioclip).

Rodar localmente:

```
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt   # .venv/bin/pip no Linux/macOS
.venv/Scripts/uvicorn main:app --host 0.0.0.0 --port 8000
```

Ou via Docker Compose (`backend/docker-compose.yml`, serviço `bioclip`).

Doc completa (arquitetura, decisões, troubleshooting) fica pra revisão posterior do
projeto -- isto aqui é só o essencial pra rodar.
