const map = L.map('map', {
    crs: L.CRS.Simple,
    minZoom: -3,
    maxZoom: 2,
    zoomSnap: 0.5,
    attributionControl: false,
    doubleClickZoom: false
});

const imgWidth = 5400;
const imgHeight = 3750;
const bounds = [[0, 0], [imgHeight, imgWidth]];

const imageOverlay = L.imageOverlay('main/assets/map_background_extracted.jpeg', bounds).addTo(map);

map.fitBounds(bounds);
map.setView([imgHeight / 2, imgWidth / 2], -1);

// Persistent Storage & Multiplayer Sync
let pois = {}; // Changed to object for easier merging by ID
let pathColors = {};
let currentCrusadeId = null;

// Auth Modal UI
const authModal = document.getElementById('auth-modal');
const idInput = document.getElementById('crusade-id-input');
const btnAuth = document.getElementById('btn-auth-submit');
const authMsg = document.getElementById('auth-message');

btnAuth.addEventListener('click', async () => {
    const requestedId = idInput.value.trim();
    btnAuth.disabled = true;
    authMsg.style.display = 'block';

    try {
        if (!requestedId) {
            if (currentCrusadeId) {
                // We already created the crusade, this is the user clicking to continue
                authModal.classList.add('hidden');
                refreshFromNetwork();
                startAutoSync();
                return;
            }

            authMsg.textContent = "Initializing new Cogitator link...";
            currentCrusadeId = await createCrusade();
            idInput.value = currentCrusadeId;
            authMsg.textContent = "Link established! Save this code. Click button again to continue.";
            authMsg.style.color = "var(--accent-gold)";
            btnAuth.textContent = "ENTER CAMPAIGN";
            btnAuth.disabled = false;
        } else {
            authMsg.textContent = "Authenticating with server...";
            await verifyAndLoadCrusade(requestedId);
            currentCrusadeId = requestedId;
            authModal.classList.add('hidden');
            startAutoSync();
        }
    } catch (e) {
        authMsg.textContent = e.message || "Error: Invalid ID or Network Failure.";
        authMsg.style.color = "var(--accent-red)";
        btnAuth.disabled = false;
    }
});

// Network API (Using JSONBin.io)
// IMPORTANT: You will need to create a free account at https://jsonbin.io
const JSONBIN_ACCESS_KEY = "$2a$10$H4vniPlHO4v2R0pwvIqcr.PkQJf68LbFUxXIddVw4HqVG9b7bReA2";
const JSONBIN_COLLECTION_ID = "69a8d106ae596e708f6026f7";
const JSONBIN_BASE_URL = "https://api.jsonbin.io/v3/b";

const jsonbinHeaders = {
    "Content-Type": "application/json",
    "X-Access-Key": JSONBIN_ACCESS_KEY
};

async function createCrusade() {
    const payload = { pois: {}, pathColors: {} };
    const res = await fetch(JSONBIN_BASE_URL, {
        method: "POST",
        headers: {
            ...jsonbinHeaders,
            "X-Bin-Name": "CrusadeMap_" + Date.now(),
            "X-Collection-Id": JSONBIN_COLLECTION_ID
        },
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        throw new Error(`API Error (${res.status}): Validation failed. Make sure your JSONBIN Access Key and Collection ID are valid!`);
    }

    const data = await res.json();
    return data.metadata.id; // JSONBin v3 returns the ID in metadata.id
}

async function verifyAndLoadCrusade(id) {
    const res = await fetch(`${JSONBIN_BASE_URL}/${id}/latest`, {
        headers: jsonbinHeaders
    });
    if (!res.ok) throw new Error("Not Found");
    const data = await res.json();

    // JSONBin stores the data inside the "record" property
    const record = data.record || {};

    // Initial load
    pois = record.pois || {};
    pathColors = record.pathColors || {};
    renderData();
    applyPathColorsToDOM();
}

function mutateNetworkData(localUpdatesCallback) {
    if (!currentCrusadeId) return;

    try {
        // Local-only mutation to save API requests
        const serverData = { pois, pathColors };
        localUpdatesCallback(serverData);

        // Update local ram and re-render
        pois = serverData.pois;
        pathColors = serverData.pathColors;
        renderData();

        // Visually prompt the user that they have unsaved network changes!
        const btnExp = document.getElementById('btn-export');
        if (btnExp) {
            btnExp.innerHTML = `
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M2 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4.207a1 1 0 0 0-.293-.707l-2.5-2.5A1 1 0 0 0 10.5 1H2zm1 2h7.5L13 5.5v7.5a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM5 4a1 1 0 0 0-1 1v2h4V5a1 1 0 0 0-1-1H5zm0 6a1 1 0 0 0-1 1v2h8v-2a1 1 0 0 0-1-1H5z"/>
                </svg>
                Publish Session (Unsaved Changes)
            `;
            btnExp.style.backgroundColor = "var(--accent-red)";
            btnExp.style.borderColor = "var(--accent-red)";
            btnExp.style.color = "white";
        }

    } catch (e) {
        console.error("Local Sync Error:", e);
    }
}

async function refreshFromNetwork() {
    if (!currentCrusadeId) return;
    try {
        const res = await fetch(`${JSONBIN_BASE_URL}/${currentCrusadeId}/latest`, {
            headers: jsonbinHeaders
        });
        const data = await res.json();
        const record = data.record || {};

        // Very basic incoming merge (If a player is editing heavily, you might want object-level timestamps, 
        // but for a tabletop map simple latest-state sync is usually perfect).
        pois = record.pois || {};
        pathColors = record.pathColors || {};
        renderData();
        applyPathColorsToDOM();
    } catch (e) {
        console.warn("Failed to poll server.");
    }
}

function startAutoSync() {
    // Polling has been disabled per user request to conserve JSONBin free allotment requests!
}


// UI Interactions
const coordsOverlay = document.getElementById('coords-overlay');
let activeMarkerMode = false;
let currentClickCoords = null;
const activeMarkers = {};

map.on('popupopen', function (e) {
    const btn = e.popup._contentNode.querySelector('.popup-delete-btn');
    if (btn) {
        btn.addEventListener('click', function () {
            const idToDel = btn.getAttribute('data-id');
            map.closePopup();
            // Network Mutation: Delete POI
            mutateNetworkData((serverData) => {
                delete serverData.pois[idToDel];
            });
        });
    }
});

map.on('mousemove', function (e) {
    coordsOverlay.innerHTML = `Y: ${e.latlng.lat.toFixed(1)} | X: ${e.latlng.lng.toFixed(1)}`;
});

map.on('click', function (e) {
    if (activeMarkerMode) {
        currentClickCoords = e.latlng;
        openModal(e.latlng);
        activeMarkerMode = false;
        document.getElementById('map').style.cursor = 'crosshair';
        document.getElementById('btn-add-marker').classList.remove('secondary');
    }
});

// SVG Vectors
let pathsRef = [];

Promise.all([
    fetch('main/assets/map_overlay_struc.svg').then(r => r.text()),
    fetch('main/assets/map_overlay_inf.svg').then(r => r.text())
]).then(async ([strucText, infText]) => {
    // Process struc
    processSvg(strucText, false);
    // Process inf
    processSvg(infText, true);

    // Apply once loaded if data arrived before SVG fetched
    applyPathColorsToDOM();
});

function processSvg(svgText, isInf) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, "image/svg+xml");
    const svgElement = doc.documentElement;

    svgElement.setAttribute('viewBox', '0 0 4050 2812.5');
    svgElement.setAttribute('preserveAspectRatio', 'none');
    svgElement.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    svgElement.style.pointerEvents = 'none'; // CRITICAL: Stop the map-wide SVG from trapping clicks so layers underneath can be accessed!

    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");

    // Create Inf Patterns (JPGs)
    if (isInf) {
        ['blue', 'green', 'red'].forEach(color => {
            const pat = document.createElementNS("http://www.w3.org/2000/svg", "pattern");
            pat.setAttribute("id", `${color}_inf_pat`);
            pat.setAttribute("patternUnits", "objectBoundingBox");
            pat.setAttribute("patternContentUnits", "objectBoundingBox");
            pat.setAttribute("width", "1");
            pat.setAttribute("height", "1");

            const img = document.createElementNS("http://www.w3.org/2000/svg", "image");
            img.setAttributeNS(null, "href", `main/assets/mapsicons/inf/${color}_inf.jpg`);
            img.setAttributeNS("http://www.w3.org/1999/xlink", "href", `main/assets/mapsicons/inf/${color}_inf.jpg`);
            img.setAttribute("x", "0");
            img.setAttribute("y", "0");
            img.setAttribute("width", "1");
            img.setAttribute("height", "1");
            img.setAttribute("preserveAspectRatio", "none");

            pat.appendChild(img);
            defs.appendChild(pat);
        });
    } else {
        // Create Struc Patterns (PNGs) for all variants
        const colors = ['red', 'blue', 'green'];
        const types = ['stars', 'bio', 'forge', 'sat'];

        colors.forEach(color => {
            types.forEach(type => {
                const pat = document.createElementNS("http://www.w3.org/2000/svg", "pattern");
                pat.setAttribute("id", `${color}_${type}_struc_pat`);
                pat.setAttribute("patternUnits", "objectBoundingBox");
                pat.setAttribute("patternContentUnits", "objectBoundingBox");
                pat.setAttribute("width", "1");
                pat.setAttribute("height", "1");

                const img = document.createElementNS("http://www.w3.org/2000/svg", "image");
                img.setAttributeNS(null, "href", `main/assets/mapsicons/struc/${color}_${type}.png`);
                img.setAttributeNS("http://www.w3.org/1999/xlink", "href", `main/assets/mapsicons/struc/${color}_${type}.png`);
                img.setAttribute("x", "0");
                img.setAttribute("y", "0");
                img.setAttribute("width", "1");
                img.setAttribute("height", "1");
                img.setAttribute("preserveAspectRatio", "none");

                pat.appendChild(img);
                defs.appendChild(pat);
            });
        });
    }

    svgElement.insertBefore(defs, svgElement.firstChild);

    const thesePaths = Array.from(svgElement.querySelectorAll("path, rect, polygon, circle"));

    thesePaths.forEach((path) => {
        const globalIndex = pathsRef.length;
        pathsRef.push(path);

        // Setup base styles
        path.setAttribute('fill', 'transparent');
        path.style.fill = 'transparent'; // Override any inline Affinity styles
        path.style.transition = "all 0.2s ease";
        path.style.cursor = "pointer";
        path.style.pointerEvents = "painted";

        path.addEventListener('click', (e) => {
            if (!currentCrusadeId) return; // Prevent clicking before auth

            let nextColor = 'transparent';

            if (isInf) {
                const patterns = ['transparent', 'url(#blue_inf_pat)', 'url(#green_inf_pat)', 'url(#red_inf_pat)'];
                let currentFill = path.style.fill || path.getAttribute('fill') || 'transparent';

                let nextIndex = 1;
                if (currentFill.includes('blue')) nextIndex = 2;
                else if (currentFill.includes('green')) nextIndex = 3;
                else if (currentFill.includes('red')) nextIndex = 0;

                nextColor = patterns[nextIndex];
            } else {
                const patterns = [
                    'transparent',
                    'url(#red_stars_struc_pat)', 'url(#blue_stars_struc_pat)', 'url(#green_stars_struc_pat)',
                    'url(#red_bio_struc_pat)', 'url(#blue_bio_struc_pat)', 'url(#green_bio_struc_pat)',
                    'url(#red_forge_struc_pat)', 'url(#blue_forge_struc_pat)', 'url(#green_forge_struc_pat)',
                    'url(#red_sat_struc_pat)', 'url(#blue_sat_struc_pat)', 'url(#green_sat_struc_pat)'
                ];
                let currentFill = path.style.fill || path.getAttribute('fill') || 'transparent';

                // Find exact match
                let nextIndex = patterns.indexOf(currentFill) + 1;

                // Fallback for DOM string manipulation artifacts (e.g. quotes or spacing)
                if (nextIndex === 0) {
                    const matchIndex = patterns.findIndex(p => p !== 'transparent' && (p.includes(currentFill) || currentFill.includes(p.replace(/['"]/g, ''))));
                    nextIndex = (matchIndex !== -1 ? matchIndex : 0) + 1;
                }

                // Cycle loop
                if (nextIndex >= patterns.length) nextIndex = 0;

                nextColor = patterns[nextIndex];
            }

            // Optimistic UI update
            path.setAttribute('fill', nextColor);
            path.style.fill = nextColor;
            if (nextColor === 'transparent') {
                path.removeAttribute('fill-opacity');
                path.style.opacity = '1';
            } else {
                path.setAttribute('fill-opacity', '1');
                path.style.opacity = '1';
            }

            // Network Mutation: Update Path Color
            mutateNetworkData((serverData) => {
                if (nextColor === 'transparent') {
                    delete serverData.pathColors[globalIndex];
                } else {
                    serverData.pathColors[globalIndex] = nextColor;
                }
            });

            e.preventDefault();
            e.stopPropagation();
        });

        path.addEventListener('mouseenter', () => {
            path.setAttribute('data-orig-stroke', path.getAttribute('stroke') || 'none');
            path.setAttribute('data-orig-stroke-width', path.getAttribute('stroke-width') || '1');
            path.setAttribute('stroke', '#E11D48');
            path.setAttribute('stroke-width', '4');

            if (path.getAttribute('fill') !== 'transparent' && isInf) {
                path.setAttribute('opacity', '0.8');
            } else {
                path.setAttribute('opacity', '1');
            }
        });
        path.addEventListener('mouseleave', () => {
            path.setAttribute('stroke', path.getAttribute('data-orig-stroke'));
            path.setAttribute('stroke-width', path.getAttribute('data-orig-stroke-width'));
            path.setAttribute('opacity', '1');
            if (!path.getAttribute('data-orig-stroke') || path.getAttribute('data-orig-stroke') === 'none') {
                path.removeAttribute('stroke');
            }
        });
    });

    L.svgOverlay(svgElement, bounds, {
        interactive: true,
        className: `affinity-pdf-layer layer-${isInf ? 'inf' : 'struc'}`
    }).addTo(map);
}

function applyPathColorsToDOM() {
    if (!pathsRef || pathsRef.length === 0) return;
    pathsRef.forEach((path, i) => {
        const savedColor = pathColors[i];
        if (savedColor) {
            path.setAttribute('fill', savedColor);
            path.style.fill = savedColor;
            path.setAttribute('fill-opacity', savedColor.includes('url(') ? '1' : '0.5');
        } else {
            path.setAttribute('fill', 'transparent');
            path.style.fill = 'transparent';
            path.removeAttribute('fill-opacity');
        }
    });
}


// Rendering POIs
function renderData() {
    // Clear Map
    Object.values(activeMarkers).forEach(m => map.removeLayer(m));
    for (let key in activeMarkers) delete activeMarkers[key];

    // Clear Sidebar
    const listEl = document.getElementById('poi-list');
    listEl.innerHTML = '';

    // Rebuild
    Object.values(pois).forEach(poi => {
        const icon = L.icon({
            iconUrl: 'main/assets/mapsicons/poi.png',
            iconSize: [24, 24],
            iconAnchor: [12, 12],
            popupAnchor: [0, -12]
        });

        const marker = L.marker([poi.y, poi.x], { icon }).addTo(map);

        marker.bindPopup(`
            <h3>${poi.title}</h3>
            <span class="coordinates">Y: ${poi.y.toFixed(1)} | X: ${poi.x.toFixed(1)}</span>
            <p>${poi.desc}</p>
            <div style="font-size:0.7em; color:#666; margin-top:5px;">Mission Core ID: ${poi.id.substring(poi.id.length - 6)}</div>
            <button class="action-btn secondary popup-delete-btn" style="margin-top:10px; width:100%; border-color:var(--accent-red); color:var(--accent-red)" data-id="${poi.id}">Delete Marker</button>
        `);
        activeMarkers[poi.id] = marker;

        const listItem = document.createElement('div');
        listItem.className = `poi-item ${poi.type}`;
        listItem.innerHTML = `
            <button class="poi-delete" data-id="${poi.id}">&times;</button>
            <span class="poi-title">${poi.title}</span>
            <span class="poi-coords">Y: ${poi.y.toFixed(1)} | X: ${poi.x.toFixed(1)}</span>
            <div class="poi-desc">${poi.desc}</div>
        `;

        listItem.addEventListener('click', (e) => {
            if (!e.target.classList.contains('poi-delete')) {
                map.flyTo([poi.y, poi.x], 1, { duration: 1.5 });
                marker.openPopup();
            }
        });

        listItem.querySelector('.poi-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            // Network Mutation: Delete POI
            mutateNetworkData((serverData) => {
                delete serverData.pois[poi.id];
            });
        });

        listEl.appendChild(listItem);
    });

    // Also re-apply colors continuously if data changes
    applyPathColorsToDOM();
}

// Modal Form Logic
const modal = document.getElementById('poi-modal');
const btnAdd = document.getElementById('btn-add-marker');
const btnClose = document.getElementById('close-modal');
const form = document.getElementById('poi-form');
const btnExport = document.getElementById('btn-export');

btnAdd.addEventListener('click', () => {
    activeMarkerMode = !activeMarkerMode;
    if (activeMarkerMode) {
        document.getElementById('map').style.cursor = 'crosshair';
        btnAdd.classList.add('secondary');
        alert("Strategic mode engaged: Click anywhere on the map to place a new POI.");
    } else {
        btnAdd.classList.remove('secondary');
    }
});

function openModal(coords) {
    modal.classList.remove('hidden');
    document.getElementById('poi-y').value = coords.lat.toFixed(1);
    document.getElementById('poi-x').value = coords.lng.toFixed(1);
    document.getElementById('poi-title').value = '';
    document.getElementById('poi-desc').value = '';
    document.getElementById('poi-type').value = 'planet';
}

btnClose.addEventListener('click', () => {
    modal.classList.add('hidden');
});

form.addEventListener('submit', (e) => {
    e.preventDefault();
    const newPoiId = 'poi_' + Date.now();
    const newPoi = {
        id: newPoiId,
        title: document.getElementById('poi-title').value,
        y: parseFloat(document.getElementById('poi-y').value),
        x: parseFloat(document.getElementById('poi-x').value),
        desc: document.getElementById('poi-desc').value,
        type: document.getElementById('poi-type').value
    };

    modal.classList.add('hidden');

    // Network Mutation: Add POI
    mutateNetworkData((serverData) => {
        serverData.pois[newPoiId] = newPoi;
    });
});

btnExport.addEventListener('click', async () => {
    if (!currentCrusadeId) return;

    btnExport.textContent = "SAVING NETWORK...";
    btnExport.style.pointerEvents = 'none';

    try {
        const payload = { pois, pathColors };
        await fetch(`${JSONBIN_BASE_URL}/${currentCrusadeId}`, {
            method: "PUT",
            headers: jsonbinHeaders,
            body: JSON.stringify(payload)
        });

        // Reset button
        btnExport.innerHTML = `
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M2 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4.207a1 1 0 0 0-.293-.707l-2.5-2.5A1 1 0 0 0 10.5 1H2zm1 2h7.5L13 5.5v7.5a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM5 4a1 1 0 0 0-1 1v2h4V5a1 1 0 0 0-1-1H5zm0 6a1 1 0 0 0-1 1v2h8v-2a1 1 0 0 0-1-1H5z"/>
            </svg>
            Session Cache Saved!
        `;
        btnExport.style.backgroundColor = "";
        btnExport.style.borderColor = "";
        btnExport.style.color = "";
        btnExport.style.pointerEvents = 'auto';

        setTimeout(() => {
            btnExport.innerHTML = `
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M2 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4.207a1 1 0 0 0-.293-.707l-2.5-2.5A1 1 0 0 0 10.5 1H2zm1 2h7.5L13 5.5v7.5a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM5 4a1 1 0 0 0-1 1v2h4V5a1 1 0 0 0-1-1H5zm0 6a1 1 0 0 0-1 1v2h8v-2a1 1 0 0 0-1-1H5z"/>
                </svg>
                Save Session Cache
            `;
        }, 2500);
    } catch (e) {
        console.error("Save Error:", e);
        btnExport.innerHTML = "API ERROR - TRY AGAIN";
        btnExport.style.pointerEvents = 'auto';
    }
});
