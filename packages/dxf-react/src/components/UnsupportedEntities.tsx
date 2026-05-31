import { useState } from "react";
import "./UnsupportedEntities.css";

export interface UnsupportedEntitiesProps {
  entities: string[];
}

/**
 * Collapsible amber warning panel listing entity types that could not be
 * rendered. Renders nothing when `entities` is empty.
 */
export function UnsupportedEntities({ entities }: UnsupportedEntitiesProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (entities.length === 0) return null;

  return (
    <div className="dxfk-unsupported">
      <div className="dxfk-unsupported-header">
        <svg className="dxfk-unsupported-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="14" />
          <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
        </svg>
        <span className="dxfk-unsupported-title">Unsupported Elements ({entities.length})</span>
        <button className="dxfk-unsupported-toggle" onClick={() => setIsExpanded((v) => !v)}>
          {isExpanded ? "Hide" : "Show"}
        </button>
      </div>

      {isExpanded && (
        <div className="dxfk-unsupported-list">
          {entities.map((entity, index) => (
            <div key={index} className="dxfk-unsupported-item">
              <span className="dxfk-unsupported-bullet">&#8226;</span>
              <span className="dxfk-unsupported-text">{entity}</span>
            </div>
          ))}
        </div>
      )}

      <div className="dxfk-unsupported-footer">
        <span className="dxfk-unsupported-note">
          &#8505;&#65039; These elements will not be displayed on the drawing
        </span>
      </div>
    </div>
  );
}
