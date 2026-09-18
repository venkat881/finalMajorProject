
import io
import json
import os
from pathlib import Path

import numpy as np
from flask import Flask, request, jsonify, render_template_string
from PIL import Image
import tensorflow as tf

from labels import CATEGORY_MAP


# ============================================================
# CONFIG
# ============================================================

IMG_SIZE = (224, 224)

MODEL_DIR = Path(
    os.environ.get("MODEL_DIR", "models")
)

PORT = int(
    os.environ.get("PORT", 8000)
)

HOST = "0.0.0.0"

API_KEY = os.environ.get("API_KEY")


# ============================================================
# FLASK
# ============================================================

app = Flask(__name__)


# ============================================================
# LOAD MODEL
# ============================================================

print(
    f"Loading model from "
    f"{MODEL_DIR}/civic_issue_classifier.keras ..."
)

model = tf.keras.models.load_model(
    MODEL_DIR / "civic_issue_classifier.keras"
)


class_indices = json.loads(
    (
        MODEL_DIR / "class_indices.json"
    ).read_text()
)

index_to_folder = {
    v: k
    for k, v in class_indices.items()
}

print(
    f"Loaded {len(index_to_folder)} classes:"
)

print(index_to_folder)


# ============================================================
# HTML UI
# ============================================================

HTML = """
<!DOCTYPE html>

<html lang="en">

<head>

<meta charset="UTF-8">

<meta name="viewport"
      content="width=device-width, initial-scale=1.0">

<title>Civic Issue AI Verification</title>


<style>

* {
    box-sizing: border-box;
}

body {

    margin: 0;

    font-family:
        Arial,
        Helvetica,
        sans-serif;

    background:
        #f3f4f6;

    min-height: 100vh;

    display: flex;

    justify-content: center;

    align-items: center;

    padding: 30px;
}


.container {

    width: 100%;

    max-width: 650px;

    background: white;

    border-radius: 18px;

    padding: 30px;

    box-shadow:
        0 10px 35px
        rgba(0,0,0,0.10);

}


.header {

    text-align: center;

    margin-bottom: 25px;

}


.header h1 {

    margin: 0;

    color: #111827;

    font-size: 28px;

}


.header p {

    margin-top: 8px;

    color: #6b7280;

}


.server {

    text-align: center;

    padding: 10px;

    margin-bottom: 20px;

    border-radius: 8px;

    background: #ecfdf5;

    color: #166534;

    font-size: 14px;

    font-weight: bold;

}


.upload {

    border: 2px dashed #9ca3af;

    border-radius: 14px;

    padding: 35px 20px;

    text-align: center;

    cursor: pointer;

    background: #fafafa;

}


.upload:hover {

    border-color: #2563eb;

    background: #eff6ff;

}


.upload-icon {

    font-size: 45px;

    margin-bottom: 10px;

}


.upload-text {

    font-size: 17px;

    font-weight: bold;

    color: #374151;

}


.upload-sub {

    margin-top: 8px;

    color: #6b7280;

    font-size: 13px;

}


input[type="file"] {

    display: none;

}


.preview {

    margin-top: 20px;

    text-align: center;

    display: none;

}


.preview img {

    max-width: 100%;

    max-height: 330px;

    border-radius: 12px;

    object-fit: contain;

}


.file-name {

    margin-top: 8px;

    font-size: 13px;

    color: #6b7280;

}


.verify {

    width: 100%;

    margin-top: 20px;

    padding: 15px;

    border: none;

    border-radius: 10px;

    background: #2563eb;

    color: white;

    font-size: 17px;

    font-weight: bold;

    cursor: pointer;

}


.verify:hover {

    background: #1d4ed8;

}


.verify:disabled {

    background: #9ca3af;

    cursor: not-allowed;

}


.loading {

    display: none;

    text-align: center;

    margin-top: 20px;

    color: #2563eb;

    font-weight: bold;

}


.result {

    display: none;

    margin-top: 25px;

    padding: 20px;

    border-radius: 14px;

    background: #f0fdf4;

    border: 1px solid #bbf7d0;

}


.result-title {

    color: #166534;

    font-size: 14px;

    font-weight: bold;

    margin-bottom: 12px;

}


.category {

    font-size: 25px;

    font-weight: bold;

    color: #111827;

    margin-bottom: 12px;

}


.confidence {

    font-size: 16px;

    color: #374151;

}


.bar {

    width: 100%;

    height: 14px;

    background: #d1d5db;

    border-radius: 10px;

    margin-top: 10px;

    overflow: hidden;

}


.bar-fill {

    height: 100%;

    width: 0%;

    background: #22c55e;

    transition: width 0.5s ease;

}


.error {

    display: none;

    margin-top: 20px;

    padding: 14px;

    border-radius: 10px;

    background: #fef2f2;

    color: #b91c1c;

    border: 1px solid #fecaca;

}


</style>

</head>


<body>


<div class="container">


    <div class="header">

        <h1>
            🚨 Civic Issue AI Verification
        </h1>

        <p>
            Upload an image and verify the detected civic issue
        </p>

    </div>


    <div class="server">

        🟢 AI SERVER ONLINE

        &nbsp; | &nbsp;

        PORT: {{ port }}

    </div>


    <!-- IMAGE SELECT -->

    <label
        class="upload"
        for="imageInput"
    >

        <div class="upload-icon">
            📷
        </div>

        <div class="upload-text">
            Click to select civic issue image
        </div>

        <div class="upload-sub">
            JPG, JPEG, PNG or WEBP
        </div>

        <input
            id="imageInput"
            type="file"
            accept="image/*"
        >

    </label>


    <!-- PREVIEW -->

    <div
        class="preview"
        id="preview"
    >

        <img
            id="previewImage"
            alt="Selected image"
        >

        <div
            class="file-name"
            id="fileName"
        ></div>

    </div>


    <!-- VERIFY -->

    <button
        class="verify"
        id="verifyButton"
        disabled
    >

        🔍 VERIFY CIVIC ISSUE

    </button>


    <!-- LOADING -->

    <div
        class="loading"
        id="loading"
    >

        🤖 AI is analyzing the image...

    </div>


    <!-- RESULT -->

    <div
        class="result"
        id="result"
    >

        <div class="result-title">
            AI VERIFICATION RESULT
        </div>

        <div
            class="category"
            id="category"
        >
            -
        </div>

        <div
            class="confidence"
            id="confidence"
        >
            Confidence: -
        </div>

        <div class="bar">

            <div
                class="bar-fill"
                id="barFill"
            ></div>

        </div>

    </div>


    <!-- ERROR -->

    <div
        class="error"
        id="error"
    ></div>


</div>


<script>


const imageInput =
    document.getElementById(
        "imageInput"
    );


const preview =
    document.getElementById(
        "preview"
    );


const previewImage =
    document.getElementById(
        "previewImage"
    );


const fileName =
    document.getElementById(
        "fileName"
    );


const verifyButton =
    document.getElementById(
        "verifyButton"
    );


const loading =
    document.getElementById(
        "loading"
    );


const result =
    document.getElementById(
        "result"
    );


const category =
    document.getElementById(
        "category"
    );


const confidence =
    document.getElementById(
        "confidence"
    );


const barFill =
    document.getElementById(
        "barFill"
    );


const errorBox =
    document.getElementById(
        "error"
    );


let selectedFile = null;


// ==========================================================
// IMAGE SELECTED
// ==========================================================

imageInput.addEventListener(
    "change",
    function () {

        const file =
            this.files[0];

        if (!file) {
            return;
        }


        selectedFile = file;


        previewImage.src =
            URL.createObjectURL(
                file
            );


        fileName.textContent =
            file.name;


        preview.style.display =
            "block";


        verifyButton.disabled =
            false;


        result.style.display =
            "none";


        errorBox.style.display =
            "none";

    }
);


// ==========================================================
// VERIFY BUTTON
// ==========================================================

verifyButton.addEventListener(
    "click",
    async function () {

        if (!selectedFile) {
            return;
        }


        verifyButton.disabled =
            true;


        loading.style.display =
            "block";


        result.style.display =
            "none";


        errorBox.style.display =
            "none";


        try {

            // Convert image to raw bytes

            const imageBuffer =
                await selectedFile.arrayBuffer();


            const response =
                await fetch(
                    "/classify",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                selectedFile.type
                        },

                        body: imageBuffer
                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    data.error ||
                    "Verification failed"
                );

            }


            // ==============================================
            // RESULT
            // ==============================================

            const confidenceValue =
                Number(
                    data.confidence
                );


            const percentage =
                confidenceValue * 100;


            category.textContent =
                data.category;


            confidence.textContent =
                `Confidence: ${
                    percentage.toFixed(2)
                }%`;


            barFill.style.width =
                `${percentage}%`;


            result.style.display =
                "block";


        }

        catch (error) {

            errorBox.textContent =
                "❌ " +
                error.message;


            errorBox.style.display =
                "block";

        }

        finally {

            loading.style.display =
                "none";


            verifyButton.disabled =
                false;

        }

    }
);


</script>


</body>

</html>
"""


# ============================================================
# WEB UI ROUTE
# ============================================================

@app.route("/", methods=["GET"])
def home():

    return render_template_string(
        HTML,
        port=PORT
    )


# ============================================================
# HEALTH
# ============================================================

@app.route("/health", methods=["GET"])
def health():

    return jsonify({
        "status": "ok",
        "classes": list(
            index_to_folder.values()
        )
    })


# ============================================================
# CLASSIFY
# ============================================================

@app.route("/classify", methods=["POST"])
def classify():

    # --------------------------------------------------------
    # API KEY
    # --------------------------------------------------------

    if API_KEY:

        auth_header = request.headers.get(
            "Authorization",
            ""
        )

        if auth_header != (
            f"Bearer {API_KEY}"
        ):

            return jsonify({
                "error": "Unauthorized"
            }), 401


    # --------------------------------------------------------
    # IMAGE
    # --------------------------------------------------------

    image_bytes = request.get_data()

    if not image_bytes:

        return jsonify({
            "error":
                "No image data received"
        }), 400


    # --------------------------------------------------------
    # PREPROCESS
    # --------------------------------------------------------

    try:

        img = Image.open(
            io.BytesIO(
                image_bytes
            )
        ).convert("RGB")


        img = img.resize(
            IMG_SIZE
        )


        arr = np.asarray(
            img,
            dtype=np.float32
        )


        arr = np.expand_dims(
            arr,
            axis=0
        )

    except Exception as exc:

        return jsonify({
            "error":
                f"Could not read image: {exc}"
        }), 400


    # --------------------------------------------------------
    # MODEL PREDICTION
    # --------------------------------------------------------

    predictions = model.predict(
        arr,
        verbose=0
    )[0]


    top_index = int(
        np.argmax(predictions)
    )


    confidence = float(
        predictions[top_index]
    )


    # --------------------------------------------------------
    # CATEGORY
    # --------------------------------------------------------

    folder_name =index_to_folder.get(
            top_index
        )


    category = CATEGORY_MAP.get(
        folder_name,
        folder_name
    )


    # --------------------------------------------------------
    # RESPONSE
    # --------------------------------------------------------

    return jsonify({

        "category":
            category,

        "confidence":
            confidence

    })


# ============================================================
# START SERVER
# ============================================================

if __name__ == "__main__":

    print()
    print("=" * 60)
    print("       CIVIC ISSUE AI VERIFICATION SERVER")
    print("=" * 60)

    print(
        f"Model : "
        f"{MODEL_DIR}/civic_issue_classifier.keras"
    )

    print(
        f"Host  : {HOST}"
    )

    print(
        f"Port  : {PORT}"
    )

    print(
        f"Open  : http://localhost:{PORT}"
    )

    print("=" * 60)
    print()

    app.run(
        host=HOST,
        port=PORT,
        debug=False,
        use_reloader=False
    )