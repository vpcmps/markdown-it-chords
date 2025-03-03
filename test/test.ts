import MarkdownIt from "markdown-it";
import plugin from "../src";

describe("markdown-it-chords plugin", () => {
  const md = new MarkdownIt();
  md.use(plugin);

  it("should render a simple chord", () => {
    const result = md.renderInline("[C]");
    expect(result).toBe(
      '<span class="chord"><span class="inner"><i class="name">C</i></span></span>'
    );
  });

  it("should render a chord with extensions", () => {
    const result = md.renderInline("[Cmaj7]");
    expect(result).toBe(
      '<span class="chord"><span class="inner"><i class="name">Cmaj<sup>7</sup></i></span></span>'
    );
  });

  it("should render a chord with a diagram", () => {
    const result = md.renderInline("[C|x32010]");
    // console.log(result);
    expect(result).toContain(
      '<span class="chord diagram"><span class="inner"><i class="name">C</i><i class="diagram">'
    );
  });

  it("should render a diagram only", () => {
    const result = md.renderInline("[|x32010]");
    // console.log(result);
    expect(result).toContain(
      '<span class="chord diagram"><span class="inner"><i class="diagram">'
    );
  });

  it("should handle invalid chord gracefully", () => {
    const result = md.renderInline("[invalid]");
    expect(result).toBe("[invalid]");
  });
});
