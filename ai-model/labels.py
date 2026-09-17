"""
Shared category mapping between training and serving.

Folder names on disk are filesystem-safe (no slashes/spaces); the values
are the EXACT category strings the Node backend expects — they must match
CATEGORIES in backend/services/ai.service.js character-for-character.
"""

CATEGORY_MAP = {
    "pothole": "Pothole",
    "street_light_electricity": "Street Light / Electricity",
    "water_leakage": "Water Leakage",
    "drainage": "Drainage",
    "garbage": "Garbage",
}

# Reverse lookup, used nowhere yet but handy if you need it
LABEL_TO_FOLDER = {v: k for k, v in CATEGORY_MAP.items()}
