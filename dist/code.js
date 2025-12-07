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
      const wrapperFrame = figma.createFrame();
      let siteName = "Imported Site";
      try {
        const urlObj = new URL(url);
        siteName = urlObj.hostname.replace(/^www\./, "");
      } catch (e) {
        siteName = url || "Imported Site";
      }
      wrapperFrame.name = siteName;
      const wrapperWidth = Math.max(1, node.width || 1440);
      const wrapperHeight = Math.max(1, node.height || 900);
      wrapperFrame.resize(wrapperWidth, wrapperHeight);
      wrapperFrame.layoutMode = "NONE";
      wrapperFrame.clipsContent = true;
      wrapperFrame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
      const offsetX = node.x || 0;
      const offsetY = node.y || 0;
      const rootFrame = yield createFigmaNode(node, 0, offsetX, offsetY);
      if (rootFrame) {
        wrapperFrame.appendChild(rootFrame);
        rootFrame.x = 0;
        rootFrame.y = 0;
      }
      wrapperFrame.x = 0;
      wrapperFrame.y = 0;
      figma.currentPage.appendChild(wrapperFrame);
      figma.viewport.scrollAndZoomIntoView([wrapperFrame]);
      figma.notify("Import completed!");
    }
  });
  function createFigmaNode(data, depth = 0, offsetX = 0, offsetY = 0) {
    return __async(this, null, function* () {
      var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m;
      if (!data) return null;
      const indent = "  ".repeat(depth);
      console.log(`${indent}[createFigmaNode] type=${data.type} name=${data.name || ((_a = data.text) == null ? void 0 : _a.substring(0, 20))} children=${((_b = data.children) == null ? void 0 : _b.length) || 0}`);
      try {
        if (data.type === "TEXT") {
          const textNode = figma.createText();
          textNode.name = ((_c = data.text) == null ? void 0 : _c.substring(0, 30)) || "Text";
          textNode.fontName = { family: "Inter", style: "Regular" };
          if ((_d = data.style) == null ? void 0 : _d.fontFamily) {
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
          if (((_e = data.style) == null ? void 0 : _e.fontSize) && data.style.fontSize > 0) {
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
          if ((_f = data.style) == null ? void 0 : _f.color) {
            textNode.fills = [{ type: "SOLID", color: { r: data.style.color.r, g: data.style.color.g, b: data.style.color.b }, opacity: (_g = data.style.color.a) != null ? _g : 1 }];
          } else {
            textNode.fills = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
          }
          if ((_h = data.style) == null ? void 0 : _h.textAlign) {
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
          if (((_i = data.style) == null ? void 0 : _i.lineHeight) && data.style.lineHeight > 0) {
            textNode.lineHeight = { value: data.style.lineHeight, unit: "PIXELS" };
          }
          if ((_j = data.style) == null ? void 0 : _j.letterSpacing) {
            textNode.letterSpacing = { value: data.style.letterSpacing, unit: "PIXELS" };
          }
          return textNode;
        }
        function fetchImage(url) {
          return __async(this, null, function* () {
            try {
              const response = yield fetch(url);
              if (!response.ok) return null;
              const buffer = yield response.arrayBuffer();
              const image = figma.createImage(new Uint8Array(buffer));
              return {
                type: "IMAGE",
                imageHash: image.hash,
                scaleMode: "FILL"
              };
            } catch (e) {
              console.log("Image load error:", url);
              return null;
            }
          });
        }
        if (data.type === "IMAGE") {
          const rect = figma.createRectangle();
          rect.name = "Image";
          rect.resize(Math.max(1, data.width || 1), Math.max(1, data.height || 1));
          let fills = [{ type: "SOLID", color: { r: 0.85, g: 0.85, b: 0.85 } }];
          if (data.imageSrc) {
            const imagePaint = yield fetchImage(data.imageSrc);
            if (imagePaint) fills = [imagePaint];
          }
          rect.fills = fills;
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
          if (data.children && data.children.length > 0) {
            console.log(`${indent}  Processing ${data.children.length} children of ${data.name}`);
            for (let i = 0; i < data.children.length; i++) {
              const childData = data.children[i];
              console.log(`${indent}    [${i}] Creating child: ${childData.type} - ${childData.name || ((_l = childData.text) == null ? void 0 : _l.substring(0, 20))}`);
              const childNode = yield createFigmaNode(childData, depth + 1, offsetX, offsetY);
              if (childNode) {
                frame.appendChild(childNode);
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
        console.error(`${indent}[ERROR] Failed to create node: ${data.type} - ${data.name || ((_m = data.text) == null ? void 0 : _m.substring(0, 20))}`, e);
        return null;
      }
    });
  }
})();
