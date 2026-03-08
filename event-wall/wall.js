import supabase from './supabaseClient.js';
import { GraffitiGrid, renderMessage, generateRandomStyles } from './gridAlgorithm.js';
import { initMessageModal } from './messageModal.js';
import { submitRsvp } from './rsvp.js';
import { exportWall } from './export.js';

// Application State
let currentUser = null;
let currentGrid = null;
let myMessageId = null; // Track if the current user already has a message
let messagesCache = [];

// DOM Elements
const authModal = document.getElementById('auth-modal');
const appWrapper = document.getElementById('app-wrapper');
const wallSurface = document.getElementById('wall-surface');
const btnLeaveMsg = document.getElementById('btn-leave-message');
const btnEditMsg = document.getElementById('btn-edit-message');

async function initAuth() {
    // Check current session
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
        currentUser = session.user;
        document.getElementById('current-user-email').innerText = currentUser.email;
        authModal.classList.remove('active');
        appWrapper.style.display = 'flex';

        // Check Admin specifically to show the export and delete tools
        if (currentUser.email === 'vanguard.cs@proton.me') {
            document.getElementById('admin-section').style.display = 'block';
        }

        loadWall();
    } else {
        // Enforce Login View
        authModal.classList.add('active');
        appWrapper.style.display = 'none';

        // Magic Link Handler
        document.getElementById('auth-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('auth-email').value;
            const msgEl = document.getElementById('auth-message');
            msgEl.innerText = "Sending magic link...";

            const { error } = await supabase.auth.signInWithOtp({
                email: email,
                options: { emailRedirectTo: 'https://vanguard-cs.github.io/event-wall/' }
            });

            if (error) {
                msgEl.innerText = "Error: " + error.message;
            } else {
                msgEl.innerText = "Check your email for the magic login link!";
            }
        });
    }

    // Logout
    document.getElementById('btn-logout').addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.reload();
    });
}

async function loadWall() {
    // 1. Fetch all messages
    const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true });

    if (error) {
        console.error("Failed to load messages:", error);
        return;
    }

    messagesCache = messages;

    // 2. Initialize the spatial grid algorithm based on our container's true pixel width
    const container = document.getElementById('wall-container');
    // Ensure the container is drawn before measuring
    await new Promise(r => setTimeout(r, 50));
    currentGrid = new GraffitiGrid(container.clientWidth, container.clientHeight);

    // 3. Render
    wallSurface.innerHTML = ''; // Clear
    myMessageId = null;

    for (let msg of messagesCache) {
        const isAdmin = currentUser.email === 'vanguard.cs@proton.me';
        renderMessage(wallSurface, msg, currentGrid, isAdmin);

        // Identify if the active user owns this message
        if (msg.user_id === currentUser.id) {
            myMessageId = msg.id;
        }
    }

    // 4. Update UI Buttons
    if (myMessageId) {
        btnLeaveMsg.style.display = 'none';
        btnEditMsg.style.display = 'block';
    } else {
        btnLeaveMsg.style.display = 'block';
        btnEditMsg.style.display = 'none';
    }
}

// Modal Form Submission Callback
async function handleMessageSave(textContent, existingMessageObj) {
    if (existingMessageObj) {
        // UPDATE Existing
        const { error } = await supabase
            .from('messages')
            .update({ content: textContent })
            .eq('id', existingMessageObj.id);

        if (error) {
            alert("Error updating message: " + error.message);
        } else {
            loadWall(); // Reload the wall to see the changes
        }
    } else {
        // INSERT New
        // First, find an empty slot in the grid algorithm
        const slot = currentGrid.findAvailableSlot(messagesCache);
        const styles = generateRandomStyles(textContent.length);

        const { error } = await supabase
            .from('messages')
            .insert({
                content: textContent,
                grid_x: slot.x,
                grid_y: slot.y,
                user_id: currentUser.id,
                font: styles.font,
                color_hex: styles.color_hex,
                color_rgb: styles.color_rgb,
                rotation: styles.rotation,
                font_size: styles.font_size
            });

        if (error) {
            alert("Error creating message: " + error.message);
        } else {
            loadWall();
        }
    }
}

// Bind Interactions
const modalController = initMessageModal(handleMessageSave);

btnLeaveMsg.addEventListener('click', () => modalController.openModal(null));

// Global listener for Admin Delete Buttons
document.addEventListener('click', async (e) => {
    if (e.target && e.target.classList.contains('btn-admin-delete')) {
        const msgId = e.target.getAttribute('data-id');
        if (confirm("Admin: Permanently delete this message?")) {
            const { error } = await supabase.from('messages').delete().eq('id', msgId);
            if (error) {
                alert("Failed to delete: " + error.message);
            } else {
                loadWall();
            }
        }
    }
});

btnEditMsg.addEventListener('click', () => {
    // Find the user's specific message object
    const myMsg = messagesCache.find(m => m.id === myMessageId);
    if (myMsg) modalController.openModal(myMsg);
});

// Event Details Markdown Modal
const btnDetails = document.getElementById('btn-event-details');
const modalDetails = document.getElementById('details-modal');
const btnCloseDetails = document.getElementById('btn-close-details');
const markdownContainer = document.getElementById('markdown-container');

btnDetails.addEventListener('click', async () => {
    modalDetails.classList.add('active');
    try {
        const response = await fetch('details.md');
        if (!response.ok) throw new Error("Could not load details.md");
        const markdownText = await response.text();

        // marked comes from the CDN script in index.html
        markdownContainer.innerHTML = marked.parse(markdownText);
    } catch (error) {
        markdownContainer.innerHTML = "<p>Error loading event details.</p>";
        console.error(error);
    }
});

btnCloseDetails.addEventListener('click', () => {
    modalDetails.classList.remove('active');
});


document.getElementById('btn-rsvp-yes').addEventListener('click', () => submitRsvp('yes'));
document.getElementById('btn-rsvp-no').addEventListener('click', () => submitRsvp('no'));

document.getElementById('btn-export-tiff').addEventListener('click', () => exportWall());

// Boot
initAuth();
