// Itanium C++ ABI demangler covering what GCC emits for Arduino and ESP-IDF code:
// nested names, templates, substitutions, constructors and destructors, operators,
// local names, lambdas, ABI tags and GCC clone suffixes. Output follows c++filt.
// Anything it cannot parse is returned unchanged.

const BUILTIN: Record<string, string> = {
  v: "void", w: "wchar_t", b: "bool", c: "char", a: "signed char", h: "unsigned char", s: "short",
  t: "unsigned short", i: "int", j: "unsigned int", l: "long", m: "unsigned long", x: "long long",
  y: "unsigned long long", n: "__int128", o: "unsigned __int128", f: "float", d: "double",
  e: "long double", g: "__float128", z: "...",
};
const BUILTIN_D: Record<string, string> = {
  n: "decltype(nullptr)", s: "char16_t", i: "char32_t", u: "char8_t", a: "auto", c: "decltype(auto)",
};
const OPERATORS: Record<string, string> = {
  nw: "new", na: "new[]", dl: "delete", da: "delete[]", ps: "+", ng: "-", ad: "&", de: "*", co: "~",
  pl: "+", mi: "-", ml: "*", dv: "/", rm: "%", an: "&", or: "|", eo: "^", aS: "=", pL: "+=", mI: "-=",
  mL: "*=", dV: "/=", rM: "%=", aN: "&=", oR: "|=", eO: "^=", ls: "<<", rs: ">>", lS: "<<=", rS: ">>=",
  eq: "==", ne: "!=", lt: "<", gt: ">", le: "<=", ge: ">=", ss: "<=>", nt: "!", aa: "&&", oo: "||",
  pp: "++", mm: "--", cm: ",", pm: "->*", pt: "->", cl: "()", ix: "[]", qu: "?",
};
const STD_SUBS: Record<string, string> = {
  t: "std", a: "std::allocator", b: "std::basic_string",
  s: "std::string", i: "std::istream", o: "std::ostream", d: "std::iostream",
};

class Fail extends Error {}

const FULL_STD: Record<string, string> = {
  "std::string": "std::basic_string<char, std::char_traits<char>, std::allocator<char> >",
  "std::istream": "std::basic_istream<char, std::char_traits<char> >",
  "std::ostream": "std::basic_ostream<char, std::char_traits<char> >",
  "std::iostream": "std::basic_iostream<char, std::char_traits<char> >",
};

/** "ns::Foo<int, Bar<char> >" -> "Foo", for naming constructors and destructors. */
function baseName(text: string): string {
  let t = text.replace(/\[abi:[^\]]*\]/g, "");
  while (t.endsWith(">")) {
    let depth = 0;
    let i = t.length - 1;
    for (; i >= 0; i--) {
      if (t[i] === ">") depth++;
      else if (t[i] === "<" && --depth === 0) break;
    }
    t = t.slice(0, Math.max(i, 0)).trimEnd();
  }
  const at = t.lastIndexOf("::");
  return at >= 0 ? t.slice(at + 2) : t;
}

/** A type, kept as pieces so pointers to functions and arrays print the C way. */
interface Ty {
  /** Text before the declarator, e.g. "int" */
  base: string;
  /** Text after the declarator, e.g. "(char)" for a function type, "[4]" for an array */
  suffix?: string;
  /** Pointer and reference marks collected for a function or array type */
  mid?: string;
}

const show = (t: Ty): string => (t.suffix !== undefined ? `${t.base} (${t.mid ?? ""})${t.suffix}`.replace(" ()(", " (") : t.base);

class Parser {
  pos = 0;
  subs: Ty[] = [];
  templateArgs: Ty[] = [];
  /** Template arguments of the function being demangled, for T_ in its parameters */
  fnArgs: Ty[] | null = null;
  constructor(readonly s: string) {}

  peek(n = 0) {
    return this.s[this.pos + n] ?? "";
  }
  eat(prefix: string) {
    if (this.s.startsWith(prefix, this.pos)) {
      this.pos += prefix.length;
      return true;
    }
    return false;
  }
  expect(c: string) {
    if (!this.eat(c)) throw new Fail(`expected ${c} at ${this.pos}`);
  }
  number(): number {
    const m = /^n?\d+/.exec(this.s.slice(this.pos));
    if (!m) throw new Fail("number");
    this.pos += m[0].length;
    return m[0].startsWith("n") ? -Number(m[0].slice(1)) : Number(m[0]);
  }
  seqId(): number {
    // S_ is 0; S0_ is 1; base 36 digits and capitals
    if (this.eat("_")) return 0;
    const m = /^[0-9A-Z]+/.exec(this.s.slice(this.pos));
    if (!m) throw new Fail("seq id");
    this.pos += m[0].length;
    this.expect("_");
    return parseInt(m[0], 36) + 1;
  }

  // <encoding> ::= <name> <bare-function-type> | <name> | <special-name>
  encoding(): string {
    if (this.peek() === "T" || (this.peek() === "G" && this.peek(1) === "V")) return this.special();
    const saved = this.templateArgs;
    const name = this.name();
    if (this.pos >= this.s.length || this.peek() === "E" || this.peek() === ".") {
      return name.text;
    }
    let ret = "";
    const outerFnArgs = this.fnArgs;
    if (name.template) this.fnArgs = this.templateArgs;
    if (name.template && !name.ctorDtor) ret = show(this.type()) + " ";
    const params = this.bareParams();
    const result = `${ret}${name.text}(${params})${name.quals}`;
    this.fnArgs = outerFnArgs;
    this.templateArgs = saved;
    return result;
  }

  bareParams(): string {
    const types: string[] = [];
    while (this.pos < this.s.length && this.peek() !== "E" && this.peek() !== ".") {
      types.push(show(this.type()));
    }
    if (types.length === 1 && types[0] === "void") return "";
    return types.join(", ");
  }

  special(): string {
    if (this.eat("TV")) return `vtable for ${show(this.type())}`;
    if (this.eat("TI")) return `typeinfo for ${show(this.type())}`;
    if (this.eat("TS")) return `typeinfo name for ${show(this.type())}`;
    if (this.eat("TT")) return `VTT for ${show(this.type())}`;
    if (this.eat("Th")) {
      this.number();
      this.expect("_");
      return `non-virtual thunk to ${this.encoding()}`;
    }
    if (this.eat("Tv")) {
      this.number();
      this.expect("_");
      this.number();
      this.expect("_");
      return `virtual thunk to ${this.encoding()}`;
    }
    if (this.eat("GV")) return `guard variable for ${this.name().text}`;
    throw new Fail("special");
  }

  // Returns the name text plus facts the encoding needs.
  name(): { text: string; template: boolean; ctorDtor: boolean; quals: string } {
    if (this.peek() === "N") return this.nested();
    if (this.peek() === "Z") {
      this.pos++;
      const outer = this.encoding();
      this.expect("E");
      if (this.eat("s")) {
        this.discriminator();
        return { text: `${outer}::string literal`, template: false, ctorDtor: false, quals: "" };
      }
      const inner = this.name();
      this.discriminator();
      return { ...inner, text: `${outer}::${inner.text}` };
    }
    // <unscoped-name> or <unscoped-template-name> <template-args>, possibly a substitution
    let text: string;
    let ctorDtor = false;
    if (this.peek() === "S" && this.peek(1) !== "t") {
      text = show(this.substitution());
    } else {
      const std = this.eat("St");
      const u = this.unqualified("");
      ctorDtor = u.ctorDtor;
      text = (std ? "std::" : "") + u.text;
      if (this.peek() === "I") this.subs.push({ base: text });
    }
    if (this.peek() === "I") {
      const args = this.templateArgList();
      text += args;
      return { text, template: true, ctorDtor, quals: "" };
    }
    return { text, template: false, ctorDtor, quals: "" };
  }

  discriminator() {
    if (this.eat("_")) {
      if (this.eat("_")) {
        this.number();
        this.expect("_");
      } else this.number();
    }
  }

  nested(): { text: string; template: boolean; ctorDtor: boolean; quals: string } {
    this.expect("N");
    let quals = "";
    for (;;) {
      if (this.eat("r")) quals += " restrict";
      else if (this.eat("V")) quals += " volatile";
      else if (this.eat("K")) quals += " const";
      else break;
    }
    // Order as c++filt prints: const volatile
    quals = [" const", " volatile", " restrict"].filter((q) => quals.includes(q)).join("");
    let ref = "";
    if (this.eat("R")) ref = " &";
    else if (this.eat("O")) ref = " &&";
    let text = "";
    let last = "";
    let template = false;
    let ctorDtor = false;
    let first = true;
    let fromSub = false;
    while (!this.eat("E")) {
      if (this.pos >= this.s.length) throw new Fail("unterminated nested name");
      if (!first && !fromSub) {
        // The previous component (without being the final one) is a prefix: substitutable.
        this.subs.push({ base: text });
      }
      fromSub = false;
      template = false;
      ctorDtor = false;
      if (this.peek() === "S" && first) {
        fromSub = this.peek(1) !== "t";
        text = show(this.substitution());
        // c++filt spells out std::string and friends when naming their constructors.
        if (FULL_STD[text] && /^[CD]\d/.test(this.s.slice(this.pos, this.pos + 2))) text = FULL_STD[text];
      } else if (this.peek() === "T" && first) {
        text = show(this.templateParam());
        fromSub = false;
      } else if (this.peek() === "I") {
        if (first) throw new Fail("template args first");
        text += this.templateArgList();
        template = true;
        first = false;
        continue;
      } else if (this.eat("M")) {
        // data-member-prefix: closure in a member initialiser
        first = false;
        continue;
      } else {
        const u = this.unqualified(last);
        ctorDtor = u.ctorDtor;
        text = first ? u.text : `${text}::${u.text}`;
        last = baseName(u.text);
      }
      if (first) last = baseName(text);
      first = false;
    }
    return { text, template, ctorDtor, quals: quals + ref };
  }

  unqualified(enclosing: string): { text: string; ctorDtor: boolean } {
    const c = this.peek();
    let text: string;
    let ctorDtor = false;
    if (/\d/.test(c)) text = this.sourceName();
    else if (c === "C" && /[1-5I]/.test(this.peek(1))) {
      this.pos += 2;
      if (this.s[this.pos - 1] === "I") {
        this.pos++;
        this.type();
      }
      text = enclosing;
      ctorDtor = true;
    } else if (c === "D" && /[0-25]/.test(this.peek(1))) {
      this.pos += 2;
      text = `~${enclosing}`;
      ctorDtor = true;
    } else if (c === "U" && this.peek(1) === "t") {
      this.pos += 2;
      const n = this.peek() === "_" ? 1 : this.number() + 2;
      this.expect("_");
      text = `{unnamed type#${n}}`;
    } else if (c === "U" && this.peek(1) === "l") {
      this.pos += 2;
      const params = this.bareParams();
      this.expect("E");
      const n = this.peek() === "_" ? 1 : this.number() + 2;
      this.expect("_");
      text = `{lambda(${params})#${n}}`;
    } else if (c === "L") {
      // internal-linkage marker used by some compilers
      this.pos++;
      return this.unqualified(enclosing);
    } else text = this.operatorName();
    while (this.peek() === "B") {
      this.pos++;
      text += `[abi:${this.sourceName()}]`;
    }
    return { text, ctorDtor };
  }

  sourceName(): string {
    const n = this.number();
    const id = this.s.slice(this.pos, this.pos + n);
    if (id.length !== n) throw new Fail("source name");
    this.pos += n;
    return id.startsWith("_GLOBAL__N") ? "(anonymous namespace)" : id;
  }

  operatorName(): string {
    if (this.eat("cv")) return `operator ${show(this.type())}`;
    if (this.eat("li")) return `operator"" ${this.sourceName()}`;
    const code = this.s.slice(this.pos, this.pos + 2);
    const op = OPERATORS[code];
    if (!op) throw new Fail(`operator ${code}`);
    this.pos += 2;
    return /^[a-z]/.test(op) ? `operator ${op}` : `operator${op}`;
  }

  templateArgList(): string {
    this.expect("I");
    const args: Ty[] = [];
    while (!this.eat("E")) {
      if (this.pos >= this.s.length) throw new Fail("template args");
      args.push(this.templateArg());
    }
    this.templateArgs = args;
    const text = args.map(show).filter((a) => a !== "").join(", ");
    return `<${text}${text.endsWith(">") ? " " : ""}>`;
  }

  templateArg(): Ty {
    if (this.eat("L")) return { base: this.literal() };
    if (this.eat("X")) throw new Fail("expression");
    if (this.eat("J")) {
      const parts: string[] = [];
      while (!this.eat("E")) parts.push(show(this.templateArg()));
      return { base: parts.join(", ") };
    }
    return this.type();
  }

  literal(): string {
    if (this.eat("_Z")) {
      const e = this.encoding();
      this.expect("E");
      return e;
    }
    const t = this.peek();
    if (BUILTIN[t]) {
      this.pos++;
      const neg = this.eat("n");
      const m = /^\d+/.exec(this.s.slice(this.pos));
      const digits = m ? m[0] : "";
      this.pos += digits.length;
      this.expect("E");
      const n = (neg ? "-" : "") + digits;
      if (t === "b") return n === "0" ? "false" : "true";
      if (t === "i") return n;
      if (t === "j") return `${n}u`;
      if (t === "l") return `${n}l`;
      if (t === "m") return `${n}ul`;
      if (t === "x") return `${n}ll`;
      if (t === "y") return `${n}ull`;
      return `(${BUILTIN[t]})${n}`;
    }
    const ty = this.type();
    const m = /^n?\d+/.exec(this.s.slice(this.pos));
    const v = m ? m[0].replace(/^n/, "-") : "";
    this.pos += m ? m[0].length : 0;
    this.expect("E");
    return `(${show(ty)})${v}`;
  }

  substitution(): Ty {
    this.expect("S");
    const c = this.peek();
    if (STD_SUBS[c] && c !== "t") {
      this.pos++;
      return { base: STD_SUBS[c] };
    }
    if (c === "t") {
      this.pos++;
      return { base: `std::${this.unqualified("").text}` };
    }
    const id = this.seqId();
    const t = this.subs[id];
    if (!t) throw new Fail(`substitution ${id}`);
    return t;
  }

  templateParam(): Ty {
    this.expect("T");
    const id = this.seqId();
    const t = (this.fnArgs ?? this.templateArgs)[id];
    if (!t) throw new Fail(`template param ${id}`);
    return t;
  }

  type(): Ty {
    const c = this.peek();
    if (BUILTIN[c]) {
      this.pos++;
      return { base: BUILTIN[c] };
    }
    if (c === "D" && BUILTIN_D[this.peek(1)]) {
      this.pos += 2;
      return { base: BUILTIN_D[this.s[this.pos - 1]] };
    }
    if (c === "D" && this.peek(1) === "p") {
      this.pos += 2;
      const t = this.type();
      this.subs.push(t);
      return { ...t, base: `${t.base}...` };
    }
    if (c === "u") {
      this.pos++;
      return { base: this.sourceName() };
    }
    let result: Ty;
    if (c === "P" || c === "R" || c === "O") {
      this.pos++;
      const inner = this.type();
      const mark = c === "P" ? "*" : c === "R" ? "&" : "&&";
      result = inner.suffix !== undefined ? { ...inner, mid: mark + (inner.mid ?? "") } : { base: `${inner.base}${mark}` };
    } else if (c === "K" || c === "V" || c === "r") {
      let q = "";
      while (/[KVr]/.test(this.peek())) {
        const x = this.s[this.pos++];
        q = (x === "K" ? " const" : x === "V" ? " volatile" : " restrict") + q;
      }
      const inner = this.type();
      result = inner.suffix !== undefined ? { ...inner, suffix: inner.suffix + q } : { base: `${inner.base}${q}` };
    } else if (c === "F") {
      this.pos++;
      this.eat("Y");
      const ret = show(this.type());
      const params = this.bareParams();
      let ref = "";
      if (this.eat("R")) ref = " &";
      else if (this.eat("O")) ref = " &&";
      this.expect("E");
      result = { base: ret, suffix: `(${params})${ref}`, mid: "" };
    } else if (c === "A") {
      this.pos++;
      const n = /\d/.test(this.peek()) ? String(this.number()) : "";
      this.expect("_");
      const el = this.type();
      result = { base: el.base, suffix: `[${n}]`, mid: "" };
    } else if (c === "M") {
      this.pos++;
      const cls = show(this.type());
      const member = this.type();
      result =
        member.suffix !== undefined
          ? { ...member, mid: `${cls}::*${member.mid ?? ""}` }
          : { base: `${member.base} ${cls}::*` };
    } else if (c === "T") {
      result = this.templateParam();
      if (this.peek() === "I") {
        this.subs.push(result);
        result = { base: result.base + this.templateArgList() };
      }
    } else if (c === "S" && !(this.peek(1) === "t")) {
      result = this.substitution();
      if (this.peek() !== "I") return result;
      result = { base: result.base + this.templateArgList() };
    } else {
      // class or enum type, possibly scoped with St or N...E
      const n = this.name();
      result = { base: n.text };
    }
    this.subs.push(result);
    return result;
  }
}

/** Demangle a C++ symbol the way `c++filt` does. Non-C++ names come back unchanged. */
export function demangle(symbol: string): string {
  if (!symbol.startsWith("_Z")) return symbol;
  // GCC clone suffixes: foo.constprop.0, foo.isra.0.part.0, foo.cold; Xtensa uses $ for .
  const plain = symbol.replace(/\$/g, ".");
  const dot = plain.indexOf(".");
  const core = dot > 0 ? plain.slice(0, dot) : plain;
  const clones = dot > 0 ? plain.slice(dot).match(/\.[A-Za-z_]+(?:\.\d+)*/g) ?? [] : [];
  try {
    const p = new Parser(core);
    p.pos = 2;
    const text = p.encoding();
    if (p.pos !== core.length) return symbol;
    return text + clones.map((c) => ` [clone ${c}]`).join("");
  } catch {
    return symbol;
  }
}
