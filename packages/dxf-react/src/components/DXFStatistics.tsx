import { useMemo } from "react";
import type { DxfStatistics } from "dxf-render";
import "./DXFStatistics.css";

export interface DXFStatisticsProps {
  statistics: DxfStatistics;
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export function DXFStatistics({ statistics }: DXFStatisticsProps) {
  const sortedEntitiesByType = useMemo(() => {
    const entries = Object.entries(statistics.entitiesByType);
    entries.sort((a, b) => b[1] - a[1]);
    return entries;
  }, [statistics.entitiesByType]);

  return (
    <div className="dxfk-statistics">
      <h3 className="dxfk-statistics-title">File Statistics</h3>

      <div className="dxfk-statistics-grid">
        <div className="dxfk-statistics-section">
          <h4 className="dxfk-statistics-section-title">General</h4>
          <div className="dxfk-statistics-item">
            <span className="dxfk-statistics-label">File Size:</span>
            <span className="dxfk-statistics-value">{formatFileSize(statistics.fileSize)}</span>
          </div>
          {statistics.autocadVersion && (
            <div className="dxfk-statistics-item">
              <span className="dxfk-statistics-label">AutoCAD Version:</span>
              <span className="dxfk-statistics-value">{statistics.autocadVersion}</span>
            </div>
          )}
        </div>

        <div className="dxfk-statistics-section">
          <h4 className="dxfk-statistics-section-title">Entities</h4>
          <div className="dxfk-statistics-item">
            <span className="dxfk-statistics-label">Total Entities:</span>
            <span className="dxfk-statistics-value dxfk-statistics-value--highlight">
              {statistics.totalEntities}
            </span>
          </div>
          {sortedEntitiesByType.map(([type, count]) => (
            <div key={type} className="dxfk-statistics-item dxfk-statistics-item--entity-type">
              <span className="dxfk-statistics-label">{type}:</span>
              <span className="dxfk-statistics-value">{count}</span>
            </div>
          ))}
        </div>

        <div className="dxfk-statistics-section">
          <h4 className="dxfk-statistics-section-title">Structure</h4>
          <div className="dxfk-statistics-item">
            <span className="dxfk-statistics-label">Layers:</span>
            <span className="dxfk-statistics-value">{statistics.layersCount}</span>
          </div>
          <div className="dxfk-statistics-item">
            <span className="dxfk-statistics-label">Blocks:</span>
            <span className="dxfk-statistics-value">{statistics.blocksCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
