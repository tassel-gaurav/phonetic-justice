from typing import Dict, Any
import os
import json
import re
import google.generativeai as genai
from dotenv import load_dotenv
import uuid
import requests

class EthnicityDetectionAgent:
    """An agent that detects the ethnicity of a given name using the Gemini API."""

    def __init__(self):
        load_dotenv()
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_API_KEY not found in .env file.")
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-1.5-pro-latest')

    def run(self, name: str) -> Dict[str, Any]:
        """
        Runs the ethnicity detection process.

        Args:
            name: The romanized name to analyze.

        Returns:
            A dictionary with the predicted ethnicity and confidence.
        """
        prompt = f"""
        Analyze the following name and determine its most likely ethnic origin.
        Name: "{name}"

        Provide the output in a JSON object with the following keys:
        - "ethnicity": The most probable ethnicity (e.g., "Japanese", "Irish", "Hindi").
        - "confidence": A score from 0.0 to 1.0 indicating your confidence.
        - "alternatives": A list of other possible ethnicities.
        - "details": A brief explanation of your reasoning.

        Example:
        {{
          "ethnicity": "Irish",
          "confidence": 0.85,
          "alternatives": ["Scottish", "Welsh"],
          "details": "The name Siobhan is a common Gaelic name of Irish origin."
        }}

        JSON response:
        """

        try:
            response = self.model.generate_content(prompt)
            # Clean up the response to extract only the JSON part
            json_str = re.search(r'```json\n({.*?})\n```', response.text, re.DOTALL)
            if json_str:
                return json.loads(json_str.group(1))
            else:
                # Fallback for when the model doesn't use markdown
                return json.loads(response.text)
        except (Exception, json.JSONDecodeError) as e:
            print(f"Error processing Gemini response: {e}")
            return {
                "ethnicity": "Error",
                "confidence": 0.0,
                "alternatives": [],
                "details": "Failed to parse response from the AI model."
            }


class NameTransliterationAgent:
    """An agent that converts a romanized name to its native script."""

    def __init__(self):
        # The API key setup is lightweight, so it's safe to run it again.
        load_dotenv()
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_API_KEY not found for Transliteration Agent.")
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-1.5-pro-latest')

    def run(self, name: str, ethnicity: str) -> Dict[str, str]:
        """
        Converts the name to its native script based on ethnicity.
        """
        if ethnicity in ["Error", "Uncertain (Agent)"]:
             return {"native_script": name, "transliteration_successful": False, "details": "Cannot transliterate without a clear ethnicity."}

        prompt = f"""
        Analyze the following romanized name and its ethnicity. Your task is to convert the name into its native script.

        **Crucial Instructions:**
        1.  **Direct Transliteration Only:** Convert the name ONLY. Do NOT add any titles, honorifics (like Mr., Mrs., Sir), or any other words.
        2.  **Handle Latin Scripts:** If the name's native language uses the Latin alphabet (e.g., English, Spanish, German), state that transliteration is not applicable and return the original name.
        3.  **Confidence:** If you are not highly confident in the transliteration, it is better to return the original name.

        Name: "{name}"
        Ethnicity: "{ethnicity}"

        Provide the output as a JSON object with the following keys:
        - "native_script": The converted name in its native script, or the original name if not converted.
        - "transliteration_successful": A boolean (true/false) indicating if a meaningful conversion was performed.
        - "details": A brief explanation of your decision.

        Example 1 (Success):
        Input Name: "Guanxiong", Ethnicity: "Chinese"
        Output: {{ "native_script": "管雄", "transliteration_successful": true, "details": "The name was converted to Chinese characters." }}

        Example 2 (Failure/Fallback):
        Input Name: "John Smith", Ethnicity: "English"
        Output: {{ "native_script": "John Smith", "transliteration_successful": false, "details": "The name is English and already in its native (Latin) script." }}

        JSON response:
        """
        try:
            response = self.model.generate_content(prompt)
            # Clean up the response to extract only the JSON part
            json_str = re.search(r'```json\n({.*?})\n```', response.text, re.DOTALL)
            if json_str:
                return json.loads(json_str.group(1))
            else:
                # Fallback for when the model doesn't use markdown
                return json.loads(response.text)
        except (Exception, json.JSONDecodeError) as e:
            print(f"Error during transliteration: {e}")
            return {"native_script": name, "transliteration_successful": False, "details": "Failed to process transliteration model response."}


class PronunciationGenerationAgent:
    """An agent that generates pronunciation by calling the ElevenLabs HTTP API."""
    
    TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"

    # A curated list of high-quality voices to offer on the frontend for the hackathon.
    AVAILABLE_VOICES = [
        {"name": "Linh (Vietnamese)", "voice_id": "3VnrjnYrskPMDsapTr8X"},
        {"name": "Ian (Mandarin)", "voice_id": "xOb2inHvz6kuaPa9808C"},
        {"name": "Kayla (Hindi)", "voice_id": "fqmA1vGU7WYwC8w6Lidg"},
        {"name": "Monica (Arabic)", "voice_id": "m0ym3Tl23iHi7B3lTc2L"},
    ]

    # We can map ethnicities to specific, fine-tuned voices for better quality.
    VOICE_MAP = {
        "vietnamese": "3VnrjnYrskPMDsapTr8X", # Linh
        "chinese": "xOb2inHvz6kuaPa9808C",    # Ian (Mandarin)
        "arabic": "m0ym3Tl23iHi7B3lTc2L",      # Monica
        "indian": "fqmA1vGU7WYwC8w6Lidg",      # Kayla
    }
    # A good default, multilingual voice
    DEFAULT_VOICE_ID = "fqmA1vGU7WYwC8w6Lidg" # Kayla

    def __init__(self):
        load_dotenv()
        self.api_key = os.getenv("ELEVENLABS_API_KEY")
        if not self.api_key:
            raise ValueError("ELEVENLABS_API_KEY not found in .env file.")
        
        self.output_dir = os.path.join("static", "audio")
        os.makedirs(self.output_dir, exist_ok=True)
        
        self.headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": self.api_key
        }

    def run(self, native_script_name: str, ethnicity: str, voice_id: str | None = None) -> Dict[str, Any]:
        """
        Runs the pronunciation generation process using a direct HTTP call.
        Overrides automatic voice selection if a voice_id is provided.
        """
        print(f"Agent: Generating TTS for '{native_script_name}' via HTTP API")
        
        used_voice_id = voice_id
        selection_method = "manual"

        # If no voice_id is provided manually, use the automatic mapping
        if not used_voice_id:
            normalized_ethnicity = ethnicity.lower().strip()
            # Check if there is a specific mapping for this ethnicity
            if normalized_ethnicity in self.VOICE_MAP:
                used_voice_id = self.VOICE_MAP[normalized_ethnicity]
                selection_method = "automatic_specific" # A specific mapping was found
            else:
                used_voice_id = self.DEFAULT_VOICE_ID
                selection_method = "automatic_default" # Fell back to default
        else:
             selection_method = "manual" # User provided a voice_id

        print(f"Agent: Selected voice_id '{used_voice_id}' for ethnicity '{ethnicity}' (Method: {selection_method})")

        request_url = self.TTS_URL.format(voice_id=used_voice_id)
        
        data = {
            "text": native_script_name,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.75,
                "speed": 1.0
            }
        }

        try:
            response = requests.post(request_url, json=data, headers=self.headers)
            response.raise_for_status() # Will raise an exception for 4xx/5xx errors

            # Save the audio to a file
            filename = f"pronunciation_{uuid.uuid4()}.mp3"
            file_path = os.path.join(self.output_dir, filename)
            
            with open(file_path, "wb") as f:
                f.write(response.content)

            web_path = f"/static/audio/{filename}"
            
            return {
                "audio_output": web_path,
                "status": "success",
                "details": f"Audio generated for '{native_script_name}'.",
                "voice_id_used": used_voice_id,
                "selection_method": selection_method
            }

        except requests.exceptions.RequestException as e:
            print(f"Error during TTS HTTP request: {e}")
            return {
                "audio_output": None,
                "status": "error_tts_http",
                "details": f"Failed to generate audio via API call. {e}",
                "voice_id_used": used_voice_id,
                "selection_method": selection_method
            }