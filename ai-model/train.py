"""
Trains the civic issue image classifier.

Model design: transfer learning on top of MobileNetV2 (pretrained on
ImageNet). MobileNetV2 is chosen deliberately over training a CNN from
scratch:

  - It already knows general visual features (edges, textures, shapes)
    from 1.4M images, so it needs far less labeled data to reach usable
    accuracy on a new 5-class problem than a from-scratch CNN would.
  - It's small (~14MB, ~3.5M params) — fast to train on a laptop CPU and
    fast enough to serve in real time without a GPU in production.
  - It's a standard, well-documented architecture — appropriate for a
    project you need to explain and defend, not a black box.

Architecture:

    MobileNetV2 (frozen, ImageNet weights, no top)
        -> GlobalAveragePooling2D
        -> Dense(128, relu)
        -> Dropout(0.3)
        -> Dense(num_classes, softmax)

Training happens in two phases:
  1. Train only the new head, with the MobileNetV2 base frozen, so the
     randomly-initialized head doesn't wreck the pretrained features.
  2. Unfreeze the last few MobileNetV2 layers and fine-tune everything
     together at a much lower learning rate, to adapt the pretrained
     features specifically to civic-issue photos.

Usage:
    python train.py
    python train.py --epochs-head 8 --epochs-finetune 6 --batch-size 16

Outputs:
    models/civic_issue_classifier.keras   (the trained model)
    models/class_indices.json             (folder-name -> index mapping,
                                            needed by serve.py to decode
                                            predictions back into labels)
"""

import argparse
import json
from pathlib import Path

import tensorflow as tf
from tensorflow.keras import layers, models, optimizers
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.preprocessing.image import ImageDataGenerator

from labels import CATEGORY_MAP

IMG_SIZE = (224, 224)


def build_model(num_classes: int) -> tf.keras.Model:
    base = MobileNetV2(input_shape=IMG_SIZE + (3,), include_top=False, weights="imagenet")
    base.trainable = False  # phase 1: frozen

    inputs = tf.keras.Input(shape=IMG_SIZE + (3,))
    x = tf.keras.applications.mobilenet_v2.preprocess_input(inputs)
    x = base(x, training=False)
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.Dense(128, activation="relu")(x)
    x = layers.Dropout(0.3)(x)
    outputs = layers.Dense(num_classes, activation="softmax")(x)

    model = models.Model(inputs, outputs)
    return model, base


def make_generators(train_dir: str, val_dir: str, batch_size: int):
    train_datagen = ImageDataGenerator(
        rotation_range=15,
        width_shift_range=0.1,
        height_shift_range=0.1,
        zoom_range=0.15,
        horizontal_flip=True,
        brightness_range=(0.8, 1.2),
    )
    val_datagen = ImageDataGenerator()

    # Fixed, alphabetical class order (folder names) so class_indices.json
    # is deterministic and matches labels.CATEGORY_MAP keys.
    classes = sorted(CATEGORY_MAP.keys())

    train_gen = train_datagen.flow_from_directory(
        train_dir, target_size=IMG_SIZE, batch_size=batch_size,
        class_mode="categorical", classes=classes,
    )
    val_gen = val_datagen.flow_from_directory(
        val_dir, target_size=IMG_SIZE, batch_size=batch_size,
        class_mode="categorical", classes=classes, shuffle=False,
    )
    return train_gen, val_gen


def main(args):
    train_gen, val_gen = make_generators(args.train_dir, args.val_dir, args.batch_size)
    num_classes = len(train_gen.class_indices)

    print(f"Classes ({num_classes}): {train_gen.class_indices}")
    print(f"Training images: {train_gen.samples} | Validation images: {val_gen.samples}")

    if train_gen.samples < 50:
        print(
            "\n  Warning: very little training data. Transfer learning helps, "
            "but aim for at least ~40-60 images per category for a usable model.\n"
        )

    model, base = build_model(num_classes)

    # ---- Phase 1: train the new head only ----
    model.compile(
        optimizer=optimizers.Adam(learning_rate=1e-4),
        loss="categorical_crossentropy",
        metrics=["accuracy"],
    )
    print("\n=== Phase 1: training classification head (base frozen) ===")
    model.fit(train_gen, validation_data=val_gen, epochs=args.epochs_head)

    # ---- Phase 2: fine-tune the top of the base model ----
    base.trainable = True
    for layer in base.layers[: -args.finetune_layers]:
        layer.trainable = False

    model.compile(
        optimizer=optimizers.Adam(learning_rate=1e-5),
        loss="categorical_crossentropy",
        metrics=["accuracy"],
    )
    print(f"\n=== Phase 2: fine-tuning last {args.finetune_layers} base layers ===")
    history = model.fit(train_gen, validation_data=val_gen, epochs=args.epochs_finetune)

    final_val_acc = history.history.get("val_accuracy", [None])[-1]
    print(f"\nFinal validation accuracy: {final_val_acc}")

    models_dir = Path(args.output_dir)
    models_dir.mkdir(parents=True, exist_ok=True)

    model_path = models_dir / "civic_issue_classifier.keras"
    model.save(model_path)
    print(f"Saved model to {model_path}")

    class_indices_path = models_dir / "class_indices.json"
    class_indices_path.write_text(json.dumps(train_gen.class_indices, indent=2))
    print(f"Saved class index mapping to {class_indices_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--train-dir", default="data/train")
    parser.add_argument("--val-dir", default="data/val")
    parser.add_argument("--output-dir", default="models")
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--epochs-head", type=int, default=8)
    parser.add_argument("--epochs-finetune", type=int, default=6)
    parser.add_argument("--finetune-layers", type=int, default=30, help="Number of trailing base layers to unfreeze")
    main(parser.parse_args())
