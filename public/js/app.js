// Initialize Map
const map = L.map('map').setView([51.1657, 10.4515], 6); // Germany center

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

    return (totalArea / 10000).toFixed(2); // Convert to hectares
}

// Load Fields from Backend
async function loadFields(autoZoom = false) {
    console.log('loadFields called');
    try {
        const response = await fetch('api/fields.php');
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

        for (const field of fields) {
            let geojson = JSON.parse(field.geometry);
            const area = calculateArea(geojson);
            totalArea += parseFloat(area);

            const crop = field.crop || '';

            // Ensure we have a Feature/FeatureCollection for L.geoJSON to properly trigger onEachFeature
            if (geojson.type !== 'Feature' && geojson.type !== 'FeatureCollection') {
                geojson = {
                    type: 'Feature',
                    geometry: geojson,
                    properties: {}
                };
            }

            console.log('Adding field to map:', field.name, field.id);
            L.geoJSON(geojson, {
                onEachFeature: (feature, layer) => {
                    layer.fieldData = field;

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

                    // Add to the group
                    drawnItems.addLayer(layer);
                }
            });

            // Add to Sidebar
            const item = document.createElement('div');
            item.className = 'field-item';

            const title = document.createElement('h4');
            title.textContent = `${field.name} (${area} ha)`;
            item.appendChild(title);

            if (crop) {
                const cropInfo = document.createElement('div');
                cropInfo.style.fontSize = '0.9em';
                cropInfo.style.marginBottom = '5px';
                cropInfo.textContent = cropLabel + " " + crop;
                item.appendChild(cropInfo);
            }

            const actions = document.createElement('div');
            actions.className = 'actions';

            const zoomBtn = document.createElement('button');
            zoomBtn.className = 'btn-primary';
            zoomBtn.textContent = (typeof _t === 'function') ? _t('btn-zoom') : 'Zoom';
            zoomBtn.onclick = () => zoomToField(field.id);

            const editBtn = document.createElement('button');
            editBtn.className = 'btn-success';
            editBtn.textContent = (typeof _t === 'function') ? _t('btn-edit') : 'Edit/Info';
            editBtn.onclick = () => window.location.href = `field.html?id=${field.id}`;

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn-danger';
            deleteBtn.textContent = (typeof _t === 'function') ? _t('btn-delete') : 'Delete';
            deleteBtn.onclick = () => deleteField(field.id);

            actions.appendChild(zoomBtn);
            actions.appendChild(editBtn);
            actions.appendChild(deleteBtn);
            item.appendChild(actions);

            listElement.appendChild(item);
        }

        const totalAreaText = (typeof _t === 'function') ? _t('total-area', {area: totalArea.toFixed(2)}) : `Total Area: ${totalArea.toFixed(2)} ha`;
        document.getElementById('total-area-display').textContent = totalAreaText;

        if (autoZoom && fields.length > 0) {
            zoomToAllFields();
        }
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
        alert(typeof _t === 'function' ? _t('alert-name') : 'Please enter a name');
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
        alert('Error saving field');
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

async function exportAllData() {
    if (loadedFields.length === 0) {
        alert(typeof _t === 'function' ? _t('no-fields-export') : "No fields to export.");
        return;
    }

    const wb = XLSX.utils.book_new();

    for (const field of loadedFields) {
        const response = await fetch(`api/records.php?field_id=${field.id}`);
        const records = await response.json();

        if (records.length > 0) {
            const data = records.map(r => ({
                "Year": r.year,
                "Crop": r.crop,
                "Seeding Date": r.seeding_date,
                "Seeding": r.seeding,
                "Fertilizing Date": r.fertilizing_date,
                "Fertilizing": r.fertilizing,
                "Spraying Date": r.spraying_date,
                "Spraying": r.spraying,
                "Employee": r.spraying_employee,
                "BBCH": r.bbch,
                "Tilling Date": r.tilling_date,
                "Tilling": r.tilling,
                "Harvesting Date": r.harvesting_date,
                "Harvesting": r.harvesting,
                "Notes": r.notes
            }));

            const ws = XLSX.utils.json_to_sheet(data);
            // Sheet name max length 31 chars
            XLSX.utils.book_append_sheet(wb, ws, field.name.substring(0, 31));
        }
    }

    if (wb.SheetNames.length === 0) {
        alert("No records found for any field.");
        return;
    }

    XLSX.writeFile(wb, "all_fields_records.xlsx");
}

function exportISOXML() {
    if (loadedFields.length === 0) {
        alert(_t('no-fields-export'));
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

fileInput.onchange = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

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
        if (group.kml) await handleKML(group.kml);
        else if (group.json || group.geojson) await handleGenericJSON(group.json || group.geojson);
        else if (group.zip) await handleZip(group.zip);
        else if (group.shp) await handleShp(group);
        else if (group.xml && base.toUpperCase() === 'TASKDATA') await handleISOXML(group.xml);
    }
    loadFields(true);
    fileInput.value = '';
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
        const options = {
            shp: await group.shp.arrayBuffer()
        };
        if (group.dbf) options.dbf = await group.dbf.arrayBuffer();
        if (group.shx) options.shx = await group.shx.arrayBuffer();

        let geojson = await shp(options);
        const prjText = group.prj ? await group.prj.text() : null;

        // Handle reprojection if .prj exists and isn't WGS84
        if (prjText && !prjText.includes('WGS_1984') && !prjText.includes('EPSG","4326"')) {
            try {
                const sourceProj = prjText;
                const destProj = 'EPSG:4326';
                const features = Array.isArray(geojson) ? geojson.flatMap(g => g.features || [g]) : (geojson.features || [geojson]);

                features.forEach(feature => {
                    if (!feature.geometry || !feature.geometry.coordinates) return;
                    const reprojectCoords = (coords) => {
                        if (typeof coords[0] === 'number') {
                            const [lng, lat] = proj4(sourceProj, destProj, coords);
                            coords[0] = lng;
                            coords[1] = lat;
                        } else {
                            coords.forEach(reprojectCoords);
                        }
                    };
                    reprojectCoords(feature.geometry.coordinates);
                });
            } catch (reprojErr) {
                console.warn('Reprojection failed, falling back to raw coordinates:', reprojErr);
            }
        }

        await saveGeoJSONFeatures(geojson, group.shp.name.split('.')[0]);
    } catch (err) {
        console.error('Error parsing Shapefiles:', err);
        alert('Error parsing Shapefiles: ' + err.message);
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
            await fetch('api/fields.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: props.name || props.NAME || props.Name || props.NAM || props.Designator || defaultName,
                    notes: props.description || props.notes || '',
                    geometry: JSON.stringify(geometry),
                    area: calculateArea(geometry)
                })
            });
        }
    }
}

// Initial Load
loadFields(true);
