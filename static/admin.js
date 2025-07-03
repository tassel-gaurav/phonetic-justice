// Admin Panel JavaScript
let namesData = [];

document.addEventListener('DOMContentLoaded', async function() {
    await loadNamesTable();
    setupEventListeners();
});

async function loadNamesTable() {
    try {
        const response = await fetch('/api/names');
        namesData = await response.json();
        renderNamesTable();
    } catch (error) {
        console.error('Failed to load names:', error);
    }
}

function renderNamesTable() {
    const tbody = document.getElementById('names-tbody');
    tbody.innerHTML = '';

    namesData.forEach(name => {
        const row = document.createElement('tr');
        
        // Determine action buttons based on whether audio exists
        let actionButtons = '';
        if (name.audio_path) {
            // Has saved audio - show "Show" button and "Review" instead of "Test"
            actionButtons = `
                <button class="action-btn show-btn" onclick="showInlineAudio(${name.id}, this)">👁️ Show</button>
                <button class="action-btn review-btn hidden" onclick="reviewPronunciation(${name.id})" id="review-btn-${name.id}">📝 Review</button>
                <button class="action-btn" onclick="markAsCorrect(${name.id})">✓</button>
                <button class="action-btn" onclick="markAsNeedsReview(${name.id})">⚠</button>
            `;
        } else {
            // No saved audio - show Test button to generate
            actionButtons = `
                <button class="action-btn test-btn" onclick="testPronunciation(${name.id})">🧪 Generate</button>
                <button class="action-btn" onclick="markAsCorrect(${name.id})">✓</button>
                <button class="action-btn" onclick="markAsNeedsReview(${name.id})">⚠</button>
            `;
        }

        row.innerHTML = `
            <td>${name.name}</td>
            <td>${name.detected_ethnicity || 'Not tested'}</td>
            <td>${name.native_script || 'Not tested'}</td>
            <td><span class="status-badge status-${name.status}">${formatStatus(name.status)}</span></td>
            <td>${name.last_tested || 'Never'}</td>
            <td class="action-cell">
                ${actionButtons}
                <div id="audio-container-${name.id}" class="inline-audio-container hidden"></div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function formatStatus(status) {
    switch(status) {
        case 'untested': return 'Untested';
        case 'correct': return 'Correct';
        case 'needs_review': return 'Needs Review';
        default: return status;
    }
}

function setupEventListeners() {
    // Add Name Modal
    document.getElementById('add-name-btn').addEventListener('click', () => {
        document.getElementById('add-name-modal').classList.remove('hidden');
    });

    document.getElementById('close-add-modal').addEventListener('click', closeAddModal);
    document.getElementById('cancel-add-btn').addEventListener('click', closeAddModal);

    // Bulk Import Modal
    document.getElementById('bulk-import-btn').addEventListener('click', () => {
        document.getElementById('bulk-import-modal').classList.remove('hidden');
    });

    document.getElementById('close-bulk-modal').addEventListener('click', closeBulkModal);
    document.getElementById('cancel-bulk-btn').addEventListener('click', closeBulkModal);
    
    document.getElementById('process-names-btn').addEventListener('click', processBulkNames);

    // Add Name Form
    document.getElementById('add-name-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await addNewName();
    });

    // Pronunciation Modal
    document.getElementById('close-modal').addEventListener('click', closePronunciationModal);

    // Modal background click to close - more robust handling
    document.addEventListener('click', (e) => {
        if (e.target.id === 'pronunciation-modal') {
            closePronunciationModal();
        } else if (e.target.id === 'add-name-modal') {
            closeAddModal();
        } else if (e.target.id === 'bulk-import-modal') {
            closeBulkModal();
        }
    });

    // ESC key to close modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (!document.getElementById('pronunciation-modal').classList.contains('hidden')) {
                closePronunciationModal();
            } else if (!document.getElementById('add-name-modal').classList.contains('hidden')) {
                closeAddModal();
            } else if (!document.getElementById('bulk-import-modal').classList.contains('hidden')) {
                closeBulkModal();
            }
        }
    });
}

async function testPronunciation(nameId) {
    const nameRecord = namesData.find(n => n.id === nameId);
    if (!nameRecord) return;

    // Show modal
    document.getElementById('modal-name').textContent = `Testing: ${nameRecord.name}`;
    document.getElementById('pronunciation-modal').classList.remove('hidden');
    
    // Check if we have saved results
    if (nameRecord.detected_ethnicity && nameRecord.native_script && nameRecord.audio_path) {
        // Show saved results in accordion structure
        showSavedResults(nameRecord);
        return;
    }

    // Show loader for new generation
    document.getElementById('modal-loader').classList.remove('hidden');
    document.getElementById('modal-results').innerHTML = '';
    document.getElementById('modal-audio-section').classList.add('hidden');
    document.getElementById('modal-alternatives').classList.add('hidden');

    try {
        const response = await fetch('/pronounce', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: nameRecord.name, voice_id: null }),
        });

        if (!response.ok) throw new Error('Failed to get pronunciation');

        const data = await response.json();
        
        // Update the database record with new info
        const updatedRecord = {
            ...nameRecord,
            detected_ethnicity: data.ethnicity_result.ethnicity,
            native_script: data.transliteration_result.native_script,
            audio_path: data.pronunciation_result.audio_output,
            status: 'untested', // Keep as untested until user marks it
            last_tested: new Date().toISOString().split('T')[0]
        };

        // Update local data
        const index = namesData.findIndex(n => n.id === nameId);
        if (index !== -1) namesData[index] = updatedRecord;

        // Update the backend database with the audio_path
        try {
            await fetch(`/api/names/${nameId}/update`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    detected_ethnicity: data.ethnicity_result.ethnicity,
                    native_script: data.transliteration_result.native_script,
                    audio_path: data.pronunciation_result.audio_output,
                    last_tested: new Date().toISOString().split('T')[0]
                }),
            });
        } catch (updateError) {
            console.warn('Failed to update backend record:', updateError);
        }

        // Show results
        showPronunciationResults(data);

        // Refresh table
        renderNamesTable();

    } catch (error) {
        document.getElementById('modal-results').innerHTML = `
            <div style="color: #ff8a80;">
                Error: ${error.message}
            </div>
        `;
    } finally {
        document.getElementById('modal-loader').classList.add('hidden');
    }
}

function showSavedResults(nameRecord) {
    document.getElementById('modal-loader').classList.add('hidden');
    
    // Create accordion structure for reviewing results
    document.getElementById('modal-results').innerHTML = `
        <div class="saved-results-accordion">
            <div class="accordion-section">
                <button class="accordion-header active" onclick="toggleAccordion(this)">
                    <span>📋 Generated Information</span>
                    <span class="accordion-icon">▼</span>
                </button>
                <div class="accordion-content show">
                    <p><strong>Detected Ethnicity:</strong> ${nameRecord.detected_ethnicity}</p>
                    <p><strong>Native Script:</strong> <span class="native-script">${nameRecord.native_script}</span></p>
                    <p><strong>Generated:</strong> ${nameRecord.last_tested || 'During bulk import'}</p>
                    <p><strong>Current Status:</strong> <span class="status-badge status-${nameRecord.status}">${formatStatus(nameRecord.status)}</span></p>
                </div>
            </div>
            
            ${nameRecord.audio_path ? `
            <div class="accordion-section">
                <button class="accordion-header active" onclick="toggleAccordion(this)">
                    <span>🔊 Generated Pronunciation</span>
                    <span class="accordion-icon">▼</span>
                </button>
                <div class="accordion-content show">
                    <audio controls style="width: 100%; margin-bottom: 1rem;">
                        <source src="${nameRecord.audio_path}" type="audio/mpeg">
                    </audio>
                    <div class="pronunciation-quality">
                        <p><strong>How does this sound?</strong></p>
                        <div class="quality-buttons">
                            <button onclick="markAsCorrectFromReview(${nameRecord.id})" class="quality-btn correct-btn">✅ Sounds Good</button>
                            <button onclick="markAsNeedsReviewFromReview(${nameRecord.id})" class="quality-btn review-btn">⚠️ Needs Work</button>
                        </div>
                    </div>
                </div>
            </div>
            ` : ''}
            
            <div class="accordion-section">
                <button class="accordion-header" onclick="toggleAccordion(this)">
                    <span>🔧 Improvement Options</span>
                    <span class="accordion-icon">▶</span>
                </button>
                <div class="accordion-content">
                    <p style="margin-bottom: 1rem; color: var(--subtle-text-color);">
                        <em>Only use these if the current pronunciation needs improvement:</em>
                    </p>
                    <div class="improvement-actions">
                        <button onclick="getAlternativePronunciations('${nameRecord.name}', '/pronounce/all', 'Specialized Voices')" class="improvement-btn">🎯 Try Specialized Voices</button>
                        <button onclick="getAlternativePronunciations('${nameRecord.name}', '/pronounce/general', 'General Voices')" class="improvement-btn">🎙️ Try General Voices</button>
                        <button onclick="regeneratePronunciation(${nameRecord.id})" class="improvement-btn">🔄 Regenerate Current</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function showPronunciationResults(data) {
    document.getElementById('modal-results').innerHTML = `
        <div style="margin-bottom: 1rem;">
            <p><strong>Detected Ethnicity:</strong> ${data.ethnicity_result.ethnicity} 
               (Confidence: ${data.ethnicity_result.confidence.toFixed(2)})</p>
            <p><strong>Native Script:</strong> <span style="font-size: 1.2rem; color: var(--primary-color);">${data.transliteration_result.native_script}</span></p>
            <p><em>${data.transliteration_result.details}</em></p>
        </div>
    `;

    // Show audio
    if (data.pronunciation_result.audio_output) {
        document.getElementById('modal-audio-player').innerHTML = `
            <audio controls style="width: 100%;">
                <source src="${data.pronunciation_result.audio_output}" type="audio/mpeg">
            </audio>
        `;
        document.getElementById('modal-audio-section').classList.remove('hidden');

        // Setup action buttons
        setupModalActionButtons(data.nameId, data.name);
    }
}

async function regeneratePronunciation(nameId) {
    const nameRecord = namesData.find(n => n.id === nameId);
    if (!nameRecord) return;

    // Show loader
    document.getElementById('modal-loader').classList.remove('hidden');
    document.getElementById('modal-results').innerHTML = '';

    try {
        const response = await fetch('/pronounce', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: nameRecord.name, voice_id: null }),
        });

        if (!response.ok) throw new Error('Failed to regenerate pronunciation');

        const data = await response.json();
        
        // Update the database record
        const updatedRecord = {
            ...nameRecord,
            detected_ethnicity: data.ethnicity_result.ethnicity,
            native_script: data.transliteration_result.native_script,
            audio_path: data.pronunciation_result.audio_output,
            last_tested: new Date().toISOString().split('T')[0]
        };

        // Update local data
        const index = namesData.findIndex(n => n.id === nameId);
        if (index !== -1) namesData[index] = updatedRecord;

        // Update the backend database with the new audio_path
        try {
            await fetch(`/api/names/${nameId}/update`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    detected_ethnicity: data.ethnicity_result.ethnicity,
                    native_script: data.transliteration_result.native_script,
                    audio_path: data.pronunciation_result.audio_output,
                    last_tested: new Date().toISOString().split('T')[0]
                }),
            });
        } catch (updateError) {
            console.warn('Failed to update backend record:', updateError);
        }

        // Show new results
        showSavedResults(updatedRecord);

        // Refresh table
        renderNamesTable();

    } catch (error) {
        document.getElementById('modal-results').innerHTML = `
            <div style="color: #ff8a80;">
                Error: ${error.message}
            </div>
        `;
    } finally {
        document.getElementById('modal-loader').classList.add('hidden');
    }
}

function toggleAccordion(button) {
    const content = button.nextElementSibling;
    const icon = button.querySelector('.accordion-icon');
    const isActive = button.classList.contains('active');
    
    if (isActive) {
        button.classList.remove('active');
        content.classList.remove('show');
        icon.textContent = '▶';
    } else {
        button.classList.add('active');
        content.classList.add('show');
        icon.textContent = '▼';
    }
}

function setupModalActionButtons(nameId, name) {
    document.getElementById('try-specialized-btn').onclick = async () => {
        await getAlternativePronunciations(name, '/pronounce/all', 'Specialized Voices');
    };

    document.getElementById('try-general-btn').onclick = async () => {
        await getAlternativePronunciations(name, '/pronounce/general', 'General Voices');
    };

    document.getElementById('mark-correct-btn').onclick = async () => {
        await updateNameStatus(nameId, 'correct');
    };
}

async function getAlternativePronunciations(name, endpoint, title) {
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name, voice_id: null }),
        });

        if (!response.ok) throw new Error('Failed to get alternative pronunciations');

        const data = await response.json();
        const results = data.pronunciation_result;

        const alternativesList = document.getElementById('alternatives-list');
        alternativesList.innerHTML = `<h5>${title}:</h5>`;

        results.forEach(result => {
            if (result.audio_output) {
                const item = document.createElement('div');
                item.className = 'alternative-item';
                item.innerHTML = `
                    <h5>${result.voice_name || 'Unknown Voice'}</h5>
                    <audio controls style="width: 100%;">
                        <source src="${result.audio_output}" type="audio/mpeg">
                    </audio>
                `;
                alternativesList.appendChild(item);
            }
        });

        document.getElementById('modal-alternatives').classList.remove('hidden');

    } catch (error) {
        console.error('Error getting alternatives:', error);
    }
}

async function updateNameStatus(nameId, status) {
    try {
        const response = await fetch(`/api/names/${nameId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: status }),
        });

        if (!response.ok) throw new Error('Failed to update status');

        // Update local data
        const index = namesData.findIndex(n => n.id === nameId);
        if (index !== -1) {
            namesData[index].status = status;
            namesData[index].last_tested = new Date().toISOString().split('T')[0];
        }

        // Refresh table and close modal
        renderNamesTable();
        closePronunciationModal();

    } catch (error) {
        console.error('Error updating status:', error);
    }
}

async function markAsCorrect(nameId) {
    await updateNameStatus(nameId, 'correct');
}

async function markAsNeedsReview(nameId) {
    await updateNameStatus(nameId, 'needs_review');
}

async function addNewName() {
    const nameInput = document.getElementById('new-name-input');
    const ethnicityInput = document.getElementById('expected-ethnicity');

    const name = nameInput.value.trim();
    if (!name) return;

    try {
        const response = await fetch('/api/names', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: name,
                expected_ethnicity: ethnicityInput.value.trim() || null
            }),
        });

        if (!response.ok) throw new Error('Failed to add name');

        // Refresh the table
        await loadNamesTable();
        closeAddModal();

        // Clear form
        nameInput.value = '';
        ethnicityInput.value = '';

    } catch (error) {
        console.error('Error adding name:', error);
    }
}

function closePronunciationModal() {
    const modal = document.getElementById('pronunciation-modal');
    modal.classList.add('hidden');
    // Reset modal state
    document.getElementById('modal-results').innerHTML = '';
    document.getElementById('modal-audio-section').classList.add('hidden');
    document.getElementById('modal-alternatives').classList.add('hidden');
    document.getElementById('alternatives-list').innerHTML = '';
}

function closeAddModal() {
    const modal = document.getElementById('add-name-modal');
    modal.classList.add('hidden');
    // Clear form
    document.getElementById('new-name-input').value = '';
    document.getElementById('expected-ethnicity').value = '';
}

function closeBulkModal() {
    const modal = document.getElementById('bulk-import-modal');
    modal.classList.add('hidden');
    // Reset the form
    document.getElementById('names-textarea').value = '';
    document.getElementById('processing-section').classList.add('hidden');
    document.getElementById('progress-fill').style.width = '0%';
    document.getElementById('processing-log').innerHTML = '';
    document.getElementById('process-names-btn').disabled = false;
    document.getElementById('process-names-btn').textContent = 'Process Names';
}

async function processBulkNames() {
    const textarea = document.getElementById('names-textarea');
    const generatePronunciations = document.getElementById('auto-generate-pronunciations').checked;
    
    const namesText = textarea.value.trim();
    if (!namesText) {
        alert('Please enter some names to process.');
        return;
    }

    // Parse names from textarea (one per line)
    const namesList = namesText.split('\n')
        .map(name => name.trim())
        .filter(name => name.length > 0);

    if (namesList.length === 0) {
        alert('No valid names found.');
        return;
    }

    // Show processing section
    document.getElementById('processing-section').classList.remove('hidden');
    document.getElementById('process-names-btn').disabled = true;
    document.getElementById('process-names-btn').textContent = 'Processing...';

    // Initialize progress
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    const processingLog = document.getElementById('processing-log');
    
    progressText.textContent = `0 / ${namesList.length} names processed`;
    processingLog.innerHTML = '';

    addLogEntry('info', `Starting bulk processing of ${namesList.length} names...`);

    let processedCount = 0;
    let successCount = 0;
    let failedCount = 0;

    // Process names one by one for real-time updates
    for (let i = 0; i < namesList.length; i++) {
        const name = namesList[i];
        
        addLogEntry('info', `Processing: ${name}...`);
        
        try {
            // Add the name first
            const addResponse = await fetch('/api/names', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name,
                    expected_ethnicity: null
                }),
            });

            if (!addResponse.ok) throw new Error('Failed to add name');
            const addedName = await addResponse.json();
            
            if (generatePronunciations) {
                // Generate pronunciation for this name
                const pronounceResponse = await fetch('/pronounce', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: name, voice_id: null }),
                });

                if (pronounceResponse.ok) {
                    const data = await pronounceResponse.json();
                    const confidence = Math.round(data.ethnicity_result.confidence * 100);
                    
                    // Update the backend record with pronunciation data
                    try {
                        await fetch(`/api/names/${addedName.id}/update`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                detected_ethnicity: data.ethnicity_result.ethnicity,
                                native_script: data.transliteration_result.native_script,
                                audio_path: data.pronunciation_result.audio_output,
                                last_tested: new Date().toISOString().split('T')[0]
                            }),
                        });
                    } catch (updateError) {
                        console.warn('Failed to update backend record:', updateError);
                    }
                    
                    addLogEntry('success', 
                        `✅ ${name} → ${data.ethnicity_result.ethnicity} (${confidence}% confidence) → ${data.transliteration_result.native_script} with audio`
                    );
                    successCount++;
                } else {
                    addLogEntry('warning', `⚠️ ${name} → Added but pronunciation failed`);
                    successCount++; // Still count as success since name was added
                }
            } else {
                addLogEntry('success', `✅ ${name} → Added to database`);
                successCount++;
            }

        } catch (error) {
            addLogEntry('error', `❌ ${name} → Error: ${error.message}`);
            failedCount++;
        }

        processedCount++;
        
        // Update progress
        const progressPercent = (processedCount / namesList.length) * 100;
        progressFill.style.width = `${progressPercent}%`;
        progressText.textContent = `${processedCount} / ${namesList.length} names processed`;

        // Small delay to show progress clearly
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Final summary
    addLogEntry('info', `🎉 Bulk processing completed! ${successCount} successful, ${failedCount} failed`);

    // Refresh the table
    await loadNamesTable();

    // Reset button
    document.getElementById('process-names-btn').disabled = false;
    document.getElementById('process-names-btn').textContent = 'Process Names';
}

function addLogEntry(type, message) {
    const processingLog = document.getElementById('processing-log');
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    
    const timestamp = new Date().toLocaleTimeString();
    entry.textContent = `[${timestamp}] ${message}`;
    
    processingLog.appendChild(entry);
    processingLog.scrollTop = processingLog.scrollHeight;
}

function showInlineAudio(nameId, buttonElement) {
    const nameRecord = namesData.find(n => n.id === nameId);
    if (!nameRecord || !nameRecord.audio_path) return;

    const audioContainer = document.getElementById(`audio-container-${nameId}`);
    const reviewButton = document.getElementById(`review-btn-${nameId}`);
    
    // Toggle audio container
    if (audioContainer.classList.contains('hidden')) {
        // Show audio
        audioContainer.innerHTML = `
            <div class="inline-audio-player">
                <div class="audio-info">
                    <strong>Generated Pronunciation:</strong>
                    <span class="native-script-small">${nameRecord.native_script}</span>
                </div>
                <audio controls style="width: 100%; margin: 0.5rem 0;" onplay="enableReviewButton(${nameId})">
                    <source src="${nameRecord.audio_path}" type="audio/mpeg">
                </audio>
                <div class="audio-actions">
                    <button class="mini-btn" onclick="hideInlineAudio(${nameId})">Hide</button>
                    <button class="mini-btn" onclick="openFullReview(${nameId})">Full Review</button>
                </div>
            </div>
        `;
        audioContainer.classList.remove('hidden');
        buttonElement.textContent = '👁️ Hide';
        buttonElement.classList.add('active');
    } else {
        // Hide audio
        hideInlineAudio(nameId);
    }
}

function hideInlineAudio(nameId) {
    const audioContainer = document.getElementById(`audio-container-${nameId}`);
    const showButton = document.querySelector(`[onclick="showInlineAudio(${nameId}, this)"]`);
    const reviewButton = document.getElementById(`review-btn-${nameId}`);
    
    audioContainer.classList.add('hidden');
    audioContainer.innerHTML = '';
    
    if (showButton) {
        showButton.textContent = '👁️ Show';
        showButton.classList.remove('active');
    }
    
    if (reviewButton) {
        reviewButton.classList.add('hidden');
    }
}

function enableReviewButton(nameId) {
    const reviewButton = document.getElementById(`review-btn-${nameId}`);
    if (reviewButton) {
        reviewButton.classList.remove('hidden');
        reviewButton.classList.add('pulse'); // Add a pulse animation to draw attention
        setTimeout(() => {
            reviewButton.classList.remove('pulse');
        }, 2000);
    }
}

function openFullReview(nameId) {
    // Hide inline audio first
    hideInlineAudio(nameId);
    // Then open the full review modal (same as test but different context)
    reviewPronunciation(nameId);
}

// Review function for existing pronunciations
async function reviewPronunciation(nameId) {
    const nameRecord = namesData.find(n => n.id === nameId);
    if (!nameRecord) return;

    // Show modal with review context
    document.getElementById('modal-name').textContent = `Reviewing: ${nameRecord.name}`;
    document.getElementById('pronunciation-modal').classList.remove('hidden');
    
    // Always show saved results for review (since audio already exists)
    showSavedResults(nameRecord);
}

async function markAsCorrectFromReview(nameId) {
    await updateNameStatus(nameId, 'correct');
    // Show success message briefly
    const modal = document.getElementById('pronunciation-modal');
    const originalContent = document.getElementById('modal-results').innerHTML;
    document.getElementById('modal-results').innerHTML = `
        <div style="text-align: center; padding: 2rem; color: #28a745;">
            <h3>✅ Marked as Correct!</h3>
            <p>This pronunciation has been approved.</p>
        </div>
    `;
    setTimeout(() => {
        closePronunciationModal();
    }, 1500);
}

async function markAsNeedsReviewFromReview(nameId) {
    await updateNameStatus(nameId, 'needs_review');
    // Show message and keep accordion open for improvements
    const nameRecord = namesData.find(n => n.id === nameId);
    showSavedResults({...nameRecord, status: 'needs_review'});
    
    // Show improvement section automatically
    const improvementSection = document.querySelector('.accordion-section:last-child .accordion-header');
    if (improvementSection && !improvementSection.classList.contains('active')) {
        toggleAccordion(improvementSection);
    }
}