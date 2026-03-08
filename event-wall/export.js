import supabase from './supabaseClient.js';

export async function exportWall() {
    const wallContainer = document.getElementById('wall-surface');
    if (!wallContainer) return;

    // Optional: Hide UI elements you don't want in the export if they lived inside wall-container

    try {
        // Hide admin delete buttons before snapshot
        const delBtns = document.querySelectorAll('.btn-admin-delete');
        delBtns.forEach(btn => btn.style.display = 'none');

        // html2canvas is globally available via CDN in index.html
        const canvas = await html2canvas(wallContainer, {
            useCORS: true,
            allowTaint: false,
            backgroundColor: '#121212',
            scale: 2 // High resolution for print
        });

        // Restore delete buttons
        delBtns.forEach(btn => btn.style.display = 'flex');

        // Extract raw pixel data
        const ctx = canvas.getContext('2d');
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Encode raw pixels to TIFF using UTIF.js
        const tiffBuffer = UTIF.encodeImage(imgData.data.buffer, canvas.width, canvas.height);

        // Convert the returned ArrayBuffer into a Blob for downloading
        const blob = new Blob([tiffBuffer], { type: "image/tiff" });
        const objUrl = URL.createObjectURL(blob);

        // Create a temporary link to download
        const a = document.createElement("a");
        a.href = objUrl;
        a.download = `Event_Wall_Export_${new Date().toISOString().split('T')[0]}.tiff`;
        document.body.appendChild(a);
        a.click();

        // Cleanup
        document.body.removeChild(a);
        URL.revokeObjectURL(objUrl);

        alert("Wall successfully exported!");
    } catch (error) {
        console.error("Export failed:", error);
        alert("Failed to export the wall to an image.");
    }
}
