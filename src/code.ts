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
        flexWrap?: string;
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

        figma.notify("Starting import...");

        // Pre-load common fonts
        try {
            await figma.loadFontAsync({ family: "Inter", style: "Regular" });
            await figma.loadFontAsync({ family: "Inter", style: "Bold" });
            await figma.loadFontAsync({ family: "Inter", style: "Medium" });
        } catch (e) {
            console.error("Failed to preload Inter fonts", e);
        }

        // Create a wrapper frame for the entire page
        const wrapperFrame = figma.createFrame();

        // Extract site name from URL
        let siteName = "Imported Site";
        try {
            const urlObj = new URL(url);
            siteName = urlObj.hostname.replace(/^www\./, '');
        } catch (e) {
            siteName = url || "Imported Site";
        }
        wrapperFrame.name = siteName;

        // Set wrapper size based on root node dimensions
        const wrapperWidth = Math.max(1, node.width || 1440);
        const wrapperHeight = Math.max(1, node.height || 900);
        wrapperFrame.resize(wrapperWidth, wrapperHeight);
        wrapperFrame.layoutMode = 'NONE';
        wrapperFrame.clipsContent = true; // Clip anything outside the frame bounds
        wrapperFrame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];

        // Create the content starting from the root node
        // Offset coordinates so everything is relative to (0,0) in the wrapper
        const offsetX = node.x || 0;
        const offsetY = node.y || 0;

        const rootFrame = await createFigmaNode(node, 0, offsetX, offsetY);

        if (rootFrame) {
            wrapperFrame.appendChild(rootFrame);
            // Position the root at 0,0 within the wrapper
            rootFrame.x = 0;
            rootFrame.y = 0;
        }

        // Position wrapper at origin on the page
        wrapperFrame.x = 0;
        wrapperFrame.y = 0;

        figma.currentPage.appendChild(wrapperFrame);
        figma.viewport.scrollAndZoomIntoView([wrapperFrame]);
        figma.notify("Import completed!");
    }
};

async function createFigmaNode(data: NodeData, depth: number = 0, offsetX: number = 0, offsetY: number = 0): Promise<SceneNode | null> {
    if (!data) return null;

    const indent = "  ".repeat(depth);
    console.log(`${indent}[createFigmaNode] type=${data.type} name=${data.name || data.text?.substring(0, 20)} children=${data.children?.length || 0}`);

    try {
        // --- TEXT NODE ---
        if (data.type === 'TEXT') {
            const textNode = figma.createText();
            textNode.name = data.text?.substring(0, 30) || "Text";

            // Font is already preloaded, just set it
            textNode.fontName = { family: "Inter", style: "Regular" };

            // Try to use custom font if specified
            if (data.style?.fontFamily) {
                const fontFamily = data.style.fontFamily.split(',')[0].replace(/['\"]/g, '').trim();
                const fontWeight = data.style.fontWeight || '400';
                const isBold = fontWeight === '700' || fontWeight === 'bold' || fontWeight === '600' || parseInt(fontWeight) >= 600;
                const fontStyle = isBold ? 'Bold' : 'Regular';

                try {
                    await figma.loadFontAsync({ family: fontFamily, style: fontStyle });
                    textNode.fontName = { family: fontFamily, style: fontStyle };
                } catch (e) {
                    // Keep Inter as fallback - already set
                    if (isBold) {
                        textNode.fontName = { family: "Inter", style: "Bold" };
                    }
                }
            }

            // Set font size BEFORE setting characters
            if (data.style?.fontSize && data.style.fontSize > 0) {
                textNode.fontSize = data.style.fontSize;
            } else {
                textNode.fontSize = 16; // Default font size
            }

            // Set characters (font is now definitely loaded)
            const textContent = data.text || " ";
            textNode.characters = textContent;

            // Use a fixed width from extraction with auto height
            // This preserves line wrapping from the original
            if (data.width && data.width > 10) {
                textNode.textAutoResize = 'HEIGHT'; // Fixed width, auto height
                textNode.resize(data.width, Math.max(data.height || 20, 20));
            } else {
                textNode.textAutoResize = 'WIDTH_AND_HEIGHT'; // Fully auto for small/inline text
            }

            // Set text color
            if (data.style?.color) {
                textNode.fills = [{ type: 'SOLID', color: { r: data.style.color.r, g: data.style.color.g, b: data.style.color.b }, opacity: data.style.color.a ?? 1 }];
            } else {
                textNode.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }]; // Default black
            }

            if (data.style?.textAlign) {
                switch (data.style.textAlign) {
                    case 'center': textNode.textAlignHorizontal = 'CENTER'; break;
                    case 'right': textNode.textAlignHorizontal = 'RIGHT'; break;
                    case 'justify': textNode.textAlignHorizontal = 'JUSTIFIED'; break;
                    default: textNode.textAlignHorizontal = 'LEFT';
                }
            }

            if (data.style?.lineHeight && data.style.lineHeight > 0) {
                textNode.lineHeight = { value: data.style.lineHeight, unit: 'PIXELS' };
            }

            if (data.style?.letterSpacing) {
                textNode.letterSpacing = { value: data.style.letterSpacing, unit: 'PIXELS' };
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
            rect.resize(Math.max(1, data.width || 1), Math.max(1, data.height || 1));

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
                const svgW = Math.max(1, data.width || 1);
                const svgH = Math.max(1, data.height || 1);
                svgNode.resize(svgW, svgH);
                return svgNode;
            } catch (e) {
                console.error("Failed to create SVG", e);
                return null;
            }
        }


        // --- FRAME NODE ---
        if (data.type === 'FRAME') {
            const frame = figma.createFrame();
            frame.name = data.name || "Frame";

            // Use minimum of 1 pixel for dimensions to avoid Figma issues
            const safeW = Math.max(1, data.width || 1);
            const safeH = Math.max(1, data.height || 1);
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

            // --- DISABLE AUTO LAYOUT FOR FIDELITY ---
            // To avoid "stacking" and ensure pixel-perfect matches with the browser's rendering,
            // we will use Frame positioning (NONE) for everything.
            // AutoLayout often misinterprets browser spacing (margins vs gap vs padding).
            // NOTE: We cannot use layoutPositioning = 'ABSOLUTE' when parent has layoutMode = 'NONE'
            frame.layoutMode = 'NONE';

            // Clip content if needed
            if (data.style.overflow === 'hidden' || data.style.overflow === 'scroll' || data.style.overflow === 'auto') {
                frame.clipsContent = true;
            }

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
                    data.style.border.top.width || 0,
                    data.style.border.right.width || 0,
                    data.style.border.bottom.width || 0,
                    data.style.border.left.width || 0
                );
                if (maxW > 0) {
                    const borderColor = data.style.border.top.color || { r: 0, g: 0, b: 0, a: 1 };
                    // IMPORTANT: Figma color object must NOT contain 'a' - use opacity separately
                    frame.strokes = [{
                        type: 'SOLID',
                        color: { r: borderColor.r, g: borderColor.g, b: borderColor.b },
                        opacity: borderColor.a ?? 1
                    }];
                    frame.strokeWeight = maxW;

                    if (data.style.border.top.width !== data.style.border.bottom.width) {
                        frame.strokeTopWeight = data.style.border.top.width || 0;
                        frame.strokeBottomWeight = data.style.border.bottom.width || 0;
                        frame.strokeLeftWeight = data.style.border.left.width || 0;
                        frame.strokeRightWeight = data.style.border.right.width || 0;
                    }
                }
            }

            // Opacity
            if (typeof data.style.opacity === 'number') {
                frame.opacity = data.style.opacity;
            }

            // Recursion - pass offset for coordinate normalization
            if (data.children && data.children.length > 0) {
                console.log(`${indent}  Processing ${data.children.length} children of ${data.name}`);
                for (let i = 0; i < data.children.length; i++) {
                    const childData = data.children[i];
                    console.log(`${indent}    [${i}] Creating child: ${childData.type} - ${childData.name || childData.text?.substring(0, 20)}`);

                    // Pass offset parameters to recursive call
                    const childNode = await createFigmaNode(childData, depth + 1, offsetX, offsetY);
                    if (childNode) {
                        frame.appendChild(childNode);

                        // Position child relative to parent
                        // Calculate position relative to parent's origin
                        const relX = childData.x - data.x;
                        const relY = childData.y - data.y;

                        if (!isNaN(relX) && isFinite(relX)) childNode.x = relX;
                        if (!isNaN(relY) && isFinite(relY)) childNode.y = relY;
                    } else {
                        console.log(`${indent}    [${i}] Child returned null!`);
                    }
                }
            } else {
                console.log(`${indent}  No children for ${data.name}`);
            }

            return frame;
        }
        return null;
    } catch (e) {
        console.error(`${indent}[ERROR] Failed to create node: ${data.type} - ${data.name || data.text?.substring(0, 20)}`, e);
        return null;
    }
}
