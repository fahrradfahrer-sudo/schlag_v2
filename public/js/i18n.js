const translations = {
    en: {
        'page-title': 'AgriField Manager - Dashboard',
        'header-title': 'AgriField Manager',
        'farmer-overview': 'Farmer Overview',
        'field-overview': 'Field Overview',
        'zoom-all': 'Zoom All',
        'export-isoxml': 'Export ISOXML',
        'total-area': 'Total Area: {area} ha',
        'import-fields': 'Import Fields',
        'upload-file': 'Upload File',
        'my-fields': 'My Fields',
        'btn-zoom': 'Zoom',
        'btn-edit': 'Edit/Info',
        'btn-delete': 'Delete',
        'modal-new-field': 'New Field',
        'modal-edit-info': 'Field Information',
        'label-name': 'Field Name:',
        'label-crop': 'Crop:',
        'label-seeding': 'Seeding Details:',
        'label-fertilizing': 'Fertilizing Details:',
        'label-spraying': 'Spraying Details:',
        'label-tilling': 'Tilling Details:',
        'label-harvesting': 'Harvesting Details:',
        'label-notes': 'General Notes:',
        'btn-save': 'Save',
        'btn-cancel': 'Cancel',
        'placeholder-crop': 'e.g. Wheat, Corn',
        'back-link': '← Back to Map',
        'btn-save-changes': 'Save Changes',
        'btn-delete-field': 'Delete Field',
        'confirm-delete': 'Are you sure you want to delete this field?',
        'alert-name': 'Please enter a name',
        'no-fields-export': 'No fields to export.',
        'error-parsing': 'Error parsing file: ',
        'field-details-title': 'Field Details',
        'psm-search-placeholder': 'Search product...',
        'psm-choose-option': '-- Choose product --',
        'btn-psm-search': 'Search',
        'mgmt-year': 'Management Year:',
        'export-csv': 'Export CSV',
        'psm-product': 'Product',
        'psm-expiry': 'Approval End',
        'psm-bee': 'Bee safety',
        'psm-rates': 'Rates',
        'psm-add-btn': 'Add to spraying'
    },
    de: {
        'page-title': 'AgriField Manager - Übersicht',
        'header-title': 'AgriField Manager',
        'farmer-overview': 'Landwirte-Übersicht',
        'field-overview': 'Feld-Übersicht',
        'zoom-all': 'Alle anzeigen',
        'export-isoxml': 'ISOXML Export',
        'total-area': 'Gesamtfläche: {area} ha',
        'import-fields': 'Felder importieren',
        'upload-file': 'Datei hochladen',
        'my-fields': 'Meine Felder',
        'btn-zoom': 'Zoom',
        'btn-edit': 'Info/Bearbeiten',
        'btn-delete': 'Löschen',
        'modal-new-field': 'Neues Feld',
        'modal-edit-info': 'Feld-Informationen',
        'label-name': 'Feldname:',
        'label-crop': 'Kultur:',
        'label-seeding': 'Aussaat-Details:',
        'label-fertilizing': 'Düngung-Details:',
        'label-spraying': 'Pflanzenschutz-Details:',
        'label-tilling': 'Bodenbearbeitung-Details:',
        'label-harvesting': 'Ernte-Details:',
        'label-notes': 'Allgemeine Notizen:',
        'btn-save': 'Speichern',
        'btn-cancel': 'Abbrechen',
        'placeholder-crop': 'z.B. Weizen, Mais',
        'back-link': '← Zurück zur Karte',
        'btn-save-changes': 'Änderungen speichern',
        'btn-delete-field': 'Feld löschen',
        'confirm-delete': 'Sind Sie sicher, dass Sie dieses Feld löschen möchten?',
        'alert-name': 'Bitte geben Sie einen Namen ein',
        'no-fields-export': 'Keine Felder zum Exportieren vorhanden.',
        'error-parsing': 'Fehler beim Parsen der Datei: ',
        'field-details-title': 'Felddetails',
        'psm-search-placeholder': 'Produkt suchen...',
        'psm-choose-option': '-- Produkt wählen --',
        'btn-psm-search': 'Suchen',
        'mgmt-year': 'Wirtschaftsjahr:',
        'export-csv': 'CSV Export',
        'psm-product': 'Produkt',
        'psm-expiry': 'Zulassungsende',
        'psm-bee': 'Bienenschutz',
        'psm-rates': 'Aufwandmengen',
        'psm-add-btn': 'Zu Spritzungen hinzufügen'
    }
};

let currentLang = localStorage.getItem('language') || 'en';
let cropList = [];

async function loadCropList() {
    try {
        if (cropList.length === 0) {
            const response = await fetch('data/crops.json');
            cropList = await response.json();
        }
        const datalists = document.querySelectorAll('#crop-list');
        datalists.forEach(datalist => {
            datalist.innerHTML = '';
            cropList.forEach(crop => {
                const option = document.createElement('option');
                const displayName = currentLang === 'de' ? crop.name : crop.en;
                option.value = `${displayName} (${crop.eppo})`;
                datalist.appendChild(option);
            });
        });
    } catch (e) {
        console.error("Error loading crop list:", e);
    }
}

function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('language', lang);
    applyTranslations();
}

function applyTranslations() {
    const t = translations[currentLang];

    const map = {
        'header-title': t['header-title'],
        'farmer-overview-text': t['farmer-overview'],
        'field-overview-title': t['field-overview'],
        'zoom-all-btn': t['zoom-all'],
        'export-btn': t['export-isoxml'],
        'import-title': t['import-fields'],
        'upload-btn': t['upload-file'],
        'my-fields-title': t['my-fields'],
        'modal-title': t['modal-edit-info'],
        'label-name': t['label-name'],
        'label-crop': t['label-crop'],
        'label-seeding': t['label-seeding'],
        'label-fertilizing': t['label-fertilizing'],
        'label-spraying': t['label-spraying'],
        'label-tilling': t['label-tilling'],
        'label-harvesting': t['label-harvesting'],
        'label-notes': t['label-notes'],
        'save-field-btn': t['btn-save'],
        'cancel-btn': t['btn-cancel'],
        'back-link': t['back-link'],
        'save-btn': t['btn-save-changes'],
        'delete-btn': t['btn-delete-field'],
        'export-csv-btn': t['export-csv']
    };

    for (let id in map) {
        const el = document.getElementById(id);
        if (el) el.textContent = map[id];
    }

    const cropInputs = document.querySelectorAll('#field-crop');
    cropInputs.forEach(input => {
        input.placeholder = t['placeholder-crop'];
    });

    loadCropList();

    const psmSearchInput = document.getElementById('psm-search');
    if (psmSearchInput) psmSearchInput.placeholder = t['psm-search-placeholder'];

    const psmChooseOption = document.querySelector('#psm-select option[value=""]');
    if (psmChooseOption) psmChooseOption.textContent = t['psm-choose-option'];

    const psmSearchBtn = document.querySelector('button[onclick="searchPSM()"]');
    if (psmSearchBtn) psmSearchBtn.textContent = t['btn-psm-search'];

    const yearLabel = document.getElementById('label-year');
    if (yearLabel) yearLabel.textContent = t['mgmt-year'];

    const psmAddBtn = document.getElementById('psm-add-btn');
    if (psmAddBtn) psmAddBtn.textContent = t['psm-add-btn'];

    const mainHeader = document.querySelector('header h1');
    if (mainHeader) {
        if (window.location.pathname.includes('field.html')) {
            mainHeader.textContent = t['field-details-title'];
        } else {
            mainHeader.textContent = t['header-title'];
        }
    }
}

function _t(key, replacements = {}) {
    let str = translations[currentLang][key] || key;
    for (let k in replacements) {
        str = str.replace(`{${k}}`, replacements[k]);
    }
    return str;
}

document.addEventListener('DOMContentLoaded', applyTranslations);
