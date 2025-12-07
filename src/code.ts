/// <reference types="@figma/plugin-typings" />

figma.showUI(__html__, { width: 400, height: 600 });

// Helper to parse "rgb(r, g, b)"
function parseColor(colorStr?: string): { r: number, g: number, b: number } | null {
    if (!colorStr) return null;
    const match = colorStr.match(/(\d+),\s*(\d+),\s*(\d+)/);
    if (!match) return null;
    return {
        r: parseInt(match[1]) / 255,
        g: parseInt(match[2]) / 255,
        b: parseInt(match[3]) / 255
    };
}

// Helper types matching the new extraction script
interface Rgba { r: number, g: number, b: number, a: number }

interface NodeData {
    type: 'FRAME' | 'TEXT' | 'IMAGE' | 'SVG';
    name: string;
    text?: string;
    svg?: string;
    x: number;
    y: number;
    width: number;
    height: number;
    imageSrc?: string;
    backgroundImage?: string;
    children?: NodeData[];
    style: {
        backgroundColor?: Rgba;
        color?: Rgba;
        fontSize?: number;
        fontWeight?: string;
        fontFamily?: string;
        textAlign?: string;
        lineHeight?: number;
        letterSpacing?: number;
        textTransform?: string;
        textDecoration?: string;
        display?: string;
        position?: string;
        flexDirection?: string;
        justifyContent?: string;
        alignItems?: string;
        gap?: string;
        padding?: { t: number, r: number, b: number, l: number };
        border?: {
            top: { width: number, color: Rgba },
            right: { width: number, color: Rgba },
            bottom: { width: number, color: Rgba },
            left: { width: number, color: Rgba }
        };
        borderRadius?: { tl: number, tr: number, bl: number, br: number };
        boxShadow?: string;
        overflow?: string;
        opacity?: number;
        zIndex?: string;
    };
}

figma.ui.onmessage = async (msg) => {
    if (msg.type === 'import-html') {
        const { url, node } = msg.payload;
        if (!node) {
            figma.notify("Failed to parse content");
            return;
        }

        // Use current page instead of creating new one
        figma.notify("Starting import...");

        await figma.loadFontAsync({ family: "Inter", style: "Regular" });
        await figma.loadFontAsync({ family: "Inter", style: "Bold" });

        const rootFrame = await createFigmaNode(node);

        if (rootFrame) {
            figma.currentPage.appendChild(rootFrame);
            figma.viewport.scrollAndZoomIntoView([rootFrame]);
            figma.notify("Import completed!");
        } else {
            figma.notify("Nothing valid imported.");
        }
    }
};

async function createFigmaNode(data: NodeData): Promise<SceneNode | null> {
    if (!data) return null;

    // --- TEXT NODE ---
    if (data.type === 'TEXT') {
        const textNode = figma.createText();
        textNode.characters = data.text || "";

        textNode.resize(data.width, data.height);

        if (data.style) {
            if (data.style.fontSize) textNode.fontSize = data.style.fontSize;
            if (data.style.color) textNode.fills = [{ type: 'SOLID', color: data.style.color, opacity: data.style.color.a }];

            // Basic Weight mapping
            const style = data.style.fontWeight === '700' || data.style.fontWeight === 'bold' ? 'Bold' : 'Regular';
            let family = "Inter";

            if (data.style.fontFamily) {
                family = data.style.fontFamily.split(',')[0].replace(/['"]/g, '').trim();
            }

            const targetFont = { family, style };

            try {
                await figma.loadFontAsync(targetFont);
                textNode.fontName = targetFont;
            } catch (e) {
                textNode.fontName = { family: "Inter", style: style };
            }

            if (data.style.textAlign) {
                switch (data.style.textAlign) {
                    case 'center': textNode.textAlignHorizontal = 'CENTER'; break;
                    case 'right': textNode.textAlignHorizontal = 'RIGHT'; break;
                    case 'justify': textNode.textAlignHorizontal = 'JUSTIFIED'; break;
                }
            }

            if (data.style.lineHeight) {
                textNode.lineHeight = { value: data.style.lineHeight, unit: 'PIXELS' };
            }

            if (data.style.letterSpacing) {
                textNode.letterSpacing = { value: data.style.letterSpacing, unit: 'PIXELS' };
            }
        }
        return textNode;
    }

    // Helper to fetch image
    async function fetchImage(url: string): Promise<ImagePaint | null> {
        try {
            const response = await fetch(url);
            if (!response.ok) return null;
            const buffer = await response.arrayBuffer();
            const image = figma.createImage(new Uint8Array(buffer));
            return {
                type: 'IMAGE',
                imageHash: image.hash,
                scaleMode: 'FILL'
            };
        } catch (e) {
            console.log("Image load error:", url);
            return null;
        }
    }

    // --- IMAGE NODE ---
    if (data.type === 'IMAGE') {
        const rect = figma.createRectangle();
        rect.name = "Image";
        rect.resize(data.width, data.height);

        let fills: Paint[] = [{ type: 'SOLID', color: { r: 0.85, g: 0.85, b: 0.85 } }];

        if (data.imageSrc) {
            const imagePaint = await fetchImage(data.imageSrc);
            if (imagePaint) fills = [imagePaint];
        }
        rect.fills = fills;
        return rect;
    }

    // --- SVG NODE ---
    if (data.type === 'SVG' && data.svg) {
        try {
            const svgNode = figma.createNodeFromSvg(data.svg);
            svgNode.name = "SVG";
            svgNode.resize(data.width, data.height);
            return svgNode;
        } catch (e) {
            console.error("Failed to create SVG", e);
            return null;
        }
    }

    // --- FRAME NODE ---
    if (data.type === 'FRAME') {
        const frame = figma.createFrame();
        frame.name = data.name;
        // Basic resize with safe limit
        const safeW = Math.max(0.01, data.width);
        const safeH = Math.max(0.01, data.height);
        frame.resize(safeW, safeH);

        // Fills
        let fills: Paint[] = [];

        // Background Color
        if (data.style.backgroundColor) {
            const { r, g, b, a } = data.style.backgroundColor;
            // Only add fill if it's visible. 
            // Note: SVG paths often have 0 alpha "backgroundColor" on the bounding box but standard fill?
            // Wait, we extract backgroundColor style.
            if (a > 0) {
                fills.push({ type: 'SOLID', color: { r, g, b }, opacity: a });
            }
        }

        // Background Image
        if (data.backgroundImage) {
            const bgImage = await fetchImage(data.backgroundImage);
            if (bgImage) fills.push(bgImage);
        }

        frame.fills = fills;

        // Positioning (handled by parent, but we might set absolute layout prop)
        if (data.style.position === 'absolute' || data.style.position === 'fixed') {
            frame.layoutPositioning = 'ABSOLUTE';
        }

        // --- DISABLE AUTO LAYOUT FOR FIDELITY ---
        // To avoid "stacking" and ensure pixel-perfect matches with the browser's rendering,
        // we will use Frame positioning (NONE) for everything.
        // AutoLayout often misinterprets browser spacing (margins vs gap vs padding).
        frame.layoutMode = 'NONE';

        // Although we disable AL, we can still apply padding visually if needed? 
        // No, padding in browser affects child position, which is already captured by getBoundingClientRect.
        // So we just need to container size. Correct.

        // Clip content if needed
        if (data.style.overflow === 'hidden' || data.style.overflow === 'scroll' || data.style.overflow === 'auto') {
            frame.clipsContent = true;
        }

        /*
        // Layout - Try AutoLayout if Flex
        if (data.style.display === 'flex') {
             // ... code disabled ...
        }
        */

        // Radius
        if (data.style.borderRadius) {
            frame.topLeftRadius = data.style.borderRadius.tl;
            frame.topRightRadius = data.style.borderRadius.tr;
            frame.bottomLeftRadius = data.style.borderRadius.bl;
            frame.bottomRightRadius = data.style.borderRadius.br;
        }

        // Borders
        if (data.style.border) {
            const maxW = Math.max(
                data.style.border.top.width,
                data.style.border.right.width,
                data.style.border.bottom.width,
                data.style.border.left.width
            );
            if (maxW > 0) {
                const borderColor = data.style.border.top.color || { r: 0, g: 0, b: 0, a: 1 };
                frame.strokes = [{ type: 'SOLID', color: borderColor, opacity: borderColor.a }];
                frame.strokeWeight = maxW;

                if (data.style.border.top.width !== data.style.border.bottom.width) {
                    frame.strokeTopWeight = data.style.border.top.width;
                    frame.strokeBottomWeight = data.style.border.bottom.width;
                    frame.strokeLeftWeight = data.style.border.left.width;
                    frame.strokeRightWeight = data.style.border.right.width;
                }
            }
        }

        // Clips Content
        if (data.style.overflow === 'hidden' || data.style.overflow === 'scroll' || data.style.overflow === 'auto') {
            frame.clipsContent = true;
        }

        // Opacity
        if (typeof data.style.opacity === 'number') {
            frame.opacity = data.style.opacity;
        }

        // Recursion
        if (data.children) {
            for (const childData of data.children) {
                const childNode = await createFigmaNode(childData);
                if (childNode) {
                    frame.appendChild(childNode);

                    // FIX: Proper positioning logic
                    // If frame has AutoLayout, child x/y is ignored UNLESS child is absolute.
                    // If frame is NONE, we MUST set x/y.
                    const childIsAbsolute = 'layoutPositioning' in childNode && childNode.layoutPositioning === 'ABSOLUTE';

                    if (frame.layoutMode === 'NONE' || childIsAbsolute) {
                        const relX = childData.x - data.x;
                        const relY = childData.y - data.y;

                        if (!isNaN(relX)) childNode.x = relX;
                        if (!isNaN(relY)) childNode.y = relY;
                    }
                }
            }
        }

        return frame;
    }
    return null;
}
