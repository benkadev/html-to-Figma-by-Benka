// --- n8n Extraction Script (Enhanced) ---
// MUST run in Puppeteer > Evaluate JavaScript

const url = $('Webhook').first().json.body.url;

// Set initial viewport width to desktop 1800px
await $page.setViewport({ width: 1800, height: 900 });

await $page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 3000)); // Wait for lazy-loaded content

// Get full page height and resize viewport to capture everything
const fullHeight = await $page.evaluate(() => {
    return Math.max(
        document.body.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.clientHeight,
        document.documentElement.scrollHeight,
        document.documentElement.offsetHeight
    );
});

// Set viewport to full page height
await $page.setViewport({ width: 1800, height: fullHeight });
await new Promise(r => setTimeout(r, 500)); // Small wait after resize

const extractedData = await $page.evaluate(() => {

    // --- Helpers ---
    function getRgb(color) {
        if (!color) return null;
        if (color === 'transparent' || color === 'rgba(0, 0, 0, 0)') return null;
        const match = color.match(/(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d\.]+))?/);
        if (!match) return null;
        return {
            r: parseInt(match[1]) / 255,
            g: parseInt(match[2]) / 255,
            b: parseInt(match[3]) / 255,
            a: match[4] ? parseFloat(match[4]) : 1
        };
    }

    function isHidden(el) {
        const style = window.getComputedStyle(el);
        return style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0';
    }

    // Parse CSS transform matrix to extract translate, scale, rotate
    function parseTransform(transformString) {
        if (!transformString || transformString === 'none') return null;

        // Match matrix(a, b, c, d, tx, ty) or matrix3d(...)
        const matrix2d = transformString.match(/matrix\(([^)]+)\)/);
        const matrix3d = transformString.match(/matrix3d\(([^)]+)\)/);

        let a, b, c, d, tx, ty;

        if (matrix3d) {
            const values = matrix3d[1].split(',').map(v => parseFloat(v.trim()));
            a = values[0]; b = values[1]; tx = values[12];
            c = values[4]; d = values[5]; ty = values[13];
        } else if (matrix2d) {
            const values = matrix2d[1].split(',').map(v => parseFloat(v.trim()));
            [a, b, c, d, tx, ty] = values;
        } else {
            return null;
        }

        // Extract rotation angle (in degrees)
        const rotation = Math.atan2(b, a) * (180 / Math.PI);

        // Extract scale
        const scaleX = Math.sqrt(a * a + b * b);
        const scaleY = Math.sqrt(c * c + d * d);

        return {
            translateX: tx || 0,
            translateY: ty || 0,
            rotation: rotation || 0,
            scaleX: scaleX !== 1 ? scaleX : undefined,
            scaleY: scaleY !== 1 ? scaleY : undefined
        };
    }

    function traverse(el) {
        if (el.nodeType !== 1 && el.nodeType !== 3) return null; // Only Element or Text

        const nodeData = {};

        // --- TEXT NODES ---
        if (el.nodeType === 3) { // Text
            const textContent = el.textContent?.trim();
            if (!textContent) return null;

            // Get parent styles for text
            const parent = el.parentElement;
            if (!parent || isHidden(parent)) return null;
            const style = window.getComputedStyle(parent);

            // Calculate range rect for exact text position
            const range = document.createRange();
            range.selectNode(el);
            const rect = range.getBoundingClientRect();
            range.detach();

            if (rect.width < 1 || rect.height < 1) return null;

            return {
                type: 'TEXT',
                text: textContent,
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
                style: {
                    color: getRgb(style.color),
                    fontSize: parseFloat(style.fontSize),
                    fontWeight: style.fontWeight,
                    fontFamily: style.fontFamily,
                    textAlign: style.textAlign,
                    lineHeight: style.lineHeight === 'normal' ? undefined : parseFloat(style.lineHeight),
                    letterSpacing: style.letterSpacing === 'normal' ? 0 : parseFloat(style.letterSpacing),
                    textTransform: style.textTransform,
                    textDecoration: style.textDecorationLine
                }
            };
        }

        // --- ELEMENT NODES ---
        if (el.nodeType === 1) {
            if (isHidden(el)) return null;
            if (['SCRIPT', 'STYLE', 'META', 'HEAD', 'LINK', 'NOSCRIPT', 'IFRAME', 'PATH'].includes(el.tagName)) return null;

            // SVG Handling
            if (el.tagName.toLowerCase() === 'svg') {
                const svgRect = el.getBoundingClientRect();
                // For SVG, we want visual size. If 0, check children? standard SVG must have size.
                if (svgRect.width < 1 || svgRect.height < 1) return null;
                return {
                    type: 'SVG',
                    name: 'svg',
                    x: svgRect.x,
                    y: svgRect.y,
                    width: svgRect.width,
                    height: svgRect.height,
                    svg: el.outerHTML,
                    style: {
                        opacity: parseFloat(window.getComputedStyle(el).opacity),
                        zIndex: window.getComputedStyle(el).zIndex
                    }
                };
            }

            const style = window.getComputedStyle(el);

            // Collect children first
            const children = [];
            el.childNodes.forEach(child => {
                const childNode = traverse(child);
                if (childNode) children.push(childNode);
            });

            // PSEUDO ELEMENTS (::before, ::after) - ENHANCED
            ['::before', '::after'].forEach(pseudo => {
                const pStyle = window.getComputedStyle(el, pseudo);
                const content = pStyle.content;

                // Check if pseudo-element has content OR visual properties (background, border)
                const hasContent = content && content !== 'none' && content !== '""' && content !== 'normal';
                const hasVisuals = (pStyle.backgroundColor && pStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' && pStyle.backgroundColor !== 'transparent') ||
                    (pStyle.borderWidth && pStyle.borderWidth !== '0px') ||
                    (pStyle.backgroundImage && pStyle.backgroundImage !== 'none');

                if (hasContent || hasVisuals) {
                    const pRect = el.getBoundingClientRect(); // Fallback to parent rect

                    // Calculate position based on CSS positioning
                    const position = pStyle.position;
                    const top = pStyle.top !== 'auto' ? parseFloat(pStyle.top) : 0;
                    const left = pStyle.left !== 'auto' ? parseFloat(pStyle.left) : 0;
                    const right = pStyle.right !== 'auto' ? parseFloat(pStyle.right) : null;
                    const bottom = pStyle.bottom !== 'auto' ? parseFloat(pStyle.bottom) : null;

                    // Calculate width and height
                    let pseudoWidth = pStyle.width !== 'auto' ? parseFloat(pStyle.width) : pRect.width;
                    let pseudoHeight = pStyle.height !== 'auto' ? parseFloat(pStyle.height) : pRect.height;

                    // Handle inset positioning (before:inset-0)
                    if (pStyle.inset && pStyle.inset !== 'auto') {
                        const insetValue = parseFloat(pStyle.inset);
                        pseudoWidth = pRect.width - (insetValue * 2);
                        pseudoHeight = pRect.height - (insetValue * 2);
                    }

                    // Determine type: TEXT if has text content, FRAME if visual only
                    const nodeType = hasContent ? 'TEXT' : 'FRAME';

                    const pseudoNode = {
                        type: nodeType,
                        name: pseudo,
                        x: pRect.x + left,
                        y: pRect.y + top,
                        width: pseudoWidth,
                        height: pseudoHeight,
                        style: {
                            backgroundColor: getRgb(pStyle.backgroundColor),
                            position: position,
                            opacity: parseFloat(pStyle.opacity),
                            zIndex: pStyle.zIndex,
                            borderRadius: {
                                tl: parseFloat(pStyle.borderTopLeftRadius),
                                tr: parseFloat(pStyle.borderTopRightRadius),
                                bl: parseFloat(pStyle.borderBottomLeftRadius),
                                br: parseFloat(pStyle.borderBottomRightRadius)
                            },
                            border: {
                                top: { width: parseFloat(pStyle.borderTopWidth), color: getRgb(pStyle.borderTopColor) },
                                right: { width: parseFloat(pStyle.borderRightWidth), color: getRgb(pStyle.borderRightColor) },
                                bottom: { width: parseFloat(pStyle.borderBottomWidth), color: getRgb(pStyle.borderBottomColor) },
                                left: { width: parseFloat(pStyle.borderLeftWidth), color: getRgb(pStyle.borderLeftColor) }
                            },
                            transform: parseTransform(pStyle.transform)
                        }
                    };

                    // Add text-specific properties if it's a text node
                    if (nodeType === 'TEXT') {
                        pseudoNode.text = content.replace(/['"]/g, '');
                        pseudoNode.style.color = getRgb(pStyle.color);
                        pseudoNode.style.fontSize = parseFloat(pStyle.fontSize);
                        pseudoNode.style.fontWeight = pStyle.fontWeight;
                        pseudoNode.style.fontFamily = pStyle.fontFamily;
                        pseudoNode.style.textAlign = pStyle.textAlign;
                    }

                    // Add background image if present
                    if (pStyle.backgroundImage && pStyle.backgroundImage !== 'none') {
                        const match = pStyle.backgroundImage.match(/url\(['"]?(.*?)['"]?\)/);
                        if (match && match[1]) {
                            pseudoNode.backgroundImage = match[1];
                        }
                    }

                    children.push(pseudoNode);
                }
            });

            const rect = el.getBoundingClientRect();

            // Pruning Logic:
            // If it has children, we generally keep it to preserve structure.
            // If it has no children, we check if it has visuals (bg, border, image).
            // If neither, we prune.
            const hasVisuals = (style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent') ||
                (style.borderWidth && style.borderWidth !== '0px') ||
                (style.backgroundImage && style.backgroundImage !== 'none') ||
                el.tagName === 'IMG';

            if (children.length === 0 && !hasVisuals) {
                if (rect.width < 1 || rect.height < 1) return null;
                // If it has size but no children/visuals? keep it? pure spacer?
                // Let's prune generic empty empty divs.
                // return null; 
            }
            // Actually, strict pruning:
            if (children.length === 0 && rect.width < 1 && rect.height < 1) return null;

            // Special handling for IMG
            let itemType = 'FRAME';
            let imageSrc = null;
            if (el.tagName === 'IMG') {
                itemType = 'IMAGE';
                imageSrc = el.currentSrc || el.src || el.getAttribute('data-src') || el.srcset?.split(',')[0]?.split(' ')[0];
            } else if (style.backgroundImage && style.backgroundImage !== 'none') {
                const match = style.backgroundImage.match(/url\(['"]?(.*?)['"]?\)/);
                if (match && match[1]) {
                    nodeData.backgroundImage = match[1];
                }
            }

            const className = el.getAttribute('class');
            const classSelector = className ? '.' + className.split(' ')[0] : '';

            return {
                type: itemType,
                name: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + classSelector,
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
                imageSrc: imageSrc,
                backgroundImage: nodeData.backgroundImage,
                children: children,
                style: {
                    backgroundColor: getRgb(style.backgroundColor),
                    display: style.display,
                    position: style.position,
                    flexDirection: style.flexDirection,
                    flexWrap: style.flexWrap,
                    justifyContent: style.justifyContent,
                    alignItems: style.alignItems,
                    gap: style.gap,
                    // Grid layout properties
                    gridTemplateColumns: style.gridTemplateColumns !== 'none' ? style.gridTemplateColumns : null,
                    gridTemplateRows: style.gridTemplateRows !== 'none' ? style.gridTemplateRows : null,
                    gridColumnGap: style.gridColumnGap !== 'normal' ? parseFloat(style.gridColumnGap) : null,
                    gridRowGap: style.gridRowGap !== 'normal' ? parseFloat(style.gridRowGap) : null,
                    padding: {
                        t: parseFloat(style.paddingTop),
                        r: parseFloat(style.paddingRight),
                        b: parseFloat(style.paddingBottom),
                        l: parseFloat(style.paddingLeft)
                    },
                    border: {
                        top: { width: parseFloat(style.borderTopWidth), color: getRgb(style.borderTopColor) },
                        right: { width: parseFloat(style.borderRightWidth), color: getRgb(style.borderRightColor) },
                        bottom: { width: parseFloat(style.borderBottomWidth), color: getRgb(style.borderBottomColor) },
                        left: { width: parseFloat(style.borderLeftWidth), color: getRgb(style.borderLeftColor) }
                    },
                    borderRadius: {
                        tl: parseFloat(style.borderTopLeftRadius),
                        tr: parseFloat(style.borderTopRightRadius),
                        bl: parseFloat(style.borderBottomLeftRadius),
                        br: parseFloat(style.borderBottomRightRadius)
                    },
                    boxShadow: style.boxShadow !== 'none' ? style.boxShadow : null,
                    overflow: style.overflow,
                    opacity: parseFloat(style.opacity),
                    zIndex: style.zIndex,
                    // Transform properties
                    transform: parseTransform(style.transform)
                }
            };
        }
    }

    return traverse(document.body);
});

return [extractedData];
