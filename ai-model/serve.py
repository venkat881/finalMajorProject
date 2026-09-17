"""
Inference server for the civic issue classifier.

Speaks exactly the request/response shape backend/services/ai.service.js
already expects in EXTERNAL_API mode (see callExternalApi() there):

    POST /classify
    Headers: Authorization: Bearer <API_KEY>   (optional, see below)
    Body:    raw image bytes (application/octet-stream)
    Response: { "category": "Pothole", "confidence": 0.94 }

Run:
    python serve.py
    # or for production:  waitress-serve --port=8000 serve:app

Then in backend/.env:
    AI_MODE=EXTERNAL_API
    AI_API_URL=http://localhost:8000/classify
    AI_API_KEY=<same value as API_KEY below, or leave both blank>
"""

import io
import json
import os
from pathlib import Path

import numpy as np
from flask import Flask, request, jsonify
from PIL import Image
import tensorflow as tf

from labels import CATEGORY_MAP

IMG_SIZE = (224, 224)
MODEL_DIR = Path(os.environ.get("MODEL_DIR", "models"))
API_KEY = os.environ.get("API_KEY")  # set this to require auth; leave unset to allow any request

app = Flask(__name__)

print(f"Loading model from {MODEL_DIR}/civic_issue_classifier.keras ...")
model = tf.keras.models.load_model(MODEL_DIR / "civic_issue_classifier.keras")

class_indices = json.loads((MODEL_DIR / "class_indices.json").read_text())
# class_indices: {"drainage": 0, "garbage": 1, ...} -> invert to index -> folder name
index_to_folder = {v: k for k, v in class_indices.items()}
print(f"Loaded {len(index_to_folder)} classes: {index_to_folder}")


def preprocess(image_bytes: bytes) -> np.ndarray:
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = img.resize(IMG_SIZE)
    arr = np.asarray(img, dtype=np.float32)
    arr = np.expand_dims(arr, axis=0)  # the model itself applies mobilenet_v2.preprocess_input internally
    return arr


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "classes": list(index_to_folder.values())})


@app.route("/classify", methods=["POST"])
def classify():
    if API_KEY:
        auth_header = request.headers.get("Authorization", "")
        if auth_header != f"Bearer {API_KEY}":
            return jsonify({"error": "Unauthorized"}), 401

    image_bytes = request.get_data()
    if not image_bytes:
        return jsonify({"error": "No image data received"}), 400

    try:
        arr = preprocess(image_bytes)
    except Exception as exc:  # noqa: BLE001 - want to report any decode failure as a 400
        return jsonify({"error": f"Could not read image: {exc}"}), 400

    predictions = model.predict(arr, verbose=0)[0]
    top_index = int(np.argmax(predictions))
    confidence = float(predictions[top_index])

    folder_name = index_to_folder.get(top_index)
    category = CATEGORY_MAP.get(folder_name, folder_name)

    return jsonify({"category": category, "confidence": confidence})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    app.run(host="0.0.0.0", port=port)
