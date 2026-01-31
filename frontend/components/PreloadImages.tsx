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

        images.forEach((src) => {
            const link = document.createElement("link");
            link.rel = "preload";
            link.as = "image";
            link.type = "image/svg+xml";
            link.href = src;
            document.head.appendChild(link);
        });
    }, []);

    return null;
}
