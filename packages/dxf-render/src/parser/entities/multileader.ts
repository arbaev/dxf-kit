import type DxfScanner from "../scanner";
import type { IGroup } from "../scanner";
import * as helpers from "../parseHelpers";
import type { IPoint, IEntityBase } from "../parseHelpers";

interface IMLeaderLine {
  vertices: IPoint[];
}

interface IMLeaderBranch {
  lines: IMLeaderLine[];
  lastLeaderPoint?: IPoint;
  doglegVector?: IPoint;
  doglegLength?: number;
}

export interface IMLeaderEntity extends IEntityBase {
  type: "MULTILEADER";
  leaders: IMLeaderBranch[];
  text?: string;
  textPosition?: IPoint;
  textHeight?: number;
  arrowSize?: number;
  hasArrowHead?: boolean;
  /** Entity-level LeaderLineType (code 170): 0=invisible, 1=straight, 2=spline. */
  leaderLineType?: number;
  /** Entity-level MLEADERSTYLE handle (code 340, after CONTEXT_DATA closes). */
  styleHandle?: string;
  /** Entity-level PropertyOverrideFlag (code 90, after CONTEXT_DATA closes). */
  propertyOverrideFlag?: number;
  /** Entity-level LeaderLineColor raw CmEntityColor (code 91, after CONTEXT_DATA closes). */
  leaderLineColorRaw?: number;
  /** CONTEXT_DATA TextColor raw CmEntityColor (code 90 inside CONTEXT_DATA, top scope). */
  textColorRaw?: number;
}

/**
 * CONTEXT_DATA nesting in MLEADER uses paired open/close codes per level:
 *   300 = "CONTEXT_DATA{"   301 = "}"            (context block)
 *   302 = "LEADER{"         303 = "}"            (per-leader subsection)
 *   304 = "LEADER_LINE{"    305 = "}"            (per-line subsection)
 * Code 304 is overloaded: it carries the MText content when the value is
 * not the literal "LEADER_LINE{" marker.
 *
 * Several DXF group codes are reused at different scopes inside MLEADER and
 * mean different things — we track `inContextData` / `inLeader` / `inLeaderLine`
 * so the same code dispatches correctly:
 *   - code 40  : ContentScale (CONTEXT_DATA top), DoglegLength (inside LEADER)
 *   - code 41  : TextHeight (CONTEXT_DATA top), DoglegLength (entity-level)
 *   - code 42  : various (CONTEXT_DATA top), ArrowHeadSize (entity-level)
 *   - code 90  : TextColor (CONTEXT_DATA top, raw CmEntityColor),
 *               LeaderBranchIndex (inside LEADER, ignored),
 *               PropertyOverrideFlag (entity-level)
 *   - code 91  : LeaderLineColor (entity-level, raw CmEntityColor);
 *               TextBackgroundColor (CONTEXT_DATA top, not yet supported);
 *               LeaderLineIndex (inside LEADER_LINE, ignored)
 *   - code 140 : LandingGap (CONTEXT_DATA top — not text height!)
 *   - code 170 : LeaderLineType (entity-level only — 0/1/2)
 *   - code 340 : LeaderStyleId / styleHandle (entity-level);
 *               TextStyleId (CONTEXT_DATA top, ignored)
 * Inside LEADER_LINE: code 10/20/30 = vertices.
 * Inside LEADER (before LEADER_LINE): code 10/20/30 = lastLeaderPoint,
 * code 11/21/31 = doglegVector.
 * At CONTEXT_DATA top: code 12/22/32 = textPosition.
 */
export function parseMultiLeader(scanner: DxfScanner, curr: IGroup): IMLeaderEntity {
  const entity: IMLeaderEntity = {
    type: "MULTILEADER",
    leaders: [],
    hasArrowHead: true,
  };

  curr = scanner.next();

  let inContextData = false;
  let inLeader = false;
  let inLeaderLine = false;
  let currentLeader: IMLeaderBranch | null = null;
  let currentLine: IMLeaderLine | null = null;

  while (!scanner.isEOF()) {
    if (curr.code === 0) break;

    switch (curr.code) {
      case 300:
        inContextData = true;
        break;
      case 301:
        // "}" closing CONTEXT_DATA.
        inContextData = false;
        break;
      case 302: {
        if ((curr.value as string) === "LEADER{") {
          inLeader = true;
          currentLeader = { lines: [] };
        }
        break;
      }
      case 303: {
        // "}" closing LEADER subsection.
        if (inLeader && currentLeader) {
          if (currentLeader.lines.length > 0) {
            entity.leaders.push(currentLeader);
          }
          currentLeader = null;
          inLeader = false;
        }
        break;
      }
      case 304: {
        const val = curr.value as string;
        if (val === "LEADER_LINE{") {
          inLeaderLine = true;
          currentLine = { vertices: [] };
        } else if (!inLeader) {
          // Outside LEADER, code 304 is the MText content of the multileader.
          entity.text = val;
        }
        break;
      }
      case 305: {
        // "}" closing LEADER_LINE subsection.
        if (inLeaderLine && currentLine) {
          if (currentLeader && currentLine.vertices.length > 0) {
            currentLeader.lines.push(currentLine);
          }
          currentLine = null;
          inLeaderLine = false;
        }
        break;
      }

      case 10:
        if (inLeaderLine && currentLine) {
          currentLine.vertices.push(helpers.parsePoint(scanner));
        } else if (inLeader && currentLeader) {
          currentLeader.lastLeaderPoint = helpers.parsePoint(scanner);
        }
        break;
      case 11:
        if (inLeader && currentLeader && !inLeaderLine) {
          currentLeader.doglegVector = helpers.parsePoint(scanner);
        }
        break;
      case 12:
        if (inContextData && !inLeader) {
          entity.textPosition = helpers.parsePoint(scanner);
        }
        break;

      case 40:
        if (inLeader && currentLeader && !inLeaderLine) {
          currentLeader.doglegLength = curr.value as number;
        }
        // Outside LEADER: code 40 is ContentScale (CONTEXT_DATA) or unused — ignore.
        break;
      case 41:
        if (inContextData && !inLeader) {
          // CONTEXT_DATA TextHeight — already in drawing units after the
          // OverallContentScale (code 40) is applied by the writer.
          entity.textHeight = curr.value as number;
        }
        // Entity-level (after CONTEXT_DATA closes): DoglegLength — ignored;
        // we don't render the dogleg shelf as a separate primitive.
        break;
      case 42:
        if (!inContextData) {
          // Entity-level ArrowHeadSize. Inside CONTEXT_DATA code 42 has a
          // different meaning (line spacing / column-related), skip it.
          entity.arrowSize = curr.value as number;
        }
        break;
      case 170:
        if (!inContextData) {
          entity.leaderLineType = curr.value as number;
        }
        break;

      case 90:
        if (inContextData && !inLeader) {
          entity.textColorRaw = curr.value as number;
        } else if (!inContextData) {
          entity.propertyOverrideFlag = curr.value as number;
        }
        // inside LEADER: LeaderBranchIndex — ignore
        break;
      case 91:
        if (!inContextData) {
          entity.leaderLineColorRaw = curr.value as number;
        }
        // inside CONTEXT_DATA top: TextBackgroundColor — not yet supported
        // inside LEADER_LINE: LeaderLineIndex — ignore
        break;
      case 340:
        if (!inContextData) {
          entity.styleHandle = String(curr.value).toUpperCase();
        }
        // inside CONTEXT_DATA top: TextStyleId — not yet used
        break;

      case 100:
        break;
      case 171:
        // Heuristic: at entity level a LeaderLineWeight of 0 (rare) is treated
        // as "no arrow". The proper signal is an empty ArrowHead block (code 342),
        // which we don't resolve yet.
        if (!inContextData) {
          entity.hasArrowHead = (curr.value as number) !== 0;
        }
        break;

      default:
        helpers.checkCommonEntityProperties(entity, curr, scanner);
        break;
    }
    curr = scanner.next();
  }

  return entity;
}
