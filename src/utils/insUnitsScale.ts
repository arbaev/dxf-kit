/**
 * DXF $INSUNITS auto-scaling for block insertion.
 *
 * When a block's BLOCK_RECORD units differ from the drawing's $INSUNITS,
 * AutoCAD applies a conversion factor so the block renders at the correct size.
 * If either value is 0 (Unitless), no scaling is applied.
 */

// Conversion factor from each INSUNITS code to millimeters.
// Index = INSUNITS code (0–20).
const UNITS_TO_MM: ReadonlyArray<number> = [
  0,              //  0 = Unitless (sentinel — never used for math)
  25.4,           //  1 = Inches
  304.8,          //  2 = Feet
  1_609_344,      //  3 = Miles
  1,              //  4 = Millimeters
  10,             //  5 = Centimeters
  1_000,          //  6 = Meters
  1_000_000,      //  7 = Kilometers
  0.0000254,      //  8 = Microinches
  0.0254,         //  9 = Mils
  914.4,          // 10 = Yards
  1e-7,           // 11 = Angstroms
  1e-6,           // 12 = Nanometers
  0.001,          // 13 = Microns
  100,            // 14 = Decimeters
  10_000,         // 15 = Decameters
  100_000,        // 16 = Hectometers
  1e12,           // 17 = Gigameters
  1.496e14,       // 18 = Astronomical units
  9.461e18,       // 19 = Light years
  3.086e19,       // 20 = Parsecs
];

/**
 * Returns the uniform scale factor to apply to block geometry when inserting
 * a block whose units (`blockUnits`) differ from the drawing units (`drawingUnits`).
 *
 * Both values use the DXF INSUNITS encoding (0–20).
 * Returns 1 when no conversion is needed:
 *  - either value is 0 (Unitless)
 *  - both values are equal
 *  - either value is out of range
 */
export function getInsUnitsScale(drawingUnits: number, blockUnits: number): number {
  if (drawingUnits === 0 || blockUnits === 0) return 1;
  if (drawingUnits === blockUnits) return 1;
  if (drawingUnits < 0 || drawingUnits >= UNITS_TO_MM.length) return 1;
  if (blockUnits < 0 || blockUnits >= UNITS_TO_MM.length) return 1;

  return UNITS_TO_MM[blockUnits] / UNITS_TO_MM[drawingUnits];
}
