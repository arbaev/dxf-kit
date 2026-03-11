import { useState } from "react";
import { DxfViewer } from "./DxfViewer";

export function App() {
  const [dxfText, setDxfText] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setDxfText(reader.result as string);
    reader.readAsText(file);
  }

  return (
    <div style={{ fontFamily: "system-ui, sans-serif" }}>
      <div style={{ padding: 16, display: "flex", gap: 12, alignItems: "center" }}>
        <label
          style={{
            padding: "8px 16px",
            background: "#fff",
            border: "1px solid #ccc",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          Open DXF file
          <input type="file" accept=".dxf" onChange={handleFile} hidden />
        </label>
        {fileName && <span style={{ fontSize: 14, color: "#666" }}>{fileName}</span>}
      </div>

      {dxfText ? (
        <DxfViewer dxfText={dxfText} />
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "calc(100vh - 60px)",
            color: "#999",
            fontSize: 18,
          }}
        >
          Select a .dxf file to render
        </div>
      )}
    </div>
  );
}
