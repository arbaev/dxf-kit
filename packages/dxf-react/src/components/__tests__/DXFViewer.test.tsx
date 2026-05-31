import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { StrictMode } from "react";
import { DXFViewer } from "../DXFViewer";

/**
 * Smoke tests. jsdom has no WebGL, so scene init bails into the
 * "WebGL not supported" path — these only assert that the React lifecycle
 * (mount effect, cleanup, StrictMode double-invoke) runs without throwing.
 * Visual rendering is verified manually in the playground.
 */
describe("DXFViewer (smoke)", () => {
  it("mounts and unmounts without throwing", () => {
    const { container, unmount } = render(<DXFViewer />);
    expect(container.querySelector(".dxfk-viewer")).toBeTruthy();
    unmount();
  });

  it("renders the empty-state placeholder when no DXF is provided", () => {
    const { container } = render(<DXFViewer />);
    expect(container.textContent).toContain("Select a DXF file to view");
  });

  it("survives a StrictMode mount → cleanup → remount cycle", () => {
    const { unmount } = render(
      <StrictMode>
        <DXFViewer fileName="test.dxf" />
      </StrictMode>,
    );
    unmount();
  });
});
