export function initMessageModal(onSaveCallback) {
    const modal = document.getElementById('compose-modal');
    const input = document.getElementById('graffiti-input');
    const btnSave = document.getElementById('btn-save-message');
    const btnCancel = document.getElementById('btn-cancel-message');

    // Track if we are editing an existing message
    let currentEditMessage = null;

    btnCancel.addEventListener('click', () => {
        modal.classList.remove('active');
    });

    btnSave.addEventListener('click', () => {
        const text = input.value.trim();
        if (!text) {
            alert("Message cannot be empty.");
            return;
        }

        // Pass the submission back to the main controller
        onSaveCallback(text, currentEditMessage);
        modal.classList.remove('active');
    });

    return {
        openModal: (baseMessageObj = null) => {
            currentEditMessage = baseMessageObj;
            input.value = baseMessageObj ? baseMessageObj.content : '';
            document.getElementById('compose-title').innerText = baseMessageObj ? "Edit Your Mark" : "Leave Your Mark";

            modal.classList.add('active');
            input.focus();
        },
        closeModal: () => {
            modal.classList.remove('active');
        }
    }
}
