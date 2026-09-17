# Civic Issue Classifier — your own model, not a third-party API

This replaces the `AI_MODE=EXTERNAL_API` slot in `backend/services/ai.service.js`
with a model **you train and host yourself**, instead of calling someone
else's hosted API with an API key.

## Design

Transfer learning on **MobileNetV2** (pretrained on ImageNet), with a
custom classification head trained on your civic-issue photos:

```
MobileNetV2 (frozen, ImageNet weights, no top)
    -> GlobalAveragePooling2D
    -> Dense(128, relu)
    -> Dropout(0.3)
    -> Dense(5, softmax)     [Pothole / Street Light-Electricity / Water Leakage / Drainage / Garbage]
```

Why transfer learning instead of a CNN from scratch: MobileNetV2 already
knows general visual features (edges, textures, shapes) from 1.4M ImageNet
images, so it needs far less labeled data than training from zero — a few
hundred photos total can get you a usable model, versus tens of thousands
for a from-scratch CNN. It's also small (~14MB) and fast enough to run
inference on a CPU in real time, no GPU required for serving.

Training happens in two phases (see `train.py` for the full rationale):
1. Train only the new head, base frozen.
2. Unfreeze the last ~30 base layers and fine-tune everything together at
   a much lower learning rate.

## 1. Set up the environment

```bash
cd ai-model
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## 2. Collect a dataset

You need real photos in 5 categories. Put them here:

```
data/raw/pothole/*.jpg
data/raw/street_light_electricity/*.jpg
data/raw/water_leakage/*.jpg
data/raw/drainage/*.jpg
data/raw/garbage/*.jpg
```

**Where to get images:**
- Photograph real examples yourself with a phone — the most reliable way
  to match what citizens will actually submit.
- Public labeled datasets you can supplement with (check each dataset's
  license before use): Kaggle has pothole-detection and garbage/waste
  classification datasets; road-damage datasets like RDD2022 cover
  potholes, cracks, and some drainage-adjacent damage.
- Aim for **at least 40-60 images per category** as an absolute floor,
  ideally 150-300+ for meaningfully better accuracy. More, and more
  varied (different lighting, angles, backgrounds), matters more than
  anything else here.

## 3. Split into train/validation sets

```bash
python split_dataset.py
```

This copies 80% of each category into `data/train/<category>/` and 20%
into `data/val/<category>/` (change with `--val-ratio`).

## 4. Train

```bash
python train.py
```

Useful flags:
```bash
python train.py --epochs-head 8 --epochs-finetune 6 --batch-size 16
```

Watch `val_accuracy` in the output. If it's not improving, the most
common fixes, in order of impact: get more/better-varied training images,
reduce `--finetune-layers` (less prone to overfitting on small datasets),
or increase `--epochs-head`.

This produces:
- `models/civic_issue_classifier.keras` — the trained model
- `models/class_indices.json` — label mapping (needed by the server)

## 5. Serve it

```bash
python serve.py
```

Starts a Flask server on `http://localhost:8000` with:
- `GET /health` — sanity check, lists loaded classes
- `POST /classify` — accepts raw image bytes, returns `{"category": "...", "confidence": 0.94}`

To require an API key (recommended once this isn't just running on your
own laptop):
```bash
API_KEY=some-long-random-string python serve.py
```

For anything beyond local testing, run it behind a real WSGI server
instead of Flask's dev server, e.g.:
```bash
pip install waitress
waitress-serve --port=8000 serve:app
```

## 6. Point the Node backend at it

In `backend/.env`:
```
AI_MODE=EXTERNAL_API
AI_API_URL=http://localhost:8000/classify
AI_API_KEY=some-long-random-string   # only if you set API_KEY above; otherwise leave blank
```

Restart the backend. `ai.service.js`'s `callExternalApi()` already sends
the exact request shape this server expects and parses the exact response
shape it returns — no changes needed there.

## Retraining later

Add more photos to `data/raw/<category>/`, re-run `split_dataset.py` and
`train.py`. The model file gets overwritten each time you train, so keep
a copy of an old `models/` folder if you want to compare accuracy before
and after adding data.
