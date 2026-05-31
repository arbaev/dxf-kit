import { useMemo, useState, type KeyboardEvent } from "react";
import type { PickingEvent } from "../hooks/usePicking";
import { getEntityProperties, type PropertySection } from "../utils/entityProperties";
import { cx } from "../utils/classNames";
import "./PropertiesPanel.css";

export interface PropertiesPanelProps {
  /** Picking event of the currently selected entity, or null when nothing is selected. */
  event?: PickingEvent | null;
  darkTheme?: boolean;
  /** Extra class merged onto the `.dxfk-properties-panel` root. */
  className?: string;
}

export function PropertiesPanel({ event = null, darkTheme = false, className }: PropertiesPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const sections = useMemo<PropertySection[]>(() => {
    if (!event?.entity) return [];
    return getEntityProperties(event.entity);
  }, [event]);

  const onHeaderKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setIsExpanded((v) => !v);
    }
  };

  return (
    <div
      className={cx(
        "dxfk-properties-panel",
        !isExpanded && "dxfk-properties-panel--collapsed",
        darkTheme && "dxfk-dark",
        className,
      )}
      role="region"
      aria-label="Entity properties panel"
    >
      <div
        className="dxfk-properties-panel-header"
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-label={isExpanded ? "Collapse properties panel" : "Expand properties panel"}
        onClick={() => setIsExpanded((v) => !v)}
        onKeyDown={onHeaderKeyDown}
      >
        <span className="dxfk-properties-panel-title">
          Properties
          {event && (
            <>
              : <code className="dxfk-properties-panel-type">{event.type}</code>
            </>
          )}
        </span>
        <button
          className="dxfk-properties-panel-collapse"
          title={isExpanded ? "Collapse" : "Expand"}
          aria-label={isExpanded ? "Collapse" : "Expand"}
          tabIndex={-1}
        >
          {isExpanded ? "−" : "+"}
        </button>
      </div>

      {isExpanded && (
        <div className="dxfk-properties-panel-body">
          {!event ? (
            <div className="dxfk-properties-empty">Click an entity to inspect its properties.</div>
          ) : (
            sections.map((section) => (
              <div key={section.title} className="dxfk-properties-section">
                <h4 className="dxfk-properties-section-title">{section.title}</h4>
                {section.rows.map((row) => (
                  <div key={row.label} className="dxfk-properties-row">
                    <span className="dxfk-properties-label">{row.label}</span>
                    <span className="dxfk-properties-value-wrap">
                      {row.swatch && (
                        <span
                          className="dxfk-properties-swatch"
                          style={{ backgroundColor: row.swatch }}
                          aria-hidden="true"
                        />
                      )}
                      <span
                        className={cx("dxfk-properties-value", row.mono && "dxfk-properties-value--mono")}
                        title={row.value}
                      >
                        {row.value}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
