import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef, useState } from "react";
import { DXFViewer } from "dxf-react";
import "dxf-react/style.css";
const checkbox = (label, value, set) => (_jsxs("label", { style: { fontSize: 14, display: "inline-flex", gap: 4, alignItems: "center" }, children: [_jsx("input", { type: "checkbox", checked: value, onChange: (e) => set(e.target.checked) }), label] }));
// Framework switcher matching the Vue demo's hero pills (React active here).
const switchBox = {
    display: "inline-flex",
    gap: 2,
    padding: 3,
    borderRadius: 999,
    background: "#f0f4ff",
    fontFamily: '"SF Mono", "Fira Code", monospace',
    fontSize: 13,
    fontWeight: 600,
    flexShrink: 0,
};
const pill = (active) => ({
    padding: "3px 14px",
    borderRadius: 999,
    color: active ? "#fff" : "#1040b0",
    background: active ? "#1040b0" : "transparent",
    textDecoration: "none",
});
// In production both demos share one deploy → relative /. In dev they are
// separate Vite servers (React 5174, Vue 5173), so point at the Vue dev port.
const vueHref = import.meta.env.DEV ? "http://localhost:5173/" : "/";
export function App() {
    const viewerRef = useRef(null);
    const [fileName, setFileName] = useState("");
    const [darkTheme, setDarkTheme] = useState(false);
    const [pickingEnabled, setPickingEnabled] = useState(true);
    const [showRulers, setShowRulers] = useState(true);
    const [showProperties, setShowProperties] = useState(true);
    const [measureMode, setMeasureMode] = useState("none");
    function handleFile(e) {
        const file = e.target.files?.[0];
        if (!file)
            return;
        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = () => viewerRef.current?.loadDXFFromText(reader.result);
        reader.readAsText(file);
    }
    return (_jsxs("div", { style: { display: "flex", flexDirection: "column", height: "100vh", fontFamily: "system-ui, sans-serif" }, children: [_jsxs("div", { style: {
                    padding: "8px 12px",
                    display: "flex",
                    gap: 12,
                    alignItems: "center",
                    flexWrap: "wrap",
                    borderBottom: "1px solid #eee",
                }, children: [_jsxs("div", { style: switchBox, role: "group", "aria-label": "Choose framework wrapper", children: [_jsx("a", { href: vueHref, style: pill(false), children: "Vue 3" }), _jsx("span", { style: pill(true), "aria-current": "page", children: "React" })] }), _jsxs("span", { style: { fontSize: 13, color: "#666" }, children: ["Minimal demo of ", _jsx("strong", { children: "dxf-react" }), " \u2014 every ", _jsx("code", { children: "dxf-vuer" }), " feature is available (it's a 1:1 port)."] })] }), _jsxs("div", { style: { padding: 12, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", borderBottom: "1px solid #e0e0e0" }, children: [_jsxs("label", { style: {
                            padding: "8px 16px",
                            background: "#1040b0",
                            color: "#fff",
                            borderRadius: 6,
                            cursor: "pointer",
                            fontSize: 14,
                        }, children: ["Open DXF file", _jsx("input", { type: "file", accept: ".dxf", onChange: handleFile, hidden: true })] }), fileName && _jsx("span", { style: { fontSize: 14, color: "#666" }, children: fileName }), checkbox("Dark", darkTheme, setDarkTheme), checkbox("Picking", pickingEnabled, setPickingEnabled), checkbox("Rulers", showRulers, setShowRulers), checkbox("Properties", showProperties, setShowProperties), _jsxs("span", { style: { fontSize: 14, color: "#999" }, children: ["measureMode: ", measureMode] })] }), _jsx("div", { style: { flex: 1, display: "flex", minHeight: 0 }, children: _jsx(DXFViewer, { ref: viewerRef, fileName: fileName, darkTheme: darkTheme, pickingEnabled: pickingEnabled, rectangleSelection: true, showRulers: showRulers, showCoordinates: true, showZoomLevel: true, showPropertiesPanel: showProperties, showResetButton: true, showExportButton: true, showMeasureButton: true, showMeasureAreaButton: true, showMeasureAngleButton: true, allowDrop: true, measureMode: measureMode, onMeasureModeChange: setMeasureMode, onEntityClick: (e) => console.log("entity-click", e.type, e.handle), onEntitiesSelect: (events) => console.log("entities-select", events.length), onMeasure: (r) => console.log("measure", r.value, r.units) }) })] }));
}
