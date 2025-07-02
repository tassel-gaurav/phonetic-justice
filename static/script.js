document.addEventListener('DOMContentLoaded', async function() {
    const voiceSelectorContainer = document.getElementById('voice-selector-container');
    // Explicitly hide the container on page load by directly setting its style.
    voiceSelectorContainer.style.display = 'none';

    // Fetch voices and populate the dropdown on page load
    try {
        const response = await fetch('/voices');
        const voices = await response.json();
        const voiceSelector = document.getElementById('voice-selector');
        
        // Group voices by category
        const specializedVoices = voices.filter(voice => voice.category === 'Specialized');
        const generalVoices = voices.filter(voice => voice.category === 'General');
        
        // Create optgroups for better organization
        if (specializedVoices.length > 0) {
            const specializedGroup = document.createElement('optgroup');
            specializedGroup.label = 'Specialized Voices';
            specializedVoices.forEach(voice => {
                const option = document.createElement('option');
                option.value = voice.voice_id;
                option.textContent = voice.name;
                specializedGroup.appendChild(option);
            });
            voiceSelector.appendChild(specializedGroup);
        }
        
        if (generalVoices.length > 0) {
            const generalGroup = document.createElement('optgroup');
            generalGroup.label = 'General Voices';
            generalVoices.forEach(voice => {
                const option = document.createElement('option');
                option.value = voice.voice_id;
                option.textContent = voice.name;
                generalGroup.appendChild(option);
            });
            voiceSelector.appendChild(generalGroup);
        }
    } catch (error) {
        console.error("Failed to load voices:", error);
    }
});

let currentName = ''; // Keep track of the name being processed

document.getElementById('name-form').addEventListener('submit', async function(event) {
    event.preventDefault();
    
    // Reset for new pronunciation request
    const nameInput = document.getElementById('name-input');
    const newName = nameInput.value.trim();
    
    // If it's a different name, reset everything
    if (newName !== currentName) {
        currentName = '';  // This will trigger auto-detection
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

    // COMPLETE RESET: Always clear all previous results and additional sections for every pronunciation request
    const alternativesContainer = document.getElementById('alternatives-container');
    const generalContainer = document.getElementById('general-container');
    if (alternativesContainer) {
        alternativesContainer.remove();
    }
    if (generalContainer) {
        generalContainer.remove();
    }

    // Reset all button states that might have been modified
    const retryBtn = document.getElementById('retry-btn');
    const generalBtn = document.getElementById('general-voices-btn');
    if (retryBtn) {
        retryBtn.disabled = false;
        retryBtn.textContent = 'Get Another';
    }
    if (generalBtn) {
        generalBtn.disabled = false;
        generalBtn.textContent = 'Try General Voices';
    }

    // Show loader and hide all result-related elements, including the voice selector
    resultsContainer.classList.remove('hidden');
    loader.classList.remove('hidden');
    resultContent.classList.add('hidden');
    feedbackButtons.classList.add('hidden');
    feedbackButtons.style.display = 'none'; // Ensure it's hidden during loading
    autoSelectMessage.classList.add('hidden');
    voiceSelectorContainer.style.display = 'none'; // Use direct style manipulation
    errorMessageDiv.innerHTML = '';
    ethnicityResultDiv.innerHTML = '';
    pronunciationResultDiv.innerHTML = '';

    // Reset pronunciation result display style in case it was hidden
    pronunciationResultDiv.style.display = 'block';

    // Determine if this is a new pronunciation request (new name) or voice change for same name
    const isNewPronunciationRequest = (currentName !== name);
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
        
        // Ensure buttons are visible (additional safety check)
        feedbackButtons.style.display = 'block';

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

document.getElementById('retry-btn').addEventListener('click', async () => {
    const name = document.getElementById('name-input').value;
    if (!name) return;

    const retryBtn = document.getElementById('retry-btn');
    retryBtn.disabled = true; // Prevent multiple clicks
    retryBtn.textContent = 'Generating...';

    const feedbackButtons = document.getElementById('feedback-buttons');
    const existingPronunciationResult = document.getElementById('pronunciation-result');
    
    try {
        const response = await fetch('/pronounce/all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name, voice_id: null }),
        });

        if (!response.ok) throw new Error('Failed to get new pronunciations.');

        const data = await response.json();
        const results = data.pronunciation_result;

        // Hide the initial result and the feedback buttons
        existingPronunciationResult.style.display = 'none';
        feedbackButtons.style.display = 'none';

        // Create a new container for the alternatives
        let alternativesContainer = document.getElementById('alternatives-container');
        if (!alternativesContainer) {
            alternativesContainer = document.createElement('div');
            alternativesContainer.id = 'alternatives-container';
            // Insert it after the main result content
            document.getElementById('result-content').appendChild(alternativesContainer);
        }
        
        alternativesContainer.innerHTML = '<h3>Other Voices</h3>'; // Clear previous alternatives and add a title

        results.forEach(result => {
            const voiceName = result.voice_name || 'Unknown Voice';
            const audioSrc = result.audio_output;

            if (audioSrc) {
                const playerWrapper = document.createElement('div');
                playerWrapper.className = 'alternative-player';
                playerWrapper.innerHTML = `
                    <p><strong>${voiceName}:</strong></p>
                    <audio controls src="${audioSrc}"></audio>
                `;
                alternativesContainer.appendChild(playerWrapper);
            }
        });

    } catch (error) {
        console.error("Error getting all pronunciations:", error);
        retryBtn.textContent = 'Error!';
        // Restore button after a delay
        setTimeout(() => {
            retryBtn.disabled = false;
            retryBtn.textContent = 'Get Another';
        }, 2000);
    }
});

document.getElementById('general-voices-btn').addEventListener('click', async () => {
    const name = document.getElementById('name-input').value;
    if (!name) return;

    const generalBtn = document.getElementById('general-voices-btn');
    generalBtn.disabled = true; // Prevent multiple clicks
    generalBtn.textContent = 'Generating...';

    const feedbackButtons = document.getElementById('feedback-buttons');
    // DON'T hide the original pronunciation result - keep it visible for comparison
    // const existingPronunciationResult = document.getElementById('pronunciation-result');
    
    try {
        const response = await fetch('/pronounce/general', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name, voice_id: null }),
        });

        if (!response.ok) throw new Error('Failed to get general pronunciations.');

        const data = await response.json();
        const results = data.pronunciation_result;

        // Keep the original result visible and just hide the feedback buttons
        feedbackButtons.style.display = 'none';

        // Create a new container for the general alternatives
        let generalContainer = document.getElementById('general-container');
        if (!generalContainer) {
            generalContainer = document.createElement('div');
            generalContainer.id = 'general-container';
            // Insert it after the main result content
            document.getElementById('result-content').appendChild(generalContainer);
        }
        
        generalContainer.innerHTML = '<h3>General Voices</h3>'; // Clear previous alternatives and add a title

        results.forEach(result => {
            const voiceName = result.voice_name || 'Unknown Voice';
            const audioSrc = result.audio_output;

            if (audioSrc) {
                const playerWrapper = document.createElement('div');
                playerWrapper.className = 'general-player';
                playerWrapper.innerHTML = `
                    <p><strong>${voiceName}:</strong></p>
                    <audio controls src="${audioSrc}"></audio>
                `;
                generalContainer.appendChild(playerWrapper);
            }
        });

    } catch (error) {
        console.error("Error getting general pronunciations:", error);
        generalBtn.textContent = 'Error!';
        // Restore button after a delay
        setTimeout(() => {
            generalBtn.disabled = false;
            generalBtn.textContent = 'Try General Voices';
        }, 2000);
    }
});

document.getElementById('submit-own-btn').addEventListener('click', () => {
    alert('Functionality to submit your own pronunciation is not yet implemented.');
}); 