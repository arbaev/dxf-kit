import { useMemo, useState, type KeyboardEvent } from "react";
import { groupLayersByPrefix } from "dxf-render";
import type { GroupLayersByPrefixOptions, LayerGroup } from "dxf-render";
import type { LayerState } from "../hooks/useLayers";
import { cx } from "../utils/classNames";
import "./LayerPanel.css";

export interface LayerPanelProps {
  layers: LayerState[];
  darkTheme?: boolean;
  /** Extra class name merged onto the `.dxfk-layer-panel` root. */
  className?: string;
  /**
   * Group layers by name prefix (`A-WALL`, `A-DOOR` → group `A`).
   * `false` (default) renders the existing flat list.
   * `true` enables grouping with utility defaults (`separator: /[-_]/`, `minGroupSize: 2`).
   * An options object overrides those defaults.
   */
  groupLayers?: boolean | GroupLayersByPrefixOptions;
  onToggleLayer?: (layerName: string) => void;
  onShowAll?: () => void;
  onHideAll?: () => void;
  onLayerHover?: (layerName: string | null) => void;
}

const EyeIcon = (
  <svg className="dxfk-layer-icon-eye" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = (
  <svg className="dxfk-layer-icon-eye dxfk-layer-icon-eye--off" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const FrozenIcon = (
  <svg className="dxfk-layer-icon-frozen" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="2" x2="12" y2="22" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    <line x1="19.07" y1="4.93" x2="4.93" y2="19.07" />
    <line x1="12" y1="2" x2="9" y2="5" />
    <line x1="12" y1="2" x2="15" y2="5" />
    <line x1="12" y1="22" x2="9" y2="19" />
    <line x1="12" y1="22" x2="15" y2="19" />
  </svg>
);

const LockIcon = (
  <svg className="dxfk-layer-icon-lock" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

type GroupVisState = "all-visible" | "all-hidden" | "mixed" | "all-frozen";

function getGroupVisState(group: LayerGroup<LayerState>): GroupVisState {
  const toggleable = group.layers.filter((l) => !l.frozen);
  if (toggleable.length === 0) return "all-frozen";
  let visible = 0;
  for (const l of toggleable) if (l.visible) visible++;
  if (visible === 0) return "all-hidden";
  if (visible === toggleable.length) return "all-visible";
  return "mixed";
}

function getGroupVisibleCount(group: LayerGroup<LayerState>): number {
  let n = 0;
  for (const l of group.layers) if (l.visible && !l.frozen) n++;
  return n;
}

function getGroupTotalEntities(group: LayerGroup<LayerState>): number {
  let n = 0;
  for (const l of group.layers) n += l.entityCount;
  return n;
}

const GroupToggleIcon = ({ state }: { state: GroupVisState }) => {
  if (state === "mixed") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <path d="M12 4v16" strokeWidth="1.5" />
        <path d="M12 5a7 7 0 0 1 0 14z" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  if (state === "all-hidden") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
};

interface LayerItemProps {
  layer: LayerState;
  inGroup?: boolean;
  onToggleLayer?: (layerName: string) => void;
  onLayerHover?: (layerName: string | null) => void;
}

function LayerItem({ layer, inGroup, onToggleLayer, onLayerHover }: LayerItemProps) {
  const toggle = () => {
    if (!layer.frozen) onToggleLayer?.(layer.name);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle();
    }
  };
  return (
    <div
      className={cx(
        "dxfk-layer-item",
        inGroup && "dxfk-layer-item--in-group",
        !layer.visible && "dxfk-layer-item--hidden",
        layer.frozen && "dxfk-layer-item--frozen",
      )}
      role="button"
      tabIndex={layer.frozen ? -1 : 0}
      aria-pressed={layer.visible}
      aria-disabled={layer.frozen}
      aria-label={`Toggle visibility of layer ${layer.name}`}
      onClick={toggle}
      onKeyDown={onKeyDown}
      onMouseEnter={() => {
        if (!layer.frozen) onLayerHover?.(layer.name);
      }}
      onMouseLeave={() => {
        if (!layer.frozen) onLayerHover?.(null);
      }}
    >
      {layer.frozen ? FrozenIcon : layer.visible ? EyeIcon : EyeOffIcon}
      {layer.locked && !layer.frozen && LockIcon}
      <span className="dxfk-layer-swatch" style={{ backgroundColor: layer.color }} />
      <span className="dxfk-layer-name" title={layer.name}>
        {layer.name}
      </span>
      <span className="dxfk-layer-count">{layer.entityCount}</span>
    </div>
  );
}

export function LayerPanel({
  layers,
  darkTheme = false,
  className,
  groupLayers = false,
  onToggleLayer,
  onShowAll,
  onHideAll,
  onLayerHover,
}: LayerPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [filter, setFilter] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const filteredLayers = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return layers;
    return layers.filter((l) => l.name.toLowerCase().includes(q));
  }, [layers, filter]);

  const groupingOptions = useMemo<GroupLayersByPrefixOptions | null>(() => {
    if (!groupLayers) return null;
    return typeof groupLayers === "object" ? groupLayers : {};
  }, [groupLayers]);

  const groups = useMemo<LayerGroup<LayerState>[] | null>(() => {
    if (!groupingOptions) return null;
    return groupLayersByPrefix(filteredLayers, groupingOptions);
  }, [groupingOptions, filteredLayers]);

  const realGroups = useMemo<LayerGroup<LayerState>[]>(
    () => groups?.filter((g) => g.prefix !== "") ?? [],
    [groups],
  );

  const ungroupedLayers = useMemo<LayerState[]>(
    () => groups?.find((g) => g.prefix === "")?.layers ?? [],
    [groups],
  );

  const isGroupExpanded = (prefix: string): boolean => !collapsedGroups[prefix];

  const toggleGroupCollapse = (prefix: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [prefix]: !prev[prefix] }));
  };

  const handleGroupToggle = (group: LayerGroup<LayerState>) => {
    const state = getGroupVisState(group);
    if (state === "all-frozen") return;
    const shouldShow = state === "all-hidden";
    for (const l of group.layers) {
      if (l.frozen) continue;
      if (l.visible !== shouldShow) {
        onToggleLayer?.(l.name);
      }
    }
  };

  const onHeaderKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setIsExpanded((v) => !v);
    }
  };

  return (
    <div
      className={cx(
        "dxfk-layer-panel",
        !isExpanded && "dxfk-layer-panel--collapsed",
        darkTheme && "dxfk-dark",
        className,
      )}
      role="region"
      aria-label="Layer visibility panel"
    >
      <div
        className="dxfk-layer-panel-header"
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-label={isExpanded ? "Collapse layer panel" : "Expand layer panel"}
        onClick={() => setIsExpanded((v) => !v)}
        onKeyDown={onHeaderKeyDown}
      >
        <span className="dxfk-layer-panel-title">Layers ({layers.length})</span>
        <button
          className="dxfk-layer-panel-collapse"
          title={isExpanded ? "Collapse" : "Expand"}
          aria-label={isExpanded ? "Collapse" : "Expand"}
          tabIndex={-1}
        >
          {isExpanded ? "−" : "+"}
        </button>
      </div>

      {isExpanded && (
        <div className="dxfk-layer-panel-body">
          <div className="dxfk-layer-panel-actions">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onShowAll?.();
              }}
              className="dxfk-layer-panel-action"
              aria-label="Show all layers"
            >
              All
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onHideAll?.();
              }}
              className="dxfk-layer-panel-action"
              aria-label="Hide all layers"
            >
              None
            </button>
          </div>

          {layers.length > 5 && (
            <div className="dxfk-layer-filter-wrapper">
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                type="text"
                className="dxfk-layer-filter"
                placeholder="Filter layers…"
                aria-label="Filter layers by name"
                onClick={(e) => e.stopPropagation()}
              />
              {filter && (
                <button
                  className="dxfk-layer-filter-clear"
                  aria-label="Clear filter"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFilter("");
                  }}
                >
                  ×
                </button>
              )}
            </div>
          )}

          <div className="dxfk-layer-list">
            {filteredLayers.length === 0 && (
              <div className="dxfk-layer-empty">No layers match "{filter}"</div>
            )}

            {groups ? (
              <>
                {realGroups.map((group) => {
                  const expanded = isGroupExpanded(group.prefix);
                  const visState = getGroupVisState(group);
                  return (
                    <div
                      key={`g:${group.prefix}`}
                      className={cx("dxfk-layer-group", !expanded && "dxfk-layer-group--collapsed")}
                      role="group"
                      aria-label={`Layer group ${group.prefix}`}
                    >
                      <div
                        className="dxfk-layer-group-header"
                        role="button"
                        tabIndex={0}
                        aria-expanded={expanded}
                        aria-label={expanded ? `Collapse group ${group.prefix}` : `Expand group ${group.prefix}`}
                        onClick={() => toggleGroupCollapse(group.prefix)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggleGroupCollapse(group.prefix);
                          }
                        }}
                      >
                        <button
                          className="dxfk-layer-group-collapse"
                          tabIndex={-1}
                          title={expanded ? "Collapse" : "Expand"}
                          aria-label={expanded ? "Collapse" : "Expand"}
                        >
                          {expanded ? "−" : "+"}
                        </button>
                        <span className="dxfk-layer-group-name" title={group.prefix}>
                          {group.prefix}
                        </span>
                        <span className="dxfk-layer-group-count">
                          {getGroupVisibleCount(group)} / {group.layers.length} ·{" "}
                          {getGroupTotalEntities(group)}
                        </span>
                        <button
                          className={cx(
                            "dxfk-layer-group-toggle",
                            `dxfk-layer-group-toggle--${visState}`,
                          )}
                          disabled={visState === "all-frozen"}
                          aria-pressed={visState !== "all-hidden"}
                          aria-disabled={visState === "all-frozen"}
                          aria-label={`Toggle visibility of group ${group.prefix}`}
                          title={visState === "all-hidden" ? "Show all in group" : "Hide all in group"}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleGroupToggle(group);
                          }}
                        >
                          <GroupToggleIcon state={visState} />
                        </button>
                      </div>

                      {expanded && (
                        <div className="dxfk-layer-group-body">
                          {group.layers.map((layer) => (
                            <LayerItem
                              key={layer.name}
                              layer={layer}
                              inGroup
                              onToggleLayer={onToggleLayer}
                              onLayerHover={onLayerHover}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {ungroupedLayers.map((layer) => (
                  <LayerItem
                    key={`u:${layer.name}`}
                    layer={layer}
                    onToggleLayer={onToggleLayer}
                    onLayerHover={onLayerHover}
                  />
                ))}
              </>
            ) : (
              filteredLayers.map((layer) => (
                <LayerItem
                  key={layer.name}
                  layer={layer}
                  onToggleLayer={onToggleLayer}
                  onLayerHover={onLayerHover}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
