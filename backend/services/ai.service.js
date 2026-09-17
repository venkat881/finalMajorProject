/**
 * AI Image Classification Service
 * ---------------------------------------------------------------
 * Isolated from Express controllers so the underlying model/provider
 * can be swapped without touching route/controller code.
 *
 * Supported modes (set AI_MODE in .env):
 *
 *  - "EXTERNAL_API"   Calls a hosted vision model at AI_API_URL using
 *                      AI_API_KEY. Point this at any service that accepts
 *                      an image and returns a category + confidence, e.g.:
 *                        - a Hugging Face Inference Endpoint running an
 *                          image-classification model fine-tuned on civic
 *                          issue photos
 *                        - a custom TensorFlow/PyTorch model served behind
 *                          a small Flask/FastAPI wrapper
 *                        - a cloud vision API (Google Cloud Vision, AWS
 *                          Rekognition custom labels, Azure Custom Vision)
 *                      Adjust `callExternalApi()` below to match whatever
 *                      request/response shape your chosen provider uses.
 *
 *  - "DEV_HEURISTIC"   No external AI account needed. Produces a
 *                      deterministic, explainable "confidence" so the
 *                      full pipeline (thresholds, AI_REVIEW, category
 *                      mismatch handling, etc.) can be developed and
 *                      demoed end-to-end without any AI credentials.
 *                      This is NOT real computer vision — replace it with
 *                      EXTERNAL_API mode before relying on it for anything
 *                      beyond local development.
 *
 * Both modes return the same shape:
 *   { category: string, confidence: number (0-100), raw: any }
 *
 * AI failures NEVER throw out of this module for callers that use
 * classifyIssueImage() — they resolve to a safe fallback result with
 * confidence 0 and a `failed: true` flag, so a downed AI provider can
 * never crash the Express server (Rule 10 / Section 45).
 */

const fs = require('fs');
const crypto = require('crypto');

const CATEGORIES = [
  'Pothole',
  'Street Light / Electricity',
  'Water Leakage',
  'Drainage',
  'Garbage',
];

async function callExternalApi(imagePath) {
  const apiUrl = process.env.AI_API_URL;
  const apiKey = process.env.AI_API_KEY;

  const imageBuffer = fs.readFileSync(imagePath);

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/octet-stream',
    },
    body: imageBuffer,
  });

  if (!response.ok) {
    throw new Error(`AI API responded with status ${response.status}`);
  }

  const data = await response.json();

  // Expected provider response: { category: "Pothole", confidence: 0.94 }
  // Adjust this mapping to match your provider's actual response shape.
  return {
    category: data.category,
    confidence: Math.round(Number(data.confidence) * 100),
    raw: data,
  };
}

/**
 * Deterministic dev-mode heuristic: hashes the image bytes + the
 * citizen-selected category to produce a stable "confidence" in the
 * 55-97 range, so the same photo always yields the same demo result,
 * and different categories/photos vary the number in a believable way.
 * This is a stand-in for a real model and is clearly not image content
 * analysis — it exists purely so the rest of the pipeline can be built,
 * tested, and demonstrated without requiring AI credentials.
 */
function devHeuristicClassification(imagePath, selectedCategory) {
  const buffer = fs.readFileSync(imagePath);
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  const hashInt = parseInt(hash.slice(0, 8), 16);

  // Most of the time, "detect" the same category the citizen picked
  // (simulating a reasonably accurate model); occasionally simulate a
  // mismatch or a low-confidence result so the mismatch/AI_REVIEW flows
  // in the UI can actually be exercised during a demo.
  const roll = hashInt % 100;
  let category = selectedCategory;
  if (roll < 8) {
    // simulate a mismatch
    const others = CATEGORIES.filter((c) => c !== selectedCategory);
    category = others[hashInt % others.length];
  }

  let confidence;
  if (roll < 8) {
    confidence = 40 + (hashInt % 20); // low confidence mismatch: 40-59
  } else if (roll < 20) {
    confidence = 55 + (hashInt % 25); // review band: 55-79
  } else {
    confidence = 85 + (hashInt % 13); // auto-pass band: 85-97
  }

  return { category, confidence, raw: { mode: 'DEV_HEURISTIC', roll } };
}

/**
 * classifyIssueImage
 * @param {string} imagePath - absolute path to the stored image on disk
 * @param {string} selectedCategory - category the citizen chose
 * @returns {Promise<{category:string, confidence:number, failed:boolean, error?:string}>}
 */
async function classifyIssueImage(imagePath, selectedCategory) {
  const mode = (process.env.AI_MODE || 'DEV_HEURISTIC').toUpperCase();

  try {
    if (mode === 'EXTERNAL_API' && process.env.AI_API_URL) {
      console.log(`[ai.service] calling external model at ${process.env.AI_API_URL}`);
      const result = await callExternalApi(imagePath);
      console.log(`[ai.service] external model responded:`, result.category, result.confidence);
      return { ...result, failed: false };
    }
    if (mode === 'EXTERNAL_API' && !process.env.AI_API_URL) {
      console.warn('[ai.service] AI_MODE=EXTERNAL_API but AI_API_URL is not set — falling back to DEV_HEURISTIC. Check your .env.');
    }
    const result = devHeuristicClassification(imagePath, selectedCategory);
    return { ...result, failed: false };
  } catch (err) {
    console.error('[ai.service] Classification failed, falling back to AI_REVIEW:', err.message);
    return { category: null, confidence: 0, failed: true, error: err.message };
  }
}

function getConfidenceThresholds() {
  return {
    autoPass: Number(process.env.AI_CONFIDENCE_AUTO_PASS || 85),
    reviewMin: Number(process.env.AI_CONFIDENCE_REVIEW_MIN || 50),
  };
}

/**
 * Applies the confidence + category-match business rules (Sections 16-17).
 * Returns one of: 'PASS' | 'REVIEW' | 'REJECT'
 */
function evaluateAiResult({ selectedCategory, aiCategory, aiConfidence, failed }) {
  if (failed) return 'REVIEW'; // AI unavailable -> human review, never crash/reject outright

  const { autoPass, reviewMin } = getConfidenceThresholds();
  const categoryMatches = aiCategory === selectedCategory;

  if (aiConfidence < reviewMin) return 'REJECT';
  if (aiConfidence >= autoPass && categoryMatches) return 'PASS';
  return 'REVIEW'; // mid-confidence, or high-confidence-but-mismatched category
}

module.exports = {
  CATEGORIES,
  classifyIssueImage,
  getConfidenceThresholds,
  evaluateAiResult,
};