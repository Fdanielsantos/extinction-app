# ML — reconhecimento de imagem (RF018)

Pipeline em 3 scripts, cada um consumindo a saída do anterior:

1. `scripts/map_species_images.py` -> gera `data/image_manifest.jsonl` (URLs de imagem por espécie, via GBIF)
2. `scripts/download_images.py` -> baixa as imagens do manifest -> `data/download_log.csv` + `data/images/<taxonKey>/...`
3. `scripts/train_model.py` -> treina o classificador (transfer learning) -> `model/saved_model/`, `model/synset.txt`, `model/labels.csv`

`data/image_manifest.jsonl` e `data/download_log.csv` ficam versionados no git (são pequenos,
texto). `data/images/` (as imagens em si) e `model/` (checkpoints/modelo treinado) **não** ficam
— estão no `.gitignore` porque são pesados demais pro GitHub. Isso significa que dar `git clone`
no repo te dá o código e os metadados, mas não os dados nem o modelo treinado — veja abaixo como
obter cada um.

## Setup rápido (CPU, Windows nativo)

Ver docstring de `scripts/train_model.py` — resumo:

```
py -3.13 -m venv C:/mlvenvs/extinction-ml
C:/mlvenvs/extinction-ml/Scripts/pip install -r ml/requirements.txt
C:/mlvenvs/extinction-ml/Scripts/python ml/scripts/train_model.py --download-log ml/data/download_log.csv
```

Lento (horas a dias com milhares de classes) porque roda 100% em CPU — ver seção de GPU abaixo se
você tiver uma placa NVIDIA.

## Rodando com GPU NVIDIA (bem mais rápido — recomendado se disponível)

TensorFlow >= 2.11 não tem mais binário Windows nativo com suporte a GPU (só CPU). O caminho
oficial hoje é **WSL2** (mesmo em placas NVIDIA topo de linha) — o driver continua sendo o do
Windows, o WSL2 só expõe a GPU pro Linux por baixo.

**1. Instalar o WSL2** (uma vez só, PowerShell como administrador):

```powershell
wsl --install
```

Reinicia a máquina se pedir. Isso já instala Ubuntu por padrão.

**2. Confirmar que a GPU aparece dentro do WSL2** — abra o terminal "Ubuntu" (menu Iniciar) e rode:

```bash
nvidia-smi
```

Deve listar sua placa (ex: RTX 5060). **Não instale um driver NVIDIA dentro do Linux** — o WSL2
usa o driver que já está instalado no Windows. Se `nvidia-smi` não achar a placa, atualize o
driver NVIDIA no Windows (versão de 2025 ou mais recente, pra suportar placas Blackwell/RTX 50)
e reinicie o WSL2 com `wsl --shutdown` no PowerShell antes de tentar de novo.

**3. Clonar o repo dentro do filesystem nativo do WSL2** (não em `/mnt/c/...`) — evita a
lentidão de I/O de acessar NTFS via WSL2 e o limite de 260 caracteres de path do Windows que já
nos mordeu ao instalar o TensorFlow direto no Windows:

```bash
cd ~
git clone https://github.com/Fdanielsantos/extinction-app.git
cd extinction-app
```

**4. Criar o venv e instalar as dependências com suporte a GPU:**

```bash
python3 -m venv ~/mlvenvs/extinction-ml
source ~/mlvenvs/extinction-ml/bin/activate
pip install -r ml/requirements.txt
pip install "tensorflow[and-cuda]"
```

(`tensorflow[and-cuda]` traz o CUDA/cuDNN certinho via pip, sem precisar instalar toolkit CUDA
separado no sistema.)

**5. Confirmar que o TensorFlow está enxergando a GPU** antes de rodar qualquer treino longo:

```bash
python -c "import tensorflow as tf; print(tf.config.list_physical_devices('GPU'))"
```

Deve imprimir algo como `[PhysicalDevice(name='/physical_device:GPU:0', device_type='GPU')]`.
Lista vazia (`[]`) = caiu pra CPU, ver Troubleshooting abaixo.

**6. Baixar as imagens** (usa o manifest já versionado no repo — não precisa gerar de novo):

```bash
python ml/scripts/download_images.py --manifest ml/data/image_manifest.jsonl --resume
```

São ~200 mil imagens de dezenas de hosts diferentes, então isso demora dependendo da internet.
`--resume` é seguro rodar de novo se cair no meio.

**7. Rodar o treino:**

```bash
python ml/scripts/train_model.py --download-log ml/data/download_log.csv
```

### Troubleshooting

- `nvidia-smi` no WSL2 não lista a placa → atualizar o driver NVIDIA **no Windows** (não instalar
  driver Linux dentro do WSL2) e rodar `wsl --shutdown` no PowerShell antes de reabrir o terminal.
- `tf.config.list_physical_devices('GPU')` retorna `[]` mesmo com `nvidia-smi` ok → confirmar que
  instalou `tensorflow[and-cuda]` (não só `tensorflow` puro) e que a versão é >= 2.16.
- RTX 5060 é hardware bem recente (Blackwell) — se aparecer erro tipo "no kernel image is
  available for execution on the device", atualizar pra última versão do TensorFlow
  (`pip install -U "tensorflow[and-cuda]"`) e o driver NVIDIA pra versão mais recente.

## Retomando o treino de outra pessoa (`--resume`)

O `train_model.py` salva checkpoints em `model/checkpoint_head.keras` (fase 1) e
`model/checkpoint_finetune.keras` (fase 2) a cada época que melhora a métrica monitorada. Pra
continuar de onde alguém parou:

1. Pegue os arquivos `checkpoint_head.keras`/`checkpoint_finetune.keras` de quem estava treinando
   — **não vêm pelo git** (estão no `.gitignore`, são grandes demais). Combine a transferência por
   Drive/pendrive/rede local e coloque em `ml/model/` na mesma estrutura.
2. Rode com **exatamente os mesmos argumentos** da chamada original (mesmo `--download-log`,
   `--base-model`, `--img-size`, etc. — o checkpoint tem pesos específicos daquela config) mais
   `--resume`:
   ```bash
   python ml/scripts/train_model.py --download-log ml/data/download_log.csv --resume
   ```
3. Importante: isso continua o treino a partir dos pesos já aprendidos, mas **não** é uma
   retomada byte-a-byte — o otimizador é recriado do zero (perde o momentum acumulado do Adam) e
   as épocas voltam a contar de 0 até `--epochs` (roda mais N épocas em cima do que já foi
   aprendido, não "completa" o total original). Na prática funciona bem, só não espere que ele
   saiba exatamente "em que época parou".
4. Só existe checkpoint pra retomar se pelo menos uma época já tiver *terminado* e melhorado a
   métrica monitorada — não há checkpoint no meio de uma época.
