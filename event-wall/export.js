import supabase from './supabaseClient.js';

export async function exportWall() {
    const wallContainer = document.getElementById('wall-surface');
    if (!wallContainer) return;

    // Optional: Hide UI elements you don't want in the export if they lived inside wall-container

    try {
        // html2canvas is globally available via CDN in index.html
        const canvas = await html2canvas(wallContainer, {
            useCORS: true,
            allowTaint: false,
            backgroundColor: '#121212',
            scale: 2 // High resolution for print
        });

        // Convert the canvas data to a downloadable image
        // Browsers natively support PNG and JPEG. TIFF requires heavier external libs (like UTIF.js).
        // For static simplicity with high quality, we export as a lossless high-res PNG
        const imageUri = canvas.toDataURL("image/png");

        // Create a temporary lin to download
        const a = document.createElement("a");
        a.href = imageUri;
        a.download = `Event_Wall_Export_${new Date().toISOString().split('T')[0]}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        alert("Wall successfully exported!");
    } catch (error) {
        console.error("Export failed:", error);
        alert("Failed to export the wall to an image.");
    }
}
