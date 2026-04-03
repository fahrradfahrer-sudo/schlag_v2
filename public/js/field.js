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

let psmSearchTimeout = null;
let psmSearchResults = [];

async function searchPSM() {
    const query = document.getElementById('psm-search').value;
    const datalist = document.getElementById('psm-list');

    // Check if the current value matches a result from our search
    const matched = psmSearchResults.find(item => `${item.mittelname} (${item.kennr})` === query);
    if (matched) {
        onPSMSelected(matched.kennr);
        return;
    }

    if (query.length < 3) {
        datalist.innerHTML = '';
        return;
    }

    clearTimeout(psmSearchTimeout);
    psmSearchTimeout = setTimeout(async () => {
        const response = await fetch(`api/psm_proxy.php?q=${encodeURIComponent(query)}`);
        const data = await response.json();

        datalist.innerHTML = '';
        psmSearchResults = data.items || [];

        if (data.items) {
            data.items.forEach(item => {
                const option = document.createElement('option');
                option.value = `${item.mittelname} (${item.kennr})`;
                datalist.appendChild(option);
            });
        }
    }, 400);
}

let selectedPSM = null;

async function onPSMSelected(kennr) {
    const detailsDiv = document.getElementById('psm-details');

    if (!kennr) {
        detailsDiv.style.display = 'none';
        selectedPSM = null;
        return;
    }

    const response = await fetch(`api/psm_proxy.php?kennr=${encodeURIComponent(kennr)}`);
    selectedPSM = await response.json();

    if (selectedPSM.mittel) {
        detailsDiv.style.display = 'block';
        document.getElementById('psm-info-name').textContent = `${_t('psm-product')}: ${selectedPSM.mittel.mittelname} (${selectedPSM.mittel.kennr})`;

        const expiryDate = selectedPSM.mittel.zul_ende ? new Date(selectedPSM.mittel.zul_ende).toLocaleDateString() : 'N/A';
        document.getElementById('psm-info-expiry').textContent = `${_t('psm-expiry')}: ${expiryDate}`;

        document.getElementById('psm-info-bee').textContent = `${_t('psm-bee')}: ${selectedPSM.bee_safety}`;

        let ratesText = `${_t('psm-rates')}: `;
        if (selectedPSM.rates && selectedPSM.rates.length > 0) {
            ratesText += selectedPSM.rates.map(r => `${r.amount} ${r.unit}`).join(", ");
        } else {
            ratesText += "N/A";
        }
        document.getElementById('psm-info-rates').textContent = ratesText;
    }
}

function addPSMToDetails() {
    if (!selectedPSM || !selectedPSM.mittel) return;

    const textarea = document.getElementById('field-spraying');
    if (textarea.value) textarea.value += "\n";

    const expiryDate = selectedPSM.mittel.zul_ende ? new Date(selectedPSM.mittel.zul_ende).toLocaleDateString() : 'N/A';
    const rate = (selectedPSM.rates && selectedPSM.rates[0]) ? `${selectedPSM.rates[0].amount} ${selectedPSM.rates[0].unit}` : '';

    let line = `${selectedPSM.mittel.mittelname} (${selectedPSM.mittel.kennr})`;
    if (rate) line += ` @ ${rate}`;
    line += ` [${_t('psm-expiry')}: ${expiryDate}, ${_t('psm-bee')}: ${selectedPSM.bee_safety}]`;

    textarea.value += line;
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

document.addEventListener('DOMContentLoaded', () => {
    loadField();
});
