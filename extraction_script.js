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

            // PSEUDO ELEMENTS (::before, ::after)
            ['::before', '::after'].forEach(pseudo => {
                const pStyle = window.getComputedStyle(el, pseudo);
                const content = pStyle.content;
                if (content && content !== 'none' && content !== '""' && content !== 'normal') {
                    // Get approximate rect for pseudo
                    const pRect = el.getBoundingClientRect(); // fallback to parent
                    children.push({
                        type: 'TEXT',
                        name: pseudo,
                        text: content.replace(/['"]/g, ''),
                        x: pRect.x, // Rough
                        y: pRect.y,
                        width: pRect.width,
                        height: pRect.height,
                        style: {
                            color: getRgb(pStyle.color),
                            fontSize: parseFloat(pStyle.fontSize),
                            fontWeight: pStyle.fontWeight,
                            fontFamily: pStyle.fontFamily,
                            opacity: parseFloat(pStyle.opacity),
                            textAlign: 'center'
                        }
                    });
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
                    zIndex: style.zIndex
                }
            };
        }
    }

    return traverse(document.body);
});

return [extractedData];
