// Initialize Map for Preview
let map = L.map('field-map-preview').setView([51.1657, 10.4515], 13);
L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
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

    const response = await fetch(`api/fields.php`);
    const fields = await response.json();
    currentField = fields.find(f => f.id == fieldId);

    if (!currentField) {
        alert("Field not found");
        window.location.href = 'index.html';
        return;
    }

    // Fill form
    document.getElementById('field-id').value = currentField.id;
    document.getElementById('field-name').value = currentField.name;
    document.getElementById('field-crop').value = currentField.crop || '';
    document.getElementById('field-seeding').value = currentField.seeding || '';
    document.getElementById('field-fertilizing').value = currentField.fertilizing || '';
    document.getElementById('field-spraying').value = currentField.spraying || '';
    document.getElementById('field-tilling').value = currentField.tilling || '';
    document.getElementById('field-harvesting').value = currentField.harvesting || '';
    document.getElementById('field-notes').value = currentField.notes || '';

    // Render Geometry
    const geojson = JSON.parse(currentField.geometry);
    const layer = L.geoJSON(geojson).addTo(drawnItems);
    map.fitBounds(layer.getBounds());
}

async function saveField() {
    const data = {
        name: document.getElementById('field-name').value,
        crop: document.getElementById('field-crop').value,
        seeding: document.getElementById('field-seeding').value,
        fertilizing: document.getElementById('field-fertilizing').value,
        spraying: document.getElementById('field-spraying').value,
        tilling: document.getElementById('field-tilling').value,
        harvesting: document.getElementById('field-harvesting').value,
        notes: document.getElementById('field-notes').value,
        geometry: currentField.geometry, // Keep original geometry for now
        area: currentField.area
    };

    if (!data.name) {
        alert(_t('alert-name'));
        return;
    }

    await fetch(`api/fields.php?id=${currentField.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    alert(_t('btn-save-changes') + "!");
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
