import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Panel, PanelHeader } from "./panel";

describe("Panel", () => {
  test("renders its children inside a section surface", () => {
    const html = renderToStaticMarkup(<Panel>conteúdo</Panel>);
    expect(html).toContain("conteúdo");
    expect(html).toContain("<section");
  });

  test("PanelHeader renders the title", () => {
    const html = renderToStaticMarkup(<PanelHeader title="Sua aposta" />);
    expect(html).toContain("Sua aposta");
  });
});
