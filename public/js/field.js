// Initialize Map for Preview
let map = L.map('field-map-preview').setView([51.1657, 10.4515], 13);
L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: '&copy; Google'
}).addTo(map);

let drawnItems = new L.FeatureGroup().addTo(map);
let currentField = null;

async function loadField() {
    const urlParams = new URLSearchParams(window.location.search);
    const fieldId = urlParams.get('id');
    if (!fieldId) {
        window.location.href = 'index.html';
        return;
    }

    const response = await fetch(`api/fields.php?id=${fieldId}`);
    currentField = await response.json();

    if (!currentField || currentField.error) {
        alert("Field not found");
        window.location.href = 'index.html';
        return;
    }

    // Fill basic info
    document.getElementById('field-id').value = currentField.id;
    document.getElementById('field-name').value = currentField.name;

    // Render Geometry
    const geojson = JSON.parse(currentField.geometry);
    const layer = L.geoJSON(geojson).addTo(drawnItems);
    map.fitBounds(layer.getBounds());

    // Initialize Year Selector
    initYearSelector();
}

function initYearSelector() {
    const select = document.getElementById('mgmt-year-select');
    const currentYear = new Date().getFullYear();
    for (let i = currentYear + 1; i >= currentYear - 5; i--) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = i;
        if (i === currentYear) option.selected = true;
        select.appendChild(option);
    }
    loadYearlyRecord();
}

async function loadYearlyRecord() {
    const year = document.getElementById('mgmt-year-select').value;
    const response = await fetch(`api/records.php?field_id=${currentField.id}&year=${year}`);
    const record = await response.json();

    document.getElementById('field-crop').value = record.crop || '';
    document.getElementById('field-seeding').value = record.seeding || '';
    document.getElementById('field-fertilizing').value = record.fertilizing || '';
    document.getElementById('field-spraying').value = record.spraying || '';
    document.getElementById('field-tilling').value = record.tilling || '';
    document.getElementById('field-harvesting').value = record.harvesting || '';
    document.getElementById('field-notes').value = record.notes || '';
}

async function searchPSM() {
    const query = document.getElementById('psm-search').value;
    if (query.length < 3) return;

    const response = await fetch(`api/psm_proxy.php?q=${encodeURIComponent(query)}`);
    const data = await response.json();
    const select = document.getElementById('psm-select');

    // Keep first option
    select.innerHTML = `<option value="">${translations[currentLang]['psm-choose-option']}</option>`;

    if (data.items) {
        data.items.forEach(item => {
            const option = document.createElement('option');
            option.value = `${item.mittelname} (${item.kennr})`;
            option.textContent = `${item.mittelname} (${item.kennr})`;
            select.appendChild(option);
        });
    }
}

function addPSMToDetails() {
    const select = document.getElementById('psm-select');
    if (!select.value) return;

    const textarea = document.getElementById('field-spraying');
    if (textarea.value) textarea.value += "\n";
    textarea.value += select.value;
}

async function saveField() {
    // 1. Update Field Name
    const fieldName = document.getElementById('field-name').value;
    if (!fieldName) {
        alert(_t('alert-name'));
        return;
    }

    await fetch(`api/fields.php?id=${currentField.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ...currentField,
            name: fieldName
        })
    });

    // 2. Save Yearly Record
    const year = document.getElementById('mgmt-year-select').value;
    const recordData = {
        field_id: currentField.id,
        year: year,
        crop: document.getElementById('field-crop').value,
        seeding: document.getElementById('field-seeding').value,
        fertilizing: document.getElementById('field-fertilizing').value,
        spraying: document.getElementById('field-spraying').value,
        tilling: document.getElementById('field-tilling').value,
        harvesting: document.getElementById('field-harvesting').value,
        notes: document.getElementById('field-notes').value
    };

    await fetch('api/records.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recordData)
    });

    alert(_t('btn-save-changes') + "!");
}

async function exportCSV() {
    const response = await fetch(`api/records.php?field_id=${currentField.id}`);
    const records = await response.json();

    if (records.length === 0) {
        alert("No records to export.");
        return;
    }

    let csv = "Field,Year,Crop,Seeding,Fertilizing,Spraying,Tilling,Harvesting,Notes\n";
    records.forEach(r => {
        csv += `"${currentField.name}","${r.year}","${r.crop}","${r.seeding}","${r.fertilizing}","${r.spraying}","${r.tilling}","${r.harvesting}","${r.notes}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `field_${currentField.id}_records.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

async function deleteField() {
    if (confirm(_t('confirm-delete'))) {
        await fetch(`api/fields.php?id=${currentField.id}`, {
            method: 'DELETE'
        });
        window.location.href = 'index.html';
    }
}

document.addEventListener('DOMContentLoaded', loadField);
