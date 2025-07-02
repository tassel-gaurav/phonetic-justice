from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
import os
import json
import asyncio
from typing import Any, Dict

from .agents import EthnicityDetectionAgent, PronunciationGenerationAgent, NameTransliterationAgent

# Initialize Agents
ethnicity_agent = EthnicityDetectionAgent()
transliteration_agent = NameTransliterationAgent()
pronunciation_agent = PronunciationGenerationAgent()

app = FastAPI(
    title="Phonetic Justice API",
    description="API for generating accurate pronunciations of multilingual names.",
    version="0.1.0",
)

# Determine the path to the static directory and cache file
base_dir = os.path.dirname(os.path.abspath(__file__))
static_dir = os.path.join(base_dir, "..", "..", "static")
cache_file = os.path.join(base_dir, "..", "..", "data", "pronunciation_cache.json")

# Mount the static directory
app.mount("/static", StaticFiles(directory=static_dir), name="static")

class EthnicityResult(BaseModel):
    ethnicity: str
    confidence: float
    alternatives: list[str] = []
    details: str

class TransliterationResult(BaseModel):
    native_script: str
    transliteration_successful: bool
    details: str | None = None

class PronunciationResult(BaseModel):
    audio_output: Any = None
    status: str
    details: str
    voice_id_used: str | None = None
    selection_method: str | None = None
    voice_name: str | None = None

class NameInput(BaseModel):
    name: str
    voice_id: str | None = None

class PronunciationOutput(BaseModel):
    ethnicity_result: EthnicityResult
    transliteration_result: TransliterationResult
    pronunciation_result: PronunciationResult | list[PronunciationResult]

@app.get("/", response_class=FileResponse)
def read_index():
    """Serves the main index.html file."""
    return os.path.join(static_dir, "index.html")

@app.get("/voices")
async def get_voices():
    """Returns a list of available TTS voices."""
    # Combine both specialized and general voices for the dropdown
    all_voices = []
    
    # Add specialized voices with a category label
    for voice in pronunciation_agent.AVAILABLE_VOICES:
        voice_with_category = voice.copy()
        voice_with_category['category'] = 'Specialized'
        all_voices.append(voice_with_category)
    
    # Add general voices with a category label
    for voice in pronunciation_agent.GENERAL_VOICES:
        voice_with_category = voice.copy()
        voice_with_category['category'] = 'General'
        all_voices.append(voice_with_category)
    
    return all_voices

@app.post("/pronounce/all", response_model=PronunciationOutput)
async def get_all_pronunciations(data: NameInput):
    """
    Generates pronunciations from all available voices for a given name.
    """
    # Step 1: Detect ethnicity
    ethnicity_result = ethnicity_agent.run(data.name)
    detected_ethnicity = ethnicity_result.get("ethnicity", "Uncertain")

    # Step 2: Transliterate name to native script
    transliteration_result = transliteration_agent.run(data.name, detected_ethnicity)
    
    # Determine which name to use for pronunciation
    if transliteration_result.get("transliteration_successful"):
        name_to_pronounce = transliteration_result.get("native_script", data.name)
    else:
        name_to_pronounce = data.name # Fallback to original name

    # Step 3: Generate pronunciation from all available voices
    pronunciation_results = pronunciation_agent.run(
        name_to_pronounce,
        detected_ethnicity,
        generate_for_all_available=True
    )

    # Combine results
    result = {
        "ethnicity_result": ethnicity_result,
        "transliteration_result": transliteration_result,
        "pronunciation_result": pronunciation_results
    }
    
    return PronunciationOutput(**result)

@app.post("/pronounce/general", response_model=PronunciationOutput)
async def get_general_pronunciations(data: NameInput):
    """
    Generates pronunciations from all general voices for a given name.
    """
    # Step 1: Detect ethnicity
    ethnicity_result = ethnicity_agent.run(data.name)
    detected_ethnicity = ethnicity_result.get("ethnicity", "Uncertain")

    # Step 2: Transliterate name to native script
    transliteration_result = transliteration_agent.run(data.name, detected_ethnicity)
    
    # Determine which name to use for pronunciation
    if transliteration_result.get("transliteration_successful"):
        name_to_pronounce = transliteration_result.get("native_script", data.name)
    else:
        name_to_pronounce = data.name # Fallback to original name

    # Step 3: Generate pronunciation from all general voices
    pronunciation_results = pronunciation_agent.run(
        name_to_pronounce,
        detected_ethnicity,
        generate_for_all_available=True,
        use_general_voices=True
    )

    # Combine results
    result = {
        "ethnicity_result": ethnicity_result,
        "transliteration_result": transliteration_result,
        "pronunciation_result": pronunciation_results
    }
    
    return PronunciationOutput(**result)

@app.post("/pronounce", response_model=PronunciationOutput)
async def get_pronunciation(data: NameInput):
    """
    Takes a name, checks cache, and uses agents to get pronunciation.
    """
    # Caching logic is temporarily disabled.
    # # Load cache
    # try:
    #     with open(cache_file, 'r') as f:
    #         cache = json.load(f)
    # except (FileNotFoundError, json.JSONDecodeError):
    #     cache = {}

    # # Check if name is in cache
    # if data.name.lower() in cache:
    #     # Ensure cached data conforms to the model
    #     try:
    #         return PronunciationOutput(**cache[data.name.lower()])
    #     except Exception:
    #         # If cache is old format, proceed to regenerate
    #         pass

    # Simulate thinking time and run agents
    await asyncio.sleep(1.5) # Simulates network/model latency

    # Step 1: Detect ethnicity
    ethnicity_result = ethnicity_agent.run(data.name)
    detected_ethnicity = ethnicity_result.get("ethnicity", "Uncertain")

    # Step 2: Transliterate name to native script
    transliteration_result = transliteration_agent.run(data.name, detected_ethnicity)
    
    # Determine which name to use for pronunciation
    if transliteration_result.get("transliteration_successful"):
        name_to_pronounce = transliteration_result.get("native_script", data.name)
    else:
        name_to_pronounce = data.name # Fallback to original name

    # Step 3: Generate pronunciation
    pronunciation_result = pronunciation_agent.run(
        name_to_pronounce,
        detected_ethnicity,
        voice_id=data.voice_id
    )

    # Combine results
    result = {
        "ethnicity_result": ethnicity_result,
        "transliteration_result": transliteration_result,
        "pronunciation_result": pronunciation_result
    }
    
    # Validate before returning
    try:
        validated_result = PronunciationOutput(**result)
    except Exception as e:
        print(f"Validation error before returning: {e}")
        # Handle error case, maybe return an error response
        raise

    # Caching logic is temporarily disabled.
    # # Save updated cache
    # cache[data.name.lower()] = validated_result.model_dump()
    # with open(cache_file, 'w') as f:
    #     json.dump(cache, f, indent=4)

    return validated_result 