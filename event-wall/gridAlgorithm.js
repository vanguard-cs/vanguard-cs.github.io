// Optimized Grid Placement Algorithm

export class GraffitiGrid {
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

export function generateRandomStyles(contentLength) {
    const fonts = [
        "Permanent Marker", "Rock Salt", "Sedgwick Ave", "Fredericka the Great",
        "Reenie Beanie", "Caveat Brush", "Shadows Into Light"
    ];
    const colors = [
        { hex: "#ff0055", rgb: "255, 0, 85" },
        { hex: "#00e5ff", rgb: "0, 229, 255" },
        { hex: "#ffd500", rgb: "255, 213, 0" },
        { hex: "#00ff88", rgb: "0, 255, 136" },
        { hex: "#ffffff", rgb: "255, 255, 255" },
        { hex: "#ff3300", rgb: "255, 51, 0" },
        { hex: "#b800ff", rgb: "184, 0, 255" }
    ];

    const chosenColor = colors[Math.floor(Math.random() * colors.length)];
    const lengthScore = Math.max(10, contentLength);

    return {
        font: fonts[Math.floor(Math.random() * fonts.length)],
        color_hex: chosenColor.hex,
        color_rgb: chosenColor.rgb,
        rotation: (Math.random() * 24 - 12).toFixed(2), // -12 to +12 degrees
        font_size: Math.max(18, Math.min(42, 450 / lengthScore))
    };
}

export function renderMessage(container, message, grid) {
    const el = document.createElement("div");
    el.className = "graffiti-tag";
    el.innerText = message.content;

    // Apply strict bounds to prevent massive words from breaking the layout
    el.style.maxWidth = `${grid.cellWidth * 0.9}px`;
    el.style.wordWrap = "break-word";

    const { left, top } = grid.calculateStyles(message.grid_x, message.grid_y);

    // Apply persistent database styles or default fallbacks
    const rot = message.rotation !== undefined ? message.rotation : (Math.random() * 24 - 12);

    el.style.position = "absolute";
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.transform = `translate(-50%, -50%) rotate(${rot}deg)`;

    el.style.fontFamily = message.font || "Permanent Marker";
    const hex = message.color_hex || "#ffffff";
    const rgb = message.color_rgb || "255, 255, 255";
    el.style.color = hex;

    // Create a realistic spray paint glow/drip effect using multiple layered text-shadows
    el.style.textShadow = `
        0px 0px 4px rgba(0,0,0,0.8),
        0px 0px 8px rgba(${rgb}, 0.6),
        0px 0px 15px rgba(${rgb}, 0.4),
        0px 5px 2px rgba(${rgb}, 0.2)
    `;

    el.style.fontSize = `${message.font_size || 24}px`;

    container.appendChild(el);
}
