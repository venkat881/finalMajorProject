const fs = require('fs');

const CATEGORIES = [
  'Pothole',
  'Street Light / Electricity',
  'Water Leakage',
  'Drainage',
  'Garbage',
];

/**
 * Calls the local Flask TensorFlow classifier from serve.py.
 *
 * Python endpoint:
 *   POST http://localhost:8000/classify
 *
 * Expected Python response:
 *   {
 *     "category": "Pothole",
 *     "confidence": 0.97
 *   }
 *
 * Python confidence is 0-1.
 * This service converts it to 0-100.
 */
async function callExternalApi(imagePath) {
  const apiUrl =
    process.env.AI_API_URL || 'http://localhost:8000/classify';

  const imageBuffer = fs.readFileSync(imagePath);

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
    },
    body: imageBuffer,
  });

  if (!response.ok) {
    let message = `AI API responded with status ${response.status}`;

    try {
      const errorData = await response.json();

      if (errorData.error) {
        message += `: ${errorData.error}`;
      }
    } catch (_) {
      // Ignore JSON parsing failure
    }

    throw new Error(message);
  }

  const data = await response.json();

  // Make sure Python returned the expected values
  if (!data.category || data.confidence === undefined) {
    throw new Error(
      'AI API returned an invalid classification response'
    );
  }

  // Python model returns confidence between 0 and 1
  const confidence01 = Number(data.confidence);

  if (
    !Number.isFinite(confidence01) ||
    confidence01 < 0 ||
    confidence01 > 1
  ) {
    throw new Error(
      `Invalid AI confidence returned: ${data.confidence}`
    );
  }

  // Make sure the model returned one of our supported civic categories
  if (!CATEGORIES.includes(data.category)) {
    throw new Error(
      `AI returned unsupported category: ${data.category}`
    );
  }

  return {
    category: data.category,

    // Convert 0.97 -> 97
    confidence: Math.round(confidence01 * 100),

    // Keep complete Python response for debugging/logging
    raw: data,
  };
}

/**
 * classifyIssueImage
 *
 * Sends the uploaded image to the actual Python TensorFlow model.
 *
 * @param {string} imagePath
 *   Absolute path to the stored uploaded image.
 *
 * @param {string} selectedCategory
 *   Category selected by the citizen.
 *
 * @returns {Promise<{
 *   category: string|null,
 *   confidence: number,
 *   failed: boolean,
 *   error?: string,
 *   raw?: any
 * }>}
 */
async function classifyIssueImage(imagePath, selectedCategory) {
  try {
    const result = await callExternalApi(imagePath);

    console.log(
      `[ai.service] Model classification: ${result.category} (${result.confidence}%) | selected: ${selectedCategory}`
    );

    return {
      ...result,
      failed: false,
    };
  } catch (err) {
    console.error(
      '[ai.service] Classification failed, sending to AI_REVIEW:',
      err.message
    );

    return {
      category: null,
      confidence: 0,
      failed: true,
      error: err.message,
    };
  }
}

/**
 * Confidence thresholds
 *
 * Example:
 *
 * AI_CONFIDENCE_AUTO_PASS=85
 * AI_CONFIDENCE_REVIEW_MIN=50
 */
function getConfidenceThresholds() {
  return {
    autoPass: Number(
      process.env.AI_CONFIDENCE_AUTO_PASS || 85
    ),

    reviewMin: Number(
      process.env.AI_CONFIDENCE_REVIEW_MIN || 50
    ),
  };
}

/**
 * Applies AI verification rules.
 *
 * Rules:
 *
 * 1. AI unavailable
 *    -> REVIEW
 *
 * 2. Confidence below review minimum
 *    -> REJECT
 *
 * 3. High confidence AND AI category matches
 *    citizen selected category
 *    -> PASS
 *
 * 4. Everything else
 *    -> REVIEW
 */
function evaluateAiResult({
  selectedCategory,
  aiCategory,
  aiConfidence,
  failed,
}) {
  // If Python AI server is unavailable,
  // don't reject the citizen's issue automatically.
  if (failed) {
    return 'REVIEW';
  }

  const {
    autoPass,
    reviewMin,
  } = getConfidenceThresholds();

  // Compare citizen-selected category
  // against the actual AI classification.
  const categoryMatches =
    aiCategory === selectedCategory;

  // Very low confidence
  // Very low confidence
if (aiConfidence < reviewMin) {
  return 'REJECT';
}

// High-confidence matching category
if (aiConfidence >= autoPass && categoryMatches) {
  return 'PASS';
}

// AI confidently identified a DIFFERENT civic category.
// Do not allow submission.
if (aiConfidence >= autoPass && !categoryMatches) {
  return 'REJECT';
}

// Medium-confidence result -> manual review
return 'REVIEW';
  // Medium confidence OR category mismatch
  return 'REVIEW';
}

module.exports = {
  CATEGORIES,
  classifyIssueImage,
  getConfidenceThresholds,
  evaluateAiResult,
};