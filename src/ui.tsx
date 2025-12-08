import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './ui.css';

const App = () => {
    const [url, setUrl] = useState('');
    // Webhook URL is now hardcoded - no need to enter it each time
    const webhookUrl = 'https://n8n.tinepsi.com/webhook/html-to-figma';
    const [loading, setLoading] = useState(false);
    const [simplifyLayers, setSimplifyLayers] = useState(true); // Simplify by default


    // Shared type definition - Matching what Extraction Script output
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

    const handleImport = async () => {
        if (!url) return;
        setLoading(true);

        try {
            // Send request to n8n via Proxy to avoid CORS errors (Figma runs on origin 'null')
            // We use corsproxy.io to wrap the POST request.
            const proxyPrefix = "https://corsproxy.io/?";
            const targetUrl = proxyPrefix + encodeURIComponent(webhookUrl);

            const response = await fetch(targetUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: url })
            });

            if (!response.ok) throw new Error(`Webhook failed: ${response.status}`);

            const data = await response.json();

            // Handle n8n returning an array (common) vs object
            const rootNode = Array.isArray(data) ? data[0] : (data.result || data);

            parent.postMessage({ pluginMessage: { type: 'import-html', payload: { url, node: rootNode, simplifyLayers } } }, '*');
            setLoading(false);

        } catch (error) {
            console.error(error);
            alert("Import failed: " + error);
            setLoading(false);
        }
    };

    return (
        <div className="container">
            <h2>HTML to Figma</h2>
            <div className="input-group">
                <label>Website URL</label>
                <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com"
                />
            </div>

            <div className="input-group checkbox-group">
                <label>
                    <input
                        type="checkbox"
                        checked={simplifyLayers}
                        onChange={(e) => setSimplifyLayers(e.target.checked)}
                    />
                    Simplify layers (recommandé)
                </label>
                <small>Fusionne les conteneurs inutiles et réduit le nombre de calques</small>
            </div>

            <button onClick={handleImport} disabled={loading}>
                {loading ? 'Processing on Server...' : 'Import to Figma'}
            </button>
            <div className="note">
                <p>Desktop 1800px • Powered by n8n + Puppeteer</p>
            </div>
        </div>
    );
};



const root = createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);
