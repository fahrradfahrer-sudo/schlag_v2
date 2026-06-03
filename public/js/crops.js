/**
 * Crops and NC-Matching Logic
 */

let cropList = [];

/**
 * Load crop mappings from JSON
 */
async function loadCropMappings() {
    try {
        const response = await fetch('data/crop_mappings.json');
        cropList = await response.json();
        populateCropDatalist();
    } catch (e) {
        console.error("Error loading crop mappings:", e);
    }
}

/**
 * Populates the datalist for crop suggestions
 */
function populateCropDatalist() {
    const datalist = document.getElementById('crop-list');
    if (!datalist) return;

    datalist.innerHTML = '';
    // Sort by name
    const sortedCrops = [...cropList].sort((a, b) => a.name.localeCompare(b.name));

    // We only want to suggest the primary Name (EPPO) format
    const seen = new Set();
    sortedCrops.forEach(c => {
        let label = c.name;
        if (c.eppo) label += ` (${c.eppo})`;

        if (!seen.has(label)) {
            const opt = document.createElement('option');
            opt.value = label;
            datalist.appendChild(opt);
            seen.add(label);
        }
    });
}

/**
 * Matches an input string (NC code, name, or synonym) and returns standardized Name (EPPO)
 * @param {string} input
 * @returns {string|null}
 */
function getMatchedCrop(input) {
    if (!input || !cropList || cropList.length === 0) return null;
    const val = input.trim().toLowerCase();

    // 1. Check for 3-digit NC code
    if (/^\d{3}$/.test(val)) {
        const match = cropList.find(c => c.nc === val);
        if (match) {
            return match.eppo ? `${match.name} (${match.eppo})` : match.name;
        }
    }

    // 2. Exact match on German Name
    let match = cropList.find(c => c.name.toLowerCase() === val);
    if (match) return match.eppo ? `${match.name} (${match.eppo})` : match.name;

    // 3. Exact match on English Name
    match = cropList.find(c => c.en.toLowerCase() === val);
    if (match) return match.eppo ? `${match.name} (${match.eppo})` : match.name;

    // 4. Exact match on Synonym
    match = cropList.find(c => c.synonyms && c.synonyms.some(s => s.toLowerCase() === val));
    if (match) return match.eppo ? `${match.name} (${match.eppo})` : match.name;

    // 5. Partial match on name (if input is long enough)
    if (val.length >= 4) {
        match = cropList.find(c => c.name.toLowerCase().includes(val) || val.includes(c.name.toLowerCase()));
        if (match) return match.eppo ? `${match.name} (${match.eppo})` : match.name;
    }

    return null;
}

/**
 * Event handler for crop input
 * @param {HTMLInputElement} input
 */
function handleCropInputMatching(input) {
    const matched = getMatchedCrop(input.value);
    if (matched && matched !== input.value) {
        input.value = matched;
        // Trigger any associated logic (like BBCH estimation)
        if (typeof updateBBCHEstimation === 'function') {
            updateBBCHEstimation();
        }
    }
}

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    loadCropMappings();

    // Attach listener to field-crop inputs if they exist
    const cropInputs = document.querySelectorAll('#field-crop');
    cropInputs.forEach(input => {
        // We match on blur to not interrupt typing, or on input for NC codes
        input.addEventListener('blur', (e) => handleCropInputMatching(e.target));
        input.addEventListener('input', (e) => {
            // For NC codes, we can match immediately when 3 digits are reached
            if (/^\d{3}$/.test(e.target.value)) {
                handleCropInputMatching(e.target);
            }
        });
    });
});
