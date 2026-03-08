export function initMessageModal(onSaveCallback) {
    const modal = document.getElementById('compose-modal');
    const input = document.getElementById('graffiti-input');
    const btnSave = document.getElementById('btn-save-message');
    const btnCancel = document.getElementById('btn-cancel-message');

    // Track if we are editing an existing message
    let currentEditMessage = null;
    let selectedColor = { hex: "#ffffff", rgb: "255, 255, 255" };

    // Set up color swatches
    const swatches = document.querySelectorAll('.swatch');
    swatches.forEach(swatch => {
        swatch.addEventListener('click', () => {
            // Remove active from all
            swatches.forEach(s => s.classList.remove('active'));
            // Add to clicked
            swatch.classList.add('active');

            const color = swatch.getAttribute('data-color');
            const rgb = swatch.style.backgroundColor.replace('rgb(', '').replace(')', '');
            selectedColor = { hex: color, rgb: rgb };

            // Preview in input
            input.style.color = color;
        });
    });

    btnCancel.addEventListener('click', () => {
        modal.classList.remove('active');
    });

    btnSave.addEventListener('click', () => {
        const text = input.value.trim();
        if (!text) {
            alert("Message cannot be empty.");
            return;
        }

        // Pass the submission back to the main controller with the chosen color
        onSaveCallback(text, currentEditMessage, selectedColor);
        modal.classList.remove('active');
    });

    return {
        openModal: (baseMessageObj = null) => {
            currentEditMessage = baseMessageObj;
            input.value = baseMessageObj ? baseMessageObj.content : '';

            // Reset color UI
            const initialHex = baseMessageObj ? (baseMessageObj.color_hex || "#ffffff") : "#ffffff";
            const initialRgb = baseMessageObj ? (baseMessageObj.color_rgb || "255, 255, 255") : "255, 255, 255";
            selectedColor = { hex: initialHex, rgb: initialRgb };
            input.style.color = initialHex;

            swatches.forEach(s => {
                if (s.getAttribute('data-color') === initialHex) {
                    s.classList.add('active');
                } else {
                    s.classList.remove('active');
                }
            });

            document.getElementById('compose-title').innerText = baseMessageObj ? "Edit Your Mark" : "Leave Your Mark";

            modal.classList.add('active');
            input.focus();
        },
        closeModal: () => {
            modal.classList.remove('active');
        }
    }
}
