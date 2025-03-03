"use strict";

type Token = {
  attrs: [string, string][];
  content: string;
};

type State = {
  src: string;
  pos: number;
  push: (type: string, tag: string, nesting: number) => Token;
};

type Diagram = {
  fret: number;
  char: string;
};

const CHORD_TEST =
  /^\[[A-G][b#♭♯]*(?:M|Δ|[Mm]aj|m|[Mm]in|-|–|[Dd]im|o|°|ø|[Aa]ug|\+|[Ss]usp?|[Aa]dd)?(?:1?[\d])?(?:(?:[\(\/,]?(?:[-–+Δob#♭♯]|[Mm]aj|[Mm]in|[Ss]usp?)?[0-9]+\)?)*)?(?:\/[A-G][b#♭♯]*)?(?:\|[XxOo\d,\(\)]{3,})?\]/;
const CHORD_REGEX =
  /^\[([A-G])([♭♯]*)(M|Δ|[Mm]aj|m|[Mm]in|‑|[Dd]im|°|ø|[Aa]ug|\+|[Ss]usp?|[Aa]dd)?(1?[\d])?((?:[\(\/,]?(?:[‑+Δ°♭♯]|[Mm]aj|[Mm]in|[Ss]usp?)?[0-9]+\)?)*)?(\/[A-G][♭♯]*)?(\|[XxOo\d,\(\)]{3,})?\]/;
const EXTENDED_REGEX =
  /(?:[\(\/,1]*(?:[‑+Δ°♭♯]|[Mm]aj|[Mm]in|[Ss]usp?)?[0-9]+\)?)*/;
const DIAGRAM_REGEX = /^\[(?:[XxOo\d,\(\)]{3,})\]/;

function chords(state: State, silent: boolean): boolean {
  const pos = state.pos;

  if (state.src.charCodeAt(pos) !== 0x5b /* [ */) return false;

  const tail = state.src.slice(pos);
  if (!tail.length) return false;

  const { chord, diagram, chordMatch } = parseChordAndDiagram(tail);
  if (!chord && !diagram) return false;

  const classes = chord ? "chord" : "chord diagram";
  if (!silent) {
    renderChord(state, chord, diagram, classes);
  }

  state.pos += chordMatch[0].length;
  return true;
}

function parseChordAndDiagram(tail: string) {
  let chordMatch = tail.match(CHORD_TEST);
  let chord: RegExpMatchArray | null = null;
  let diagram: string[] | false = false;

  if (chordMatch) {
    const chordSplit = chordMatch[0].split("|");
    chord = (chordSplit[0] + "]")
      .replace(/b/g, "♭")
      .replace(/#/g, "♯")
      .replace(/o/g, "°")
      .replace(/[-–]/g, "‑")
      .match(CHORD_REGEX);
    diagram = parseDiagram(chordSplit[1]);
  } else {
    chordMatch = tail.match(DIAGRAM_REGEX) || [""];
    diagram = parseDiagram(chordMatch[0]);
  }

  return { chord, diagram, chordMatch };
}

function renderChord(
  state: State,
  chord: RegExpMatchArray | null,
  diagram: string[] | false,
  classes: string
) {
  let token = state.push("chord_open", "span", 1);
  token.attrs = [["class", classes]];

  token = state.push("chord_inner_open", "span", 1);
  token.attrs = [["class", "inner"]];

  if (chord) {
    renderChordName(state, chord);
  }

  if (diagram && diagram.length) {
    renderChordDiagram(state, diagram);
  }

  state.push("chord_inner_close", "span", -1);
  state.push("chord_close", "span", -1);
}

function renderChordName(state: State, chord: RegExpMatchArray) {
  const extended = chord[5] ? chord[5].match(EXTENDED_REGEX) : null;
  let token = state.push("chord_i_open", "i", 1);
  token.attrs = [["class", "name"]];

  token = state.push("text", "", 0);
  token.content = chord[1];

  if (chord[2]) token.content += chord[2];

  if (chord[3] === "ø") {
    state.push("sup_open", "sup", 1);
    token = state.push("text", "", 0);
    token.content = "ø";
    state.push("sup_close", "sup", -1);
  } else if (chord[3]) {
    token.content += chord[3];
  }

  if (chord[4]) {
    state.push("sup_open", "sup", 1);
    token = state.push("text", "", 0);
    token.content = chord[4];
    state.push("sup_close", "sup", -1);
  }

  if (extended) {
    extended.forEach((v) => {
      state.push("sup_open", "sup", 1);
      token = state.push("text", "", 0);
      token.content = v;
      state.push("sup_close", "sup", -1);
    });
  }

  if (chord[6]) {
    token = state.push("text", "", 0);
    token.content = chord[6];
  }

  state.push("chord_i_close", "i", -1);
}

function renderChordDiagram(state: State, diagram: string[]) {
  let token = state.push("chord_i_open", "i", 1);
  token.attrs = [["class", "diagram"]];

  diagram.forEach((line) => {
    token = state.push("text", "", 0);
    token.content = line;
    state.push("br", "br", 0);
  });

  state.push("chord_i_close", "i", -1);
}

function parseDiagram(diagram: string): string[] | false {
  if (!diagram) return false;

  const fr = "|",
    nt = String.fromCharCode(0x2016),
    str = String.fromCharCode(0x0336),
    str0 = String.fromCharCode(0x0335),
    sp = String.fromCharCode(0xa0),
    finger = String.fromCharCode(0x25cf),
    optional = String.fromCharCode(0x25cb);

  let nut = str0,
    lines: string[] = [];

  let { diagramMapped, min, max } = mapDiagram(diagram, sp, optional, finger);

  if (max <= 4) min = 1;
  if (max - min < 2) max++;

  if (min > 1) {
    lines.push(`${sp}${min}fr`);
    nut = str;
  }

  createDiagram(diagramMapped, sp, nt, nut, min, max, str, fr, lines);

  return lines;
}

function parseDiagramMap(
  diagramLine: string,
  sp: string,
  optional: string,
  finger: string,
  min: number = 99,
  max: number = 0
): Diagram {
  let char = "";
  let fret = parseInt(diagramLine.replace(/[\(\)]/g, ""), 10);

  if (fret && fret < min) min = fret;
  if (fret && fret > max) max = fret;

  if (isNaN(fret)) char = "x";
  else if (!fret) char = sp;
  else if (/\(/.test(diagramLine)) char = optional;
  else char = finger;

  return {
    fret: fret || 0,
    char: char,
  };
}
function mapDiagram(
  diagram: string,
  sp: string,
  optional: string,
  finger: string,
  min: number = 99,
  max: number = 0
) {
  let diagramReplaced = diagram.replace(/[\[\]|]/g, "").replace(/[Oo]/g, "0");
  let diagramArray = /,/.test(diagramReplaced)
    ? diagramReplaced.split(",")
    : diagramReplaced.match(/\(?[XxOo\d]\)?/g) || [];
  diagramArray.reverse();
  let diagramMapped: Diagram[] = diagramArray.map((line) =>
    parseDiagramMap(line, sp, optional, finger, min, max)
  );
  return { diagramMapped, min, max };
}

function createDiagram(
  diagram: Diagram[],
  sp: string,
  nt: string,
  nut: string,
  min: number,
  max: number,
  str: string,
  fr: string,
  lines: string[]
) {
  let line = "";

  diagram.forEach((o, idx) => {
    let frets = idx && idx < diagram.length - 1;
    line = o.char === "x" ? "x" : sp;
    line += `${frets ? nt : sp}${nut}`;
    for (let i = min; i <= max; i++) {
      line += i === o.fret ? o.char : `${sp}${str}`;
      line += `${frets ? fr : sp}${str}`;
    }
    lines.push(`${line}`);
  });
}

export function plugin(md: any) {
  md.inline.ruler.push("chords", chords);
}
