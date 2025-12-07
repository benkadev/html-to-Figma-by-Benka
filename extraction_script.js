// --- n8n Extraction Script (Enhanced) ---
// MUST run in Puppeteer > Evaluate JavaScript

const url = $('Webhook').first().json.body.url;
await $page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
await new Promise(r => setTimeout(r, 2000)); // Safety wait

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

            const rect = el.getBoundingClientRect();
            if (rect.width < 1 || rect.height < 1) return null;

            // SVG Handling: Case insensitive check
            if (el.tagName.toLowerCase() === 'svg') {
                return {
                    type: 'SVG',
                    name: 'svg',
                    x: rect.x,
                    y: rect.y,
                    width: rect.width,
                    height: rect.height,
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

            // --- PSEUDO ELEMENTS (::before, ::after) ---
            ['::before', '::after'].forEach(pseudo => {
                const style = window.getComputedStyle(el, pseudo);
                const content = style.content;
                if (content && content !== 'none' && content !== '""' && content !== 'normal') {
                    // It has content!
                    // Measuring is hard without helper, let's try a simple approach first:
                    // Treat as text node inside the element.
                    // Position is tricky. For now, we rely on parent's layout or assume centered?
                    // Better: just add it as a text child.
                    children.push({
                        type: 'TEXT',
                        name: pseudo,
                        text: content.replace(/['"]/g, ''),
                        x: rect.x + parseFloat(style.left || '0'), // rough
                        y: rect.y + parseFloat(style.top || '0'), // rough
                        width: rect.width, // rough
                        height: rect.height, // rough
                        style: {
                            color: getRgb(style.color),
                            fontSize: parseFloat(style.fontSize),
                            fontWeight: style.fontWeight,
                            fontFamily: style.fontFamily,
                            opacity: parseFloat(style.opacity),
                            textAlign: 'center' // Assumption
                        }
                    });
                }
            });

            // Special handling for IMG
            let itemType = 'FRAME';
            let imageSrc = null;
            if (el.tagName === 'IMG') {
                itemType = 'IMAGE';
                imageSrc = el.src;
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
