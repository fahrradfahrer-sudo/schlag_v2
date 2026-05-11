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

function prefillDates() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const currentDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;

    const dateIds = [
        'field-seeding-date',
        'field-fertilizing-date',
        'field-spraying-date',
        'field-tilling-date',
        'field-harvesting-date'
    ];

    dateIds.forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.value) {
            el.value = currentDateTime;
        }
    });
}

async function loadYearlyRecord() {
    const year = document.getElementById('mgmt-year-select').value;
    const response = await fetch(`api/records.php?field_id=${currentField.id}&year=${year}`);
    const record = await response.json();

    document.getElementById('field-crop').value = record.crop || '';
    document.getElementById('field-notes').value = record.notes || '';

    loadTasks();
}

async function loadTasks() {
    const year = document.getElementById('mgmt-year-select').value;
    const response = await fetch(`api/tasks.php?field_id=${currentField.id}&year=${year}`);
    const tasks = await response.json();

    const container = document.getElementById('tasks-list');
    container.innerHTML = '';

    if (tasks.length === 0) {
        container.innerHTML = `<p>${_t('no-tasks-found')}</p>`;
        return;
    }

    tasks.forEach(task => {
        const div = document.createElement('div');
        div.className = 'task-item';
        div.style.border = '1px solid #ddd';
        div.style.padding = '10px';
        div.style.marginBottom = '10px';
        div.style.borderRadius = '4px';
        div.style.background = '#fcfcfc';

        const typeKey = `task-type-${task.task_type}`;
        const translatedType = _t(typeKey).toUpperCase();

        let html = `<strong>${translatedType}</strong> - ${task.task_date}<br>`;

        if (task.task_type === 'spraying' && task.products && task.products.length > 0) {
            html += `<ul style="margin: 5px 0; padding-left: 20px;">`;
            task.products.forEach(p => {
                html += `<li><strong>${p.mittelname}</strong> (${p.kennr}) - ${p.aufwandmenge} ${p.einheit}<br>`;
                html += `<small>${p.schadorganismus} | ${p.verwendungszweck}</small></li>`;
            });
            html += `</ul>`;
            if (task.water_rate) {
                html += `<div><small>Water: ${task.water_rate} l/ha</small></div>`;
            }
        } else {
            html += `<span>${task.content}</span>`;
        }

        if (task.comment) {
            html += `<div style="font-style: italic; color: #666; margin-top: 5px;">${_t('label-task-comment')} ${task.comment}</div>`;
        }
        if (task.employee) {
            html += `<div style="font-size: 0.9em; margin-top: 5px;">${_t('label-task-employee')} ${task.employee}</div>`;
        }
        if (task.bbch) {
            html += `<div style="font-size: 0.9em;">${_t('label-task-bbch')} ${task.bbch}`;
            if (task.bbch_description) {
                html += ` - ${task.bbch_description}`;
            }
            html += `</div>`;
        }
        html += `<button class="btn-danger" style="padding: 2px 5px; font-size: 0.8em; margin-top: 5px;" onclick="deleteTask(${task.id})">${_t('btn-delete')}</button>`;

        div.innerHTML = html;
        container.appendChild(div);
    });
}

function toggleTaskFields() {
    const type = document.getElementById('task-type').value;
    document.getElementById('spraying-fields').style.display = (type === 'spraying') ? 'block' : 'none';
    document.getElementById('bbch-group').style.display = (type === 'spraying' || type === 'fertilizing') ? 'block' : 'none';

    // Default date if empty
    const dateInput = document.getElementById('task-date');
    if (!dateInput.value) {
        const now = new Date();
        dateInput.value = now.toISOString().slice(0, 16);
    }
}

let addedProducts = [];

function addProductToList() {
    const awgSelect = document.getElementById('psm-awg-select');
    const schadSelect = document.getElementById('psm-schadorg-select');
    const verwSelect = document.getElementById('psm-verw-select');
    const rateSelect = document.getElementById('psm-rate-select');

    if (!selectedPSM || !awgSelect.value) return;

    const product = {
        mittelname: selectedPSM.mittel.mittelname,
        kennr: selectedPSM.mittel.kennr,
        schadorganismus: schadSelect.value,
        verwendungszweck: verwSelect.value,
        aufwandmenge: rateSelect.options[rateSelect.selectedIndex].getAttribute('data-amount'),
        einheit: rateSelect.options[rateSelect.selectedIndex].getAttribute('data-unit')
    };

    addedProducts.push(product);
    renderAddedProducts();

    // Reset selection
    document.getElementById('psm-api-selection').style.display = 'none';
    document.getElementById('psm-search').value = '';
}

function renderAddedProducts() {
    const container = document.getElementById('added-products-container');
    const list = document.getElementById('added-products-list');
    list.innerHTML = '';

    if (addedProducts.length > 0) {
        container.style.display = 'block';
        addedProducts.forEach((p, index) => {
            const li = document.createElement('li');
            li.innerHTML = `${p.mittelname} (${p.kennr}) - ${p.aufwandmenge} ${p.einheit} <button type="button" class="btn-danger" style="padding: 0 5px;" onclick="removeProduct(${index})">x</button>`;
            list.appendChild(li);
        });
    } else {
        container.style.display = 'none';
    }
}

function removeProduct(index) {
    addedProducts.splice(index, 1);
    renderAddedProducts();
}

async function addTask() {
    const taskType = document.getElementById('task-type').value;
    const data = {
        field_id: currentField.id,
        year: document.getElementById('mgmt-year-select').value,
        task_type: taskType,
        task_date: document.getElementById('task-date').value,
        content: document.getElementById('task-content').value,
        comment: document.getElementById('task-comment').value,
        employee: document.getElementById('task-employee').value,
        bbch: document.getElementById('task-bbch').value,
        bbch_description: document.getElementById('task-bbch-desc').value,
        water_rate: document.getElementById('task-water-rate').value,
        products: (taskType === 'spraying') ? addedProducts : []
    };

    if (!data.task_date) {
        alert("Please select a date.");
        return;
    }

    if (taskType === 'spraying') {
        if (addedProducts.length === 0) {
            alert("Please add at least one product for plant protection.");
            return;
        }
        if (!data.water_rate) {
            alert("Water application rate is mandatory for plant protection.");
            return;
        }
    }

    await fetch('api/tasks.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    // Clear form
    document.getElementById('task-content').value = '';
    document.getElementById('task-comment').value = '';
    document.getElementById('task-bbch').value = '';
    document.getElementById('task-bbch-desc').value = '';
    document.getElementById('task-water-rate').value = '';
    addedProducts = [];
    renderAddedProducts();

    loadTasks();
}

async function deleteTask(id) {
    if (confirm("Delete this task?")) {
        await fetch(`api/tasks.php?id=${id}`, { method: 'DELETE' });
        loadTasks();
    }
}

function updateBBCHEstimation() {
    const cropValue = document.getElementById('field-crop').value.toLowerCase();
    const bbchInput = document.getElementById('task-bbch');
    const explanationText = document.getElementById('bbch-explanation-text');

    if (!cropValue) {
        explanationText.textContent = '';
        return;
    }

    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();

    let estimation = "";
    let bbch = "";

    if (cropValue.includes('potato') || cropValue.includes('kartoffel')) {
        if (month < 4) {
            bbch = "00";
            estimation = currentLang === 'de' ? "Keimruhe / Vorbereitung" : "Dormancy / Preparation";
        } else if (month === 4) {
            bbch = "01-09";
            estimation = currentLang === 'de' ? "Keimentwicklung" : "Sprout development";
        } else if (month === 5) {
            if (day < 15) {
                bbch = "10-19";
                estimation = currentLang === 'de' ? "Blattentwicklung" : "Leaf development";
            } else {
                bbch = "21-29";
                estimation = currentLang === 'de' ? "Bildung von Seitensprossen" : "Formation of side shoots";
            }
        } else if (month === 6) {
            if (day < 15) {
                bbch = "31-39";
                estimation = currentLang === 'de' ? "Längenwachstum der Hauptstängel / Reihenschluss" : "Stem elongation / Crop cover";
            } else {
                bbch = "41-48";
                estimation = currentLang === 'de' ? "Knollenbildung" : "Tuber formation";
            }
        } else if (month === 7) {
            bbch = "51-69";
            estimation = currentLang === 'de' ? "Blütenknospenentwicklung bis Ende der Blüte" : "Inflorescence emergence to end of flowering";
        } else if (month === 8) {
            bbch = "71-89";
            estimation = currentLang === 'de' ? "Beerenentwicklung bis Reife der Knollen" : "Development of fruit to ripening of tubers";
        } else {
            bbch = "91-99";
            estimation = currentLang === 'de' ? "Absterben der Pflanze / Ernte" : "Senescence / Harvest";
        }
    } else if (cropValue.includes('wheat') || cropValue.includes('weizen')) {
        if (month <= 3) bbch = "21-29";
        else if (month === 4) bbch = "30-32";
        else if (month === 5) bbch = "37-51";
        else if (month === 6) bbch = "61-71";
        else if (month === 7) bbch = "75-89";
        else bbch = "00-11";
        estimation = currentLang === 'de' ? "Schätzung für Winterweizen" : "Estimation for winter wheat";
    }

    if (bbch && !bbchInput.value) {
        bbchInput.placeholder = `e.g. ${bbch}`;
    }
    explanationText.textContent = estimation ? `${bbch}: ${estimation}` : "";

    if (estimation) {
        document.getElementById('task-bbch-desc').value = estimation;
        if (!bbchInput.value) bbchInput.value = bbch.split('-')[0];
    }
}

document.getElementById('field-crop').addEventListener('change', updateBBCHEstimation);
document.getElementById('field-crop').addEventListener('input', updateBBCHEstimation);

let psmSearchTimeout = null;
let psmSearchResults = [];

async function searchPSM(force = false) {
    const query = document.getElementById('psm-search').value;
    const datalist = document.getElementById('psm-list');

    // Check if the current value matches a result from our search
    const matched = psmSearchResults.find(item => `${item.mittelname} (${item.kennr})` === query);
    if (matched && !force) {
        onPSMSelected(matched.kennr);
        return;
    }

    if (query.length < 3 && !force) {
        datalist.innerHTML = '';
        return;
    }

    clearTimeout(psmSearchTimeout);
    psmSearchTimeout = setTimeout(async () => {
        const url = force ? `api/psm_proxy.php?q=` : `api/psm_proxy.php?q=${encodeURIComponent(query)}`;
        const response = await fetch(url);
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
    }, force ? 0 : 400);
}

document.getElementById('psm-search').addEventListener('focus', () => searchPSM(true));
document.getElementById('psm-search').addEventListener('click', () => searchPSM(true));

let selectedPSM = null;

async function onPSMSelected(kennr) {
    const detailsDiv = document.getElementById('psm-details');
    const apiSelectionDiv = document.getElementById('psm-api-selection');

    if (!kennr) {
        detailsDiv.style.display = 'none';
        apiSelectionDiv.style.display = 'none';
        selectedPSM = null;
        return;
    }

    const response = await fetch(`api/psm_proxy.php?kennr=${encodeURIComponent(kennr)}`);
    selectedPSM = await response.json();

    if (selectedPSM.mittel) {
        detailsDiv.style.display = 'block';
        apiSelectionDiv.style.display = 'block';
        document.getElementById('psm-info-name').textContent = `${_t('psm-product')}: ${selectedPSM.mittel.mittelname} (${selectedPSM.mittel.kennr})`;

        // Clear ingredients
        const ingredientsEl = document.getElementById('psm-info-ingredients');
        if (selectedPSM.wirkstoffe && selectedPSM.wirkstoffe.length > 0) {
            ingredientsEl.textContent = selectedPSM.wirkstoffe.map(w => `${w.name} (${w.amount} ${w.unit})`).join(", ");
        } else {
            ingredientsEl.textContent = 'N/A';
        }

        const expiryDate = selectedPSM.mittel.zul_ende ? new Date(selectedPSM.mittel.zul_ende).toLocaleDateString() : 'N/A';
        document.getElementById('psm-info-expiry').textContent = `${_t('psm-expiry')}: ${expiryDate}`;
        document.getElementById('psm-info-bee').textContent = `${_t('psm-bee')}: ${selectedPSM.bee_safety}`;

        const infoRestrictions = document.getElementById('psm-info-restrictions');
        infoRestrictions.textContent = '';
        if (selectedPSM.auflagen && selectedPSM.auflagen.length > 0) {
            const list = document.createElement('ul');
            list.style.margin = '5px 0 0 20px';
            const uniqueAuflagen = [...new Set(selectedPSM.auflagen.map(a => a.auflage))];
            uniqueAuflagen.forEach(a => {
                const li = document.createElement('li');
                li.textContent = a;
                list.appendChild(li);
            });
            infoRestrictions.appendChild(list);
        } else {
            infoRestrictions.appendChild(document.createTextNode('N/A'));
        }

        // Fill AWG select
        const awgSelect = document.getElementById('psm-awg-select');
        awgSelect.innerHTML = '';
        selectedPSM.awg.forEach(a => {
            const opt = document.createElement('option');
            opt.value = a.awg_id;
            opt.textContent = `AWG ${a.awg_id} (${a.anwendungsbereich})`;
            awgSelect.appendChild(opt);
        });

        onAWGSelected();
    }
}

function onAWGSelected() {
    const awgId = document.getElementById('psm-awg-select').value;
    const awg = selectedPSM.awg.find(a => a.awg_id === awgId);
    if (!awg) return;

    // Kultur Check
    const currentCrop = document.getElementById('field-crop').value.toLowerCase();
    const warningDiv = document.getElementById('psm-kultur-warning');
    let cropMatch = false;
    if (currentCrop && awg.kultur) {
        cropMatch = awg.kultur.some(k => currentCrop.includes(k.kultur.toLowerCase()) || k.kultur.toLowerCase().includes(currentCrop));
    }
    warningDiv.style.display = cropMatch ? 'none' : 'block';

    // Schadorg
    const schadSelect = document.getElementById('psm-schadorg-select');
    schadSelect.innerHTML = '';
    awg.schadorg.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.schadorg;
        opt.textContent = s.schadorg;
        schadSelect.appendChild(opt);
    });

    // Verwendung
    const verwSelect = document.getElementById('psm-verw-select');
    verwSelect.innerHTML = '';
    if (awg.verwendung.length > 0) {
        awg.verwendung.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.verwendungszweck;
            opt.textContent = v.verwendungszweck;
            verwSelect.appendChild(opt);
        });
    } else {
        const opt = document.createElement('option');
        opt.value = 'N/A';
        opt.textContent = 'N/A';
        verwSelect.appendChild(opt);
    }

    // Rate
    const rateSelect = document.getElementById('psm-rate-select');
    rateSelect.innerHTML = '';
    awg.aufwand.forEach(r => {
        const opt = document.createElement('option');
        opt.value = `${r.m_aufwand} ${r.m_aufwand_einheit}`;
        opt.textContent = `${r.m_aufwand} ${r.m_aufwand_einheit} (${r.aufwandbedingung || ''})`;
        opt.setAttribute('data-amount', r.m_aufwand);
        opt.setAttribute('data-unit', r.m_aufwand_einheit);
        rateSelect.appendChild(opt);
    });
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
        notes: document.getElementById('field-notes').value
    };

    await fetch('api/records.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recordData)
    });

    alert(_t('btn-save-changes') + "!");
}

function getCenter(geometry) {
    let geojson = typeof geometry === 'string' ? JSON.parse(geometry) : geometry;
    let layer = L.geoJSON(geojson);
    let bounds = layer.getBounds();
    let center = bounds.getCenter();
    return { lat: center.lat.toFixed(6), lng: center.lng.toFixed(6) };
}

async function exportData(format = 'xlsx') {
    const response = await fetch(`api/records.php?field_id=${currentField.id}`);
    const records = await response.json();

    if (records.length === 0) {
        alert("No records to export.");
        return;
    }

    const center = getCenter(currentField.geometry);

    const data = records.map(r => ({
        "Field Name": currentField.name,
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
        "Notes": r.notes,
        "Latitude": center.lat,
        "Longitude": center.lng
    }));

    const ws = XLSX.utils.json_to_sheet(data);

    if (format === 'xlsx') {
        const wb = XLSX.utils.book_new();
        let sheetName = `${currentField.id}_${currentField.name}`.substring(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        XLSX.writeFile(wb, `field_${currentField.id}_records.xlsx`);
    } else {
        const csv = XLSX.utils.sheet_to_csv(ws);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `field_${currentField.id}_records.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }
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
