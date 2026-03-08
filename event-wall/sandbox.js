import { GraffitiGrid, generateRandomStyles, renderMessage } from './gridAlgorithm.js';

let messagesCache = [];
let currentGrid = null;
let fakeIdCounter = 1;

const container = document.getElementById('wall-container');
const wallSurface = document.getElementById('wall-surface');
const statCount = document.getElementById('stat-count');

const FAKE_PHRASES = [
    "HBD Cat!!", "90s Forever", "Stay Rad", "Tubular", "Eat my Shorts",
    "Whatever", "Talk to the hand", "As if!", "Wassup", "Booyah",
    "Gag me with a spoon", "Totally", "Buggin'", "Duh", "Da Bomb",
    "Phat", "Schwing!", "Party Time", "Excellent", "Not!", "Whoomp! There it is",
    "Gettin' Jiggy", "Off the hook", "Aiight", "My bad", "Word", "Peace out",
    "Keep it real", "Cat is 40!!", "Smells like teen spirit"
];

function initSandbox() {
    // 1. Initialize Grid
    currentGrid = new GraffitiGrid(container.clientWidth, container.clientHeight);

    // 2. Bind Listeners
    document.getElementById('btn-add-1').addEventListener('click', () => injectMessages(1));
    document.getElementById('btn-add-10').addEventListener('click', () => injectMessages(10));
    document.getElementById('btn-add-30').addEventListener('click', () => injectMessages(30));

    document.getElementById('btn-add-huge').addEventListener('click', () => {
        injectMessages(1, "SUPER-CALI-FRAGILISTIC-EXPIALI-DOCIOUS");
    });

    document.getElementById('btn-clear').addEventListener('click', () => {
        messagesCache = [];
        wallSurface.innerHTML = '';
        updateStats();
    });
}

function injectMessages(count, explicitText = null) {
    for (let i = 0; i < count; i++) {
        // Find an empty spot
        const pos = currentGrid.findAvailableSlot(messagesCache);
        if (!pos) {
            console.warn("Grid is completely full!");
            alert("Canvas full! Please clear the sandbox.");
            break; // Stop loop if full
        }

        // Calculate raw pixel coords mapping back
        const pixelX = pos.x;
        const pixelY = pos.y;

        const text = explicitText || FAKE_PHRASES[Math.floor(Math.random() * FAKE_PHRASES.length)];

        // Generate full styles with correct length-based scaling
        const styles = generateRandomStyles(text.length);

        // Create Mock Supabase Message Object
        const mockMsg = {
            id: fakeIdCounter++,
            user_id: 'sandbox-user',
            content: text,
            grid_x: pixelX,
            grid_y: pixelY,
            ...styles
        };

        messagesCache.push(mockMsg);

        // Render it
        renderMessage(wallSurface, mockMsg, currentGrid, true); // True to show Admin Delete button for visual test
    }

    // Expand background
    wallSurface.style.height = `${currentGrid.getTotalHeight()}px`;

    updateStats();
}

function updateStats() {
    statCount.innerText = messagesCache.length;
}

// Global listener for Admin Delete Buttons in Sandbox
document.addEventListener('click', (e) => {
    if (e.target && e.target.classList.contains('btn-admin-delete')) {
        const msgId = parseInt(e.target.getAttribute('data-id'));
        e.target.parentElement.remove(); // Remove off screen
        messagesCache = messagesCache.filter(m => m.id !== msgId);
        // Note: Real app doesn't clear the grid spot on delete immediately to preserve organic spaces, 
        // we'll keep the spot "burnt" in the sandbox too
        updateStats();
    }
});

// Boot when DOM loads
window.addEventListener('DOMContentLoaded', () => {
    // Slight delay to ensure flex layout calculations are done
    setTimeout(initSandbox, 50);
});
