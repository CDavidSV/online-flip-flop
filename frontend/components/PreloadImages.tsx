"use client";

import { useEffect } from "react";

export function PreloadImages() {
    useEffect(() => {
        const images = [
            "/assets/pieces/black_bishop.svg",
            "/assets/pieces/black_rook.svg",
            "/assets/pieces/white_bishop.svg",
            "/assets/pieces/white_rook.svg",
        ];

        // Preload images by creating Image objects
        images.forEach((src) => {
            const img = new Image();
            img.src = src;
        });
    }, []);

    return null;
}
