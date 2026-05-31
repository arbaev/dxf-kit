import { useRef, useState, type ChangeEvent, type CSSProperties } from "react";
import { DXFViewer, type DXFViewerHandle, type MeasureMode } from "dxf-react";
import "dxf-react/style.css";

const checkbox = (label: string, value: boolean, set: (v: boolean) => void) => (
  <label style={{ fontSize: 14, display: "inline-flex", gap: 4, alignItems: "center" }}>
    <input type="checkbox" checked={value} onChange={(e) => set(e.target.checked)} />
    {label}
  </label>
);

// Framework switcher matching the Vue demo's hero pills (React active here).
const switchBox: CSSProperties = {
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
const pill = (active: boolean): CSSProperties => ({
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
  const viewerRef = useRef<DXFViewerHandle>(null);
  const [fileName, setFileName] = useState("");
  const [darkTheme, setDarkTheme] = useState(false);
  const [pickingEnabled, setPickingEnabled] = useState(true);
  const [showRulers, setShowRulers] = useState(true);
  const [showProperties, setShowProperties] = useState(true);
  const [measureMode, setMeasureMode] = useState<MeasureMode>("none");

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => viewerRef.current?.loadDXFFromText(reader.result as string);
    reader.readAsText(file);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", fontFamily: "system-ui, sans-serif" }}>
      <div
        style={{
          padding: "8px 12px",
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
          borderBottom: "1px solid #eee",
        }}
      >
        <div style={switchBox} role="group" aria-label="Choose framework wrapper">
          <a href={vueHref} style={pill(false)}>
            Vue 3
          </a>
          <span style={pill(true)} aria-current="page">
            React
          </span>
        </div>
        <span style={{ fontSize: 13, color: "#666" }}>
          Minimal demo of <strong>dxf-react</strong> — every <code>dxf-vuer</code> feature is
          available (it's a 1:1 port).
        </span>
      </div>

      <div style={{ padding: 12, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", borderBottom: "1px solid #e0e0e0" }}>
        <label
          style={{
            padding: "8px 16px",
            background: "#1040b0",
            color: "#fff",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          Open DXF file
          <input type="file" accept=".dxf" onChange={handleFile} hidden />
        </label>
        {fileName && <span style={{ fontSize: 14, color: "#666" }}>{fileName}</span>}
        {checkbox("Dark", darkTheme, setDarkTheme)}
        {checkbox("Picking", pickingEnabled, setPickingEnabled)}
        {checkbox("Rulers", showRulers, setShowRulers)}
        {checkbox("Properties", showProperties, setShowProperties)}
        <span style={{ fontSize: 14, color: "#999" }}>measureMode: {measureMode}</span>
      </div>

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <DXFViewer
          ref={viewerRef}
          fileName={fileName}
          darkTheme={darkTheme}
          pickingEnabled={pickingEnabled}
          rectangleSelection
          showRulers={showRulers}
          showCoordinates
          showZoomLevel
          showPropertiesPanel={showProperties}
          showResetButton
          showExportButton
          showMeasureButton
          showMeasureAreaButton
          showMeasureAngleButton
          allowDrop
          measureMode={measureMode}
          onMeasureModeChange={setMeasureMode}
          onEntityClick={(e) => console.log("entity-click", e.type, e.handle)}
          onEntitiesSelect={(events) => console.log("entities-select", events.length)}
          onMeasure={(r) => console.log("measure", r.value, r.units)}
        />
      </div>
    </div>
  );
}
