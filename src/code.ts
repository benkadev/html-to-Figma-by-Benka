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

interface CssTransform {
    translateX?: number;
    translateY?: number;
    rotation?: number;
    scaleX?: number;
    scaleY?: number;
}

interface ElementConstraints {
    horizontal: 'MIN' | 'CENTER' | 'MAX' | 'SCALE';
    vertical: 'MIN' | 'CENTER' | 'MAX' | 'SCALE';
}

interface Gradient {
    type: 'LINEAR_GRADIENT' | 'RADIAL_GRADIENT';
    cssValue: string;
}

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
    gradient?: Gradient;
    inputType?: string;
    constraints?: ElementConstraints;
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
        // Grid layout properties
        gridTemplateColumns?: string;
        gridTemplateRows?: string;
        gridColumnGap?: number;
        gridRowGap?: number;
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
        // Transform properties
        transform?: CssTransform;
        // Object fit for images (from Builder.io)
        objectFit?: string;
        objectPosition?: string;
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

        // Create a wrapper SECTION for the entire page (instead of Frame)
        const wrapperSection = figma.createSection();

        // Extract site name from URL
        let siteName = "Imported Site";
        try {
            const urlObj = new URL(url);
            siteName = urlObj.hostname.replace(/^www\./, '');
        } catch (e) {
            siteName = url || "Imported Site";
        }
        wrapperSection.name = siteName;

        // Set wrapper size based on root node dimensions
        const wrapperWidth = Math.max(1, node.width || 1440);
        const wrapperHeight = Math.max(1, node.height || 900);
        wrapperSection.resizeWithoutConstraints(wrapperWidth, wrapperHeight);

        // Create the content starting from the root node
        // Offset coordinates so everything is relative to (0,0) in the wrapper
        const offsetX = node.x || 0;
        const offsetY = node.y || 0;

        const rootFrame = await createFigmaNode(node, 0, offsetX, offsetY);

        if (rootFrame) {
            wrapperSection.appendChild(rootFrame);
            // Position the root at 0,0 within the wrapper
            rootFrame.x = 0;
            rootFrame.y = 0;
        }

        // Position wrapper at origin on the page
        wrapperSection.x = 0;
        wrapperSection.y = 0;

        figma.currentPage.appendChild(wrapperSection);
        figma.viewport.scrollAndZoomIntoView([wrapperSection]);
        figma.notify("Import completed!");
    }
};

// Parse box-shadow CSS string into Figma effects
function parseBoxShadow(shadowString: string): Effect[] {
    if (!shadowString || shadowString === 'none') return [];

    const effects: Effect[] = [];

    // Split by comma (multiple shadows)
    const shadows = shadowString.split(/,(?![^(]*\))/); // Split by comma not inside parentheses

    for (const shadow of shadows) {
        const trimmed = shadow.trim();

        // Check if it's inset
        const isInset = trimmed.startsWith('inset');
        const shadowWithoutInset = isInset ? trimmed.replace('inset', '').trim() : trimmed;

        // Match: offsetX offsetY blur spread color
        // Example: 0px 0px 2px rgba(0,0,0,0.2)
        const match = shadowWithoutInset.match(/(-?[\d.]+)px\s+(-?[\d.]+)px(?:\s+(-?[\d.]+)px)?(?:\s+(-?[\d.]+)px)?\s+(rgba?\([^)]+\)|#[0-9a-fA-F]+)/);

        if (match) {
            const offsetX = parseFloat(match[1]);
            const offsetY = parseFloat(match[2]);
            const blur = match[3] ? parseFloat(match[3]) : 0;
            const spread = match[4] ? parseFloat(match[4]) : 0;
            const colorString = match[5];

            // Parse color
            let r = 0, g = 0, b = 0, a = 1;
            const rgbaMatch = colorString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
            if (rgbaMatch) {
                r = parseInt(rgbaMatch[1]) / 255;
                g = parseInt(rgbaMatch[2]) / 255;
                b = parseInt(rgbaMatch[3]) / 255;
                a = rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1;
            }

            effects.push({
                type: isInset ? 'INNER_SHADOW' : 'DROP_SHADOW',
                color: { r, g, b, a },
                offset: { x: offsetX, y: offsetY },
                radius: blur,
                spread: spread,
                visible: true,
                blendMode: 'NORMAL'
            });
        }
    }

    return effects;
}

async function createFigmaNode(data: NodeData, depth: number = 0, offsetX: number = 0, offsetY: number = 0): Promise<SceneNode | null> {
    if (!data) return null;

    // Debug mode flag - set to true to enable verbose logging
    const DEBUG = false;

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

        // Helper to fetch image with object-fit support
        async function fetchImage(url: string, objectFit?: string): Promise<ImagePaint | null> {
            try {
                const response = await fetch(url);
                if (!response.ok) return null;
                const buffer = await response.arrayBuffer();
                const image = figma.createImage(new Uint8Array(buffer));

                // Determine scaleMode based on objectFit (from Builder.io)
                let scaleMode: 'FILL' | 'FIT' | 'CROP' | 'TILE' = 'FILL';
                if (objectFit === 'contain') {
                    scaleMode = 'FIT';
                } else if (objectFit === 'cover') {
                    scaleMode = 'FILL';
                } else if (objectFit === 'none') {
                    scaleMode = 'CROP';
                }

                return {
                    type: 'IMAGE',
                    imageHash: image.hash,
                    scaleMode: scaleMode
                };
            } catch (e) {
                console.error("[ERROR] Image load failed:", url);
                return null;
            }
        }

        // --- IMAGE NODE ---
        if (data.type === 'IMAGE') {
            const rect = figma.createRectangle();
            rect.name = data.name || "Image";
            rect.resize(Math.max(1, data.width || 1), Math.max(1, data.height || 1));

            let fills: Paint[] = [{ type: 'SOLID', color: { r: 0.85, g: 0.85, b: 0.85 } }];

            if (data.imageSrc) {
                const imagePaint = await fetchImage(data.imageSrc, data.style?.objectFit);
                if (imagePaint) fills = [imagePaint];
            }
            rect.fills = fills;

            // Apply border radius to images
            if (data.style?.borderRadius) {
                rect.topLeftRadius = data.style.borderRadius.tl || 0;
                rect.topRightRadius = data.style.borderRadius.tr || 0;
                rect.bottomLeftRadius = data.style.borderRadius.bl || 0;
                rect.bottomRightRadius = data.style.borderRadius.br || 0;
            }

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

            // Box-shadow (parse and apply as effects)
            if (data.style.boxShadow) {
                const effects = parseBoxShadow(data.style.boxShadow);
                if (effects.length > 0) {
                    frame.effects = effects;
                }
            }

            // Transform (rotation only - Figma doesn't support translate in frames directly)
            if (data.style.transform) {
                const transform = data.style.transform;

                // Apply rotation if present
                if (transform.rotation && transform.rotation !== 0) {
                    frame.rotation = transform.rotation;
                }

                // Note: Figma doesn't have direct translate on frames
                // Translate is handled through positioning (x, y)
                // Scale is not directly supported on frames in Figma
                // We document it in the layer name for reference
                if (transform.scaleX || transform.scaleY || transform.translateX || transform.translateY) {
                    const transformInfo = [];
                    if (transform.translateX) transformInfo.push(`translateX:${transform.translateX.toFixed(1)}px`);
                    if (transform.translateY) transformInfo.push(`translateY:${transform.translateY.toFixed(1)}px`);
                    if (transform.scaleX && transform.scaleX !== 1) transformInfo.push(`scaleX:${transform.scaleX.toFixed(2)}`);
                    if (transform.scaleY && transform.scaleY !== 1) transformInfo.push(`scaleY:${transform.scaleY.toFixed(2)}`);

                    if (transformInfo.length > 0) {
                        frame.name = `${frame.name} [${transformInfo.join(', ')}]`;
                    }
                }
            }

            // Grid Layout (documented in layer name as Figma doesn't have native grid)
            if (data.style.display === 'grid' && data.style.gridTemplateColumns) {
                const gridInfo = [`grid-cols:${data.style.gridTemplateColumns}`];
                if (data.style.gridTemplateRows) gridInfo.push(`grid-rows:${data.style.gridTemplateRows}`);
                if (data.style.gridColumnGap) gridInfo.push(`gap-x:${data.style.gridColumnGap}px`);
                if (data.style.gridRowGap) gridInfo.push(`gap-y:${data.style.gridRowGap}px`);

                frame.name = `${frame.name} [${gridInfo.join(', ')}]`;
            }

            // Recursion - pass offset for coordinate normalization
            if (data.children && data.children.length > 0) {

                // Sort children by z-index to ensure proper layering
                // Lower z-index = added first = appears behind
                // Higher z-index = added later = appears in front
                const sortedChildren = [...data.children].sort((a, b) => {
                    const zIndexA = parseInt(a.style?.zIndex || '0') || 0;
                    const zIndexB = parseInt(b.style?.zIndex || '0') || 0;
                    return zIndexA - zIndexB;
                });

                for (let i = 0; i < sortedChildren.length; i++) {
                    const childData = sortedChildren[i];

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

                        // Apply constraints from extraction (from Builder.io)
                        if (childData.constraints && 'constraints' in childNode) {
                            const constraints = childData.constraints;
                            try {
                                (childNode as ConstraintMixin).constraints = {
                                    horizontal: constraints.horizontal || 'SCALE',
                                    vertical: constraints.vertical || 'MIN'
                                };
                            } catch (e) {
                                // Some node types don't support constraints
                            }
                        }
                    } else if (DEBUG) {
                        console.warn(`[WARN] Child returned null: ${childData.name || childData.text?.substring(0, 20)}`);
                    }
                }
            }

            return frame;
        }
        return null;
    } catch (e) {
        console.error(`[ERROR] Failed to create node: ${data.type} - ${data.name || data.text?.substring(0, 20)}`, e);
        return null;
    }
}
