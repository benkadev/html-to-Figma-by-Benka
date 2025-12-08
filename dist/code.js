var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};
(function() {
  "use strict";
  figma.showUI(__html__, { width: 400, height: 600 });
  figma.ui.onmessage = (msg) => __async(this, null, function* () {
    if (msg.type === "import-html") {
      const { url, node } = msg.payload;
      if (!node) {
        figma.notify("Failed to parse content");
        return;
      }
      figma.notify("Starting import...");
      try {
        yield figma.loadFontAsync({ family: "Inter", style: "Regular" });
        yield figma.loadFontAsync({ family: "Inter", style: "Bold" });
        yield figma.loadFontAsync({ family: "Inter", style: "Medium" });
      } catch (e) {
        console.error("Failed to preload Inter fonts", e);
      }
      const wrapperSection = figma.createSection();
      let siteName = "Imported Site";
      try {
        const urlObj = new URL(url);
        siteName = urlObj.hostname.replace(/^www\./, "");
      } catch (e) {
        siteName = url || "Imported Site";
      }
      wrapperSection.name = siteName;
      const wrapperWidth = Math.max(1, node.width || 1440);
      const wrapperHeight = Math.max(1, node.height || 900);
      wrapperSection.resizeWithoutConstraints(wrapperWidth, wrapperHeight);
      const offsetX = node.x || 0;
      const offsetY = node.y || 0;
      const rootFrame = yield createFigmaNode(node, 0, offsetX, offsetY);
      if (rootFrame) {
        wrapperSection.appendChild(rootFrame);
        rootFrame.x = 0;
        rootFrame.y = 0;
      }
      wrapperSection.x = 0;
      wrapperSection.y = 0;
      figma.currentPage.appendChild(wrapperSection);
      figma.viewport.scrollAndZoomIntoView([wrapperSection]);
      figma.notify("Import completed!");
    }
  });
  function parseBoxShadow(shadowString) {
    if (!shadowString || shadowString === "none") return [];
    const effects = [];
    const shadows = shadowString.split(/,(?![^(]*\))/);
    for (const shadow of shadows) {
      const trimmed = shadow.trim();
      const isInset = trimmed.startsWith("inset");
      const shadowWithoutInset = isInset ? trimmed.replace("inset", "").trim() : trimmed;
      const match = shadowWithoutInset.match(/(-?[\d.]+)px\s+(-?[\d.]+)px(?:\s+(-?[\d.]+)px)?(?:\s+(-?[\d.]+)px)?\s+(rgba?\([^)]+\)|#[0-9a-fA-F]+)/);
      if (match) {
        const offsetX = parseFloat(match[1]);
        const offsetY = parseFloat(match[2]);
        const blur = match[3] ? parseFloat(match[3]) : 0;
        const spread = match[4] ? parseFloat(match[4]) : 0;
        const colorString = match[5];
        let r = 0, g = 0, b = 0, a = 1;
        const rgbaMatch = colorString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (rgbaMatch) {
          r = parseInt(rgbaMatch[1]) / 255;
          g = parseInt(rgbaMatch[2]) / 255;
          b = parseInt(rgbaMatch[3]) / 255;
          a = rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1;
        }
        effects.push({
          type: isInset ? "INNER_SHADOW" : "DROP_SHADOW",
          color: { r, g, b, a },
          offset: { x: offsetX, y: offsetY },
          radius: blur,
          spread,
          visible: true,
          blendMode: "NORMAL"
        });
      }
    }
    return effects;
  }
  function createFigmaNode(data, depth = 0, offsetX = 0, offsetY = 0) {
    return __async(this, null, function* () {
      var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l;
      if (!data) return null;
      const DEBUG = false;
      try {
        if (data.type === "TEXT") {
          const textNode = figma.createText();
          textNode.name = ((_a = data.text) == null ? void 0 : _a.substring(0, 30)) || "Text";
          textNode.fontName = { family: "Inter", style: "Regular" };
          if ((_b = data.style) == null ? void 0 : _b.fontFamily) {
            const fontFamily = data.style.fontFamily.split(",")[0].replace(/['\"]/g, "").trim();
            const fontWeight = data.style.fontWeight || "400";
            const isBold = fontWeight === "700" || fontWeight === "bold" || fontWeight === "600" || parseInt(fontWeight) >= 600;
            const fontStyle = isBold ? "Bold" : "Regular";
            try {
              yield figma.loadFontAsync({ family: fontFamily, style: fontStyle });
              textNode.fontName = { family: fontFamily, style: fontStyle };
            } catch (e) {
              if (isBold) {
                textNode.fontName = { family: "Inter", style: "Bold" };
              }
            }
          }
          if (((_c = data.style) == null ? void 0 : _c.fontSize) && data.style.fontSize > 0) {
            textNode.fontSize = data.style.fontSize;
          } else {
            textNode.fontSize = 16;
          }
          const textContent = data.text || " ";
          textNode.characters = textContent;
          if (data.width && data.width > 10) {
            textNode.textAutoResize = "HEIGHT";
            textNode.resize(data.width, Math.max(data.height || 20, 20));
          } else {
            textNode.textAutoResize = "WIDTH_AND_HEIGHT";
          }
          if ((_d = data.style) == null ? void 0 : _d.color) {
            textNode.fills = [{ type: "SOLID", color: { r: data.style.color.r, g: data.style.color.g, b: data.style.color.b }, opacity: (_e = data.style.color.a) != null ? _e : 1 }];
          } else {
            textNode.fills = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
          }
          if ((_f = data.style) == null ? void 0 : _f.textAlign) {
            switch (data.style.textAlign) {
              case "center":
                textNode.textAlignHorizontal = "CENTER";
                break;
              case "right":
                textNode.textAlignHorizontal = "RIGHT";
                break;
              case "justify":
                textNode.textAlignHorizontal = "JUSTIFIED";
                break;
              default:
                textNode.textAlignHorizontal = "LEFT";
            }
          }
          if (((_g = data.style) == null ? void 0 : _g.lineHeight) && data.style.lineHeight > 0) {
            textNode.lineHeight = { value: data.style.lineHeight, unit: "PIXELS" };
          }
          if ((_h = data.style) == null ? void 0 : _h.letterSpacing) {
            textNode.letterSpacing = { value: data.style.letterSpacing, unit: "PIXELS" };
          }
          return textNode;
        }
        function fetchImage(url, objectFit) {
          return __async(this, null, function* () {
            try {
              const response = yield fetch(url);
              if (!response.ok) return null;
              const buffer = yield response.arrayBuffer();
              const image = figma.createImage(new Uint8Array(buffer));
              let scaleMode = "FILL";
              if (objectFit === "contain") {
                scaleMode = "FIT";
              } else if (objectFit === "cover") {
                scaleMode = "FILL";
              } else if (objectFit === "none") {
                scaleMode = "CROP";
              }
              return {
                type: "IMAGE",
                imageHash: image.hash,
                scaleMode
              };
            } catch (e) {
              console.error("[ERROR] Image load failed:", url);
              return null;
            }
          });
        }
        if (data.type === "IMAGE") {
          const rect = figma.createRectangle();
          rect.name = data.name || "Image";
          rect.resize(Math.max(1, data.width || 1), Math.max(1, data.height || 1));
          let fills = [{ type: "SOLID", color: { r: 0.85, g: 0.85, b: 0.85 } }];
          if (data.imageSrc) {
            const imagePaint = yield fetchImage(data.imageSrc, (_i = data.style) == null ? void 0 : _i.objectFit);
            if (imagePaint) fills = [imagePaint];
          }
          rect.fills = fills;
          if ((_j = data.style) == null ? void 0 : _j.borderRadius) {
            rect.topLeftRadius = data.style.borderRadius.tl || 0;
            rect.topRightRadius = data.style.borderRadius.tr || 0;
            rect.bottomLeftRadius = data.style.borderRadius.bl || 0;
            rect.bottomRightRadius = data.style.borderRadius.br || 0;
          }
          return rect;
        }
        if (data.type === "SVG" && data.svg) {
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
        if (data.type === "FRAME") {
          const frame = figma.createFrame();
          frame.name = data.name || "Frame";
          const safeW = Math.max(1, data.width || 1);
          const safeH = Math.max(1, data.height || 1);
          frame.resize(safeW, safeH);
          let fills = [];
          if (data.style.backgroundColor) {
            const { r, g, b, a } = data.style.backgroundColor;
            if (a > 0) {
              fills.push({ type: "SOLID", color: { r, g, b }, opacity: a });
            }
          }
          if (data.backgroundImage) {
            const bgImage = yield fetchImage(data.backgroundImage);
            if (bgImage) fills.push(bgImage);
          }
          frame.fills = fills;
          frame.layoutMode = "NONE";
          if (data.style.overflow === "hidden" || data.style.overflow === "scroll" || data.style.overflow === "auto") {
            frame.clipsContent = true;
          }
          if (data.style.borderRadius) {
            frame.topLeftRadius = data.style.borderRadius.tl;
            frame.topRightRadius = data.style.borderRadius.tr;
            frame.bottomLeftRadius = data.style.borderRadius.bl;
            frame.bottomRightRadius = data.style.borderRadius.br;
          }
          if (data.style.border) {
            const maxW = Math.max(
              data.style.border.top.width || 0,
              data.style.border.right.width || 0,
              data.style.border.bottom.width || 0,
              data.style.border.left.width || 0
            );
            if (maxW > 0) {
              const borderColor = data.style.border.top.color || { r: 0, g: 0, b: 0, a: 1 };
              frame.strokes = [{
                type: "SOLID",
                color: { r: borderColor.r, g: borderColor.g, b: borderColor.b },
                opacity: (_k = borderColor.a) != null ? _k : 1
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
          if (typeof data.style.opacity === "number") {
            frame.opacity = data.style.opacity;
          }
          if (data.style.boxShadow) {
            const effects = parseBoxShadow(data.style.boxShadow);
            if (effects.length > 0) {
              frame.effects = effects;
            }
          }
          if (data.style.transform) {
            const transform = data.style.transform;
            if (transform.rotation && transform.rotation !== 0) {
              frame.rotation = transform.rotation;
            }
            if (transform.scaleX || transform.scaleY || transform.translateX || transform.translateY) {
              const transformInfo = [];
              if (transform.translateX) transformInfo.push(`translateX:${transform.translateX.toFixed(1)}px`);
              if (transform.translateY) transformInfo.push(`translateY:${transform.translateY.toFixed(1)}px`);
              if (transform.scaleX && transform.scaleX !== 1) transformInfo.push(`scaleX:${transform.scaleX.toFixed(2)}`);
              if (transform.scaleY && transform.scaleY !== 1) transformInfo.push(`scaleY:${transform.scaleY.toFixed(2)}`);
              if (transformInfo.length > 0) {
                frame.name = `${frame.name} [${transformInfo.join(", ")}]`;
              }
            }
          }
          if (data.style.display === "grid" && data.style.gridTemplateColumns) {
            const gridInfo = [`grid-cols:${data.style.gridTemplateColumns}`];
            if (data.style.gridTemplateRows) gridInfo.push(`grid-rows:${data.style.gridTemplateRows}`);
            if (data.style.gridColumnGap) gridInfo.push(`gap-x:${data.style.gridColumnGap}px`);
            if (data.style.gridRowGap) gridInfo.push(`gap-y:${data.style.gridRowGap}px`);
            frame.name = `${frame.name} [${gridInfo.join(", ")}]`;
          }
          if (data.children && data.children.length > 0) {
            const sortedChildren = [...data.children].sort((a, b) => {
              var _a2, _b2;
              const zIndexA = parseInt(((_a2 = a.style) == null ? void 0 : _a2.zIndex) || "0") || 0;
              const zIndexB = parseInt(((_b2 = b.style) == null ? void 0 : _b2.zIndex) || "0") || 0;
              return zIndexA - zIndexB;
            });
            for (let i = 0; i < sortedChildren.length; i++) {
              const childData = sortedChildren[i];
              const childNode = yield createFigmaNode(childData, depth + 1, offsetX, offsetY);
              if (childNode) {
                frame.appendChild(childNode);
                const relX = childData.x - data.x;
                const relY = childData.y - data.y;
                if (!isNaN(relX) && isFinite(relX)) childNode.x = relX;
                if (!isNaN(relY) && isFinite(relY)) childNode.y = relY;
                if (childData.constraints && "constraints" in childNode) {
                  const constraints = childData.constraints;
                  try {
                    childNode.constraints = {
                      horizontal: constraints.horizontal || "SCALE",
                      vertical: constraints.vertical || "MIN"
                    };
                  } catch (e) {
                  }
                }
              } else if (DEBUG) ;
            }
          }
          return frame;
        }
        return null;
      } catch (e) {
        console.error(`[ERROR] Failed to create node: ${data.type} - ${data.name || ((_l = data.text) == null ? void 0 : _l.substring(0, 20))}`, e);
        return null;
      }
    });
  }
})();
