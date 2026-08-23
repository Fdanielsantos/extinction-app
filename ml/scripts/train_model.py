#!/usr/bin/env python3
"""Treina um classificador de imagem (transfer learning) nas especies baixadas por
download_images.py.

Roda 100% local, CPU (ver backend/README.md secao "Reconhecimento de imagem
(RF018)"). Setup (Windows, uma vez so):

    py -3.13 -m venv C:/mlvenvs/extinction-ml
    C:/mlvenvs/extinction-ml/Scripts/pip install -r ml/requirements.txt

NAO cria o venv dentro de ml/.venv apesar do .gitignore prever esse caminho: o
projeto costuma ficar bem aninhado dentro do OneDrive, e o instalador do
TensorFlow esbarra no limite de 260 caracteres do Windows pra alguns arquivos
internos (erro "No such file or directory" no meio do `pip install`). Instalar
numa pasta curta fora do OneDrive evita isso sem precisar mexer em Long Paths do
Windows (que exigiria admin em cada maquina do time).

Depois, sempre chamando o python de dentro desse venv (nao precisa ativar):

    C:/mlvenvs/extinction-ml/Scripts/python ml/scripts/train_model.py --download-log ml/data/download_log.csv

Sem GPU: TensorFlow >= 2.11 nao usa GPU nativamente no Windows (nem placa NVIDIA sem
WSL2, nem AMD -- o plugin DirectML que permitia isso foi descontinuado pela
Microsoft). O treino roda em CPU mesmo; com milhares de classes isso e' lento
(horas a dias, nao minutos) -- use --limit-classes e --epochs baixos pra smoke test
antes de rodar o treino completo, e considere --base-model mobilenet_v2 (mais leve)
e/ou aumentar --min-images-per-class pra reduzir o numero de classes.

Entrada: download_log.csv (gerado por download_images.py), so as linhas status=ok.
Classes com menos de --min-images-per-class imagens sao descartadas (sem exemplo
suficiente pra separar treino/validacao de forma minimamente confiavel). O campo
localPath do CSV e' relativo ao diretorio ml/ (onde download_images.py normalmente
roda) -- resolvido aqui contra a pasta pai de scripts/, entao funciona chamando
train_model.py de qualquer lugar.

Saida (em --output-dir):
  - saved_model/       TensorFlow SavedModel (formato que o DJL carrega direto)
  - synset.txt          um rotulo por linha, NA MESMA ORDEM da saida do softmax —
                         e' esse arquivo que o DJL usa pra transformar indice em nome
                         de especie (ver Classifications.topK() em TFmodel.java)
  - labels.csv           taxonKey, scientificName, indice, qtdImagensTreino/val (debug)
  - training_log.csv      historico de metricas por epoca (cabeca + fine-tuning)

Uso:
    python train_model.py --download-log data/download_log.csv --output-dir model
    python train_model.py --download-log data/download_log.csv --limit-classes 20 --epochs 2   # smoke test

Checkpointing (util em treinos longos de CPU que podem ser interrompidos): a cada
epoca que melhora o monitor (val_loss, ou loss sem validacao), salva o modelo
inteiro em --output-dir/checkpoint_head.keras (fase 1) e checkpoint_finetune.keras
(fase 2). Se o treino for interrompido, rode de novo com --resume (mesmos
argumentos) pra continuar dali em vez de do zero.
"""

from __future__ import annotations

import argparse
import csv
import random
from collections import Counter, defaultdict
from pathlib import Path


def load_class_images(download_log: Path, min_images_per_class: int) -> dict[str, dict]:
    """Retorna {taxonKey: {"scientificName": str, "paths": [str, ...]}} so pras
    classes com >= min_images_per_class downloads bem-sucedidos.

    O localPath gravado no CSV por download_images.py e' relativo ao diretorio ml/
    (de onde aquele script normalmente roda), nao ao cwd de train_model.py.
    Resolvemos aqui contra ml/ (pai de scripts/, onde este arquivo mora) pra
    funcionar de qualquer lugar que train_model.py for chamado."""
    base_dir = Path(__file__).resolve().parent.parent
    by_class: dict[str, dict] = defaultdict(lambda: {"scientificName": Counter(), "paths": []})

    with download_log.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("status") != "ok" or not row.get("localPath"):
                continue
            taxon_key = row["gbifTaxonKey"]
            by_class[taxon_key]["paths"].append(str(base_dir / row["localPath"]))
            name = row.get("scientificName") or ""
            if name:
                by_class[taxon_key]["scientificName"][name] += 1

    total_missing = 0
    kept = {}
    for taxon_key, data in by_class.items():
        existing_paths = [p for p in data["paths"] if Path(p).is_file()]
        total_missing += len(data["paths"]) - len(existing_paths)
        if len(existing_paths) < min_images_per_class:
            continue
        display_name = data["scientificName"].most_common(1)[0][0] if data["scientificName"] else taxon_key
        kept[taxon_key] = {"scientificName": display_name, "paths": existing_paths}

    if total_missing:
        print(
            f"Aviso: {total_missing} imagens listadas como 'ok' no CSV nao foram "
            f"encontradas em disco (ignoradas) -- baixe de novo com download_images.py "
            f"--resume se quiser recupera-las, ou ignore se for so um punhado."
        )
    return kept


def split_train_val(
    class_images: dict[str, dict], val_split: float, seed: int
) -> tuple[list[tuple[str, str]], list[tuple[str, str]]]:
    """Split estratificado manual (nao sklearn): garante pelo menos 1 imagem em treino
    sempre, e so poe imagem em validacao se sobrar mais de 1 pra classe -- classes
    minusculas (bem acima do minimo, mas ainda pequenas) acabam sem representacao em
    validacao, o que e' esperado e nao e' bug."""
    rng = random.Random(seed)
    train: list[tuple[str, str]] = []
    val: list[tuple[str, str]] = []

    for taxon_key, data in class_images.items():
        paths = list(data["paths"])
        rng.shuffle(paths)
        n_val = int(round(len(paths) * val_split))
        n_val = min(n_val, len(paths) - 1)  # sempre sobra >=1 pra treino
        n_val = max(n_val, 0)
        val_paths, train_paths = paths[:n_val], paths[n_val:]
        train.extend((p, taxon_key) for p in train_paths)
        val.extend((p, taxon_key) for p in val_paths)

    return train, val


def build_dataset(items: list[tuple[str, str]], class_to_index: dict[str, int], img_size: int, batch_size: int, augment: bool, preprocess_input):
    import tensorflow as tf

    paths = [p for p, _ in items]
    labels = [class_to_index[k] for _, k in items]

    augmentation = tf.keras.Sequential(
        [
            tf.keras.layers.RandomFlip("horizontal"),
            tf.keras.layers.RandomRotation(0.08),
            tf.keras.layers.RandomZoom(0.1),
            tf.keras.layers.RandomContrast(0.1),
        ]
    )

    def load(path, label):
        raw = tf.io.read_file(path)
        img = tf.io.decode_image(raw, channels=3, expand_animations=False)
        img.set_shape([None, None, 3])
        img = tf.image.resize(img, [img_size, img_size])
        return img, label

    ds = tf.data.Dataset.from_tensor_slices((paths, labels))
    if augment:
        ds = ds.shuffle(buffer_size=min(len(paths), 10000), seed=42, reshuffle_each_iteration=True)
    ds = ds.map(load, num_parallel_calls=tf.data.AUTOTUNE)
    if augment:
        ds = ds.map(lambda x, y: (augmentation(x, training=True), y), num_parallel_calls=tf.data.AUTOTUNE)
    ds = ds.map(lambda x, y: (preprocess_input(x), y), num_parallel_calls=tf.data.AUTOTUNE)
    ds = ds.batch(batch_size).prefetch(tf.data.AUTOTUNE)
    return ds


def build_model(base_model_name: str, img_size: int, num_classes: int):
    import tensorflow as tf
    from tensorflow import keras

    bases = {
        "mobilenet_v2": (keras.applications.MobileNetV2, keras.applications.mobilenet_v2.preprocess_input),
        "efficientnet_b0": (keras.applications.EfficientNetB0, keras.applications.efficientnet.preprocess_input),
        "resnet50": (keras.applications.ResNet50, keras.applications.resnet50.preprocess_input),
    }
    base_cls, preprocess_input = bases[base_model_name]

    base = base_cls(include_top=False, weights="imagenet", input_shape=(img_size, img_size, 3), pooling="avg")
    base.trainable = False

    inputs = keras.Input(shape=(img_size, img_size, 3))
    x = base(inputs, training=False)
    x = keras.layers.Dropout(0.3)(x)
    outputs = keras.layers.Dense(num_classes, activation="softmax")(x)
    model = keras.Model(inputs, outputs)
    return model, base, preprocess_input


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--download-log", required=True, type=Path)
    parser.add_argument("--output-dir", default=Path("ml/model"), type=Path)
    parser.add_argument("--img-size", type=int, default=224)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--min-images-per-class", type=int, default=5)
    parser.add_argument("--val-split", type=float, default=0.15)
    parser.add_argument("--base-model", choices=["mobilenet_v2", "efficientnet_b0", "resnet50"], default="mobilenet_v2")
    parser.add_argument("--epochs", type=int, default=10, help="Epocas treinando so a cabeca (base congelada)")
    parser.add_argument("--fine-tune-epochs", type=int, default=5, help="Epocas de fine-tuning com a base (parcialmente) descongelada")
    parser.add_argument("--fine-tune-at-layer", type=int, default=-30, help="Descongela as ultimas N camadas da base pro fine-tuning (default: -30)")
    parser.add_argument("--learning-rate", type=float, default=1e-3)
    parser.add_argument("--fine-tune-lr", type=float, default=1e-5)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--limit-classes", type=int, default=None, help="Usar so as N primeiras classes (smoke test)")
    parser.add_argument("--resume", action="store_true", help="Retomar de checkpoint_head.keras/checkpoint_finetune.keras existentes em --output-dir (util em Colab apos desconexao)")
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)

    print("Carregando download_log.csv e agrupando por classe...")
    class_images = load_class_images(args.download_log, args.min_images_per_class)
    print(f"{len(class_images)} classes com >= {args.min_images_per_class} imagens")

    if args.limit_classes is not None:
        keys = list(class_images.keys())[: args.limit_classes]
        class_images = {k: class_images[k] for k in keys}
        print(f"--limit-classes aplicado: {len(class_images)} classes")

    if len(class_images) < 2:
        raise SystemExit("Menos de 2 classes utilizaveis -- baixe mais imagens ou reduza --min-images-per-class.")

    class_keys = sorted(class_images.keys())
    class_to_index = {k: i for i, k in enumerate(class_keys)}

    train_items, val_items = split_train_val(class_images, args.val_split, args.seed)
    print(f"{len(train_items)} imagens de treino, {len(val_items)} de validacao, {len(class_keys)} classes")

    with (args.output_dir / "labels.csv").open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["index", "gbifTaxonKey", "scientificName", "totalImages"])
        for k in class_keys:
            writer.writerow([class_to_index[k], k, class_images[k]["scientificName"], len(class_images[k]["paths"])])

    with (args.output_dir / "synset.txt").open("w", newline="\n", encoding="utf-8") as f:
        for k in class_keys:
            f.write(class_images[k]["scientificName"] + "\n")

    import tensorflow as tf
    from tensorflow import keras

    model, base, preprocess_input = build_model(args.base_model, args.img_size, len(class_keys))

    train_ds = build_dataset(train_items, class_to_index, args.img_size, args.batch_size, augment=True, preprocess_input=preprocess_input)
    val_ds = build_dataset(val_items, class_to_index, args.img_size, args.batch_size, augment=False, preprocess_input=preprocess_input) if val_items else None

    metrics = ["accuracy", keras.metrics.SparseTopKCategoricalAccuracy(k=5, name="top5_acc")]
    log_path = args.output_dir / "training_log.csv"

    monitor = "val_loss" if val_ds else "loss"
    checkpoint_head = args.output_dir / "checkpoint_head.keras"
    checkpoint_finetune = args.output_dir / "checkpoint_finetune.keras"

    print(f"\n== Fase 1: treinando a cabeca (base '{args.base_model}' congelada) ==")
    if args.resume and checkpoint_head.exists():
        print(f"--resume: carregando checkpoint existente de {checkpoint_head}")
        model = keras.models.load_model(checkpoint_head)
    model.compile(optimizer=keras.optimizers.Adam(args.learning_rate), loss="sparse_categorical_crossentropy", metrics=metrics)
    callbacks = [
        keras.callbacks.CSVLogger(str(log_path), append=False),
        keras.callbacks.ModelCheckpoint(str(checkpoint_head), monitor=monitor, save_best_only=True),
        keras.callbacks.EarlyStopping(monitor=monitor, patience=3, restore_best_weights=True),
        keras.callbacks.ReduceLROnPlateau(monitor=monitor, factor=0.5, patience=2),
    ]
    model.fit(train_ds, validation_data=val_ds, epochs=args.epochs, callbacks=callbacks)

    if args.fine_tune_epochs > 0:
        print(f"\n== Fase 2: fine-tuning (descongelando as ultimas {abs(args.fine_tune_at_layer)} camadas) ==")
        if args.resume and checkpoint_finetune.exists():
            print(f"--resume: carregando checkpoint existente de {checkpoint_finetune}")
            model = keras.models.load_model(checkpoint_finetune)
            base = model.layers[1]  # mesmo indice usado em build_model: inputs -> base -> dropout -> dense
        base.trainable = True
        for layer in base.layers[: args.fine_tune_at_layer]:
            layer.trainable = False

        model.compile(optimizer=keras.optimizers.Adam(args.fine_tune_lr), loss="sparse_categorical_crossentropy", metrics=metrics)
        callbacks = [
            keras.callbacks.CSVLogger(str(log_path), append=True),
            keras.callbacks.ModelCheckpoint(str(checkpoint_finetune), monitor=monitor, save_best_only=True),
            keras.callbacks.EarlyStopping(monitor=monitor, patience=3, restore_best_weights=True),
            keras.callbacks.ReduceLROnPlateau(monitor=monitor, factor=0.5, patience=2),
        ]
        model.fit(train_ds, validation_data=val_ds, epochs=args.fine_tune_epochs, callbacks=callbacks)

    saved_model_dir = args.output_dir / "saved_model"
    print(f"\nExportando SavedModel para {saved_model_dir} ...")
    model.export(str(saved_model_dir))

    print(f"\nPronto. {len(class_keys)} classes treinadas.")
    print(f"SavedModel: {saved_model_dir}")
    print(f"synset.txt (rotulos, mesma ordem da saida do modelo): {args.output_dir / 'synset.txt'}")
    print(f"labels.csv (debug): {args.output_dir / 'labels.csv'}")
    print(f"Historico de treino: {log_path}")


if __name__ == "__main__":
    main()
