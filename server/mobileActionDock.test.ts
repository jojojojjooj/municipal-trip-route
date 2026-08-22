import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectFile = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("mobile route action dock", () => {
  it("reuses the established save, PDF, print, and share handlers", () => {
    const source = projectFile("client/src/pages/Home.tsx");

    expect(source).toContain('className="mobile-action-dock print:hidden"');
    expect(source).toContain("onClick={saveTrip}");
    expect(source).toContain("onClick={downloadPdf}");
    expect(source).toContain("onClick={() => window.print()}");
    expect(source).toContain("onClick={shareTrip}");
  });

  it("is restricted to the mobile breakpoint and reserves scroll space", () => {
    const styles = projectFile("client/src/index.css");

    expect(styles).toContain(".mobile-action-dock-spacer { display: block; height: 120px; }");
    expect(styles).toContain(".mobile-action-dock { position: fixed;");
    expect(styles).toContain("padding: .55rem .75rem calc(.55rem + env(safe-area-inset-bottom))");
  });
});
