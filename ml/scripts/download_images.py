#!/usr/bin/env python3
"""Baixa as imagens listadas em image_manifest.jsonl (gerado por map_species_images.py).

Entrada: o .jsonl com uma linha por imagem (identifier = URL, gbifTaxonKey = classe,
occurrenceKey, acceptedScientificName/queriedScientificName).

Saida:
  - <output-dir>/<gbifTaxonKey>/<occurrenceKey>_<hash>.<ext>  (imagem validada)
  - <log>  (default: irmao do output-dir, download_log.csv) com uma linha por imagem
    tentada: identifier, gbifTaxonKey, scientificName, occurrenceKey, localPath,
    status (ok/falha), erro. E' esse CSV que o train_model.py consome depois.

As URLs vem de dezenas de hosts diferentes (GBIF, JBRJ, NYBG, Kew, iNaturalist, ...),
entao o rate limit e' por host (nao um global como na API do GBIF) — isso permite
bem mais paralelismo real sem ser deselegante com nenhum host individual.

Cada download e' validado com Pillow (abrir + verify()) antes de ser gravado como
'ok' — bastante URL de ocorrencia cientifica aponta pra paginas de erro/placeholder
que respondem 200 com HTML, e isso nao pode virar uma classe de treino.

Antes de gravar, a imagem e' redimensionada (lado maior <= --max-dimension, default
800px) e recomprimida como JPEG (--jpeg-quality, default 85) — sem isso, um dataset
de scans de herbario/museu em altissima resolucao facilmente passa de 500GB pra
~200 mil imagens, e o treino so usa 224x224 mesmo. Isso NAO reduz o tempo de
download (os bytes originais ainda precisam ser baixados da rede antes de poder
redimensionar), so o espaco em disco.

Uso:
    python download_images.py --manifest ml/data/image_manifest.jsonl
    python download_images.py --manifest ml/data/image_manifest.jsonl --limit 200   # smoke test
    python download_images.py --manifest ml/data/image_manifest.jsonl --resume
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Optional
from urllib.parse import urlsplit

import requests
from PIL import Image, UnidentifiedImageError
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

REQUEST_TIMEOUT = 20
MIN_BYTES = 512
MIN_DIMENSION = 32


class PerHostRateLimiter:
    """Um intervalo minimo entre requisicoes por host (nao global) — imagens vem de
    dezenas de servidores diferentes, entao throttling global desperdicaria paralelismo
    real sem necessidade."""

    def __init__(self, min_interval: float):
        self._min_interval = min_interval
        self._lock = threading.Lock()
        self._last_by_host: dict[str, float] = {}

    def wait(self, host: str) -> None:
        with self._lock:
            now = time.monotonic()
            last = self._last_by_host.get(host, 0.0)
            delay = last + self._min_interval - now
            if delay > 0:
                time.sleep(delay)
            self._last_by_host[host] = time.monotonic()


def build_session(pool_size: int) -> requests.Session:
    session = requests.Session()
    session.headers.update({"User-Agent": "extinction-app-dataset-builder/1.0"})
    retry = Retry(
        total=3,
        backoff_factor=1.0,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET"],
        respect_retry_after_header=True,
    )
    adapter = HTTPAdapter(max_retries=retry, pool_connections=pool_size, pool_maxsize=pool_size)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session


def safe_print(*args, **kwargs) -> None:
    try:
        print(*args, **kwargs)
    except UnicodeEncodeError:
        stream = kwargs.get("file", sys.stdout)
        safe_args = [str(a).encode("utf-8", errors="replace").decode("utf-8", errors="replace") for a in args]
        print(*safe_args, **{**kwargs, "file": stream})


def read_manifest(path: Path) -> list[dict]:
    records = []
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                records.append(json.loads(line))
    return records


def read_already_done(log_path: Path) -> set[str]:
    if not log_path.exists():
        return set()
    done: set[str] = set()
    with log_path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("status") == "ok":
                done.add(row["identifier"])
    return done


def download_one(
    session: requests.Session,
    record: dict,
    output_dir: Path,
    rate_limiter: PerHostRateLimiter,
    max_dimension: int,
    jpeg_quality: int,
) -> dict:
    identifier = record["identifier"]
    taxon_key = record.get("gbifTaxonKey")
    occurrence_key = record.get("occurrenceKey")
    scientific_name = record.get("acceptedScientificName") or record.get("queriedScientificName") or ""

    result = {
        "identifier": identifier,
        "gbifTaxonKey": taxon_key,
        "scientificName": scientific_name,
        "occurrenceKey": occurrence_key,
        "localPath": "",
        "status": "falha",
        "erro": "",
    }

    host = urlsplit(identifier).netloc
    try:
        rate_limiter.wait(host)
        resp = session.get(identifier, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        content = resp.content

        if len(content) < MIN_BYTES:
            result["erro"] = "arquivo_pequeno_demais"
            return result

        try:
            probe = Image.open(io.BytesIO(content))
            width, height = probe.size
            probe.verify()
        except (UnidentifiedImageError, OSError) as exc:
            result["erro"] = f"nao_e_imagem_valida: {exc}"
            return result

        if width < MIN_DIMENSION or height < MIN_DIMENSION:
            result["erro"] = f"dimensao_minima ({width}x{height})"
            return result

        # Pillow invalida o objeto apos verify() -- reabre pra poder redimensionar/salvar.
        img = Image.open(io.BytesIO(content))
        img = img.convert("RGB")
        img.thumbnail((max_dimension, max_dimension), Image.LANCZOS)

        digest = hashlib.md5(identifier.encode("utf-8")).hexdigest()[:8]
        class_dir = output_dir / str(taxon_key)
        class_dir.mkdir(parents=True, exist_ok=True)
        local_path = class_dir / f"{occurrence_key}_{digest}.jpg"
        img.save(local_path, format="JPEG", quality=jpeg_quality, optimize=True)

        result["localPath"] = str(local_path)
        result["status"] = "ok"
        return result
    except requests.RequestException as exc:
        result["erro"] = f"erro_rede: {exc}"
        return result
    except Exception as exc:  # nunca deixar uma excecao inesperada matar o worker
        result["erro"] = f"erro_inesperado: {exc!r}"
        return result


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--manifest", required=True, type=Path, help="image_manifest.jsonl gerado por map_species_images.py")
    parser.add_argument("--output-dir", default=Path("ml/data/images"), type=Path, help="Diretorio onde salvar as imagens (default: ml/data/images)")
    parser.add_argument("--log", default=None, type=Path, help="CSV de resultado (default: <output-dir>/../download_log.csv)")
    parser.add_argument("--limit", type=int, default=None, help="Baixar so os N primeiros registros do manifesto (smoke test)")
    parser.add_argument("--resume", action="store_true", help="Pular identifiers ja marcados 'ok' no log existente")
    parser.add_argument("--workers", type=int, default=32, help="Threads concorrentes (default: 32) — imagens vem de muitos hosts, entao mais paralelismo e' seguro aqui")
    parser.add_argument("--rate-per-host", type=float, default=3.0, help="Max requisicoes/segundo POR HOST (default: 3.0)")
    parser.add_argument("--max-dimension", type=int, default=800, help="Lado maior da imagem apos redimensionar, em px (default: 800)")
    parser.add_argument("--jpeg-quality", type=int, default=85, help="Qualidade JPEG na gravacao (default: 85)")
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    log_path = args.log or (args.output_dir.parent / "download_log.csv")

    records = read_manifest(args.manifest)
    print(f"{len(records)} imagens no manifesto")

    already_done: set[str] = set()
    if args.resume:
        already_done = read_already_done(log_path)
        records = [r for r in records if r["identifier"] not in already_done]
        print(f"Retomando: {len(already_done)} ja baixadas com sucesso, {len(records)} restantes")

    if args.limit is not None:
        records = records[: args.limit]
        print(f"--limit aplicado: processando {len(records)} registros")

    session = build_session(pool_size=args.workers)
    rate_limiter = PerHostRateLimiter(min_interval=1.0 / args.rate_per_host)

    file_mode = "a" if args.resume and already_done else "w"
    write_header = file_mode == "w"
    write_lock = threading.Lock()

    ok_count = 0
    completed = 0
    total = len(records)
    started = time.monotonic()

    with log_path.open(file_mode, newline="", encoding="utf-8") as log_f:
        writer = csv.DictWriter(log_f, fieldnames=["identifier", "gbifTaxonKey", "scientificName", "occurrenceKey", "localPath", "status", "erro"])
        if write_header:
            writer.writeheader()
            log_f.flush()

        with ThreadPoolExecutor(max_workers=args.workers) as executor:
            futures = {
                executor.submit(download_one, session, r, args.output_dir, rate_limiter, args.max_dimension, args.jpeg_quality): r
                for r in records
            }

            for future in as_completed(futures):
                try:
                    result = future.result()
                except Exception as exc:
                    r = futures[future]
                    safe_print(f"ERRO FATAL NAO TRATADO em '{r.get('identifier')}': {exc!r}", file=sys.stderr)
                    result = {**r, "localPath": "", "status": "falha", "erro": f"erro_fatal: {exc!r}"}

                completed += 1
                if result["status"] == "ok":
                    ok_count += 1

                with write_lock:
                    writer.writerow(result)
                    if completed % 50 == 0:
                        log_f.flush()

                if completed % 250 == 0 or completed == total:
                    elapsed = time.monotonic() - started
                    rate = completed / elapsed if elapsed > 0 else 0
                    safe_print(f"[{completed}/{total}] ok={ok_count} ({rate:.1f} img/s)")

    print(f"\n{ok_count}/{total} imagens baixadas e validadas com sucesso (nesta execucao).")
    print(f"Log: {log_path}")
    print(f"Imagens: {args.output_dir}")


if __name__ == "__main__":
    main()
