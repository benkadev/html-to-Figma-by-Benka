// --- n8n Extraction Script (Enhanced v2.0) ---
// MUST run in Puppeteer > Evaluate JavaScript
// Enhanced with features from Builder.io, Magic Patterns, and html-figma projects

const url = $('Webhook').first().json.body.url;

// Set initial viewport width to desktop 1800px
await $page.setViewport({ width: 1800, height: 900 });

await $page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(function (r) { setTimeout(r, 3000); }); // Wait for lazy-loaded content

// Get full page height and resize viewport to capture everything
const fullHeight = await $page.evaluate(function () {
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
await new Promise(function (r) { setTimeout(r, 500); }); // Small wait after resize

const extractedData = await $page.evaluate(function () {

    // --- PRE-PROCESSING: Handle SVG <use> elements (from Builder.io) ---
    var useElements = document.querySelectorAll('use');
    for (var i = 0; i < useElements.length; i++) {
        try {
            var use = useElements[i];
            var href = use.href && use.href.baseVal;
            if (href) {
                var symbol = document.querySelector(href);
                if (symbol) {
                    use.outerHTML = symbol.innerHTML;
                }
            }
        } catch (err) {
            // Ignore errors for <use> processing
        }
    }

    // --- Helpers ---
    function getRgb(color) {
        if (!color) return null;
        if (color === 'transparent' || color === 'rgba(0, 0, 0, 0)') return null;
        var match = color.match(/(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d\.]+))?/);
        if (!match) return null;
        return {
            r: parseInt(match[1]) / 255,
            g: parseInt(match[2]) / 255,
            b: parseInt(match[3]) / 255,
            a: match[4] ? parseFloat(match[4]) : 1
        };
    }

    // Parse gradient to extract stops (for better Figma gradient support)
    function parseGradient(backgroundImage) {
        if (!backgroundImage || backgroundImage === 'none') return null;

        var linearMatch = backgroundImage.match(/linear-gradient\(([^)]+)\)/);
        var radialMatch = backgroundImage.match(/radial-gradient\(([^)]+)\)/);

        if (linearMatch) {
            return {
                type: 'LINEAR_GRADIENT',
                cssValue: backgroundImage
            };
        }
        if (radialMatch) {
            return {
                type: 'RADIAL_GRADIENT',
                cssValue: backgroundImage
            };
        }
        return null;
    }

    function isHidden(el) {
        var style = window.getComputedStyle(el);
        // Check visibility properties
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
            return true;
        }
        // Check for hidden overflow with zero height (from Builder.io)
        if (style.overflow !== 'visible' && el.getBoundingClientRect().height < 1) {
            return true;
        }
        return false;
    }

    // Get semantic name based on element type (from Magic Patterns)
    function getSemanticName(el, tagName) {
        // Check for common semantic patterns
        if (el.getAttribute('role')) {
            return el.getAttribute('role');
        }
        if (el.getAttribute('aria-label')) {
            return el.getAttribute('aria-label').substring(0, 30);
        }

        // Tag-based naming
        switch (tagName) {
            case 'HEADER': return 'Header';
            case 'FOOTER': return 'Footer';
            case 'NAV': return 'Navigation';
            case 'MAIN': return 'Main Content';
            case 'ASIDE': return 'Sidebar';
            case 'ARTICLE': return 'Article';
            case 'SECTION': return 'Section';
            case 'FORM': return 'Form';
            case 'BUTTON': return 'Button';
            case 'A': return 'Link';
            case 'INPUT': return 'Input';
            case 'TEXTAREA': return 'Textarea';
            case 'SELECT': return 'Select';
            case 'LABEL': return 'Label';
            case 'H1': return 'Heading 1';
            case 'H2': return 'Heading 2';
            case 'H3': return 'Heading 3';
            case 'H4': return 'Heading 4';
            case 'H5': return 'Heading 5';
            case 'H6': return 'Heading 6';
            case 'P': return 'Paragraph';
            case 'UL': return 'List';
            case 'OL': return 'Numbered List';
            case 'LI': return 'List Item';
            case 'TABLE': return 'Table';
            case 'VIDEO': return 'Video';
            case 'AUDIO': return 'Audio';
            case 'CANVAS': return 'Canvas';
            case 'IFRAME': return 'Embed';
            default: return null;
        }
    }

    // Get elements from Shadow DOM (from Builder.io)
    function getShadowElements(el) {
        var elements = [];
        if (el.shadowRoot) {
            var shadowChildren = el.shadowRoot.querySelectorAll('*');
            for (var i = 0; i < shadowChildren.length; i++) {
                elements.push(shadowChildren[i]);
                var nested = getShadowElements(shadowChildren[i]);
                for (var j = 0; j < nested.length; j++) {
                    elements.push(nested[j]);
                }
            }
        }
        return elements;
    }

    // Parse CSS transform matrix to extract translate, scale, rotate
    function parseTransform(transformString) {
        if (!transformString || transformString === 'none') return null;

        var matrix2d = transformString.match(/matrix\(([^)]+)\)/);
        var matrix3d = transformString.match(/matrix3d\(([^)]+)\)/);

        var a, b, c, d, tx, ty;

        if (matrix3d) {
            var values = matrix3d[1].split(',').map(function (v) { return parseFloat(v.trim()); });
            a = values[0]; b = values[1]; tx = values[12];
            c = values[4]; d = values[5]; ty = values[13];
        } else if (matrix2d) {
            var values = matrix2d[1].split(',').map(function (v) { return parseFloat(v.trim()); });
            a = values[0]; b = values[1]; c = values[2]; d = values[3]; tx = values[4]; ty = values[5];
        } else {
            return null;
        }

        var rotation = Math.atan2(b, a) * (180 / Math.PI);
        var scaleX = Math.sqrt(a * a + b * b);
        var scaleY = Math.sqrt(c * c + d * d);

        return {
            translateX: tx || 0,
            translateY: ty || 0,
            rotation: rotation || 0,
            scaleX: scaleX !== 1 ? scaleX : undefined,
            scaleY: scaleY !== 1 ? scaleY : undefined
        };
    }

    // Extract constraints based on CSS positioning (from Builder.io)
    function getConstraints(el, style, parentStyle) {
        var horizontal = 'SCALE';
        var vertical = 'MIN';

        if (style.position === 'absolute' || style.position === 'fixed') {
            // Absolute positioning
            var hasLeft = style.left !== 'auto';
            var hasRight = style.right !== 'auto';
            var hasTop = style.top !== 'auto';
            var hasBottom = style.bottom !== 'auto';

            if (hasLeft && hasRight) horizontal = 'SCALE';
            else if (hasRight) horizontal = 'MAX';
            else if (hasLeft) horizontal = 'MIN';
            else horizontal = 'CENTER';

            if (hasTop && hasBottom) vertical = 'SCALE';
            else if (hasBottom) vertical = 'MAX';
            else if (hasTop) vertical = 'MIN';
            else vertical = 'CENTER';
        } else if (parentStyle) {
            // Flexbox alignment
            if (parentStyle.display === 'flex') {
                var isRow = parentStyle.flexDirection === 'row' || parentStyle.flexDirection === 'row-reverse';
                var justify = parentStyle.justifyContent;
                var align = parentStyle.alignItems;

                if (isRow) {
                    if (justify === 'center') horizontal = 'CENTER';
                    else if (justify === 'flex-end' || justify === 'end') horizontal = 'MAX';
                    if (align === 'center') vertical = 'CENTER';
                    else if (align === 'flex-end' || align === 'end') vertical = 'MAX';
                } else {
                    if (align === 'center') horizontal = 'CENTER';
                    else if (align === 'flex-end' || align === 'end') horizontal = 'MAX';
                    if (justify === 'center') vertical = 'CENTER';
                    else if (justify === 'flex-end' || justify === 'end') vertical = 'MAX';
                }
            }

            // Text alignment
            if (style.textAlign === 'center') horizontal = 'CENTER';
            else if (style.textAlign === 'right') horizontal = 'MAX';

            // Auto margins
            if (style.marginLeft === 'auto' && style.marginRight === 'auto') horizontal = 'CENTER';
            else if (style.marginLeft === 'auto') horizontal = 'MAX';
        }

        return { horizontal: horizontal, vertical: vertical };
    }

    function traverse(el, parentStyle) {
        if (el.nodeType !== 1 && el.nodeType !== 3) return null;

        var nodeData = {};

        // --- TEXT NODES ---
        if (el.nodeType === 3) {
            var textContent = el.textContent ? el.textContent.trim() : '';
            if (!textContent) return null;

            var parent = el.parentElement;
            if (!parent || isHidden(parent)) return null;
            var style = window.getComputedStyle(parent);

            var range = document.createRange();
            range.selectNode(el);
            var rect = range.getBoundingClientRect();
            range.detach();

            if (rect.width < 1 || rect.height < 1) return null;

            // Apply textTransform to the text content
            var transformedText = textContent;
            if (style.textTransform === 'uppercase') {
                transformedText = textContent.toUpperCase();
            } else if (style.textTransform === 'lowercase') {
                transformedText = textContent.toLowerCase();
            } else if (style.textTransform === 'capitalize') {
                transformedText = textContent.replace(/\b\w/g, function (c) { return c.toUpperCase(); });
            }

            return {
                type: 'TEXT',
                text: transformedText,
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
            var tagName = el.tagName;
            if (['SCRIPT', 'STYLE', 'META', 'HEAD', 'LINK', 'NOSCRIPT', 'PATH', 'DEFS', 'CLIPPATH', 'MASK'].indexOf(tagName) !== -1) return null;

            // Skip if inside a picture element (handled by picture)
            if (el.parentElement && el.parentElement.tagName === 'PICTURE' && (tagName === 'SOURCE' || tagName === 'IMG')) {
                if (tagName === 'SOURCE') return null; // Skip source, picture handles it
            }

            var style = window.getComputedStyle(el);
            var rect = el.getBoundingClientRect();

            // SVG Handling
            if (tagName.toLowerCase() === 'svg') {
                if (rect.width < 1 || rect.height < 1) return null;

                // Get fill color for SVG replacement (from html-to-figma-master)
                var fill = style.fill;
                var svgHtml = el.outerHTML;

                // Replace fill in SVG if it uses currentColor
                if (svgHtml.indexOf('currentColor') !== -1) {
                    svgHtml = svgHtml.replace(/currentColor/g, style.color || 'black');
                }

                return {
                    type: 'SVG',
                    name: 'SVG',
                    x: rect.x,
                    y: rect.y,
                    width: rect.width,
                    height: rect.height,
                    svg: svgHtml,
                    style: {
                        opacity: parseFloat(style.opacity),
                        zIndex: style.zIndex
                    }
                };
            }

            // Collect children first
            var children = [];

            // Process regular children
            el.childNodes.forEach(function (child) {
                var childNode = traverse(child, style);
                if (childNode) children.push(childNode);
            });

            // Process Shadow DOM children (from Builder.io)
            if (el.shadowRoot) {
                el.shadowRoot.childNodes.forEach(function (child) {
                    var childNode = traverse(child, style);
                    if (childNode) children.push(childNode);
                });
            }

            // PSEUDO ELEMENTS (::before, ::after) - ENHANCED
            ['::before', '::after'].forEach(function (pseudo) {
                var pStyle = window.getComputedStyle(el, pseudo);
                var content = pStyle.content;

                var hasContent = content && content !== 'none' && content !== '""' && content !== "''";
                var hasVisuals = (pStyle.backgroundColor && pStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' && pStyle.backgroundColor !== 'transparent') ||
                    (pStyle.borderWidth && pStyle.borderWidth !== '0px') ||
                    (pStyle.backgroundImage && pStyle.backgroundImage !== 'none');

                if (hasContent || hasVisuals) {
                    var pRect = el.getBoundingClientRect();
                    var position = pStyle.position;
                    var top = pStyle.top !== 'auto' ? parseFloat(pStyle.top) : 0;
                    var left = pStyle.left !== 'auto' ? parseFloat(pStyle.left) : 0;

                    var pseudoWidth = pStyle.width !== 'auto' ? parseFloat(pStyle.width) : pRect.width;
                    var pseudoHeight = pStyle.height !== 'auto' ? parseFloat(pStyle.height) : pRect.height;

                    if (pStyle.inset && pStyle.inset !== 'auto') {
                        var insetValue = parseFloat(pStyle.inset);
                        pseudoWidth = pRect.width - (insetValue * 2);
                        pseudoHeight = pRect.height - (insetValue * 2);
                    }

                    var nodeType = hasContent ? 'TEXT' : 'FRAME';

                    var pseudoNode = {
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

                    if (nodeType === 'TEXT') {
                        pseudoNode.text = content.replace(/['"]/g, '');
                        pseudoNode.style.color = getRgb(pStyle.color);
                        pseudoNode.style.fontSize = parseFloat(pStyle.fontSize);
                        pseudoNode.style.fontWeight = pStyle.fontWeight;
                        pseudoNode.style.fontFamily = pStyle.fontFamily;
                        pseudoNode.style.textAlign = pStyle.textAlign;
                    }

                    if (pStyle.backgroundImage && pStyle.backgroundImage !== 'none') {
                        var match = pStyle.backgroundImage.match(/url\(['"]?(.*?)['"]?\)/);
                        if (match && match[1]) {
                            pseudoNode.backgroundImage = match[1];
                        }
                    }

                    children.push(pseudoNode);
                }
            });

            // Pruning logic
            var hasVisuals = (style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent') ||
                (style.borderWidth && style.borderWidth !== '0px') ||
                (style.backgroundImage && style.backgroundImage !== 'none') ||
                tagName === 'IMG' || tagName === 'VIDEO' || tagName === 'PICTURE';

            if (children.length === 0 && !hasVisuals) {
                if (rect.width < 1 || rect.height < 1) return null;
            }
            if (children.length === 0 && rect.width < 1 && rect.height < 1) return null;

            // --- SPECIAL ELEMENT HANDLING ---
            var itemType = 'FRAME';
            var imageSrc = null;
            var inputValue = null;
            var inputPlaceholder = null;
            var inputType = null;

            // IMG handling
            if (tagName === 'IMG') {
                itemType = 'IMAGE';
                var srcsetSrc = null;
                if (el.srcset) {
                    var srcsetParts = el.srcset.split(',');
                    if (srcsetParts[0]) {
                        var srcParts = srcsetParts[0].split(' ');
                        srcsetSrc = srcParts[0] || null;
                    }
                }
                imageSrc = el.currentSrc || el.src || el.getAttribute('data-src') || srcsetSrc;
            }
            // PICTURE handling (from Builder.io)
            else if (tagName === 'PICTURE') {
                itemType = 'IMAGE';
                var firstSource = el.querySelector('source');
                var img = el.querySelector('img');
                if (firstSource && firstSource.srcset) {
                    imageSrc = firstSource.srcset.split(/[,\s]+/)[0];
                } else if (img) {
                    imageSrc = img.currentSrc || img.src;
                }
            }
            // VIDEO handling (poster) - from Builder.io
            else if (tagName === 'VIDEO') {
                itemType = 'IMAGE';
                imageSrc = el.poster || null;
            }
            // INPUT handling (from Magic Patterns)
            else if (tagName === 'INPUT') {
                inputType = el.getAttribute('type') || 'text';
                inputValue = el.value;
                inputPlaceholder = el.getAttribute('placeholder');

                // Add input value or placeholder as child text
                var displayText = inputValue || inputPlaceholder;
                if (displayText && inputType !== 'hidden' && inputType !== 'checkbox' && inputType !== 'radio') {
                    children.push({
                        type: 'TEXT',
                        text: displayText,
                        x: rect.x + parseFloat(style.paddingLeft),
                        y: rect.y + parseFloat(style.paddingTop),
                        width: rect.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
                        height: rect.height - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom),
                        style: {
                            color: inputValue ? getRgb(style.color) : { r: 0.6, g: 0.6, b: 0.6, a: 1 },
                            fontSize: parseFloat(style.fontSize),
                            fontWeight: style.fontWeight,
                            fontFamily: style.fontFamily,
                            textAlign: style.textAlign
                        }
                    });
                }
            }
            // TEXTAREA handling
            else if (tagName === 'TEXTAREA') {
                inputValue = el.value;
                inputPlaceholder = el.getAttribute('placeholder');

                var displayText = inputValue || inputPlaceholder;
                if (displayText) {
                    children.push({
                        type: 'TEXT',
                        text: displayText,
                        x: rect.x + parseFloat(style.paddingLeft),
                        y: rect.y + parseFloat(style.paddingTop),
                        width: rect.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
                        height: rect.height - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom),
                        style: {
                            color: inputValue ? getRgb(style.color) : { r: 0.6, g: 0.6, b: 0.6, a: 1 },
                            fontSize: parseFloat(style.fontSize),
                            fontWeight: style.fontWeight,
                            fontFamily: style.fontFamily,
                            textAlign: style.textAlign
                        }
                    });
                }
            }
            // SELECT handling (from Magic Patterns)
            else if (tagName === 'SELECT') {
                var selectedOption = el.options && el.options[el.selectedIndex];
                var selectedText = selectedOption ? selectedOption.text : '';
                if (selectedText) {
                    children.push({
                        type: 'TEXT',
                        text: selectedText,
                        x: rect.x + parseFloat(style.paddingLeft),
                        y: rect.y + parseFloat(style.paddingTop),
                        width: rect.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 20, // Leave space for dropdown arrow
                        height: rect.height - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom),
                        style: {
                            color: getRgb(style.color),
                            fontSize: parseFloat(style.fontSize),
                            fontWeight: style.fontWeight,
                            fontFamily: style.fontFamily,
                            textAlign: style.textAlign
                        }
                    });
                }
            }

            // Background image handling
            if (style.backgroundImage && style.backgroundImage !== 'none' && itemType === 'FRAME') {
                var match = style.backgroundImage.match(/url\(['"]?(.*?)['"]?\)/);
                if (match && match[1]) {
                    nodeData.backgroundImage = match[1];
                }
                // Also check for gradients
                var gradient = parseGradient(style.backgroundImage);
                if (gradient) {
                    nodeData.gradient = gradient;
                }
            }

            // Generate semantic name
            var className = el.getAttribute('class');
            var classSelector = className ? '.' + className.split(' ')[0] : '';
            var semanticName = getSemanticName(el, tagName);
            var displayName = semanticName || (tagName.toLowerCase() + (el.id ? '#' + el.id : '') + classSelector);

            // Get constraints
            var constraints = getConstraints(el, style, parentStyle);

            return {
                type: itemType,
                name: displayName,
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
                imageSrc: imageSrc,
                backgroundImage: nodeData.backgroundImage,
                gradient: nodeData.gradient,
                inputType: inputType,
                children: children,
                constraints: constraints,
                style: {
                    backgroundColor: getRgb(style.backgroundColor),
                    display: style.display,
                    position: style.position,
                    flexDirection: style.flexDirection,
                    flexWrap: style.flexWrap,
                    justifyContent: style.justifyContent,
                    alignItems: style.alignItems,
                    gap: style.gap,
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
                    transform: parseTransform(style.transform),
                    // Object fit for images (from Builder.io)
                    objectFit: style.objectFit,
                    objectPosition: style.objectPosition
                }
            };
        }
    }

    return traverse(document.body, null);
});

return [extractedData];
