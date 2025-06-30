document.getElementById('name-form').addEventListener('submit', async function(event) {
    event.preventDefault();

    const nameInput = document.getElementById('name-input');
    const resultsContainer = document.getElementById('results-container');
    const ethnicityResultDiv = document.getElementById('ethnicity-result');
    const pronunciationResultDiv = document.getElementById('pronunciation-result');
    const errorMessageDiv = document.getElementById('error-message');
    const loader = document.getElementById('loader');
    const resultContent = document.getElementById('result-content');
    const feedbackButtons = document.getElementById('feedback-buttons');

    // Show loader and results container, hide previous content
    resultsContainer.classList.remove('hidden');
    loader.classList.remove('hidden');
    resultContent.classList.add('hidden');
    feedbackButtons.classList.add('hidden');
    errorMessageDiv.innerHTML = '';
    ethnicityResultDiv.innerHTML = '';
    pronunciationResultDiv.innerHTML = '';

    const name = nameInput.value;

    try {
        const response = await fetch('/pronounce', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: name }),
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
    } finally {
        // Hide loader
        loader.classList.add('hidden');
    }
});

document.getElementById('retry-btn').addEventListener('click', () => {
    alert('Functionality to get another pronunciation is not yet implemented.');
});

document.getElementById('submit-own-btn').addEventListener('click', () => {
    alert('Functionality to submit your own pronunciation is not yet implemented.');
}); 