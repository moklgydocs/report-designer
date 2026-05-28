/**
 * High-Performance, Safe AST-Based Sandboxed Formula Engine (FastReport Compatible)
 * Allows safe evaluations of expressions with:
 * - Proper operators: + - * / % ( )
 * - Relational/Logical operators: <, >, <=, >=, ==, !=, &&, ||, !
 * - Nullish coalescing: ??
 * - Robust Field Bracket access (multi-level): {user.account.balance} or {items[0].price}
 * - Safe conditional branch: If(condition, trueVal, falseVal)
 * - Extensible Built-in functions: Sum, Count, Avg, Min, Max, Now, Concat, Format, Round, Abs, Upper, Lower
 */

// ============================================================================
// Token Types & Interfaces
// ============================================================================

/** Token types produced by the lexer during tokenization */
export type TokenType =
  | "NUMBER"        // Numeric literal (integer or float)
  | "STRING"        // String literal enclosed in single or double quotes
  | "IDENTIFIER"    // Named reference — e.g. function names (If, Sum, Now) or keywords (true, false, null)
  | "FIELD"         // Data field reference enclosed in curly braces — e.g. {user.name}
  | "PARAMETER"     // Report parameter enclosed in square brackets — e.g. [ParameterName]
  | "OPERATOR"      // Arithmetic, relational, logical, or nullish-coalescing operator
  | "LPAREN"        // Left parenthesis (
  | "RPAREN"        // Right parenthesis )
  | "COMMA"         // Comma separator ,
  | "EOF";          // End-of-input sentinel token

/** Represents a single lexical token with its type and raw string value */
export interface Token {
  type: TokenType;
  value: string;
}

// ============================================================================
// Utility: Nested Property Accessor
// ============================================================================

/**
 * Safely resolves a nested property from an object using a dot-separated path.
 * Supports both dot notation (`user.profile.name`) and bracket notation (`items[0].price`).
 *
 * @param obj  - The root object to traverse (typically a data record)
 * @param path - The property path, e.g. "user.account.balance" or "items[0].price"
 * @returns The resolved value, or `undefined` if any segment in the path is null/missing
 */
export function getNestedProperty(obj: any, path: string): any {
  if (obj == null) return undefined;
  // Normalize bracket notation: "items[0].price" → "items.0.price"
  const normalizedPath = path.replace(/\[(\w+)\]/g, ".$1").replace(/^\./, "");

  const parts = normalizedPath.split(".");
  let current = obj;
  for (const part of parts) {
    // Short-circuit on null/undefined to avoid TypeError
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

// ============================================================================
// Lexer — Tokenizes a formula string into a stream of Tokens
// ============================================================================

/**
 * Lexical analyzer that converts a raw formula string into an array of Tokens.
 * Handles numbers, strings, field references ({...}), parameter references ([...]),
 * operators, identifiers, parentheses, and commas.
 */
export class Lexer {
  private input: string;
  private pos = 0;       // Current character position in the input
  private length = 0;    // Total length of the input string

  constructor(input: string) {
    this.input = input;
    this.length = input.length;
  }

  /** Peek at the current character without advancing the position */
  private peek(): string {
    return this.pos < this.length ? this.input[this.pos] : "";
  }

  /** Consume and return the current character, advancing the position by one */
  private next(): string {
    const char = this.peek();
    this.pos++;
    return char;
  }

  /** Advance past any whitespace characters */
  private skipWhitespace() {
    while (this.pos < this.length && /\s/.test(this.input[this.pos])) {
      this.pos++;
    }
  }

  /**
   * Tokenize the entire input string into an array of Tokens.
   * The resulting array always terminates with an EOF token.
   *
   * @returns An ordered array of Tokens representing the input expression
   */
  public tokenize(): Token[] {
    const tokens: Token[] = [];
    while (this.pos < this.length) {
      this.skipWhitespace();
      if (this.pos >= this.length) break;

      const char = this.peek();

      // --- Number literal (integer or decimal) ---
      if (/\d/.test(char)) {
        let numStr = "";
        while (
          this.pos < this.length &&
          (/\d/.test(this.peek()) || this.peek() === ".")
        ) {
          numStr += this.next();
        }
        tokens.push({ type: "NUMBER", value: numStr });
        continue;
      }

      // --- String literal (single or double quoted, with backslash escaping) ---
      if (char === '"' || char === "'") {
        const quoteType = this.next();
        let strVal = "";
        while (this.pos < this.length && this.peek() !== quoteType) {
          // Handle backslash escaping
          if (this.peek() === "\\") {
            this.next(); // skip backslash
            if (this.pos < this.length) {
              strVal += this.next();
            }
          } else {
            strVal += this.next();
          }
        }
        if (this.peek() === quoteType) {
          this.next(); // Consume closing quote
        }
        tokens.push({ type: "STRING", value: strVal });
        continue;
      }

      // --- Field reference: {fieldName} or {nested.object.field} ---
      // Supports nested curly braces by tracking depth
      if (char === "{") {
        this.next(); // consume '{'
        let depth = 1;
        let fieldPath = "";
        while (this.pos < this.length && depth > 0) {
          const nextChar = this.peek();
          if (nextChar === "{") depth++;
          if (nextChar === "}") depth--;
          if (depth > 0) {
            fieldPath += this.next();
          } else {
            this.next(); // consume '}'
          }
        }
        tokens.push({ type: "FIELD", value: fieldPath });
        continue;
      }

      // --- Parameter reference: [paramName] ---
      // Supports nested brackets by tracking depth
      if (char === "[") {
        this.next(); // consume '['
        let depth = 1;
        let paramPath = "";
        while (this.pos < this.length && depth > 0) {
          const nextChar = this.peek();
          if (nextChar === "[") depth++;
          if (nextChar === "]") depth--;
          if (depth > 0) {
            paramPath += this.next();
          } else {
            this.next(); // consume ']'
          }
        }
        tokens.push({ type: "PARAMETER", value: paramPath });
        continue;
      }

      // --- Parentheses & comma separator ---
      if (char === "(") {
        this.next();
        tokens.push({ type: "LPAREN", value: "(" });
        continue;
      }
      if (char === ")") {
        this.next();
        tokens.push({ type: "RPAREN", value: ")" });
        continue;
      }
      if (char === ",") {
        this.next();
        tokens.push({ type: "COMMA", value: "," });
        continue;
      }

      // --- Operators (checked longest-first to disambiguate e.g. ">=" vs ">") ---
      const operators = [
        "??",
        "&&",
        "||",
        "==",
        "!=",
        ">=",
        "<=",
        ">",
        "<",
        "+",
        "-",
        "*",
        "/",
        "%",
        "!",
      ];
      let operatorMatched = "";
      for (const op of operators) {
        if (this.input.substring(this.pos, this.pos + op.length) === op) {
          operatorMatched = op;
          break;
        }
      }
      if (operatorMatched) {
        this.pos += operatorMatched.length;
        tokens.push({ type: "OPERATOR", value: operatorMatched });
        continue;
      }

      // --- Identifier (function names like If/Sum/Now, or keywords like true/false/null) ---
      if (/[a-zA-Z_]/.test(char)) {
        let identStr = "";
        while (this.pos < this.length && /[a-zA-Z0-9_]/.test(this.peek())) {
          identStr += this.next();
        }
        tokens.push({ type: "IDENTIFIER", value: identStr });
        continue;
      }

      // --- Fallback: treat any unexpected character as a single-char operator ---
      tokens.push({ type: "OPERATOR", value: this.next() });
    }
    // Append EOF sentinel to mark the end of the token stream
    tokens.push({ type: "EOF", value: "" });
    return tokens;
  }
}

// ============================================================================
// AST Node Types — The abstract syntax tree produced by the Parser
// ============================================================================

/**
 * Union type representing all possible AST node types:
 * - Literal:       A constant value (number, string, boolean, null)
 * - Field:         A data field reference resolved at evaluation time (e.g. {user.name})
 * - Parameter:     A report parameter reference (e.g. [ParamName])
 * - Identifier:    A named identifier (e.g. PageNumber, TotalPages)
 * - UnaryExpression:   A prefix operator applied to one operand (e.g. -5, !flag)
 * - BinaryExpression:  An infix operator applied to two operands (e.g. a + b, x == y)
 * - FunctionCall:      A named function with arguments (e.g. Sum({price}), If(cond, a, b))
 */
export type ASTNode =
  | { type: "Literal"; value: any }
  | { type: "Field"; path: string }
  | { type: "Parameter"; name: string }
  | { type: "Identifier"; name: string }
  | { type: "UnaryExpression"; operator: string; argument: ASTNode }
  | {
      type: "BinaryExpression";
      operator: string;
      left: ASTNode;
      right: ASTNode;
    }
  | { type: "FunctionCall"; name: string; arguments: ASTNode[] };

// ============================================================================
// Parser — Recursive-descent parser that builds an AST from a token stream
// ============================================================================

/**
 * Recursive-descent parser implementing operator precedence climbing.
 * Precedence (lowest → highest):
 *   ?? → || → && → == != → > < >= <= → + - → * / % → unary(- !) → primary
 */
export class Parser {
  private tokens: Token[];
  private current = 0;  // Index into the tokens array (current parse position)

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  /** Peek at the current token without consuming it */
  private peek(): Token {
    return this.tokens[this.current];
  }

  /** Return the most recently consumed token */
  private previous(): Token {
    return this.tokens[this.current - 1];
  }

  /** Check whether we've reached the end of the token stream */
  private isAtEnd(): boolean {
    return this.peek().type === "EOF";
  }

  /** Consume and return the current token, advancing the parse position */
  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  /** Check if the current token matches the given type (without consuming) */
  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  /** If the current token matches any of the given types, consume it and return true */
  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  /** If the current token is an OPERATOR with one of the given values, consume it and return true */
  private matchOperator(...ops: string[]): boolean {
    if (this.isAtEnd()) return false;
    const token = this.peek();
    if (token.type === "OPERATOR" && ops.includes(token.value)) {
      this.advance();
      return true;
    }
    return false;
  }

  /**
   * Consume the current token if it matches the expected type; otherwise throw a parse error.
   * @param type         - The expected token type
   * @param errorMessage - Descriptive error message if the token doesn't match
   */
  private consume(type: TokenType, errorMessage: string): Token {
    if (this.check(type)) return this.advance();
    throw new Error(
      `${errorMessage} (Found token '${this.peek().type}' with value '${this.peek().value}' at index ${this.current})`,
    );
  }

  /**
   * Entry point: parse the entire expression starting at the lowest precedence level.
   * The grammar is:
   *   nullCoalescing → logicalOr ( "??" logicalOr )*
   *   logicalOr      → logicalAnd ( "||" logicalAnd )*
   *   logicalAnd     → equality ( "&&" equality )*
   *   equality       → comparison ( ("==" | "!=") comparison )*
   *   comparison     → term ( (">" | "<" | ">=" | "<=") term )*
   *   term           → factor ( ("+" | "-") factor )*
   *   factor         → unary ( ("*" | "/" | "%") unary )*
   *   unary          → ("-" | "!") unary | primary
   *   primary        → NUMBER | STRING | FIELD | PARAMETER | IDENTIFIER | FunctionCall | "(" parse ")"
   */
  public parse(): ASTNode {
    return this.nullCoalescing();
  }

  /** Parse nullish coalescing: left ?? right (lowest precedence) */
  private nullCoalescing(): ASTNode {
    let expr = this.logicalOr();
    while (this.matchOperator("??")) {
      const operator = this.previous().value;
      const right = this.logicalOr();
      expr = { type: "BinaryExpression", operator, left: expr, right };
    }
    return expr;
  }

  /** Parse logical OR: left || right */
  private logicalOr(): ASTNode {
    let expr = this.logicalAnd();
    while (this.matchOperator("||")) {
      const operator = this.previous().value;
      const right = this.logicalAnd();
      expr = { type: "BinaryExpression", operator, left: expr, right };
    }
    return expr;
  }

  /** Parse logical AND: left && right */
  private logicalAnd(): ASTNode {
    let expr = this.equality();
    while (this.matchOperator("&&")) {
      const operator = this.previous().value;
      const right = this.equality();
      expr = { type: "BinaryExpression", operator, left: expr, right };
    }
    return expr;
  }

  /** Parse equality: left == right or left != right */
  private equality(): ASTNode {
    let expr = this.comparison();
    while (this.matchOperator("==", "!=")) {
      const operator = this.previous().value;
      const right = this.comparison();
      expr = { type: "BinaryExpression", operator, left: expr, right };
    }
    return expr;
  }

  /** Parse comparison: left > right, left < right, left >= right, left <= right */
  private comparison(): ASTNode {
    let expr = this.term();
    while (this.matchOperator(">", "<", ">=", "<=")) {
      const operator = this.previous().value;
      const right = this.term();
      expr = { type: "BinaryExpression", operator, left: expr, right };
    }
    return expr;
  }

  /** Parse additive terms: left + right or left - right */
  private term(): ASTNode {
    let expr = this.factor();
    while (this.matchOperator("+", "-")) {
      const operator = this.previous().value;
      const right = this.factor();
      expr = { type: "BinaryExpression", operator, left: expr, right };
    }
    return expr;
  }

  /** Parse multiplicative factors: left * right, left / right, left % right */
  private factor(): ASTNode {
    let expr = this.unary();
    while (this.matchOperator("*", "/", "%")) {
      const operator = this.previous().value;
      const right = this.unary();
      expr = { type: "BinaryExpression", operator, left: expr, right };
    }
    return expr;
  }

  /** Parse unary prefix operators: -expr or !expr */
  private unary(): ASTNode {
    if (this.matchOperator("-", "!")) {
      const operator = this.previous().value;
      const right = this.unary();
      return { type: "UnaryExpression", operator, argument: right };
    }
    return this.primary();
  }

  /**
   * Parse primary expressions — the highest-precedence atoms:
   * numbers, strings, field references, parameters, function calls,
   * identifiers (including true/false/null keywords), and parenthesized expressions.
   */
  private primary(): ASTNode {
    if (this.match("NUMBER")) {
      const valStr = this.previous().value;
      // Parse as float if it contains a decimal point, otherwise as integer
      return {
        type: "Literal",
        value: valStr.includes(".") ? parseFloat(valStr) : parseInt(valStr, 10),
      };
    }

    if (this.match("STRING")) {
      return { type: "Literal", value: this.previous().value };
    }

    if (this.match("FIELD")) {
      return { type: "Field", path: this.previous().value };
    }

    if (this.match("PARAMETER")) {
      return { type: "Parameter", name: this.previous().value };
    }

    if (this.isAtEnd()) {
       throw new Error("Unexpected end of expression");
    }

    // Detect function call: IDENTIFIER followed by LPAREN
    if (this.peek().type === "IDENTIFIER") {
      const name = this.peek().value;
      const nextToken = this.tokens[this.current + 1];
      if (nextToken && nextToken.type === "LPAREN") {
        this.advance(); // consume IDENTIFIER
        this.advance(); // consume LPAREN
        const args: ASTNode[] = [];
        if (!this.check("RPAREN")) {
          do {
            args.push(this.parse());
          } while (this.match("COMMA"));
        }
        this.consume("RPAREN", "Expect ')' after function arguments.");
        return { type: "FunctionCall", name, arguments: args };
      }
    }

    // Standalone identifier (could be a keyword like true/false/null, or a system variable)
    if (this.match("IDENTIFIER")) {
      const name = this.previous().value;
      // Boolean and null keyword literals
      if (name === "true") return { type: "Literal", value: true };
      if (name === "false") return { type: "Literal", value: false };
      if (name === "null") return { type: "Literal", value: null };
      return { type: "Identifier", name };
    }

    // Parenthesized sub-expression: recursively parse the inner expression
    if (this.match("LPAREN")) {
      const expr = this.parse();
      this.consume("RPAREN", "Expect ')' after expression.");
      return expr;
    }

    throw new Error(
      `Unexpected token inside expression: '${this.peek().value}'`,
    );
  }
}

// ============================================================================
// Evaluator — Safe AST evaluator with a sandboxed environment
// ============================================================================

/**
 * Walks an AST and evaluates it against the provided data record and render context.
 * The evaluator is sandboxed — it cannot access the DOM, global scope, or execute
 * arbitrary code. It only resolves fields, parameters, operators, and built-in functions.
 */
export class Evaluator {
  /** The current data record (a single row from the dataset) */
  private data: any;
  /** The render context providing access to allData, groupData, parameters, page info, etc. */
  private renderContext: any = {};

  /**
   * @param data          - The current data record being rendered
   * @param renderContext - Contextual information (allData, groupData, parameters, pageNumber, etc.)
   */
  constructor(data?: any, renderContext?: any) {
    this.data = data;
    if (renderContext) {
      this.renderContext = renderContext;
    }
  }

  /**
   * Evaluate an AST node and return its computed value.
   * Dispatches to the appropriate handler based on node type.
   *
   * @param node - The AST node to evaluate
   * @returns The computed value (number, string, boolean, null, or undefined)
   */
  public evaluate(node: ASTNode): any {
    switch (node.type) {
      case "Literal":
        return node.value;

      case "Field":
        // Resolve field path from the current data record
        const val = getNestedProperty(this.data, node.path);
        // If not found on the local record, fall back to renderContext (global vars, allData)
        if (val === undefined && Array.isArray(this.renderContext?.allData)) {
          return getNestedProperty(this.renderContext, node.path);
        }
        return val;

      case "Parameter": {
        // Special-case: [RowIndex] resolves to the current row index
        if (node.name.toLowerCase() === "rowindex") {
          return this.data?.__rowIndex !== undefined
            ? this.data.__rowIndex
            : (this.data as any)?.rowIndex !== undefined
            ? (this.data as any).rowIndex
            : 0;
        }
        // Look up the parameter in renderContext.parameters first, then fall back to renderContext directly
        if (this.renderContext) {
          if (params && params[node.name] !== undefined) {
            return params[node.name];
          }
          if ((this.renderContext as any)[node.name] !== undefined) {
            return (this.renderContext as any)[node.name];
          }
        }
        return undefined;
      }

      case "Identifier":
        // Resolve system variable identifiers
        if (node.name.toLowerCase() === "pagenumber") {
          return this.renderContext?.pageNumber ?? 1;
        }
        if (node.name.toLowerCase() === "totalpages") {
          return this.renderContext?.totalPages ?? 1;
        }
        if (node.name.toLowerCase() === "rowindex") {
          return this.data?.__rowIndex !== undefined
            ? this.data.__rowIndex
            : this.renderContext?.rowIndices !== undefined
            ? this.renderContext.rowIndices[0]
            : (this.data as any)?.rowIndex !== undefined
            ? (this.data as any).rowIndex
            : 0;
        }
        return undefined;

      case "UnaryExpression": {
        const argVal = this.evaluate(node.argument);
        // Numeric negation
        if (node.operator === "-") return -Number(argVal);
        // Logical NOT
        if (node.operator === "!") return !argVal;
        return argVal;
      }

      case "BinaryExpression": {
        // --- Short-circuit / lazy operators (evaluate right side only if needed) ---
        if (node.operator === "??") {
          const leftVal = this.evaluate(node.left);
          return leftVal !== undefined && leftVal !== null
            ? leftVal
            : this.evaluate(node.right);
        }
        if (node.operator === "&&") {
          return this.evaluate(node.left) && this.evaluate(node.right);
        }
        if (node.operator === "||") {
          return this.evaluate(node.left) || this.evaluate(node.right);
        }

        const leftVal = this.evaluate(node.left);
        const rightVal = this.evaluate(node.right);

        // Cast "true"/"false" strings to booleans for relational comparison
        const castToValue = (val: any) => {
          if (val === "true" || val === true) return true;
          if (val === "false" || val === false) return false;
          return val;
        };

        const cLeft = castToValue(leftVal);
        const cRight = castToValue(rightVal);

        switch (node.operator) {
          case "+":
            // String concatenation if either operand is a string; otherwise numeric addition
            if (typeof leftVal === "string" || typeof rightVal === "string") {
              return String(leftVal ?? "") + String(rightVal ?? "");
            }
            return Number(leftVal ?? 0) + Number(rightVal ?? 0);
          case "-":
            return Number(leftVal ?? 0) - Number(rightVal ?? 0);
          case "*":
            return Number(leftVal ?? 0) * Number(rightVal ?? 0);
          case "/": {
            const r = Number(rightVal);
            // Guard against division by zero — returns 0 instead of Infinity
            return r === 0 ? 0 : Number(leftVal ?? 0) / r;
          }
          case "%": {
            const r = Number(rightVal);
            // Guard against modulo by zero — returns 0 instead of NaN
            return r === 0 ? 0 : Number(leftVal ?? 0) % r;
          }
          case "==":
            return cLeft == cRight;
          case "!=":
            return cLeft != cRight;
          case ">":
            return Number(cLeft) > Number(cRight);
          case "<":
            return Number(cLeft) < Number(cRight);
          case ">=":
            return Number(cLeft) >= Number(cRight);
          case "<=":
            return Number(cLeft) <= Number(cRight);
        }
        return undefined;
      }

      case "FunctionCall":
        return this.evaluateFunction(node.name, node.arguments);
    }
  }

  /**
   * Evaluate a built-in function call.
   * Handles conditional (If), system (Now), string (Concat, Upper, Lower, Format),
   * math (Abs, Round, Ceil, Floor), running aggregate (RunningTotal, RunningCount),
   * and aggregate (Sum, Avg, Min, Max, Count) functions.
   *
   * @param name - The function name (case-insensitive)
   * @param args - The AST node arguments (evaluated lazily for If; eagerly for all others)
   * @returns The computed function result
   */
  private evaluateFunction(name: string, args: ASTNode[]): any {
    const lowerName = name.toLowerCase();

    // If() is evaluated lazily — only the true/false branch matching the condition is evaluated
    if (lowerName === "if") {
      if (args.length < 3) return "";
      const condition = !!this.evaluate(args[0]);
      return condition ? this.evaluate(args[1]) : this.evaluate(args[2]);
    }

    // All other functions evaluate their arguments eagerly
    const resolvedArgs = args.map((arg) => this.evaluate(arg));

    switch (lowerName) {
      // --- System functions ---
      case "now": {
        const fmt = resolvedArgs[0];
        const date = new Date();
        if (typeof fmt === "string") {
          // Apply custom date/time format pattern (e.g. "yyyy-MM-dd HH:mm:ss")
          return formatDateTime(date, fmt);
        }
        return date.toLocaleString("zh-CN");
      }

      // --- String functions ---
      case "concat":
        return resolvedArgs.map((val) => val ?? "").join("");
      case "upper":
        return String(resolvedArgs[0] ?? "").toUpperCase();
      case "lower":
        return String(resolvedArgs[0] ?? "").toLowerCase();
      case "format": {
        const val = resolvedArgs[0];
        const mask = resolvedArgs[1];
        if (val == null) return "";
        if (typeof mask === "string") {
          return applyFormatting(val, mask);
        }
        return String(val);
      }

      // --- Math functions ---
      case "abs":
        return Math.abs(Number(resolvedArgs[0]) || 0);
      case "round": {
        const val = Number(resolvedArgs[0]) || 0;
        const decimals = Number(resolvedArgs[1]) || 0;
        return Number(val.toFixed(decimals));
      }
      case "ceil":
        return Math.ceil(Number(resolvedArgs[0]) || 0);
      case "floor":
        return Math.floor(Number(resolvedArgs[0]) || 0);

      // --- Running aggregate functions (accumulate up to current row) ---
      case "runningtotal":
      case "runningsum": {
        const field = resolvedArgs[0];    // Field name to sum (e.g. "price")
        const scope = resolvedArgs[1] || "report";  // "group" or "report"
        let list: any[] = [];

        if (scope === "group") {
          list = this.renderContext?.groupData || [];
        } else {
          list = this.renderContext?.allData || [];
        }

        if (list.length === 0) return 0;
        if (typeof field !== "string") return 0;

        // Find the current row index in the list
        let curIdx = list.indexOf(this.data);
        // Fallback: use __rowIndex metadata if direct reference lookup fails
        if (curIdx === -1 && this.data?.__rowIndex !== undefined) {
          curIdx = this.data.__rowIndex;
        }
        // Last resort: assume we're at the end of the list
        if (curIdx === -1) {
          curIdx = list.length - 1;
        }

        // Accumulate the field values from the start of the list up to the current index
        let runSum = 0;
        for (let i = 0; i <= curIdx && i < list.length; i++) {
          const val = Number(getNestedProperty(list[i], field));
          if (!isNaN(val)) {
            runSum += val;
          }
        }
        return runSum;
      }

      // Running count: number of rows from the start up to (and including) the current row
      case "runningcount": {
        const scope = resolvedArgs[0] || "report";
        let list: any[] = [];

        if (scope === "group") {
          list = this.renderContext?.groupData || [];
        } else {
          list = this.renderContext?.allData || [];
        }

        if (list.length === 0) return 0;

        // Find the current row index
        let curIdx = list.indexOf(this.data);
        if (curIdx === -1 && this.data?.__rowIndex !== undefined) {
          curIdx = this.data.__rowIndex;
        }
        if (curIdx === -1) {
          curIdx = list.length - 1;
        }

        return Math.min(curIdx + 1, list.length);
      }

      // --- Aggregate functions (evaluated over the entire dataset or group) ---
      case "sum":
      case "avg":
      case "min":
      case "max":
      case "count":
        return this.evaluateAggregate(lowerName, resolvedArgs);

      default:
        // Gracefully ignore unknown system functions and log/return error string
        return `[Unknown function: ${name}]`;
    }
  }

  /**
   * Evaluate aggregate functions (Sum, Avg, Min, Max, Count) over a data list.
   * The data list is determined by the scope parameter ("group", "report", "page")
   * or by falling back to the render context's available data arrays.
   *
   * @param func          - The aggregate function name (lowercase)
   * @param resolvedArgs  - Already-evaluated arguments: [field, scope?]
   * @returns The computed aggregate value, or 0 if no data is available
   */
  private evaluateAggregate(func: string, resolvedArgs: any[]): any {
    // Determine the data list for aggregation:
    // Priority: groupData (current group) → allData (entire dataset) → this.data (passed array)
    let list: any[] = [];
    let field = resolvedArgs[0]; // Field name to aggregate (e.g. "price")
    let scope = resolvedArgs[1]; // Optional scope: "group", "report", or "page"

    // Special handling for Count: if only one arg and it's a scope keyword, treat it as scope
    if (func === "count") {
      if (resolvedArgs.length === 1) {
        if (["group", "page", "report"].includes(resolvedArgs[0])) {
          scope = resolvedArgs[0];
          field = undefined;
        }
      }
    }

    // Select the data list based on scope
    if (scope === "group") {
      list = this.renderContext?.groupData || this.renderContext?.allData || [];
    } else if (scope === "report") {
      list = this.renderContext?.allData || [];
    } else if (scope === "page") {
      list = (this.renderContext as any)?.pageData || this.renderContext?.allData || [];
    } else {
      // No explicit scope — auto-detect from available context data
      if (Array.isArray(this.renderContext?.groupData)) {
        list = this.renderContext.groupData;
      } else if (Array.isArray(this.renderContext?.allData)) {
        list = this.renderContext.allData;
      } else if (Array.isArray(this.data)) {
        list = this.data;
      }
    }

    if (list.length === 0) return 0;

    if (func === "count") {
      // Count with a field: count non-null/non-undefined values for that field
      if (typeof field === "string") {
        return list
          .map((item) => getNestedProperty(item, field))
          .filter((val) => val !== undefined && val !== null).length;
      }
      return list.length;  // Count without a field: just return total row count
    }

    if (typeof field !== "string") return 0;  // Non-string field argument is invalid for Sum/Avg/Min/Max

    // Extract numeric values from the list for the given field
    const values = list
      .map((item) => Number(getNestedProperty(item, field)))
      .filter((val) => !isNaN(val));

    if (values.length === 0) return 0;

    switch (func) {
      case "sum":
        return values.reduce((sum, v) => sum + v, 0);
      case "avg":
        return values.reduce((sum, v) => sum + v, 0) / values.length;
      case "min":
        return Math.min(...values);
      case "max":
        return Math.max(...values);
    }
    return 0;
  }
}

// ============================================================================
// Formatting Helpers — Date/time and number formatting for formula functions
// ============================================================================

/**
 * Format a Date object using a pattern string.
 * Supported tokens: yyyy, MM, dd, HH, mm, ss
 *
 * @param date - The Date object to format
 * @param fmt  - The format pattern, e.g. "yyyy-MM-dd HH:mm:ss"
 * @returns The formatted date string
 */
function formatDateTime(date: Date, fmt: string): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const d = {
    yyyy: date.getFullYear(),
    MM: pad(date.getMonth() + 1),
    dd: pad(date.getDate()),
    HH: pad(date.getHours()),
    mm: pad(date.getMinutes()),
    ss: pad(date.getSeconds()),
  };
  let result = fmt;
  for (const [key, val] of Object.entries(d)) {
    result = result.replace(new RegExp(key, "g"), String(val));
  }
  return result;
}

/**
 * Apply a formatting mask to a value (used by the Format() built-in function).
 * Supports number masks with '#' and '0' placeholders, optional thousands separator ',',
 * and currency prefixes ($ or ￥).
 *
 * @param value - The value to format
 * @param mask  - The format mask (e.g. "#,##0.00", "￥#,##0", "$0.00")
 * @returns The formatted string
 */
function applyFormatting(value: any, mask: string): string {
  if (value == null) return "";
  const num = Number(value);

  // If it's a valid number and the mask contains numeric placeholders
  if (!isNaN(num) && (mask.includes("#") || mask.includes("0"))) {
    // Determine decimal places from the mask (e.g. ".00" → 2 decimals)
    const decimalsMatch = mask.match(/\.(0+)/);
    const decimals = decimalsMatch ? decimalsMatch[1].length : 0;

    // Check for thousands separator in the mask
    const useThousandSeparator = mask.includes(",");
    let formatted = num.toFixed(decimals);

    if (useThousandSeparator) {
      // Insert commas as thousands separators on the integer part only
      const parts = formatted.split(".");
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      formatted = parts.join(".");
    }

    // Prepend currency symbol if the mask starts with one
    if (mask.startsWith("￥") || mask.startsWith("\\￥")) {
      return "￥" + formatted;
    }
    if (mask.startsWith("$")) {
      return "$" + formatted;
    }
    return formatted;
  }

  // Fallback: if the mask doesn't match a number pattern, just return the string value
  return String(value);
}

// ============================================================================
// Top-Level API — Main entry point for formula evaluation
// ============================================================================

/**
 * Evaluate a formula expression against the provided data and render context.
 *
 * Supports four evaluation modes:
 * 1. **Formula mode** (`=expr`): Full AST-based evaluation of the expression after the '='
 * 2. **Pure field reference** (`{field.path}`): Fast-path resolution of a single field
 * 3. **Pure parameter reference** (`[ParamName]`): Fast-path resolution of a single parameter
 * 4. **Template literal** (`"Text {field} more [param]"`): Mixed text with embedded field/parameter references
 * 5. **Static literal**: If none of the above apply, returns the expression as-is
 *
 * @param expression    - The expression string to evaluate
 * @param data          - The current data record (a single row)
 * @param renderContext - The render context (allData, groupData, parameters, pageNumber, etc.)
 * @returns The evaluated result, or a fallback string on error
 */
export function evaluateFormula(
  expression: string,
  data?: any,
  renderContext?: any,
): any {
  if (expression == null) return "";
  const trimmed = String(expression).trim();

  try {
    // Mode 1: Formula expression starting with '=' — full lexer/parser/evaluator pipeline
    if (trimmed.startsWith("=")) {
      const code = trimmed.substring(1).trim();
      const lexer = new Lexer(code);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const ast = parser.parse();
      const evaluator = new Evaluator(data, renderContext);
      return evaluator.evaluate(ast);
    }

    // Mode 2: Pure field reference optimization — e.g. "{company.name}" without any operators
    if (
      trimmed.startsWith("{") &&
      trimmed.endsWith("}") &&
      !trimmed.slice(1, -1).includes("{")
    ) {
      const path = trimmed.slice(1, -1).trim();
      const val = getNestedProperty(data, path);
      if (val === undefined && renderContext) {
        return getNestedProperty(renderContext, path) ?? `[${path}]`;
      }
      return val !== undefined ? val : `[${path}]`;
    }

    // Mode 2b: Pure parameter reference optimization — e.g. "[ParameterName]"
    if (
      trimmed.startsWith("[") &&
      trimmed.endsWith("]") &&
      !trimmed.slice(1, -1).includes("[")
    ) {
      const path = trimmed.slice(1, -1).trim();
      if (path.toLowerCase() === "rowindex") {
        return data?.__rowIndex !== undefined
          ? data.__rowIndex
          : data?.rowIndex !== undefined
          ? data.rowIndex
          : 0;
      }
      const params = (renderContext as any)?.parameters;
      if (params && params[path] !== undefined) {
        return params[path];
      }
      if (renderContext && (renderContext as any)[path] !== undefined) {
        return (renderContext as any)[path];
      }
      return `[${path}]`;
    }

    // Mode 3: Mixed template literal — replace all {field} placeholders with evaluated values
    let resolvedStr = trimmed;
    if (resolvedStr.includes("{") && resolvedStr.includes("}")) {
      // Find all curly-brace expressions and evaluate each one
      resolvedStr = resolvedStr.replace(/\{([^{}]+)\}/g, (_match, innerExpr) => {
        // If the inner expression is a simple field path, use the fast {field} path;
        // otherwise treat it as a formula expression (=...)
        const formulaToEval = innerExpr.trim().match(/^[A-Za-z0-9_$.[\]]+$/)
          ? `{${innerExpr}}` // Pure variable reference
          : `=${innerExpr}`; // Complex expression

        const evaluated = evaluateFormula(formulaToEval, data, renderContext);
        return evaluated !== undefined && evaluated !== null
          ? String(evaluated)
          : "";
      });
    }

    // Mode 3b: Mixed template parameter replacement — replace all [param] placeholders
    if (resolvedStr.includes("[") && resolvedStr.includes("]")) {
      resolvedStr = resolvedStr.replace(/\[([^[\]]+)\]/g, (match, innerExpr) => {
        const path = innerExpr.trim();
        const params = (renderContext as any)?.parameters;
        if (params && params[path] !== undefined) {
          return String(params[path]);
        }
        if (renderContext && (renderContext as any)[path] !== undefined) {
          return String((renderContext as any)[path]);
        }
        // If the inner expression is a simple identifier, use fast [param] path;
        // otherwise treat it as a formula expression (=...)
        const formulaToEval = innerExpr.trim().match(/^[A-Za-z0-9_$.[\]]+$/)
          ? `[${innerExpr}]` // Pure variable reference
          : `=${innerExpr}`; // Complex expression

        const evaluated = evaluateFormula(formulaToEval, data, renderContext);
        return evaluated !== undefined && evaluated !== null
          ? String(evaluated)
          : match;
      });
    }

    // If any substitution occurred, return the resolved template string
    if (resolvedStr !== trimmed) {
      return resolvedStr;
    }

    // Mode 4: No special syntax — return the expression as a static literal
    return expression;
  } catch (err: any) {
    // Catch and log all evaluation errors, returning a safe placeholder string
    console.warn(
      `Formula Engine Error evaluating [${expression}]:`,
      err.message,
    );
    return `[Expression Error]`;
  }
}
