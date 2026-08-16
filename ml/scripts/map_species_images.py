#!/usr/bin/env python3
"""Mapeia quais especies de uma lista possuem imagens disponiveis no GBIF.

Entrada: um CSV (ex: exportado do ALA-BIE) com uma coluna de nome cientifico.
Saida (em --output-dir):
  - species_image_summary.csv: uma linha por especie, com quantidade de
    imagens encontradas e o taxon do GBIF casado (se houver).
  - image_manifest.jsonl: um registro por imagem encontrada (URL, licenca,
    autor, especie associada), para uso posterior no download real.

Fluxo por especie:
  1. species/match: resolve o nome (com ou sem autoria) para um taxonKey
     canonico no backbone taxonomico do GBIF.
  2. occurrence/search?taxonKey=...&mediaType=StillImage: busca ocorrencias
     com imagem para esse taxon.

Nao baixa nenhuma imagem — apenas consulta a API publica do GBIF e registra
o que existe, para revisao antes do download.

Uso:
    python map_species_images.py --input "species (1).csv"
    python map_species_images.py --input "species (1).csv" --limit 20
    python map_species_images.py --input "species (1).csv" --resume
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Optional

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

GBIF_SPECIES_MATCH = "https://api.gbif.org/v1/species/match"
GBIF_OCCURRENCE_SEARCH = "https://api.gbif.org/v1/occurrence/search"
REQUEST_TIMEOUT = 20
PAGE_LIMIT = 100


class RateLimiter:
    """Garante um intervalo minimo entre requisicoes, compartilhado entre todas as threads.

    Isso desacopla concorrencia (esconder latencia de rede) de throughput real
    (respeitar o limite de requisicoes/segundo do GBIF), independente de quantos
    workers estejam configurados.
    """

    def __init__(self, min_interval: float):
        self._lock = threading.Lock()
        self._min_interval = min_interval
        self._last = 0.0

    def wait(self) -> None:
        with self._lock:
            now = time.monotonic()
            delay = self._last + self._min_interval - now
            if delay > 0:
                time.sleep(delay)
            self._last = time.monotonic()


def build_session(pool_size: int) -> requests.Session:
    session = requests.Session()
    session.headers.update({"User-Agent": "extinction-app-dataset-builder/1.0"})
    retry = Retry(
        total=5,
        backoff_factor=2.0,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET"],
        respect_retry_after_header=True,
    )
    adapter = HTTPAdapter(max_retries=retry, pool_connections=pool_size, pool_maxsize=pool_size)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session


def read_species_list(path: Path, name_column: str) -> list[str]:
    with path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames or name_column not in reader.fieldnames:
            raise SystemExit(
                f"Coluna '{name_column}' nao encontrada em {path}.\n"
                f"Colunas disponiveis: {reader.fieldnames}\n"
                f"Use --name-column para apontar a coluna correta."
            )
        names: list[str] = []
        seen: set[str] = set()
        for row in reader:
            name = (row.get(name_column) or "").strip()
            if name and name not in seen:
                seen.add(name)
                names.append(name)
    return names


def read_already_processed(summary_path: Path) -> set[str]:
    if not summary_path.exists():
        return set()
    processed: set[str] = set()
    with summary_path.open(newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        next(reader, None)  # header
        for row in reader:
            if row:
                processed.add(row[0])
    return processed


def match_taxon(session: requests.Session, verbatim_name: str, rate_limiter: RateLimiter) -> dict:
    rate_limiter.wait()
    resp = session.get(
        GBIF_SPECIES_MATCH,
        params={"name": verbatim_name, "strict": False},
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    return resp.json()


def fetch_media_for_taxon(
    session: requests.Session,
    taxon_key: int,
    country: Optional[str],
    max_images: int,
    rate_limiter: RateLimiter,
) -> list[dict]:
    media_records: list[dict] = []
    offset = 0

    while True:
        params = {
            "taxonKey": taxon_key,
            "mediaType": "StillImage",
            "limit": PAGE_LIMIT,
            "offset": offset,
        }
        if country:
            params["country"] = country

        rate_limiter.wait()
        resp = session.get(GBIF_OCCURRENCE_SEARCH, params=params, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        payload = resp.json()

        for result in payload.get("results", []):
            for media in result.get("media", []):
                identifier = media.get("identifier")
                if not identifier:
                    continue
                media_records.append(
                    {
                        "identifier": identifier,
                        "format": media.get("format"),
                        "license": media.get("license"),
                        "rightsHolder": media.get("rightsHolder"),
                        "publisher": media.get("publisher"),
                        "occurrenceKey": result.get("key"),
                        "gbifTaxonKey": taxon_key,
                        "acceptedScientificName": result.get("scientificName"),
                    }
                )
                if len(media_records) >= max_images:
                    return media_records

        total_count = payload.get("count", 0)
        end_of_records = payload.get("endOfRecords", True)
        offset += PAGE_LIMIT
        if end_of_records or offset >= total_count:
            break

    return media_records


def process_species(
    session: requests.Session,
    name: str,
    country: Optional[str],
    max_images: int,
    rate_limiter: RateLimiter,
) -> tuple[list[dict], str]:
    """Retorna (registros de midia, taxonKey casado ou motivo do 0)."""
    match = match_taxon(session, name, rate_limiter)
    match_type = match.get("matchType", "NONE")
    taxon_key = match.get("usageKey")

    if match_type == "NONE" or not taxon_key:
        return [], "sem_match_taxonomico"

    media_records = fetch_media_for_taxon(session, taxon_key, country, max_images, rate_limiter)
    return media_records, str(taxon_key)


def safe_print(*args, **kwargs) -> None:
    """print() que nunca derruba a thread por causa de encoding do console."""
    try:
        print(*args, **kwargs)
    except UnicodeEncodeError:
        stream = kwargs.get("file", sys.stdout)
        safe_args = [str(a).encode("utf-8", errors="replace").decode("utf-8", errors="replace") for a in args]
        print(*safe_args, **{**kwargs, "file": stream})


def process_species_safe(
    session: requests.Session,
    name: str,
    country: Optional[str],
    max_images: int,
    rate_limiter: RateLimiter,
) -> tuple[str, list[dict], str]:
    try:
        media_records, taxon_info = process_species(session, name, country, max_images, rate_limiter)
        return name, media_records, taxon_info
    except requests.RequestException as exc:
        safe_print(f"ERRO ao buscar '{name}': {exc}", file=sys.stderr)
        return name, [], "erro_rede"
    except Exception as exc:  # nunca deixar uma excecao inesperada matar o worker
        safe_print(f"ERRO INESPERADO ao buscar '{name}': {exc!r}", file=sys.stderr)
        return name, [], "erro_inesperado"


def main() -> None:
    # Evita UnicodeEncodeError ao imprimir nomes cientificos com acentos quando o
    # console/pipe de saida nao e UTF-8 (comum no Windows) — sem isso, uma unica
    # excecao no print() derruba a thread principal e o job inteiro trava.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--input", required=True, type=Path, help="CSV com a lista de especies (ex: export do ALA-BIE)")
    parser.add_argument(
        "--name-column",
        default="nome científico",
        help="Nome da coluna com o nome cientifico no CSV de entrada (default: 'nome científico', padrao do export ALA-BIE)",
    )
    parser.add_argument(
        "--country",
        default=None,
        help="Filtrar ocorrencias por pais (codigo ISO2, ex: BR). Omitir para nao filtrar.",
    )
    parser.add_argument(
        "--output-dir",
        default=Path("ml/data"),
        type=Path,
        help="Diretorio onde salvar os resultados (default: ml/data)",
    )
    parser.add_argument(
        "--max-images",
        type=int,
        default=20,
        help="Maximo de imagens a registrar por especie (default: 20)",
    )
    parser.add_argument("--limit", type=int, default=None, help="Processar apenas as N primeiras especies (para teste)")
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Retomar uma execucao anterior, pulando especies ja registradas em species_image_summary.csv",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=6,
        help="Numero de threads concorrentes (default: 6). So ajuda a esconder latencia de rede — quem controla o throughput real e --rate.",
    )
    parser.add_argument(
        "--rate",
        type=float,
        default=4.0,
        help="Maximo de requisicoes/segundo ao GBIF, compartilhado entre todas as threads (default: 4.0)",
    )
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    summary_path = args.output_dir / "species_image_summary.csv"
    manifest_path = args.output_dir / "image_manifest.jsonl"

    species_names = read_species_list(args.input, args.name_column)
    print(f"{len(species_names)} especies encontradas em {args.input}")

    already_processed: set[str] = set()
    if args.resume:
        already_processed = read_already_processed(summary_path)
        species_names = [n for n in species_names if n not in already_processed]
        print(f"Retomando: {len(already_processed)} ja processadas, {len(species_names)} restantes")
    elif summary_path.exists():
        print(f"AVISO: {summary_path} ja existe e sera sobrescrito (use --resume para continuar de onde parou)")

    if args.limit is not None:
        species_names = species_names[: args.limit]
        print(f"--limit aplicado: processando {len(species_names)} especies")

    session = build_session(pool_size=args.workers)
    rate_limiter = RateLimiter(min_interval=1.0 / args.rate)
    species_with_images = 0
    completed = 0
    total = len(species_names)
    write_lock = threading.Lock()

    file_mode = "a" if args.resume and already_processed else "w"
    write_header = file_mode == "w"

    with summary_path.open(file_mode, newline="", encoding="utf-8") as summary_f, manifest_path.open(
        file_mode, encoding="utf-8"
    ) as manifest_f:

        summary_writer = csv.writer(summary_f)
        if write_header:
            summary_writer.writerow(["scientificName", "imageCount", "hasImages", "gbifTaxonKeyOrReason"])
            summary_f.flush()

        with ThreadPoolExecutor(max_workers=args.workers) as executor:
            future_to_name = {
                executor.submit(
                    process_species_safe, session, name, args.country, args.max_images, rate_limiter
                ): name
                for name in species_names
            }

            for future in as_completed(future_to_name):
                submitted_name = future_to_name[future]
                try:
                    name, media_records, taxon_info = future.result()
                except Exception as exc:
                    # Rede de seguranca final: mesmo que algo escape do try/except
                    # de process_species_safe, o job inteiro nao pode morrer por causa
                    # de uma unica especie.
                    safe_print(f"ERRO FATAL NAO TRATADO ao processar '{submitted_name}': {exc!r}", file=sys.stderr)
                    name, media_records, taxon_info = submitted_name, [], "erro_inesperado"

                completed += 1
                has_images = len(media_records) > 0
                if has_images:
                    species_with_images += 1

                with write_lock:
                    summary_writer.writerow([name, len(media_records), has_images, taxon_info])
                    summary_f.flush()
                    for record in media_records:
                        record["queriedScientificName"] = name
                        manifest_f.write(json.dumps(record, ensure_ascii=False) + "\n")
                    manifest_f.flush()

                status = f"{len(media_records)} imagem(ns)" if has_images else f"SEM imagens ({taxon_info})"
                safe_print(f"[{completed}/{total}] {name}: {status}")

    print(f"\n{species_with_images}/{total} especies com pelo menos 1 imagem (nesta execucao).")
    print(f"Resumo: {summary_path}")
    print(f"Manifesto de imagens: {manifest_path}")


if __name__ == "__main__":
    main()
