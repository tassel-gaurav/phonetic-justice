document.addEventListener('DOMContentLoaded', async function() {
    const voiceSelectorContainer = document.getElementById('voice-selector-container');
    // Explicitly hide the container on page load by directly setting its style.
    voiceSelectorContainer.style.display = 'none';

    // Fetch voices and populate the dropdown on page load
    try {
        const response = await fetch('/voices');
        const voices = await response.json();
        const voiceSelector = document.getElementById('voice-selector');
        voices.forEach(voice => {
            const option = document.createElement('option');
            option.value = voice.voice_id;
            option.textContent = voice.name;
            voiceSelector.appendChild(option);
        });
    } catch (error) {
        console.error("Failed to load voices:", error);
    }
});

let currentName = ''; // Keep track of the name being processed

document.getElementById('name-form').addEventListener('submit', async function(event) {
    event.preventDefault();
    // When submitting the form, it's always a new request, so reset the name.
    const nameInput = document.getElementById('name-input');
    if (nameInput.value !== currentName) {
        currentName = '';
    }
    await handlePronunciationRequest();
});

document.getElementById('voice-selector').addEventListener('change', async function(event) {
    // When the user manually changes the voice, re-submit the request for the current name.
    await handlePronunciationRequest();
});

async function handlePronunciationRequest() {
    const nameInput = document.getElementById('name-input');
    const voiceSelector = document.getElementById('voice-selector');
    const resultsContainer = document.getElementById('results-container');
    const ethnicityResultDiv = document.getElementById('ethnicity-result');
    const pronunciationResultDiv = document.getElementById('pronunciation-result');
    const errorMessageDiv = document.getElementById('error-message');
    const loader = document.getElementById('loader');
    const resultContent = document.getElementById('result-content');
    const feedbackButtons = document.getElementById('feedback-buttons');
    const autoSelectMessage = document.getElementById('auto-select-message');
    const voiceSelectorContainer = document.getElementById('voice-selector-container');

    const name = nameInput.value;
    if (!name) {
        errorMessageDiv.innerText = 'Please enter a name.';
        return;
    }

    // Show loader and hide all result-related elements, including the voice selector
    resultsContainer.classList.remove('hidden');
    loader.classList.remove('hidden');
    resultContent.classList.add('hidden');
    feedbackButtons.classList.add('hidden');
    autoSelectMessage.classList.add('hidden');
    voiceSelectorContainer.style.display = 'none'; // Use direct style manipulation
    errorMessageDiv.innerHTML = '';
    ethnicityResultDiv.innerHTML = '';
    pronunciationResultDiv.innerHTML = '';

    // If currentName is empty, it's a new request where the backend should auto-detect.
    // Otherwise, it's a follow-up request with a manually selected voice.
    const isNewPronunciationRequest = (currentName === '');
    currentName = name; // Lock in the name for this request cycle

    try {
        const response = await fetch('/pronounce', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: name,
                voice_id: isNewPronunciationRequest ? null : voiceSelector.value
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Display ethnicity results
        const { ethnicity_result, transliteration_result, pronunciation_result } = data;
        ethnicityResultDiv.innerHTML = `
            <p><strong>Detected Ethnicity:</strong> ${ethnicity_result.ethnicity} 
               (Confidence: ${ethnicity_result.confidence.toFixed(2)})</p>
            <p><strong>Possible Alternatives:</strong> ${ethnicity_result.alternatives.join(', ')}</p>
            <p><strong>Native Script:</strong> <span class="native-script">${transliteration_result.native_script}</span></p>
            <p><em>${transliteration_result.details}</em></p>
        `;

        // First, update the dropdown to the voice that was actually used. This fixes the bug.
        voiceSelector.value = pronunciation_result.voice_id_used;
        
        // ONLY show the message if a specific voice was automatically selected.
        if (pronunciation_result.selection_method === 'automatic_specific') {
            const selectedVoiceName = voiceSelector.options[voiceSelector.selectedIndex].text;
            autoSelectMessage.innerHTML = `For the detected ethnicity (<strong>${ethnicity_result.ethnicity}</strong>), we've automatically selected a suitable voice (<strong>${selectedVoiceName}</strong>). You can change it below.`;
            autoSelectMessage.style.display = 'block';
        } else {
            autoSelectMessage.style.display = 'none';
        }

        // Now that all logic is complete, show the voice selector.
        voiceSelectorContainer.style.display = 'flex';

        // Display pronunciation results
        pronunciationResultDiv.innerHTML = `
            <p><strong>Pronunciation Status:</strong> ${pronunciation_result.status}</p>
            <p><em>${pronunciation_result.details}</em></p>
        `;
        // If audio was successfully generated, create and append an audio player
        if (pronunciation_result.audio_output) {
            const audioPlayer = document.createElement('audio');
            audioPlayer.controls = true;
            audioPlayer.src = pronunciation_result.audio_output;
            pronunciationResultDiv.appendChild(audioPlayer);
        }

        resultContent.classList.remove('hidden');
        feedbackButtons.classList.remove('hidden');

    } catch (error) {
        errorMessageDiv.innerText = `An error occurred: ${error.message}. Please try again.`;
        resultContent.classList.add('hidden');
        feedbackButtons.classList.add('hidden');
        ethnicityResultDiv.innerHTML = '';
        pronunciationResultDiv.innerHTML = '';
        // Also hide the voice selector on error
        voiceSelectorContainer.style.display = 'none'; // Use direct style manipulation
    } finally {
        // Hide loader
        loader.classList.add('hidden');
    }
}

document.getElementById('retry-btn').addEventListener('click', () => {
    alert('Functionality to get another pronunciation is not yet implemented.');
});

document.getElementById('submit-own-btn').addEventListener('click', () => {
    alert('Functionality to submit your own pronunciation is not yet implemented.');
}); 