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

// Helper to get the correct absolute redirect URL for Magic Links
function getRedirectUrl() {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const root = isLocal ? 'http://localhost:8080' : 'https://vanguard-cs.github.io';
    return `${root}/event-wall/`;
}

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
            const email = document.getElementById('auth-email').value.trim().toLowerCase();
            const msgEl = document.getElementById('auth-message');
            msgEl.innerText = "Verifying guest access...";

            // 1. Check if the email exists via secure RPC (Database Function)
            const { data: isGuest, error: guestError } = await supabase
                .rpc('verify_guest_access', { check_email: email });

            if (guestError) {
                console.error("Guest verification error details:", guestError);
                msgEl.innerText = "Error verifying guest list. Please check the console.";
                return;
            }

            if (!isGuest) {
                msgEl.innerText = "This email is not on the guest list.";
                return;
            }

            msgEl.innerText = "Sending magic link...";

            const { error: authError } = await supabase.auth.signInWithOtp({
                email: email,
                options: { emailRedirectTo: getRedirectUrl() }
            });

            if (authError) {
                msgEl.innerText = "Error: " + authError.message;
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
    // Use the actual surface width (which is 1000px min on mobile) for the grid
    currentGrid = new GraffitiGrid(wallSurface.clientWidth, container.clientHeight);

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

    // 4. Ensure the background container expands to fit the content
    wallSurface.style.height = `${currentGrid.getTotalHeight(messagesCache)}px`;
    wallSurface.style.width = `${currentGrid.getTotalWidth(messagesCache)}px`;

    // 5. Update UI Buttons
    if (myMessageId) {
        btnLeaveMsg.style.display = 'none';
        btnEditMsg.style.display = 'block';
    } else {
        btnLeaveMsg.style.display = 'block';
        btnEditMsg.style.display = 'none';
    }

    // 6. Check RSVP Status
    const rsvpStatusLbl = document.getElementById("rsvp-status");
    if (rsvpStatusLbl && currentUser) {
        const { data: rsvp } = await supabase
            .from('rsvps')
            .select('status')
            .eq('email', currentUser.email)
            .maybeSingle();

        if (rsvp) {
            rsvpStatusLbl.innerText = "You have RSVP'd. To change your RSVP contact Az.";
            rsvpStatusLbl.style.color = "#aaaaaa";
        }
    }
}

// Modal Form Submission Callback
async function handleMessageSave(textContent, existingMessageObj, chosenColor = null) {
    if (existingMessageObj) {
        // UPDATE Existing
        const updateData = { content: textContent };
        if (chosenColor) {
            updateData.color_hex = chosenColor.hex;
            updateData.color_rgb = chosenColor.rgb;
        }

        const { error } = await supabase
            .from('messages')
            .update(updateData)
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

        // Use chosen color if provided, otherwise use random
        const finalHex = chosenColor ? chosenColor.hex : styles.color_hex;
        const finalRgb = chosenColor ? chosenColor.rgb : styles.color_rgb;

        const { error } = await supabase
            .from('messages')
            .insert({
                content: textContent,
                grid_x: slot.x,
                grid_y: slot.y,
                user_id: currentUser.id,
                font: styles.font,
                color_hex: finalHex,
                color_rgb: finalRgb,
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

btnLeaveMsg.addEventListener('click', () => {
    toggleSidebar(false);
    modalController.openModal(null);
});

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
    if (myMsg) {
        toggleSidebar(false);
        modalController.openModal(myMsg);
    }
});

// Event Details Markdown Modal
const btnDetails = document.getElementById('btn-event-details');
const modalDetails = document.getElementById('details-modal');
const btnCloseDetails = document.getElementById('btn-close-details');
const markdownContainer = document.getElementById('markdown-container');

btnDetails.addEventListener('click', async () => {
    toggleSidebar(false);
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

// Mobile Sidebar / FAB Logic
const sidebar = document.getElementById('sidebar');
const backdrop = document.getElementById('sidebar-backdrop');
const btnMobileMenu = document.getElementById('btn-mobile-menu');
const fabLeave = document.getElementById('fab-leave-message');

const toggleSidebar = (force) => {
    const isOpen = force !== undefined ? force : !sidebar.classList.contains('open');
    sidebar.classList.toggle('open', isOpen);
    backdrop.classList.toggle('active', isOpen);
};

if (btnMobileMenu) {
    btnMobileMenu.addEventListener('click', () => toggleSidebar());
}
if (backdrop) {
    backdrop.addEventListener('click', () => toggleSidebar(false));
}
if (fabLeave) {
    fabLeave.addEventListener('click', () => {
        toggleSidebar(false);
        modalController.openModal(null);
    });
}

const btnGoWall = document.getElementById('btn-go-to-wall');
if (btnGoWall) {
    btnGoWall.addEventListener('click', () => toggleSidebar(false));
}

btnCloseDetails.addEventListener('click', () => {
    modalDetails.classList.remove('active');
});

document.getElementById('btn-back-details').addEventListener('click', () => {
    modalDetails.classList.remove('active');
});


document.getElementById('btn-rsvp-yes').addEventListener('click', () => submitRsvp('yes'));
document.getElementById('btn-rsvp-no').addEventListener('click', () => submitRsvp('no'));

document.getElementById('btn-export-tiff').addEventListener('click', () => exportWall());

// --- Admin Design Mode Logic ---
let isDesignMode = false;
let draggedElement = null;
let dragOffset = { x: 0, y: 0 };

function initDesignMode() {
    const btnToggle = document.getElementById('btn-toggle-design');
    if (!btnToggle) return;

    btnToggle.addEventListener('click', () => {
        isDesignMode = !isDesignMode;
        document.body.classList.toggle('design-mode-active', isDesignMode);
        btnToggle.innerText = isDesignMode ? "Exit Design Mode" : "Enter Design Mode";
        btnToggle.classList.toggle('btn-yes', isDesignMode);

        // Prevent accidental scrolling on mobile when dragging
        wallSurface.style.touchAction = isDesignMode ? 'none' : 'auto';

        if (!isDesignMode) {
            // Refresh to ensure all positions are synced
            loadWall();
        }
    });

    // Handle Dragging (Mouse & Touch)
    const handleStart = (e) => {
        if (!isDesignMode) return;
        const input = e.touches ? e.touches[0] : e;
        const tag = e.target.closest('.graffiti-tag');
        if (!tag) return;

        draggedElement = tag;
        const rect = tag.getBoundingClientRect();
        const surfaceRect = wallSurface.getBoundingClientRect();

        // Calculate offset from click/touch to center of element
        dragOffset.x = input.clientX - rect.left - rect.width / 2;
        dragOffset.y = input.clientY - rect.top - rect.height / 2;

        tag.style.transition = 'none';
        tag.style.zIndex = 1000;
    };

    const handleMove = (e) => {
        if (!draggedElement || !isDesignMode) return;
        const input = e.touches ? e.touches[0] : e;

        const surfaceRect = wallSurface.getBoundingClientRect();
        // clientX/Y are relative to viewport, getBoundingClientRect is too.
        const x = input.clientX - surfaceRect.left;
        const y = input.clientY - surfaceRect.top;

        draggedElement.style.left = `${x}px`;
        draggedElement.style.top = `${y}px`;
    };

    const handleEnd = async (e) => {
        if (!draggedElement || !isDesignMode) return;

        const msgId = draggedElement.getAttribute('data-id');
        const finalX = parseFloat(draggedElement.style.left);
        const finalY = parseFloat(draggedElement.style.top);

        // Update local cache to ensure immediate grid calculations are correct
        const msg = messagesCache.find(m => m.id === msgId);
        if (msg) {
            msg.manual_x = finalX;
            msg.manual_y = finalY;
            msg.is_manual = true;
        }

        // Update dimensions
        wallSurface.style.height = `${currentGrid.getTotalHeight(messagesCache)}px`;
        wallSurface.style.width = `${currentGrid.getTotalWidth(messagesCache)}px`;

        // Persist to Supabase
        const { error } = await supabase
            .from('messages')
            .update({
                is_manual: true,
                manual_x: finalX,
                manual_y: finalY
            })
            .eq('id', msgId);

        if (error) {
            console.error("Failed to save position:", error);
            alert("Design Mode Error: " + error.message + " | Did you run the SQL migration for new columns AND the RLS policy?");
        }

        draggedElement.style.zIndex = '';
        draggedElement = null;
    };

    // Bind Mouse
    wallSurface.addEventListener('mousedown', handleStart);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);

    // Bind Touch
    wallSurface.addEventListener('touchstart', handleStart, { passive: false });
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);

    // Handle Resizing via Mouse Wheel (Shift + Wheel)
    wallSurface.addEventListener('wheel', async (e) => {
        if (!isDesignMode || !e.shiftKey) return;
        const tag = e.target.closest('.graffiti-tag');
        if (!tag) return;

        e.preventDefault();
        const msgId = tag.getAttribute('data-id');
        const msg = messagesCache.find(m => m.id === msgId);
        if (!msg) return;

        let currentScale = msg.manual_scale || 1.0;
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        currentScale = Math.max(0.5, Math.min(3.0, currentScale + delta));

        // Update UI immediately
        msg.manual_scale = currentScale;
        msg.is_manual = true;

        // Also update local position in cache to keep dimensions in sync
        msg.manual_x = parseFloat(tag.style.left);
        msg.manual_y = parseFloat(tag.style.top);

        // Update dimensions
        wallSurface.style.height = `${currentGrid.getTotalHeight(messagesCache)}px`;
        wallSurface.style.width = `${currentGrid.getTotalWidth(messagesCache)}px`;

        // Update local element style
        const baseTransform = tag.style.transform.split('scale(')[0];
        tag.style.transform = `${baseTransform}scale(${currentScale})`;

        // Persist
        const { error } = await supabase
            .from('messages')
            .update({
                manual_scale: currentScale,
                is_manual: true,
                // Also save current position to "lock" it
                manual_x: parseFloat(tag.style.left),
                manual_y: parseFloat(tag.style.top)
            })
            .eq('id', msgId);

        if (error) {
            console.error("Failed to save scale:", error);
            alert("Design Mode Error: " + error.message + " | Have you run the SQL migration including the RLS 'Update' policy?");
        }
    }, { passive: false });
}

// Boot
initAuth();
initDesignMode();
