// Initialize Map
const map = L.map('map').setView([51.1657, 10.4515], 6); // Germany center

// Function to update field label visibility based on zoom
function updateFieldLabelVisibility() {
    const zoom = map.getZoom();
    const labels = document.querySelectorAll('.field-label');
    labels.forEach(label => {
        label.style.display = (zoom >= 15) ? 'block' : 'none';
    });
}

map.on('zoomend', updateFieldLabelVisibility);

// Google Hybrid Basemap (Satellite with labels)
const googleHybrid = L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: '&copy; Google'
}).addTo(map);

// Drawn Items Layer
const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

// Draw Control
const drawControl = new L.Control.Draw({
    edit: {
        featureGroup: drawnItems
    },
    draw: {
        polygon: {
            allowIntersection: false,
            showArea: true
        },
        polyline: false,
        rectangle: false,
        circle: false,
        marker: false,
        circlemarker: false
    }
});
map.addControl(drawControl);

// Store for loaded fields
let loadedFields = [];
let currentYear = parseInt(localStorage.getItem('selectedYear')) || new Date().getFullYear();

async function changeYear(year) {
    currentYear = parseInt(year);
    localStorage.setItem('selectedYear', currentYear);
    await loadFields();
}

// Helper to toggle bulk actions
function toggleAllFields(checked) {
    const checkboxes = document.querySelectorAll('.field-checkbox');
    checkboxes.forEach(cb => cb.checked = checked);
}

function getSelectedFieldIds() {
    const checkboxes = document.querySelectorAll('.field-checkbox:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

function selectFieldsByCrop(crop) {
    const rows = document.querySelectorAll('#field-list tr');
    rows.forEach(row => {
        const checkbox = row.querySelector('.field-checkbox');
        const fieldCrop = row.dataset.crop;
        if (crop === "" || fieldCrop === crop) {
            checkbox.checked = true;
        } else {
            checkbox.checked = false;
        }
    });
}

function openBulkTaskModal() {
    document.getElementById('bulk-task-modal').style.display = 'block';

    // Set default date
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const currentDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;
    document.getElementById('bulk-task-date').value = currentDateTime;

    // Reset plant protection state
    addedBulkProducts = [];
    renderBulkAddedProducts();
    document.getElementById('bulk-task-water-rate').value = '';
    document.getElementById('bulk-psm-api-selection').style.display = 'none';
    document.getElementById('bulk-psm-details').style.display = 'none';

    // Reset fertilizer state
    addedBulkFertilizers = [];
    renderBulkAddedFertilizers();
    document.getElementById('bulk-fertilizer-search').value = '';
    document.getElementById('bulk-fert-n').value = '';
    document.getElementById('bulk-fert-p').value = '';
    document.getElementById('bulk-fert-k').value = '';
    document.getElementById('bulk-fert-s').value = '';
    document.getElementById('bulk-fert-rate').value = '';
    document.getElementById('bulk-save-custom-fert').checked = false;
    document.getElementById('bulk-fertilizer-info').style.display = 'none';

    populateBulkFieldList();
    updateBulkTreatedAreaState();

    // Ensure extra fields are toggled correctly for the initial selection
    toggleBulkExtraFields();
}

function updateBulkTreatedAreaState() {
    const selectedIds = getBulkSelectedFieldIds();
    const input = document.getElementById('bulk-task-treated-area');
    if (selectedIds.length === 1) {
        input.disabled = false;
        const field = loadedFields.find(f => String(f.id) === selectedIds[0]);
        if (field) {
            input.value = field.area || calculateArea(JSON.parse(field.geometry));
        }
    } else {
        input.disabled = true;
        input.value = '';
        if (selectedIds.length > 1) {
            input.placeholder = "Multiple fields - auto-filled by size";
        } else {
            input.placeholder = "";
        }
    }
}

function populateBulkFieldList() {
    const container = document.getElementById('bulk-field-list');
    container.innerHTML = '';

    const selectedIds = getSelectedFieldIds();

    loadedFields.forEach(field => {
        const row = document.createElement('tr');
        row.className = 'bulk-field-row';
        row.dataset.name = field.name.toLowerCase();
        row.dataset.crop = (field.crop || '').toLowerCase();

        let lastTaskText = '-';
        if (field.last_task) {
            lastTaskText = `${field.last_task.task_type} (${field.last_task.task_date})`;
            if (field.last_task.task_type === 'spraying' && field.last_task.content) {
                // Try to extract product name from content (it's usually the first line or before the first [)
                const firstLine = field.last_task.content.split('\n')[0];
                lastTaskText += `<br><span style="font-size:0.8em; color:#666;">${firstLine}</span>`;
            }
        }

        const geojson = JSON.parse(field.geometry);
        const area = calculateArea(geojson);

        const isChecked = selectedIds.includes(String(field.id));

        row.innerHTML = `
            <td><input type="checkbox" class="bulk-field-checkbox" value="${field.id}" ${isChecked ? 'checked' : ''} onchange="updateBulkTreatedAreaState(); toggleBulkExtraFields();"></td>
            <td>${field.name}</td>
            <td>${field.crop || ''}</td>
            <td>${area}</td>
            <td>${lastTaskText}</td>
        `;
        container.appendChild(row);
    });
}

function filterBulkFields() {
    const query = document.getElementById('bulk-field-search').value.toLowerCase().trim();
    const rows = document.querySelectorAll('.bulk-field-row');
    rows.forEach(row => {
        const name = row.dataset.name || "";
        const crop = row.dataset.crop || "";
        const matches = name.includes(query) || crop.includes(query);
        row.style.display = matches ? '' : 'none';
    });
}

function toggleBulkSelection(checked) {
    const checkboxes = document.querySelectorAll('.bulk-field-checkbox');
    checkboxes.forEach(cb => {
        if (cb.parentElement.parentElement.style.display !== 'none') {
            cb.checked = checked;
        }
    });
    updateBulkTreatedAreaState();
    toggleBulkExtraFields();
}

function closeBulkModal() {
    document.getElementById('bulk-task-modal').style.display = 'none';
}

function toggleBulkExtraFields() {
    const type = document.getElementById('bulk-task-type').value;
    document.getElementById('bulk-spraying-fields').style.display = (type === 'spraying') ? 'block' : 'none';
    document.getElementById('bulk-fertilizing-fields').style.display = (type === 'fertilizing') ? 'block' : 'none';
    document.getElementById('bulk-weather-fields').style.display = (type === 'spraying') ? 'flex' : 'none';
    document.getElementById('bulk-irrigation-fields').style.display = (type === 'irrigation') ? 'block' : 'none';
    document.getElementById('bulk-bbch-group').style.display = (type === 'spraying' || type === 'fertilizing') ? 'block' : 'none';

    // Automatic prefill: only if all fields have the same crop
    const selectedIds = getBulkSelectedFieldIds();
    const selectedFields = loadedFields.filter(f => selectedIds.includes(String(f.id)));
    const crops = [...new Set(selectedFields.map(f => (f.crop || '').toLowerCase()))];

    if (crops.length === 1 && crops[0] !== '') {
        // All fields have the same crop
        if (type === 'spraying' || type === 'fertilizing') {
            // BBCH Estimation logic (reused from field.js concept but simplified for app.js)
            estimateBulkBBCH(crops[0]);
        }
    } else {
        // Reset BBCH if mixed crops or no crop
        document.getElementById('bulk-task-bbch').value = '';
        document.getElementById('bulk-task-bbch-desc').value = '';
    }

    fetchBulkWeather();
}

function estimateBulkBBCH(cropValue) {
    const bbchInput = document.getElementById('bulk-task-bbch');
    const bbchDescInput = document.getElementById('bulk-task-bbch-desc');

    if (bbchInput.value) return; // Don't override manual entry

    const { bbch, estimation } = getBBCHEstimation(cropValue, currentLang);

    if (bbch) {
        bbchInput.value = bbch.split('-')[0];
        bbchDescInput.value = estimation;
    }
}

let bulkFertSearchResults = [];
let selectedBulkFert = null;
let addedBulkFertilizers = [];

async function searchBulkFertilizer() {
    const query = document.getElementById('bulk-fertilizer-search').value;
    const datalist = document.getElementById('bulk-fertilizer-list');

    const matched = bulkFertSearchResults.find(f => f.name === query);
    if (matched) {
        onBulkFertSelected(matched);
        return;
    }

    if (query.length < 2) {
        datalist.innerHTML = '';
        return;
    }

    const response = await fetch(`api/fertilizer_proxy.php?q=${encodeURIComponent(query)}`);
    const data = await response.json();
    bulkFertSearchResults = data;

    datalist.innerHTML = '';
    data.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.name;
        datalist.appendChild(opt);
    });
}

function onBulkFertSelected(f) {
    selectedBulkFert = f;
    const infoDiv = document.getElementById('bulk-fertilizer-info');
    infoDiv.style.display = 'block';
    document.getElementById('bulk-fertilizer-name').textContent = f.name;
    document.getElementById('bulk-fertilizer-ingredients').textContent = `N: ${f.n}%, P: ${f.p}%, K: ${f.k}%, S: ${f.s}% - ${f.description || ''}`;

    // Prefill custom fields
    document.getElementById('bulk-fert-n').value = f.n;
    document.getElementById('bulk-fert-p').value = f.p;
    document.getElementById('bulk-fert-k').value = f.k;
    document.getElementById('bulk-fert-s').value = f.s;
}

async function addBulkFertilizerToList() {
    const name = document.getElementById('bulk-fertilizer-search').value;
    const n = document.getElementById('bulk-fert-n').value;
    const p = document.getElementById('bulk-fert-p').value;
    const k = document.getElementById('bulk-fert-k').value;
    const s = document.getElementById('bulk-fert-s').value;
    const rate = document.getElementById('bulk-fert-rate').value;
    const saveCustom = document.getElementById('bulk-save-custom-fert').checked;

    if (!name || !rate) {
        showToast("Please enter fertilizer name and rate.");
        return;
    }

    if (saveCustom) {
        await fetch('api/fertilizer_proxy.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, n, p, k, s, description: "Customized" })
        });
    }

    const fert = {
        mittelname: name,
        n: n || 0,
        p: p || 0,
        k: k || 0,
        s: s || 0,
        aufwandmenge: rate,
        einheit: 'kg/ha'
    };

    addedBulkFertilizers.push(fert);
    renderBulkAddedFertilizers();

    // Reset
    document.getElementById('bulk-fertilizer-search').value = '';
    document.getElementById('bulk-fert-n').value = '';
    document.getElementById('bulk-fert-p').value = '';
    document.getElementById('bulk-fert-k').value = '';
    document.getElementById('bulk-fert-s').value = '';
    document.getElementById('bulk-fert-rate').value = '';
    document.getElementById('bulk-save-custom-fert').checked = false;
    document.getElementById('bulk-fertilizer-info').style.display = 'none';
}

function renderBulkAddedFertilizers() {
    const container = document.getElementById('bulk-added-fertilizers-container');
    const list = document.getElementById('bulk-added-fertilizers-list');
    list.innerHTML = '';
    if (addedBulkFertilizers.length > 0) {
        container.style.display = 'block';
        addedBulkFertilizers.forEach((f, index) => {
            const li = document.createElement('li');
            li.innerHTML = `${f.mittelname} - ${f.aufwandmenge} ${f.einheit} <button type="button" onclick="removeBulkFertilizer(${index})">x</button>`;
            list.appendChild(li);
        });
    } else {
        container.style.display = 'none';
    }
}

function removeBulkFertilizer(index) {
    addedBulkFertilizers.splice(index, 1);
    renderBulkAddedFertilizers();
}

async function fetchBulkWeather() {
    const type = document.getElementById('bulk-task-type').value;
    if (type !== 'spraying') return;

    const dateStr = document.getElementById('bulk-task-date').value;
    const fieldIds = getBulkSelectedFieldIds();
    if (!dateStr || fieldIds.length === 0) return;

    // Use the first selected field for location
    const field = loadedFields.find(f => String(f.id) === fieldIds[0]);
    if (!field) return;

    const date = new Date(dateStr);
    const center = getCenter(field.geometry);

    try {
        const isoDate = date.toISOString().split('.')[0] + 'Z';
        const response = await fetch(`https://api.brightsky.dev/weather?lat=${center.lat}&lon=${center.lng}&date=${isoDate}`);
        const data = await response.json();

        if (data.weather && data.weather.length > 0) {
            const weather = data.weather[0];
            // Bright Sky returns wind_speed in km/h. Convert to m/s.
            const windSpeedMs = weather.wind_speed ? (weather.wind_speed / 3.6).toFixed(1) : '';
            document.getElementById('bulk-task-wind').value = windSpeedMs;
            document.getElementById('bulk-task-temp').value = weather.temperature ? weather.temperature.toFixed(1) : '';
        }
    } catch (e) {
        console.error("Error fetching bulk weather:", e);
    }
}

function onBulkBBCHManualChange() {
    const bbchValue = document.getElementById('bulk-task-bbch').value;
    if (!bbchValue) return;

    // Get crop from selected fields if they all share the same crop
    const selectedIds = getBulkSelectedFieldIds();
    const selectedFields = loadedFields.filter(f => selectedIds.includes(String(f.id)));
    const crops = [...new Set(selectedFields.map(f => (f.crop || '').toLowerCase()))];
    const cropValue = crops.length === 1 ? crops[0] : "";

    const desc = getBBCHDescription(cropValue, bbchValue, currentLang);

    if (desc) {
        document.getElementById('bulk-task-bbch-desc').value = desc;
    } else {
        // Fallback to a very simple generic description if no crop match
        const bbchNum = parseInt(bbchValue);
        if (isNaN(bbchNum)) return;
        let genericDesc = "";
        if (bbchNum < 10) genericDesc = currentLang === 'de' ? "Keimung" : "Germination";
        else if (bbchNum < 20) genericDesc = currentLang === 'de' ? "Blattentwicklung" : "Leaf development";
        else if (bbchNum < 40) genericDesc = currentLang === 'de' ? "Schossen" : "Stem elongation";
        else if (bbchNum < 70) genericDesc = currentLang === 'de' ? "Blüte" : "Flowering";
        else genericDesc = currentLang === 'de' ? "Reife / Ernte" : "Ripening / Harvest";
        document.getElementById('bulk-task-bbch-desc').value = genericDesc;
    }
}

function getBulkSelectedFieldIds() {
    const checkboxes = document.querySelectorAll('.bulk-field-checkbox:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

async function applyBulkTask() {
    const fieldIds = getBulkSelectedFieldIds();
    if (fieldIds.length === 0) {
        showToast("Please select at least one field.");
        return;
    }
    const taskType = document.getElementById('bulk-task-type').value;

    // Auto-add current product if selection is visible and list is empty
    if (taskType === 'spraying' && addedBulkProducts.length === 0) {
        const selectionDiv = document.getElementById('bulk-psm-api-selection');
        if (selectionDiv.style.display !== 'none') {
            const awgSelect = document.getElementById('bulk-psm-awg-select');
            if (awgSelect.value) {
                addBulkProductToList();
            }
        }
    }
    const taskDate = document.getElementById('bulk-task-date').value;
    const year = taskDate ? new Date(taskDate).getFullYear() : new Date().getFullYear();

    const data = {
        bulk: true,
        field_ids: fieldIds,
        year: year,
        task_type: taskType,
        task_date: taskDate,
        content: document.getElementById('bulk-task-content').value,
        comment: document.getElementById('bulk-task-comment').value,
        employee: document.getElementById('bulk-task-employee').value,
        treated_area: document.getElementById('bulk-task-treated-area').value,
        bbch: document.getElementById('bulk-task-bbch').value,
        bbch_description: document.getElementById('bulk-task-bbch-desc').value,
        water_rate: document.getElementById('bulk-task-water-rate').value,
        application_type: (taskType === 'spraying') ? document.getElementById('bulk-task-app-type').value : null,
        products: (taskType === 'spraying') ? addedBulkProducts : ((taskType === 'fertilizing') ? addedBulkFertilizers : []),
        wind_speed: (taskType === 'spraying') ? document.getElementById('bulk-task-wind').value : null,
        temperature: (taskType === 'spraying') ? document.getElementById('bulk-task-temp').value : null,
        irrigation_amount: (taskType === 'irrigation') ? document.getElementById('bulk-task-irrigation-amount').value : null
    };

    if (taskType === 'spraying') {
        if (addedBulkProducts.length === 0) {
            showToast("Please add at least one product.");
            return;
        }
    } else if (taskType === 'fertilizing') {
        if (addedBulkFertilizers.length === 0) {
            showToast("Please add at least one fertilizer.");
            return;
        }
    }

    const response = await fetch('api/tasks.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    if (response.ok) {
        showToast(_t('task-applied-success', {count: fieldIds.length}), 'success');
        closeBulkModal();
        loadFields();
    } else {
        showToast("Error applying bulk task.", 'error');
    }
}

let bulkPsmSearchTimeout = null;
let bulkPsmSearchResults = [];
let selectedBulkPSM = null;

async function searchBulkPSM() {
    const query = document.getElementById('bulk-psm-search').value;
    const datalist = document.getElementById('bulk-psm-list');

    const matched = bulkPsmSearchResults.find(item => `${item.mittelname} (${item.kennr})` === query);
    if (matched) {
        onBulkPSMSelected(matched.kennr);
        return;
    }

    if (query.length < 3) {
        datalist.innerHTML = '';
        return;
    }

    clearTimeout(bulkPsmSearchTimeout);
    bulkPsmSearchTimeout = setTimeout(async () => {
        const response = await fetch(`api/psm_proxy.php?q=${encodeURIComponent(query)}`);
        const data = await response.json();

        datalist.innerHTML = '';
        bulkPsmSearchResults = data.items || [];

        if (data.items) {
            data.items.forEach(item => {
                const option = document.createElement('option');
                option.value = `${item.mittelname} (${item.kennr})`;
                datalist.appendChild(option);
            });
        }
    }, 400);
}

async function onBulkPSMSelected(kennr) {
    const detailsDiv = document.getElementById('bulk-psm-details');
    const selectionDiv = document.getElementById('bulk-psm-api-selection');
    const response = await fetch(`api/psm_proxy.php?kennr=${encodeURIComponent(kennr)}`);
    selectedBulkPSM = await response.json();

    if (selectedBulkPSM.mittel) {
        detailsDiv.style.display = 'block';
        selectionDiv.style.display = 'block';
        document.getElementById('bulk-psm-info-name').textContent = `${selectedBulkPSM.mittel.mittelname} (${selectedBulkPSM.mittel.kennr})`;

        const awgSelect = document.getElementById('bulk-psm-awg-select');
        awgSelect.innerHTML = '';
        selectedBulkPSM.awg.forEach(a => {
            const opt = document.createElement('option');
            opt.value = a.awg_id;
            opt.textContent = `AWG ${a.awg_id} (${a.anwendungsbereich})`;
            awgSelect.appendChild(opt);
        });
        onBulkAWGSelected();
    }
}

function onBulkAWGSelected() {
    const awgId = document.getElementById('bulk-psm-awg-select').value;
    const awg = selectedBulkPSM.awg.find(a => a.awg_id === awgId);
    if (!awg) return;

    // Schadorganismus: Only show if only one crop is selected
    const selectedIds = getBulkSelectedFieldIds();
    const selectedFields = loadedFields.filter(f => selectedIds.includes(String(f.id)));
    const crops = [...new Set(selectedFields.map(f => (f.crop || '').toLowerCase()))];
    const schadorgGroup = document.getElementById('bulk-psm-schadorg-group');
    const schadSelect = document.getElementById('bulk-psm-schadorg-select');
    schadSelect.innerHTML = '';

    if (crops.length === 1 && crops[0] !== '') {
        schadorgGroup.style.display = 'block';
        if (awg.schadorg) {
            awg.schadorg.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.schadorg;
                opt.textContent = s.schadorg;
                schadSelect.appendChild(opt);
            });
        }
    } else {
        schadorgGroup.style.display = 'none';
    }

    const rateList = document.getElementById('bulk-psm-rate-list');
    rateList.innerHTML = '';
    awg.aufwand.forEach(r => {
        const opt = document.createElement('option');
        opt.value = `${r.m_aufwand} ${r.m_aufwand_einheit}`;
        rateList.appendChild(opt);
    });
    // Set default value
    if (awg.aufwand.length > 0) {
        document.getElementById('bulk-psm-rate-input').value = `${awg.aufwand[0].m_aufwand} ${awg.aufwand[0].m_aufwand_einheit}`;
    }

    // Wartezeit
    const wartezeitSelect = document.getElementById('bulk-psm-wartezeit-select');
    wartezeitSelect.innerHTML = '';
    if (awg.wartezeit && awg.wartezeit.length > 0) {
        awg.wartezeit.forEach(w => {
            const opt = document.createElement('option');
            const val = w.wartezeit_tage ? `${w.wartezeit_tage} days` : (w.wartezeit_ausgen_text || 'F');
            opt.value = val;
            opt.textContent = `${val} (${w.kultur})`;
            wartezeitSelect.appendChild(opt);
        });
    } else {
        const opt = document.createElement('option');
        opt.value = 'N/A';
        opt.textContent = 'N/A';
        wartezeitSelect.appendChild(opt);
    }
}

let addedBulkProducts = [];

function addBulkProductToList() {
    const awgSelect = document.getElementById('bulk-psm-awg-select');
    const schadSelect = document.getElementById('bulk-psm-schadorg-select');
    const rateInput = document.getElementById('bulk-psm-rate-input');
    const wartezeitSelect = document.getElementById('bulk-psm-wartezeit-select');
    if (!selectedBulkPSM || !awgSelect.value) return;

    let amount = rateInput.value;
    let unit = '';
    if (amount.includes(' ')) {
        const parts = amount.split(' ');
        amount = parts[0];
        unit = parts.slice(1).join(' ');
    }

    const product = {
        mittelname: selectedBulkPSM.mittel.mittelname,
        kennr: selectedBulkPSM.mittel.kennr,
        schadorganismus: schadSelect.value || 'N/A',
        verwendungszweck: 'N/A',
        aufwandmenge: amount,
        einheit: unit,
        wartezeit: wartezeitSelect.value || 'N/A',
        active_ingredients: selectedBulkPSM.wirkstoffe ? selectedBulkPSM.wirkstoffe.map(w => `${w.name} (${w.amount} ${w.unit})`).join(", ") : ''
    };

    addedBulkProducts.push(product);
    renderBulkAddedProducts();
    document.getElementById('bulk-psm-api-selection').style.display = 'none';
    document.getElementById('bulk-psm-search').value = '';
}

function renderBulkAddedProducts() {
    const container = document.getElementById('bulk-added-products-container');
    const list = document.getElementById('bulk-added-products-list');
    list.innerHTML = '';
    if (addedBulkProducts.length > 0) {
        container.style.display = 'block';
        addedBulkProducts.forEach((p, index) => {
            const li = document.createElement('li');
            li.innerHTML = `${p.mittelname} (${p.kennr}) - ${p.aufwandmenge} ${p.einheit} | Wartezeit: ${p.wartezeit || 'N/A'} <button type="button" onclick="removeBulkProduct(${index})">x</button>`;
            list.appendChild(li);
        });
    } else {
        container.style.display = 'none';
    }
}

function removeBulkProduct(index) {
    addedBulkProducts.splice(index, 1);
    renderBulkAddedProducts();
}

// Helper to calculate area in hectares
function calculateArea(geometry) {
    if (!geometry) return 0;
    let totalArea = 0;

    const processPolygon = (coords) => {
        // Exterior ring
        let area = L.GeometryUtil.geodesicArea(coords[0].map(p => L.latLng(p[1], p[0])));
        // Subtract interior rings (holes)
        for (let i = 1; i < coords.length; i++) {
            area -= L.GeometryUtil.geodesicArea(coords[i].map(p => L.latLng(p[1], p[0])));
        }
        return Math.abs(area);
    };

    if (geometry.type === 'Polygon') {
        totalArea += processPolygon(geometry.coordinates);
    } else if (geometry.type === 'MultiPolygon') {
        geometry.coordinates.forEach(poly => {
            totalArea += processPolygon(poly);
        });
    } else if (geometry.type === 'FeatureCollection') {
        geometry.features.forEach(f => {
            totalArea += parseFloat(calculateArea(f.geometry));
        });
        return totalArea.toFixed(2);
    } else if (geometry.type === 'Feature') {
        return calculateArea(geometry.geometry);
    }

    const hectares = totalArea / 10000;
    // Sanity check: If area is impossibly large, something went wrong with projection
    if (hectares > 1000000) {
        console.warn('Suspiciously large area calculated:', hectares, 'ha. Check coordinates.');
        return "0.00";
    }
    return hectares.toFixed(2); // Convert to hectares
}

// Load Fields from Backend
async function loadFields(autoZoom = false) {
    console.log('loadFields called');
    try {
        const response = await fetch(`api/fields.php?year=${currentYear}`);
        const fields = await response.json();
        console.log('Fields fetched:', fields);

        if (!Array.isArray(fields)) {
            console.error('Expected array of fields, got:', fields);
            return;
        }

        loadedFields = fields;

        drawnItems.clearLayers();
        const listElement = document.getElementById('field-list');
        listElement.innerHTML = '';

        let totalArea = 0;
        const cropLabel = (typeof _t === 'function') ? _t('label-crop') : "Crop:";

        const crops = new Set();
        for (const field of fields) {
            let geojson = JSON.parse(field.geometry);
            const area = calculateArea(geojson);
            totalArea += parseFloat(area);

            const crop = field.crop || '';
            if (crop) crops.add(crop);

            // Ensure we have a Feature/FeatureCollection for L.geoJSON to properly trigger onEachFeature
            if (geojson.type !== 'Feature' && geojson.type !== 'FeatureCollection') {
                geojson = {
                    type: 'Feature',
                    geometry: geojson,
                    properties: {}
                };
            }

            console.log('Adding field to map:', field.name, field.id);

            const getFieldStyle = (cropName) => {
                const c = (cropName || '').toLowerCase();
                let color = '#3388ff'; // Default Leaflet color
                if (c.includes('kartoffel') || c.includes('soltu') || c.includes('potato')) color = 'brown';
                else if (c.includes('zuckerrübe') || c.includes('beava') || c.includes('sugar beet')) color = 'white';
                else if (c.includes('mais') || c.includes('zeamx') || c.includes('maize')) color = 'yellow';
                else if (c.includes('winterweichweizen') || c.includes('trzaw') || c.includes('wheat')) color = 'green';
                else if (c.includes('weinrebe') || c.includes('vitvi') || c.includes('vineyard') || c.includes('weinberg')) color = 'purple';
                return { color: color, fillOpacity: 0.2 };
            };

            L.geoJSON(geojson, {
                style: getFieldStyle(crop),
                onEachFeature: (feature, layer) => {
                    layer.fieldData = field;
                    const fieldId = field.id;

                    layer.on('mouseover', function() {
                        const style = getFieldStyle(crop);
                        this.setStyle({
                            weight: (style.weight || 3) + 2,
                            fillOpacity: style.fillOpacity + 0.3
                        });
                        const row = document.querySelector(`#field-row-${fieldId}`);
                        if (row) row.classList.add('field-sidebar-highlight');
                    });

                    layer.on('mouseout', function() {
                        this.setStyle(getFieldStyle(crop));
                        const row = document.querySelector(`#field-row-${fieldId}`);
                        if (row) row.classList.remove('field-sidebar-highlight');
                    });

                    const popupContent = document.createElement('div');
                    const b = document.createElement('b');
                    b.textContent = field.name + " (" + area + " ha)";
                    popupContent.appendChild(b);
                    popupContent.appendChild(document.createElement('br'));
                    if (crop) {
                        const cropP = document.createElement('p');
                        cropP.style.margin = "0";
                        cropP.textContent = cropLabel + " " + crop;
                        popupContent.appendChild(cropP);
                    }
                    popupContent.appendChild(document.createTextNode(field.notes || ''));
                    layer.bindPopup(popupContent);

                    // Add permanent tooltip for field name
                    layer.bindTooltip(field.name, {
                        permanent: true,
                        direction: 'center',
                        className: 'field-label'
                    });

                    // Add to the group
                    drawnItems.addLayer(layer);
                }
            });

            // Add to Sidebar Table
            const row = document.createElement('tr');
            row.id = `field-row-${field.id}`;
            row.dataset.crop = crop;

            row.addEventListener('mouseover', () => {
                drawnItems.eachLayer(layer => {
                    if (layer.fieldData && layer.fieldData.id === field.id) {
                        const style = getFieldStyle(crop);
                        layer.setStyle({
                            weight: (style.weight || 3) + 2,
                            fillOpacity: style.fillOpacity + 0.3
                        });
                    }
                });
            });

            row.addEventListener('mouseout', () => {
                drawnItems.eachLayer(layer => {
                    if (layer.fieldData && layer.fieldData.id === field.id) {
                        layer.setStyle(getFieldStyle(crop));
                    }
                });
            });

            let lastTaskText = '-';
            if (field.last_task) {
                lastTaskText = `${field.last_task.task_type} (${field.last_task.task_date})`;
                if (field.last_task.task_type === 'spraying' && field.last_task.content) {
                    const firstLine = field.last_task.content.split('\n')[0];
                    lastTaskText += `<br><span style="font-size:0.8em; color:#666;">${firstLine}</span>`;
                }
            }

            row.innerHTML = `
                <td><input type="checkbox" class="field-checkbox" value="${field.id}"></td>
                <td>${field.name}</td>
                <td>${crop}</td>
                <td>${area}</td>
                <td style="font-size: 0.85em;">${lastTaskText}</td>
                <td>
                    <div class="btn-group">
                        <button class="btn-primary" onclick="zoomToField(${field.id})" title="Zoom">🔍</button>
                        <button class="btn-success" onclick="window.location.href='field.html?id=${field.id}'" title="Edit">✏️</button>
                        <button class="btn-danger" onclick="deleteField(${field.id})" title="Delete">🗑️</button>
                    </div>
                </td>
            `;

            listElement.appendChild(row);
        }

        // Update crop dropdown
        const cropSelect = document.getElementById('bulk-select-crop');
        if (cropSelect) {
            cropSelect.innerHTML = '<option value="">-- All --</option>';
            Array.from(crops).sort().forEach(c => {
                const opt = document.createElement('option');
                opt.value = c;
                opt.textContent = c;
                cropSelect.appendChild(opt);
            });
        }

        const totalAreaText = (typeof _t === 'function') ? _t('total-area', {area: totalArea.toFixed(2)}) : `Total Area: ${totalArea.toFixed(2)} ha`;
        document.getElementById('total-area-display').textContent = totalAreaText;

        if (autoZoom && fields.length > 0) {
            zoomToAllFields();
        }
        updateFieldLabelVisibility();
    } catch (err) {
        console.error('Error loading fields:', err);
    }
}

// Global variable to store current geometry for new/edited field
let currentGeometry = null;

// Event: Field Created
map.on(L.Draw.Event.CREATED, function (e) {
    console.log('Leaflet Draw Created event triggered');
    const layer = e.layer;
    drawnItems.addLayer(layer); // Immediately show on map
    currentGeometry = layer.toGeoJSON();
    openModal((typeof _t === 'function' ? _t('modal-new-field') : 'New Field'), null);
});

// Event: Field Edited
map.on(L.Draw.Event.EDITED, function (e) {
    const layers = e.layers;
    layers.eachLayer(async function (layer) {
        if (layer.fieldData) {
            const updatedGeometry = layer.toGeoJSON();
            const field = layer.fieldData;
            await fetch(`api/fields.php?id=${field.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: field.name,
                    notes: field.notes,
                    geometry: JSON.stringify(updatedGeometry),
                    area: calculateArea(updatedGeometry)
                })
            });
        }
    });
});

// Modal Logic
const modal = document.getElementById('field-modal');
const modalTitle = document.getElementById('modal-title');
const fieldIdInput = document.getElementById('field-id');
const fieldNameInput = document.getElementById('field-name');
const fieldCropInput = document.getElementById('field-crop');
const fieldSeedingInput = document.getElementById('field-seeding');
const fieldFertilizingInput = document.getElementById('field-fertilizing');
const fieldSprayingInput = document.getElementById('field-spraying');
const fieldTillingInput = document.getElementById('field-tilling');
const fieldHarvestingInput = document.getElementById('field-harvesting');
const fieldNotesInput = document.getElementById('field-notes');
const saveBtn = document.getElementById('save-field-btn');

async function openModal(title, fieldData) {
    console.log('Opening modal with title:', title);
    if (!modal) {
        console.error('Modal element not found!');
        return;
    }
    modalTitle.innerText = title;

    if (fieldData) {
        // If we only have basic data, try to fetch full data from API if needed
        // But for now, we assume fieldData comes from the joined GET request
        fieldIdInput.value = fieldData.id || '';
        fieldNameInput.value = fieldData.name || '';
        fieldCropInput.value = fieldData.crop || '';
        fieldSeedingInput.value = fieldData.seeding || '';
        fieldFertilizingInput.value = fieldData.fertilizing || '';
        fieldSprayingInput.value = fieldData.spraying || '';
        fieldTillingInput.value = fieldData.tilling || '';
        fieldHarvestingInput.value = fieldData.harvesting || '';
        fieldNotesInput.value = fieldData.notes || '';
    } else {
        fieldIdInput.value = '';
        fieldNameInput.value = '';
        fieldCropInput.value = '';
        fieldSeedingInput.value = '';
        fieldFertilizingInput.value = '';
        fieldSprayingInput.value = '';
        fieldTillingInput.value = '';
        fieldHarvestingInput.value = '';
        fieldNotesInput.value = '';
    }
    modal.style.display = 'block';
}

function closeModal() {
    modal.style.display = 'none';
    currentGeometry = null;
    loadFields(); // Refresh to clean up temporary drawing layers
}

saveBtn.onclick = async () => {
    const id = fieldIdInput.value;
    const data = {
        name: fieldNameInput.value,
        crop: fieldCropInput.value,
        seeding: fieldSeedingInput.value,
        fertilizing: fieldFertilizingInput.value,
        spraying: fieldSprayingInput.value,
        tilling: fieldTillingInput.value,
        harvesting: fieldHarvestingInput.value,
        notes: fieldNotesInput.value
    };

    if (!data.name) {
        showToast(typeof _t === 'function' ? _t('alert-name') : 'Please enter a name');
        return;
    }

    try {
        if (id) {
            // Update existing
            let geometry = null;
            drawnItems.eachLayer(layer => {
                if (layer.fieldData && layer.fieldData.id == id) {
                    geometry = JSON.stringify(layer.toGeoJSON());
                }
            });
            if (geometry) {
                data.geometry = geometry;
                data.area = calculateArea(JSON.parse(geometry));
            }

            await fetch(`api/fields.php?id=${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } else if (currentGeometry) {
            // Create New
            data.geometry = JSON.stringify(currentGeometry);
            data.area = calculateArea(currentGeometry);
            await fetch('api/fields.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        }
        closeModal();
    } catch (err) {
        console.error('Error saving field:', err);
        showToast('Error saving field');
    }
};

async function deleteField(id) {
    if (confirm(_t('confirm-delete'))) {
        await fetch(`api/fields.php?id=${id}`, {
            method: 'DELETE'
        });
        loadFields();
    }
}

function zoomToField(id) {
    drawnItems.eachLayer(layer => {
        if (layer.fieldData && layer.fieldData.id === id) {
            map.fitBounds(layer.getBounds());
        }
    });
}

function zoomToAllFields() {
    if (drawnItems.getLayers().length > 0) {
        map.fitBounds(drawnItems.getBounds());
    }
}

function getCenter(geometry) {
    let geojson = typeof geometry === 'string' ? JSON.parse(geometry) : geometry;
    let layer = L.geoJSON(geojson);
    let bounds = layer.getBounds();
    let center = bounds.getCenter();
    return { lat: center.lat.toFixed(6), lng: center.lng.toFixed(6) };
}

async function exportAllData(format = 'xlsx') {
    if (loadedFields.length === 0) {
        showToast(typeof _t === 'function' ? _t('no-fields-export') : "No fields to export.");
        return;
    }

    const wb = XLSX.utils.book_new();
    let allDataForCSV = [];

    for (const field of loadedFields) {
        const recordsResp = await fetch(`api/records.php?field_id=${field.id}`);
        const records = await recordsResp.json();

        const tasksResp = await fetch(`api/tasks.php?field_id=${field.id}`);
        const tasks = await tasksResp.json();

        if (tasks.length === 0 && records.length === 0) continue;

        const center = getCenter(field.geometry);
        const flattenedData = [];
        const recordLookup = {};
        records.forEach(r => { recordLookup[r.year] = r; });

        const allYears = new Set([...Object.keys(recordLookup), ...tasks.map(t => String(t.year))]);

        allYears.forEach(yearStr => {
            const year = parseInt(yearStr);
            const record = recordLookup[year] || {};
            const yearTasks = tasks.filter(t => t.year === year);

            if (yearTasks.length > 0) {
                yearTasks.forEach(task => {
                    const baseData = {
                        "Field Name": field.name,
                        "Field Size [ha]": field.area,
                        "Year": task.year,
                        "Crop": record.crop || '',
                        "Variety": record.variety || '',
                        "Task Type": (typeof _t === 'function') ? _t(`task-type-${task.task_type}`) : task.task_type,
                        "Task Date": task.task_date,
                        "Treated Area [ha]": task.treated_area,
                        "Employee": task.employee,
                        "BBCH": task.bbch,
                        "BBCH Description": task.bbch_description,
                        "Water Rate [l/ha]": task.water_rate,
                        "Application Type": task.application_type,
                        "Wind [m/s]": task.wind_speed,
                        "Temp [°C]": task.temperature,
                        "Irrigation [mm]": task.irrigation_amount,
                        "Task Content": task.content,
                        "Task Comment": task.comment,
                        "Latitude": center.lat,
                        "Longitude": center.lng
                    };

                    if (task.products && task.products.length > 0) {
                        task.products.forEach(p => {
                            flattenedData.push({
                                ...baseData,
                                "Product Name": p.mittelname,
                                "Reg No (Kennr)": p.kennr,
                                "Target Organism": p.schadorganismus,
                                "Purpose": p.verwendungszweck,
                                "App Rate": p.aufwandmenge,
                                "Unit": p.einheit,
                                "Waiting Period": p.wartezeit,
                                "Active Ingredients": p.active_ingredients,
                                "N [%]": p.n,
                                "P [%]": p.p,
                                "K [%]": p.k,
                                "S [%]": p.s
                            });
                        });
                    } else {
                        flattenedData.push({
                            ...baseData,
                            "Product Name": "",
                            "Reg No (Kennr)": "",
                            "Target Organism": "",
                            "Purpose": "",
                            "App Rate": "",
                            "Unit": "",
                            "Active Ingredients": "",
                            "N [%]": "",
                            "P [%]": "",
                            "K [%]": "",
                            "S [%]": ""
                        });
                    }
                });
            } else if (record.id) {
                // Year has a record but no tasks
                flattenedData.push({
                    "Field Name": field.name,
                    "Field Size [ha]": field.area,
                    "Year": year,
                    "Crop": record.crop || '',
                    "Variety": record.variety || '',
                    "Task Type": (typeof _t === 'function') ? _t('record-info') : "Record Info",
                    "Task Date": "",
                    "Treated Area [ha]": "",
                    "Employee": "",
                    "BBCH": "",
                    "BBCH Description": "",
                    "Water Rate [l/ha]": "",
                    "Application Type": "",
                    "Wind [m/s]": "",
                    "Temp [°C]": "",
                    "Irrigation [mm]": "",
                    "Task Content": record.notes || '',
                    "Task Comment": "",
                    "Latitude": center.lat,
                    "Longitude": center.lng,
                    "Product Name": "",
                    "Reg No (Kennr)": "",
                    "Target Organism": "",
                    "Purpose": "",
                    "App Rate": "",
                    "Unit": "",
                    "Active Ingredients": "",
                    "N [%]": "",
                    "P [%]": "",
                    "K [%]": "",
                    "S [%]": ""
                });
            }
        });

        if (flattenedData.length > 0) {
            if (format === 'xlsx') {
                const ws = XLSX.utils.json_to_sheet(flattenedData);
                let sheetName = `${field.id}_${field.name}`.substring(0, 31);
                XLSX.utils.book_append_sheet(wb, ws, sheetName);
            } else {
                allDataForCSV = allDataForCSV.concat(flattenedData);
            }
        }
    }

    if (format === 'xlsx') {
        if (wb.SheetNames.length === 0) {
            showToast("No data found for any field.");
            return;
        }
        XLSX.writeFile(wb, "all_fields_data.xlsx");
    } else {
        if (allDataForCSV.length === 0) {
            showToast("No data found for any field.");
            return;
        }
        const ws = XLSX.utils.json_to_sheet(allDataForCSV);
        const csv = XLSX.utils.sheet_to_csv(ws);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "all_fields_data.csv";
        a.click();
        URL.revokeObjectURL(url);
    }
}

function exportISOXML() {
    if (loadedFields.length === 0) {
        showToast(_t('no-fields-export'));
        return;
    }

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<ISO11783_TaskData VersionMajor="4" VersionMinor="0" ManagementSoftwareManufacturer="AgriFieldManager" ManagementSoftwareVersion="1.0">\n';

    loadedFields.forEach((field, index) => {
        const pfdId = `PFD${index + 1}`;
        xml += `  <PFD A="${pfdId}" C="${field.name}">\n`;

        const geojson = JSON.parse(field.geometry);
        let features = [];
        if (geojson.type === 'FeatureCollection') {
            features = geojson.features;
        } else if (geojson.type === 'Feature') {
            features = [geojson];
        } else {
            // Assume it's a raw geometry object
            features = [{ type: 'Feature', geometry: geojson }];
        }

        features.forEach(feature => {
            if (!feature.geometry || !feature.geometry.coordinates) return;
            const coords = feature.geometry.coordinates;
            const type = feature.geometry.type;

            const processPolygon = (polygon) => {
                xml += `    <PLN A="1">\n`; // A="1" for Field Boundary
                polygon.forEach((ring, ringIdx) => {
                    const lsgType = ringIdx === 0 ? "1" : "2"; // 1 = exterior, 2 = interior
                    xml += `      <LSG A="${lsgType}">\n`;
                    ring.forEach(point => {
                        xml += `        <PNT C="${point[1].toFixed(9)}" D="${point[0].toFixed(9)}"/>\n`;
                    });
                    xml += `      </LSG>\n`;
                });
                xml += `    </PLN>\n`;
            };

            if (type === 'Polygon') {
                processPolygon(coords);
            } else if (type === 'MultiPolygon') {
                coords.forEach(polygon => processPolygon(polygon));
            }
        });

        xml += `  </PFD>\n`;
    });

    xml += '</ISO11783_TaskData>';

    const blob = new Blob([xml], { type: 'text/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'TASKDATA.XML';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Import Logic
const fileInput = document.getElementById('file-import');
const folderInput = document.getElementById('folder-import');

async function handleFileSelection(files) {
    if (files.length === 0) return;

    const fileGroups = {};
    files.forEach(file => {
        // For folder upload, the path might be in webkitRelativePath
        const path = file.webkitRelativePath || file.name;
        const nameParts = path.split('/').pop().split('.');
        const ext = nameParts.pop().toLowerCase();
        const base = nameParts.join('.');

        if (!fileGroups[base]) fileGroups[base] = {};
        fileGroups[base][ext] = file;
    });

    for (const base in fileGroups) {
        const group = fileGroups[base];
        if (group.kml) await handleKML(group.kml);
        else if (group.json || group.geojson) await handleGenericJSON(group.json || group.geojson);
        else if (group.zip) await handleZip(group.zip);
        else if (group.shp) await handleShp(group);
        else if (group.xml && base.toUpperCase() === 'TASKDATA') await handleISOXML(group.xml);
    }
    loadFields(true);
}

fileInput.onchange = async (event) => {
    await handleFileSelection(Array.from(event.target.files));
    fileInput.value = '';
};

folderInput.onchange = async (event) => {
    await handleFileSelection(Array.from(event.target.files));
    folderInput.value = '';
};

async function handleGenericJSON(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const geojson = JSON.parse(e.target.result);
                await saveGeoJSONFeatures(geojson, file.name.split('.')[0]);
                resolve();
            } catch (err) { reject(err); }
        };
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

async function handleKML(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const kmlText = e.target.result;
                const parser = new DOMParser();
                const kmlDoc = parser.parseFromString(kmlText, 'text/xml');
                const geojson = toGeoJSON.kml(kmlDoc);
                await saveGeoJSONFeatures(geojson, file.name.split('.')[0]);
                resolve();
            } catch (err) { reject(err); }
        };
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

async function handleZip(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const geojson = await shp(e.target.result);
                await saveGeoJSONFeatures(geojson, file.name.split('.')[0]);
                resolve();
            } catch (err) { reject(err); }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

async function handleShp(group) {
    try {
        if (!group.dbf || !group.prj) {
            let missing = [];
            if (!group.dbf) missing.push('.dbf');
            if (!group.prj) missing.push('.prj');

            const msg = currentLang === 'de'
                ? `Für den Import der Datei "${group.shp.name}" fehlen folgende Dateien: ${missing.join(', ')}.\n\nBitte wählen Sie alle zugehörigen Dateien (.shp, .dbf, .prj) zusammen aus oder verwenden Sie die Funktion "Ordner hochladen".\n\nOhne .dbf fehlen die Feldnamen, und ohne .prj kann die Position falsch sein.`
                : `The following files are missing for importing "${group.shp.name}": ${missing.join(', ')}.\n\nPlease select all related files (.shp, .dbf, .prj) together or use the "Upload Folder" function.\n\nWithout .dbf, field names will be missing, and without .prj, the position might be incorrect.`;

            showToast(msg);
            return;
        }

        const shpBuffer = await group.shp.arrayBuffer();
        const dbfBuffer = await group.dbf.arrayBuffer();

        const geojson = shp.combine([shp.parseShp(shpBuffer), shp.parseDbf(dbfBuffer)]);
        const prjText = await group.prj.text();

        // Handle reprojection if .prj exists and isn't WGS84
        const isWGS84 = !prjText || prjText.includes('WGS_1984') || prjText.includes('EPSG","4326"') || prjText.includes('GEOGCS["GCS_WGS_1984"');

        if (!isWGS84) {
            try {
                console.log('Reprojecting from:', prjText);
                const sourceProj = prjText;
                const destProj = 'EPSG:4326';
                const features = Array.isArray(geojson) ? geojson.flatMap(g => g.features || [g]) : (geojson.features || [geojson]);

                features.forEach(feature => {
                    if (!feature.geometry || !feature.geometry.coordinates) return;

                    const reprojectNode = (node) => {
                        if (Array.isArray(node) && typeof node[0] === 'number' && typeof node[1] === 'number') {
                            const [lng, lat] = proj4(sourceProj, destProj, [node[0], node[1]]);
                            node[0] = lng;
                            node[1] = lat;
                        } else if (Array.isArray(node)) {
                            node.forEach(reprojectNode);
                        }
                    };
                    reprojectNode(feature.geometry.coordinates);
                });
            } catch (reprojErr) {
                console.warn('Reprojection failed, falling back to raw coordinates:', reprojErr);
            }
        } else {
            console.log('SHP already in WGS84 or no PRJ found.');
        }

        await saveGeoJSONFeatures(geojson, group.shp.name.split('.')[0]);
    } catch (err) {
        console.error('Error parsing Shapefiles:', err);
        showToast('Error parsing Shapefiles: ' + err.message);
    }
}

async function handleISOXML(file) {
    console.log('Handling ISOXML import');
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const xmlText = e.target.result;
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
                const partFields = xmlDoc.getElementsByTagName('PFD');
                for (let i = 0; i < partFields.length; i++) {
                    const pfd = partFields[i];
                    const name = pfd.getAttribute('C') || 'ISOXML Field';

                    const polygons = [];
                    // Check for PLN elements (Polygon) - standard ISOXML structure
                    const plns = pfd.querySelectorAll(':scope > PLN');
                    if (plns.length > 0) {
                        for (let j = 0; j < plns.length; j++) {
                            const pln = plns[j];
                            const polygonCoords = [];
                            const lineStrings = pln.getElementsByTagName('LSG');
                            for (let k = 0; k < lineStrings.length; k++) {
                                const lsg = lineStrings[k];
                                const type = lsg.getAttribute('A');
                                if (type === '1' || type === '2') {
                                    const ring = parseLSG(lsg);
                                    if (ring.length > 0) {
                                        polygonCoords.push(ring);
                                    }
                                }
                            }
                            if (polygonCoords.length > 0) {
                                polygons.push(polygonCoords);
                            }
                        }
                    } else {
                        // Fallback: search for LSG directly under PFD if no PLN exists
                        const lineStrings = pfd.querySelectorAll(':scope > LSG');
                        let currentPolygon = null;
                        for (let j = 0; j < lineStrings.length; j++) {
                            const lsg = lineStrings[j];
                            const type = lsg.getAttribute('A');
                            const ring = parseLSG(lsg);
                            if (ring.length > 0) {
                                if (type === '1') { // Exterior
                                    if (currentPolygon) polygons.push(currentPolygon);
                                    currentPolygon = [ring];
                                } else if (type === '2' && currentPolygon) { // Interior
                                    currentPolygon.push(ring);
                                }
                            }
                        }
                        if (currentPolygon) polygons.push(currentPolygon);
                    }

                    if (polygons.length > 0) {
                        const geometry = polygons.length === 1 ? { type: 'Polygon', coordinates: polygons[0] } : { type: 'MultiPolygon', coordinates: polygons };
                        const geojson = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { name: name }, geometry: geometry }] };
                        await saveGeoJSONFeatures(geojson, name);
                    }
                }
                resolve();
            } catch (err) {
                console.error('Error in handleISOXML:', err);
                reject(err);
            }
        };
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

function parseLSG(lsg) {
    const points = lsg.getElementsByTagName('PNT');
    const ring = [];
    for (let k = 0; k < points.length; k++) {
        const lat = parseFloat(points[k].getAttribute('C')); // Latitude
        const lng = parseFloat(points[k].getAttribute('D')); // Longitude
        if (!isNaN(lat) && !isNaN(lng)) ring.push([lng, lat]);
    }
    if (ring.length > 0) {
        // Ensure ring is closed
        if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
            ring.push([ring[0][0], ring[0][1]]);
        }
    }
    return ring;
}

async function saveGeoJSONFeatures(geojson, defaultName) {
    let features = [];
    if (Array.isArray(geojson)) {
        features = geojson.flatMap(g => g.features || [g]);
    } else if (geojson.type === 'FeatureCollection') {
        features = geojson.features;
    } else {
        features = [geojson];
    }

    for (const item of features) {
        let geometry = item.geometry || (item.type === 'Polygon' || item.type === 'MultiPolygon' ? item : null);
        if (geometry) {
            const props = item.properties || {};

            let finalCrop = props.KULTUR || props.Nutzung || '';

            await fetch('api/fields.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: props.SCHLAGNR || props.name || props.NAME || props.Name || props.NAM || props.Designator || defaultName,
                    crop: finalCrop,
                    notes: props.description || props.notes || '',
                    geometry: JSON.stringify(geometry),
                    area: calculateArea(geometry)
                })
            });
        }
    }
}

function handleCropNCAutoMatch(input) {
    const val = input.value.trim();
    if (val.length === 3 && /^\d{3}$/.test(val)) {
        const matched = cropList.find(c => String(c.nc) === val);
        if (matched) {
            const lang = (typeof currentLang !== 'undefined') ? currentLang : 'en';
            const displayName = lang === 'de' ? matched.name : matched.en;
            input.value = `${displayName} (${matched.eppo})`;
        }
    }
}

// Resizer Logic
function initResizer() {
    const resizer = document.getElementById('resizer');
    const sidebar = document.getElementById('sidebar');
    const container = document.getElementById('container');

    // Load saved width
    const savedWidth = localStorage.getItem('sidebarWidth');
    if (savedWidth) {
        sidebar.style.width = savedWidth;
    } else {
        sidebar.style.width = '50%';
    }

    resizer.addEventListener('mousedown', function(e) {
        e.preventDefault();
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = 'col-resize';
    });

    function handleMouseMove(e) {
        const containerWidth = container.offsetWidth;
        const newWidth = (e.clientX / containerWidth) * 100;

        if (newWidth > 10 && newWidth < 90) {
            sidebar.style.width = `${newWidth}%`;
            map.invalidateSize();
        }
    }

    function handleMouseUp() {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = 'default';
        localStorage.setItem('sidebarWidth', sidebar.style.width);
    }
}

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    initResizer();
    const cropInput = document.getElementById('field-crop');
    if (cropInput) {
        cropInput.addEventListener('input', (e) => handleCropNCAutoMatch(e.target));
    }

    const yearSelect = document.getElementById('mgmt-year-select');
    if (yearSelect) {
        const currentYearNum = new Date().getFullYear();
        for (let y = currentYearNum + 1; y >= currentYearNum - 5; y--) {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y;
            if (y === currentYear) opt.selected = true;
            yearSelect.appendChild(opt);
        }
    }

    const bulkDateInput = document.getElementById('bulk-task-date');
    if (bulkDateInput) {
        bulkDateInput.addEventListener('change', fetchBulkWeather);
    }

    loadFields(true);
});
