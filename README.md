# Phonetic Justice

Phonetic Justice is an advanced AI-powered application designed to address the common challenge of mispronouncing multilingual names. It provides accurate phonetic pronunciations by leveraging a sophisticated, multi-agent system to analyze a name, determine its origin, convert it to its native script, and generate high-quality, authentic audio.

![UI Screenshot](https://user-images.githubusercontent.com/12345/your-screenshot-url-here.png) <!-- TODO: Add a real screenshot -->

## Core Features

- **AI-Powered Ethnicity Detection**: Utilizes Google's Gemini 1.5 Pro to analyze a name and predict its most likely ethnic and linguistic origin.
- **Native Script Transliteration**: Converts Romanized names into their authentic native script (e.g., "Liu" -> "刘") for higher-quality audio generation.
- **Dynamic Voice Selection**: Uses a high-quality, multilingual Text-to-Speech model from ElevenLabs and dynamically selects a native-sounding voice for specific languages (e.g., Arabic) to ensure correct inflection.
- **Intelligent Fallback**: If a name cannot be confidently transliterated (e.g., most Western names), the system gracefully uses the original name for pronunciation to avoid errors.
- **Modern Frontend**: A sleek, responsive web interface for easy user interaction.

## System Architecture

The application is built on a modular, three-agent pipeline orchestrated by a FastAPI backend.

1.  **Ethnicity Detection Agent**: Receives a Romanized name and determines its origin.
2.  **Name Transliteration Agent**: Receives the name and ethnicity, then converts the name to its native script.
3.  **Pronunciation Generation Agent**: Receives the native script (or original name as a fallback) and generates the final audio file.

---

## How to Run Locally

Follow these steps to set up and run the project on your local machine.

### 1. Prerequisites

- Python 3.9+
- An active Google Gemini API Key.
- An active ElevenLabs API Key.

### 2. Clone the Repository

```bash
git clone https://github.com/tassel-team/phonetic-justice.git
cd phonetic-justice
```

### 3. Set Up Environment Variables

Create a file named `.env` in the root of the project directory. This file will hold your secret API keys and will be ignored by Git.

Add your keys to the `.env` file:

```
GOOGLE_API_KEY="YOUR_GEMINI_KEY_HERE"
ELEVENLABS_API_KEY="YOUR_ELEVENLABS_KEY_HERE"
```

### 4. Install Dependencies

Install all the necessary Python packages using pip:

```bash
pip install -r requirements.txt
```

### 5. Run the Application

Start the FastAPI server using Uvicorn:

```bash
python -m uvicorn src.phonetic_justice.main:app --reload
```

The server will be running at `http://127.0.0.1:8000`. Open this URL in your web browser to use the application.

---

## Deployment Guide (Render)

This project can be easily deployed as a Web Service on [Render](https://render.com/).

1.  **Push to GitHub**: Make sure your code, including the `Procfile` and `requirements.txt`, is pushed to a GitHub repository.

2.  **Create a New Web Service on Render**:
    - Go to your Render Dashboard.
    - Click "New +" and select "Web Service".
    - Connect your GitHub account and select your repository.

3.  **Configure the Service**:
    - **Name**: Give your service a unique name (e.g., `phonetic-justice`).
    - **Region**: Choose a region close to you.
    - **Branch**: Select the branch you want to deploy (e.g., `main`).
    - **Root Directory**: Leave this as is.
    - **Runtime**: Select `Python 3`.
    - **Build Command**: `pip install -r requirements.txt` (this is usually detected automatically).
    - **Start Command**: `uvicorn src.phonetic_justice.main:app --host 0.0.0.0 --port $PORT` (this will be picked up from your `Procfile`).

4.  **Add Environment Variables**:
    - Under "Advanced", go to the "Environment" section.
    - Add your secret keys as environment variables:
      - `GOOGLE_API_KEY`: `YOUR_GEMINI_KEY_HERE`
      - `ELEVENLABS_API_KEY`: `YOUR_ELEVENLABS_KEY_HERE`

5.  **Deploy**:
    - Click "Create Web Service".
    - Render will automatically build and deploy your application. You can monitor the progress in the deploy logs.
    - Once complete, your app will be live at the URL provided by Render (e.g., `https://phonetic-justice.onrender.com`). 