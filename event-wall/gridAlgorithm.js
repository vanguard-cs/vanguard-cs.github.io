// Optimized Grid Placement Algorithm

class GraffitiGrid {
    constructor(containerWidth, containerHeight, minCellWidth = 160, minCellHeight = 120) {
        this.minCellWidth = minCellWidth;
        this.minCellHeight = minCellHeight;
        this.containerWidth = containerWidth;
        this.containerHeight = containerHeight;

        // Dynamically calculate columns based on screen width
        this.columns = Math.max(2, Math.floor(this.containerWidth / this.minCellWidth));
        // Calculate rows based on available height (will grow if needed)
        this.rows = Math.max(3, Math.floor(this.containerHeight / this.minCellHeight));

        // Actual cell sizes stretching to fill available space
        this.cellWidth = this.containerWidth / this.columns;
        this.cellHeight = this.minCellHeight; // Keep fixed height for readability, or stretch too
    }

    /**
     * Efficiently finds a random available slot using a Set for O(1) lookups
     */
    findAvailableSlot(messages) {
        // Fast lookup of occupied slots using a Set
        // Format: "x,y"
        const occupied = new Set(messages.map(m => `${m.grid_x},${m.grid_y}`));

        const available = [];

        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.columns; x++) {
                if (!occupied.has(`${x},${y}`)) {
                    available.push({ x, y });
                }
            }
        }

        // If grid is full, expand vertically
        if (available.length === 0) {
            this.rows += 2;
            // Recursively try again with the new rows
            return this.findAvailableSlot(messages);
        }

        // Pick a random available slot
        return available[Math.floor(Math.random() * available.length)];
    }

    /**
     * Calculates the absolute CSS pixel coordinates for a slot, including organic jitter
     */
    calculateStyles(slotX, slotY) {
        // Random organic jitter, constrained within the cell to prevent overlap
        // We use 10% padding so text doesn't touch the immediate cell borders
        const paddingX = this.cellWidth * 0.1;
        const paddingY = this.cellHeight * 0.1;

        // Random offset within the safe zone of the cell
        const maxOffsetX = (this.cellWidth - paddingX * 2) * 0.5;
        const maxOffsetY = (this.cellHeight - paddingY * 2) * 0.5;

        const offsetX = (Math.random() * maxOffsetX * 2) - maxOffsetX;
        const offsetY = (Math.random() * maxOffsetY * 2) - maxOffsetY;

        return {
            left: (slotX * this.cellWidth) + (this.cellWidth / 2) + offsetX, // Center coordinate
            top: (slotY * this.cellHeight) + (this.cellHeight / 2) + offsetY, // Center coordinate
        };
    }
}

export function renderMessage(container, message, grid) {
    const el = document.createElement("div");
    el.className = "graffiti-tag";
    el.innerText = message.content;

    // Apply strict bounds to prevent massive words from breaking the layout
    el.style.maxWidth = `${grid.cellWidth * 0.9}px`;
    el.style.wordWrap = "break-word";

    const { left, top } = grid.calculateStyles(message.grid_x, message.grid_y);

    // Position from center to easily handle rotation without bounds-breaking
    el.style.position = "absolute";
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.transform = `translate(-50%, -50%) rotate(${Math.random() * 24 - 12}deg)`;

    // Styling
    const fonts = ["Permanent Marker", "Rock Salt", "Sedgwick Ave", "Fredericka the Great"];
    const colors = ["#ff0055", "#00c2ff", "#ffd500", "#00ff88", "#ffffff"];

    el.style.fontFamily = fonts[Math.floor(Math.random() * fonts.length)];
    el.style.color = colors[Math.floor(Math.random() * colors.length)];

    // Dynamic sizing based on string length (shorter strings = bigger text)
    const lengthScore = Math.max(10, message.content.length);
    const fontSize = Math.max(16, Math.min(36, 400 / lengthScore));
    el.style.fontSize = `${fontSize}px`;

    container.appendChild(el);
}
