from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi import HTTPException
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

class NameRecord(BaseModel):
    id: int
    name: str
    detected_ethnicity: str | None = None
    native_script: str | None = None
    status: str = "untested"  # untested, correct, needs_review
    last_tested: str | None = None
    expected_ethnicity: str | None = None
    audio_path: str | None = None

class UpdateNameStatus(BaseModel):
    name_id: int
    status: str

class PronunciationOutput(BaseModel):
    ethnicity_result: EthnicityResult
    transliteration_result: TransliterationResult
    pronunciation_result: PronunciationResult | list[PronunciationResult]

# Simple in-memory storage for demo (in production, use a real database)
names_database = []
next_id = 1

@app.get("/", response_class=FileResponse)
def read_index():
    """Serves the main index.html file."""
    return os.path.join(static_dir, "index.html")

@app.get("/admin", response_class=FileResponse)
def read_admin():
    """Serves the admin panel for managing pronunciations."""
    return os.path.join(static_dir, "admin.html")

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

@app.get("/api/names")
async def get_all_names():
    """Returns all names in the database for the admin panel."""
    return names_database

@app.post("/api/names")
async def add_name(data: dict):
    """Adds a new name to the database."""
    global next_id
    new_name = {
        "id": next_id,
        "name": data["name"],
        "detected_ethnicity": None,
        "native_script": None,
        "status": "untested",
        "last_tested": None,
        "expected_ethnicity": data.get("expected_ethnicity"),
        "audio_path": None
    }
    names_database.append(new_name)
    next_id += 1
    return new_name

@app.put("/api/names/{name_id}/status")
async def update_name_status(name_id: int, data: dict):
    """Updates the status of a name."""
    from datetime import datetime
    
    for name_record in names_database:
        if name_record["id"] == name_id:
            name_record["status"] = data["status"]
            name_record["last_tested"] = datetime.now().strftime("%Y-%m-%d")
            return name_record
    
    raise HTTPException(status_code=404, detail="Name not found")

@app.put("/api/names/{name_id}/update")
async def update_name_record(name_id: int, data: dict):
    """Updates a name record with pronunciation data."""
    for name_record in names_database:
        if name_record["id"] == name_id:
            # Update all provided fields
            if "detected_ethnicity" in data:
                name_record["detected_ethnicity"] = data["detected_ethnicity"]
            if "native_script" in data:
                name_record["native_script"] = data["native_script"]
            if "audio_path" in data:
                name_record["audio_path"] = data["audio_path"]
            if "last_tested" in data:
                name_record["last_tested"] = data["last_tested"]
            return name_record
    
    raise HTTPException(status_code=404, detail="Name not found")

@app.post("/api/bulk-process")
async def bulk_process_names(data: dict):
    """Processes multiple names at once through the agent pipeline."""
    names_list = data.get("names", [])
    generate_pronunciations = data.get("generate_pronunciations", False)
    
    if not names_list:
        raise HTTPException(status_code=400, detail="No names provided")
    
    results = []
    global next_id
    
    for name in names_list:
        name = name.strip()
        if not name:
            continue
            
        try:
            # Step 1: Detect ethnicity
            ethnicity_result = ethnicity_agent.run(name)
            detected_ethnicity = ethnicity_result.get("ethnicity", "Uncertain")
            
            # Step 2: Transliterate name to native script
            transliteration_result = transliteration_agent.run(name, detected_ethnicity)
            native_script = transliteration_result.get("native_script", name)
            
            # Step 3: Optionally generate pronunciation
            audio_path = None
            if generate_pronunciations:
                try:
                    name_to_pronounce = native_script if transliteration_result.get("transliteration_successful") else name
                    pronunciation_result = pronunciation_agent.run(
                        name_to_pronounce,
                        detected_ethnicity
                    )
                    audio_path = pronunciation_result.get("audio_output")
                except Exception as e:
                    print(f"Error generating pronunciation for {name}: {e}")
            
            # Create database record
            new_record = {
                "id": next_id,
                "name": name,
                "detected_ethnicity": detected_ethnicity,
                "native_script": native_script,
                "status": "untested",
                "last_tested": None,
                "audio_path": audio_path
            }
            
            names_database.append(new_record)
            next_id += 1
            
            results.append({
                "name": name,
                "success": True,
                "record": new_record,
                "ethnicity_confidence": ethnicity_result.get("confidence", 0),
                "transliteration_successful": transliteration_result.get("transliteration_successful", False)
            })
            
        except Exception as e:
            results.append({
                "name": name,
                "success": False,
                "error": str(e)
            })
    
    return {
        "processed_count": len([r for r in results if r["success"]]),
        "failed_count": len([r for r in results if not r["success"]]),
        "results": results
    }

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