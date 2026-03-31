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
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    // Group files by base name for SHP (not zip) handling
    const fileGroups = {};
    files.forEach(file => {
        const nameParts = file.name.split('.');
        const ext = nameParts.pop().toLowerCase();
        const base = nameParts.join('.');
        if (!fileGroups[base]) fileGroups[base] = {};
        fileGroups[base][ext] = file;
    });

    for (const base in fileGroups) {
        const group = fileGroups[base];

        if (group.kml) {
            await handleKML(group.kml);
        } else if (group.zip) {
            await handleZip(group.zip);
        } else if (group.shp) {
            await handleShp(group);
        } else if (group.xml && base.toUpperCase() === 'TASKDATA') {
            await handleISOXML(group.xml);
        }
    }
    loadFields();
    fileInput.value = ''; // Reset input
};

async function handleKML(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const kmlText = e.target.result;
                const parser = new DOMParser();
                const kmlDoc = parser.parseFromString(kmlText, 'text/xml');
                const geojson = toGeoJSON.kml(kmlDoc);
                await saveGeoJSONFeatures(geojson, 'Imported Field');
                resolve();
            } catch (err) {
                console.error('Error parsing KML:', err);
                reject(err);
            }
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
                await saveGeoJSONFeatures(geojson, 'Imported Shape');
                resolve();
            } catch (err) {
                console.error('Error parsing Shapefile Zip:', err);
                alert('Error parsing Shapefile Zip.');
                reject(err);
            }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

async function handleShp(group) {
    try {
        const shpBuffer = await group.shp.arrayBuffer();
        const dbfBuffer = group.dbf ? await group.dbf.arrayBuffer() : null;

        const parsedShp = shp.parseShp(shpBuffer);
        const parsedDbf = dbfBuffer ? shp.parseDbf(dbfBuffer) : null;

        const geojson = shp.combine([parsedShp, parsedDbf]);

        await saveGeoJSONFeatures(geojson, 'Imported Shape');
    } catch (err) {
        console.error('Error in handleShp:', err);
        alert('Error parsing individual Shapefiles: ' + err.message);
    }
}

async function handleISOXML(file) {
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

                    const lineStrings = pfd.getElementsByTagName('LSG');
                    const polygons = [];
                    let currentPolygon = null;

                    for (let j = 0; j < lineStrings.length; j++) {
                        const lsg = lineStrings[j];
                        const type = lsg.getAttribute('A');

                        if (type === '1' || type === '2') {
                            const points = lsg.getElementsByTagName('PNT');
                            const ring = [];
                            for (let k = 0; k < points.length; k++) {
                                const lat = parseFloat(points[k].getAttribute('C'));
                                const lng = parseFloat(points[k].getAttribute('D'));
                                if (!isNaN(lat) && !isNaN(lng)) {
                                    ring.push([lng, lat]);
                                }
                            }

                            if (ring.length > 0) {
                                if (ring[0][0] !== ring[ring.length-1][0] || ring[0][1] !== ring[ring.length-1][1]) {
                                    ring.push(ring[0]);
                                }

                                if (type === '1') {
                                    if (currentPolygon) polygons.push(currentPolygon);
                                    currentPolygon = [ring];
                                } else if (type === '2' && currentPolygon) {
                                    currentPolygon.push(ring);
                                }
                            }
                        }
                    }
                    if (currentPolygon) polygons.push(currentPolygon);

                    if (polygons.length > 0) {
                        const geometry = polygons.length === 1
                            ? { type: 'Polygon', coordinates: polygons[0] }
                            : { type: 'MultiPolygon', coordinates: polygons };

                        const geojson = {
                            type: 'FeatureCollection',
                            features: [{
                                type: 'Feature',
                                properties: { name: name, description: 'Imported from ISOXML' },
                                geometry: geometry
                            }]
                        };
                        await saveGeoJSONFeatures(geojson, name);
                    }
                }
                resolve();
            } catch (err) {
                console.error('Error parsing ISOXML:', err);
                reject(err);
            }
        };
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

async function saveGeoJSONFeatures(geojson, defaultName) {
    const features = Array.isArray(geojson) ? geojson.flatMap(g => g.features) : geojson.features;
    for (const feature of features) {
        if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
            const props = feature.properties || {};
            await fetch('api/fields.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: props.name || props.NAM || props.Designator || defaultName,
                    notes: props.description || props.notes || '',
                    geometry: JSON.stringify(feature.geometry)
                })
            });
        }
    }
}

// Initial Load
loadFields();
