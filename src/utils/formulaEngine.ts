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

export type TokenType =
  | "NUMBER"
  | "STRING"
  | "IDENTIFIER" // e.g. If, Sum, Now, etc.
  | "FIELD" // e.g. {user.name}
  | "PARAMETER" // e.g. [ParameterName]
  | "OPERATOR" // + - * / % == != >= <= > < && || ! ??
  | "LPAREN" // (
  | "RPAREN" // )
  | "COMMA" // ,
  | "EOF";

export interface Token {
  type: TokenType;
  value: string;
}

// Helper to safely get nested property from object using path like "user.profile.name" or "items[0].price"
export function getNestedProperty(obj: any, path: string): any {
  if (obj == null) return undefined;
  // Normalize bracket notation e.g. items[0].price -> items.0.price
  const normalizedPath = path.replace(/\[(\w+)\]/g, ".$1").replace(/^\./, "");

  const parts = normalizedPath.split(".");
  let current = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

// Lexer Class
export class Lexer {
  private input: string;
  private pos = 0;
  private length = 0;

  constructor(input: string) {
    this.input = input;
    this.length = input.length;
  }

  private peek(): string {
    return this.pos < this.length ? this.input[this.pos] : "";
  }

  private next(): string {
    const char = this.peek();
    this.pos++;
    return char;
  }

  private skipWhitespace() {
    while (this.pos < this.length && /\s/.test(this.input[this.pos])) {
      this.pos++;
    }
  }

  public tokenize(): Token[] {
    const tokens: Token[] = [];
    while (this.pos < this.length) {
      this.skipWhitespace();
      if (this.pos >= this.length) break;

      const char = this.peek();

      // Number
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

      // String literal with single or double quotes
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

      // Field brackets: {fieldName} or {nested.object.field}
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

      // Parameter brackets: [paramName]
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

      // Parentheses & Separators
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

      // Complex Operators check
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

      // Identifier (for function names or system fields)
      if (/[a-zA-Z_]/.test(char)) {
        let identStr = "";
        while (this.pos < this.length && /[a-zA-Z0-9_]/.test(this.peek())) {
          identStr += this.next();
        }
        tokens.push({ type: "IDENTIFIER", value: identStr });
        continue;
      }

      // Fallback for unexpected characters - treat as literal single char operator/text safely
      tokens.push({ type: "OPERATOR", value: this.next() });
    }
    tokens.push({ type: "EOF", value: "" });
    return tokens;
  }
}

// AST Nodes
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

// Parser Class
export class Parser {
  private tokens: Token[];
  private current = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }

  private isAtEnd(): boolean {
    return this.peek().type === "EOF";
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private matchOperator(...ops: string[]): boolean {
    if (this.isAtEnd()) return false;
    const token = this.peek();
    if (token.type === "OPERATOR" && ops.includes(token.value)) {
      this.advance();
      return true;
    }
    return false;
  }

  private consume(type: TokenType, errorMessage: string): Token {
    if (this.check(type)) return this.advance();
    throw new Error(
      `${errorMessage} (Found token '${this.peek().type}' with value '${this.peek().value}' at index ${this.current})`,
    );
  }

  // Parses starting at the lowest precedence - Null Coalescing `??`
  public parse(): ASTNode {
    return this.nullCoalescing();
  }

  private nullCoalescing(): ASTNode {
    let expr = this.logicalOr();
    while (this.matchOperator("??")) {
      const operator = this.previous().value;
      const right = this.logicalOr();
      expr = { type: "BinaryExpression", operator, left: expr, right };
    }
    return expr;
  }

  private logicalOr(): ASTNode {
    let expr = this.logicalAnd();
    while (this.matchOperator("||")) {
      const operator = this.previous().value;
      const right = this.logicalAnd();
      expr = { type: "BinaryExpression", operator, left: expr, right };
    }
    return expr;
  }

  private logicalAnd(): ASTNode {
    let expr = this.equality();
    while (this.matchOperator("&&")) {
      const operator = this.previous().value;
      const right = this.equality();
      expr = { type: "BinaryExpression", operator, left: expr, right };
    }
    return expr;
  }

  private equality(): ASTNode {
    let expr = this.comparison();
    while (this.matchOperator("==", "!=")) {
      const operator = this.previous().value;
      const right = this.comparison();
      expr = { type: "BinaryExpression", operator, left: expr, right };
    }
    return expr;
  }

  private comparison(): ASTNode {
    let expr = this.term();
    while (this.matchOperator(">", "<", ">=", "<=")) {
      const operator = this.previous().value;
      const right = this.term();
      expr = { type: "BinaryExpression", operator, left: expr, right };
    }
    return expr;
  }

  private term(): ASTNode {
    let expr = this.factor();
    while (this.matchOperator("+", "-")) {
      const operator = this.previous().value;
      const right = this.factor();
      expr = { type: "BinaryExpression", operator, left: expr, right };
    }
    return expr;
  }

  private factor(): ASTNode {
    let expr = this.unary();
    while (this.matchOperator("*", "/", "%")) {
      const operator = this.previous().value;
      const right = this.unary();
      expr = { type: "BinaryExpression", operator, left: expr, right };
    }
    return expr;
  }

  private unary(): ASTNode {
    if (this.matchOperator("-", "!")) {
      const operator = this.previous().value;
      const right = this.unary();
      return { type: "UnaryExpression", operator, argument: right };
    }
    return this.primary();
  }

  private primary(): ASTNode {
    if (this.match("NUMBER")) {
      const valStr = this.previous().value;
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

    // Inspect if upcoming sequence is a Function Call: IDENTIFIER and then LPAREN
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

    if (this.match("IDENTIFIER")) {
      const name = this.previous().value;
      if (name === "true") return { type: "Literal", value: true };
      if (name === "false") return { type: "Literal", value: false };
      if (name === "null") return { type: "Literal", value: null };
      return { type: "Identifier", name };
    }

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

// Safe AST Evaluator implementation with custom sandbox environment
export class Evaluator {
  private data: any;
  private renderContext: any = {};

  constructor(data?: any, renderContext?: any) {
    this.data = data;
    if (renderContext) {
      this.renderContext = renderContext;
    }
  }

  public evaluate(node: ASTNode): any {
    switch (node.type) {
      case "Literal":
        return node.value;

      case "Field":
        // Safe level path resolution
        const val = getNestedProperty(this.data, node.path);
        // If it's not found on local data record, check in allData or fallback to empty/string representation
        if (val === undefined && Array.isArray(this.renderContext?.allData)) {
          // Fallback to checking first item or general scoped keys (e.g. global vars)
          return getNestedProperty(this.renderContext, node.path);
        }
        return val;

      case "Parameter": {
        if (node.name.toLowerCase() === "rowindex") {
          return this.data?.__rowIndex !== undefined
            ? this.data.__rowIndex
            : (this.data as any)?.rowIndex !== undefined
            ? (this.data as any).rowIndex
            : 0;
        }
        if (this.renderContext) {
          const params = (this.renderContext as any).parameters;
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
        // Resolve system keywords (PageNumber, TotalPages, etc.)
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
        if (node.operator === "-") return -Number(argVal);
        if (node.operator === "!") return !argVal;
        return argVal;
      }

      case "BinaryExpression": {
        // Handle Lazy Logical & Nullish Operators
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

        // Help relational casting for boolean/boolean-equivalent comparison
        const castToValue = (val: any) => {
          if (val === "true" || val === true) return true;
          if (val === "false" || val === false) return false;
          return val;
        };

        const cLeft = castToValue(leftVal);
        const cRight = castToValue(rightVal);

        switch (node.operator) {
          case "+":
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
            return r === 0 ? 0 : Number(leftVal ?? 0) / r;
          }
          case "%": {
            const r = Number(rightVal);
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

  private evaluateFunction(name: string, args: ASTNode[]): any {
    const lowerName = name.toLowerCase();

    // Lazy / Conditional function (Important: evaluate cond lazily)
    if (lowerName === "if") {
      if (args.length < 3) return "";
      const condition = !!this.evaluate(args[0]);
      return condition ? this.evaluate(args[1]) : this.evaluate(args[2]);
    }

    // Evaluate all other function arguments
    const resolvedArgs = args.map((arg) => this.evaluate(arg));

    switch (lowerName) {
      // System
      case "now": {
        const fmt = resolvedArgs[0];
        const date = new Date();
        if (typeof fmt === "string") {
          // basic local formatting helper
          return formatDateTime(date, fmt);
        }
        return date.toLocaleString("zh-CN");
      }

      // Strings
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

      // Math
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

      case "runningtotal":
      case "runningsum": {
        const field = resolvedArgs[0];
        const scope = resolvedArgs[1] || "report";
        let list: any[] = [];

        if (scope === "group") {
          list = this.renderContext?.groupData || [];
        } else {
          list = this.renderContext?.allData || [];
        }

        if (list.length === 0) return 0;
        if (typeof field !== "string") return 0;

        let curIdx = list.indexOf(this.data);
        if (curIdx === -1 && this.data?.__rowIndex !== undefined) {
          curIdx = this.data.__rowIndex;
        }
        if (curIdx === -1) {
          curIdx = list.length - 1;
        }

        let runSum = 0;
        for (let i = 0; i <= curIdx && i < list.length; i++) {
          const val = Number(getNestedProperty(list[i], field));
          if (!isNaN(val)) {
            runSum += val;
          }
        }
        return runSum;
      }

      case "runningcount": {
        const scope = resolvedArgs[0] || "report";
        let list: any[] = [];

        if (scope === "group") {
          list = this.renderContext?.groupData || [];
        } else {
          list = this.renderContext?.allData || [];
        }

        if (list.length === 0) return 0;

        let curIdx = list.indexOf(this.data);
        if (curIdx === -1 && this.data?.__rowIndex !== undefined) {
          curIdx = this.data.__rowIndex;
        }
        if (curIdx === -1) {
          curIdx = list.length - 1;
        }

        return Math.min(curIdx + 1, list.length);
      }

      // Aggregate Functions (Evaluated over arrays)
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

  // High-performance aggregations over current dataset context
  private evaluateAggregate(func: string, resolvedArgs: any[]): any {
    // Aggregates require array target. In our engine, context.groupData (current grouping)
    // takes priority, then fallback to context.allData (entire records subset), or local passed arrays.
    let list: any[] = [];
    let field = resolvedArgs[0]; // first parameter is usually a field string Name e.g. "price"
    let scope = resolvedArgs[1];

    if (func === "count") {
      if (resolvedArgs.length === 1) {
        if (["group", "page", "report"].includes(resolvedArgs[0])) {
          scope = resolvedArgs[0];
          field = undefined;
        }
      }
    }

    if (scope === "group") {
      list = this.renderContext?.groupData || this.renderContext?.allData || [];
    } else if (scope === "report") {
      list = this.renderContext?.allData || [];
    } else if (scope === "page") {
      list = (this.renderContext as any)?.pageData || this.renderContext?.allData || [];
    } else {
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
      if (typeof field === "string") {
        return list
          .map((item) => getNestedProperty(item, field))
          .filter((val) => val !== undefined && val !== null).length;
      }
      return list.length;
    }

    if (typeof field !== "string") return 0;

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

// Basic format patterns implementation (Excel-like and string masks)
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

function applyFormatting(value: any, mask: string): string {
  if (value == null) return "";
  const num = Number(value);

  // If it's a valid Number and mask contains '#' or '0'
  if (!isNaN(num) && (mask.includes("#") || mask.includes("0"))) {
    const decimalsMatch = mask.match(/\.(0+)/);
    const decimals = decimalsMatch ? decimalsMatch[1].length : 0;

    // Check thousands separator ','
    const useThousandSeparator = mask.includes(",");
    let formatted = num.toFixed(decimals);

    if (useThousandSeparator) {
      const parts = formatted.split(".");
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      formatted = parts.join(".");
    }

    // Currency indicators (e.g. ￥ or $)
    if (mask.startsWith("￥") || mask.startsWith("\\￥")) {
      return "￥" + formatted;
    }
    if (mask.startsWith("$")) {
      return "$" + formatted;
    }
    return formatted;
  }

  // Fallback to basic string replacement masks
  return String(value);
}

/**
 * Top-Level API: Safe, secure, and fast Formula Evaluation
 */
export function evaluateFormula(
  expression: string,
  data?: any,
  renderContext?: any,
): any {
  if (expression == null) return "";
  const trimmed = String(expression).trim();

  try {
    // 1. Core formula marker: begins with '='
    if (trimmed.startsWith("=")) {
      const code = trimmed.substring(1).trim();
      const lexer = new Lexer(code);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const ast = parser.parse();
      const evaluator = new Evaluator(data, renderContext);
      return evaluator.evaluate(ast);
    }

    // 2. Pure brackets optimization (e.g., {company.name})
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

    // 2b. Pure parameter brackets optimization (e.g., [ParameterName])
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

    // 3. Mixed template literal replacement (e.g., "Amount: {qty} * {price}!")
    let resolvedStr = trimmed;
    if (resolvedStr.includes("{") && resolvedStr.includes("}")) {
      // Find all nested bracket expressions, parse and run them via formula evaluation recursively
      resolvedStr = resolvedStr.replace(/\{([^{}]+)\}/g, (_match, innerExpr) => {
        // Wrap inner expression as a formula if it contains formulas or operators
        const formulaToEval = innerExpr.trim().match(/^[A-Za-z0-9_$.[\]]+$/)
          ? `{${innerExpr}}` // pure variable fallback
          : `=${innerExpr}`;

        const evaluated = evaluateFormula(formulaToEval, data, renderContext);
        return evaluated !== undefined && evaluated !== null
          ? String(evaluated)
          : "";
      });
    }

    // 3b. Mixed template parameter replacement (e.g., "Welcome [UserName]!")
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
        // Wrap inner expression as a formula if it contains formulas or operators
        const formulaToEval = innerExpr.trim().match(/^[A-Za-z0-9_$.[\]]+$/)
          ? `[${innerExpr}]` // pure variable fallback
          : `=${innerExpr}`;

        const evaluated = evaluateFormula(formulaToEval, data, renderContext);
        return evaluated !== undefined && evaluated !== null
          ? String(evaluated)
          : match;
      });
    }

    if (resolvedStr !== trimmed) {
      return resolvedStr;
    }

    // 4. Default return static literal
    return expression;
  } catch (err: any) {
    console.warn(
      `Formula Engine Error evaluating [${expression}]:`,
      err.message,
    );
    return `[Expression Error]`;
  }
}
