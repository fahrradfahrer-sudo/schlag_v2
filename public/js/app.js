// Initialize Map
const map = L.map('map').setView([51.1657, 10.4515], 6); // Germany center

// Google Satellite Basemap (Leaflet TileLayer)
const googleSatellite = L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
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

// Load Fields from Backend
async function loadFields() {
    const response = await fetch('api/fields.php');
    const fields = await response.json();
    loadedFields = fields;

    drawnItems.clearLayers();
    const listElement = document.getElementById('field-list');
    listElement.innerHTML = '';

    fields.forEach(field => {
        const geojson = JSON.parse(field.geometry);
        L.geoJSON(geojson, {
            onEachFeature: (feature, layer) => {
                layer.fieldId = field.id;
                layer.fieldName = field.name;
                layer.fieldNotes = field.notes;

                // Add popup for better UX - prevent XSS
                const popupContent = document.createElement('div');
                const b = document.createElement('b');
                b.textContent = field.name;
                popupContent.appendChild(b);
                popupContent.appendChild(document.createElement('br'));
                popupContent.appendChild(document.createTextNode(field.notes || ''));
                layer.bindPopup(popupContent);

                // Add individual layer directly to drawnItems to avoid nesting
                layer.addTo(drawnItems);
            }
        });

        // Add to Sidebar
        const item = document.createElement('div');
        item.className = 'field-item';

        const title = document.createElement('h4');
        title.textContent = field.name;
        item.appendChild(title);

        const actions = document.createElement('div');
        actions.className = 'actions';

        const zoomBtn = document.createElement('button');
        zoomBtn.className = 'btn-primary';
        zoomBtn.textContent = 'Zoom';
        zoomBtn.onclick = () => zoomToField(field.id);

        const editBtn = document.createElement('button');
        editBtn.className = 'btn-success';
        editBtn.textContent = 'Edit';
        editBtn.onclick = () => openModal('Edit Field', field.name, field.notes, field.id);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-danger';
        deleteBtn.textContent = 'Delete';
        deleteBtn.onclick = () => deleteField(field.id);

        actions.appendChild(zoomBtn);
        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);
        item.appendChild(actions);

        listElement.appendChild(item);
    });
}

// Global variable to store current geometry for new/edited field
let currentGeometry = null;

// Event: Field Created
map.on(L.Draw.Event.CREATED, function (e) {
    const layer = e.layer;
    currentGeometry = layer.toGeoJSON();
    openModal('New Field', '', '', null);
});

// Event: Field Edited
map.on(L.Draw.Event.EDITED, function (e) {
    const layers = e.layers;
    layers.eachLayer(async function (layer) {
        if (layer.fieldId) {
            const updatedGeometry = layer.toGeoJSON();
            await fetch(`api/fields.php?id=${layer.fieldId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: layer.fieldName,
                    notes: layer.fieldNotes,
                    geometry: JSON.stringify(updatedGeometry)
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
const fieldNotesInput = document.getElementById('field-notes');
const saveBtn = document.getElementById('save-field-btn');

function openModal(title, name, notes, id) {
    modalTitle.innerText = title;
    fieldNameInput.value = name;
    fieldNotesInput.value = notes;
    fieldIdInput.value = id || '';
    modal.style.display = 'block';
}

function closeModal() {
    modal.style.display = 'none';
    currentGeometry = null;
    loadFields(); // Refresh to clean up temporary drawing layers
}

saveBtn.onclick = async () => {
    const name = fieldNameInput.value;
    const notes = fieldNotesInput.value;
    const id = fieldIdInput.value;

    if (!name) {
        alert("Please enter a name");
        return;
    }

    if (id) {
        // Find existing layer geometry if not changing it
        let geometry = null;
        drawnItems.eachLayer(layer => {
            if (layer.fieldId == id) {
                geometry = JSON.stringify(layer.toGeoJSON());
            }
        });

        if (!geometry) {
            alert("Error: Geometry not found for the selected field.");
            return;
        }

        await fetch(`api/fields.php?id=${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: name,
                notes: notes,
                geometry: geometry
            })
        });
    } else if (currentGeometry) {
        // Create New
        await fetch('api/fields.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: name,
                notes: notes,
                geometry: JSON.stringify(currentGeometry)
            })
        });
    }

    closeModal();
};

async function deleteField(id) {
    if (confirm('Are you sure you want to delete this field?')) {
        await fetch(`api/fields.php?id=${id}`, {
            method: 'DELETE'
        });
        loadFields();
    }
}

function zoomToField(id) {
    drawnItems.eachLayer(layer => {
        if (layer.fieldId === id) {
            map.fitBounds(layer.getBounds());
        }
    });
}

// Import Logic
const fileInput = document.getElementById('file-import');

fileInput.onchange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const extension = file.name.split('.').pop().toLowerCase();
    const reader = new FileReader();

    if (extension === 'kml') {
        reader.onload = async (e) => {
            const kmlText = e.target.result;
            const parser = new DOMParser();
            const kmlDoc = parser.parseFromString(kmlText, 'text/xml');
            const geojson = toGeoJSON.kml(kmlDoc);

            // Process GeoJSON features
            for (const feature of geojson.features) {
                if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
                    await fetch('api/fields.php', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name: feature.properties.name || 'Imported Field',
                            notes: feature.properties.description || '',
                            geometry: JSON.stringify(feature.geometry)
                        })
                    });
                }
            }
            loadFields();
            alert('KML fields imported successfully!');
        };
        reader.readAsText(file);
    } else if (extension === 'zip') {
        reader.onload = async (e) => {
            const buffer = e.target.result;
            try {
                const geojson = await shp(buffer);
                // shpjs may return a single GeoJSON or an array if there are multiple layers
                const features = Array.isArray(geojson) ? geojson.flatMap(g => g.features) : geojson.features;

                for (const feature of features) {
                    if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
                        await fetch('api/fields.php', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                name: feature.properties.name || 'Imported Shape',
                                notes: '',
                                geometry: JSON.stringify(feature.geometry)
                            })
                        });
                    }
                }
                loadFields();
                alert('Shapefile fields imported successfully!');
            } catch (err) {
                console.error(err);
                alert('Error parsing Shapefile. Ensure it is a valid zip containing .shp, .dbf, etc.');
            }
        };
        reader.readAsArrayBuffer(file);
    } else {
        alert('Unsupported file format. Please use .kml or .zip (for SHP).');
    }
};

// Initial Load
loadFields();
