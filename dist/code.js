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
      yield figma.loadFontAsync({ family: "Inter", style: "Regular" });
      yield figma.loadFontAsync({ family: "Inter", style: "Bold" });
      const rootFrame = yield createFigmaNode(node);
      if (rootFrame) {
        figma.currentPage.appendChild(rootFrame);
        figma.viewport.scrollAndZoomIntoView([rootFrame]);
        figma.notify("Import completed!");
      } else {
        figma.notify("Nothing valid imported.");
      }
    }
  });
  function createFigmaNode(data) {
    return __async(this, null, function* () {
      if (!data) return null;
      if (data.type === "TEXT") {
        const textNode = figma.createText();
        textNode.characters = data.text || "";
        textNode.resize(data.width, data.height);
        if (data.style) {
          if (data.style.fontSize) textNode.fontSize = data.style.fontSize;
          if (data.style.color) textNode.fills = [{ type: "SOLID", color: data.style.color, opacity: data.style.color.a }];
          const style = data.style.fontWeight === "700" || data.style.fontWeight === "bold" ? "Bold" : "Regular";
          let family = "Inter";
          if (data.style.fontFamily) {
            family = data.style.fontFamily.split(",")[0].replace(/['"]/g, "").trim();
          }
          const targetFont = { family, style };
          try {
            yield figma.loadFontAsync(targetFont);
            textNode.fontName = targetFont;
          } catch (e) {
            textNode.fontName = { family: "Inter", style };
          }
          if (data.style.textAlign) {
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
            }
          }
          if (data.style.lineHeight) {
            textNode.lineHeight = { value: data.style.lineHeight, unit: "PIXELS" };
          }
          if (data.style.letterSpacing) {
            textNode.letterSpacing = { value: data.style.letterSpacing, unit: "PIXELS" };
          }
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
        rect.resize(data.width, data.height);
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
          svgNode.resize(data.width, data.height);
          return svgNode;
        } catch (e) {
          console.error("Failed to create SVG", e);
          return null;
        }
      }
      if (data.type === "FRAME") {
        const frame = figma.createFrame();
        frame.name = data.name;
        const safeW = Math.max(0.01, data.width);
        const safeH = Math.max(0.01, data.height);
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
        if (data.style.position === "absolute" || data.style.position === "fixed") {
          frame.layoutPositioning = "ABSOLUTE";
        }
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
            data.style.border.top.width,
            data.style.border.right.width,
            data.style.border.bottom.width,
            data.style.border.left.width
          );
          if (maxW > 0) {
            const borderColor = data.style.border.top.color || { r: 0, g: 0, b: 0, a: 1 };
            frame.strokes = [{ type: "SOLID", color: borderColor, opacity: borderColor.a }];
            frame.strokeWeight = maxW;
            if (data.style.border.top.width !== data.style.border.bottom.width) {
              frame.strokeTopWeight = data.style.border.top.width;
              frame.strokeBottomWeight = data.style.border.bottom.width;
              frame.strokeLeftWeight = data.style.border.left.width;
              frame.strokeRightWeight = data.style.border.right.width;
            }
          }
        }
        if (data.style.overflow === "hidden" || data.style.overflow === "scroll" || data.style.overflow === "auto") {
          frame.clipsContent = true;
        }
        if (typeof data.style.opacity === "number") {
          frame.opacity = data.style.opacity;
        }
        if (data.children) {
          for (const childData of data.children) {
            const childNode = yield createFigmaNode(childData);
            if (childNode) {
              frame.appendChild(childNode);
              const childIsAbsolute = "layoutPositioning" in childNode && childNode.layoutPositioning === "ABSOLUTE";
              if (frame.layoutMode === "NONE" || childIsAbsolute) {
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
    });
  }
})();
