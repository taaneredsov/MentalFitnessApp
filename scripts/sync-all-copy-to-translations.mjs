#!/usr/bin/env node

import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import ts from "typescript";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const BASE_ID = process.env.AIRTABLE_BASE_ID;
const TOKEN = process.env.AIRTABLE_ACCESS_TOKEN;
const TABLE_NAME = "Vertalingen";
const SRC_ROOT = path.resolve("src");

if (!BASE_ID || !TOKEN) {
  console.error("Missing AIRTABLE_BASE_ID or AIRTABLE_ACCESS_TOKEN in .env.local");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
};

const COPY_ATTRS = new Set([
  "placeholder",
  "title",
  "aria-label",
  "aria-description",
  "alt",
  "label",
  "aria-placeholder",
]);

const COPY_PROP_NAMES = new Set([
  "title",
  "description",
  "label",
  "text",
  "placeholder",
  "content",
  "message",
  "subtitle",
]);

const USER_COPY_CALLS = new Set([
  "setError",
  "setNotificationError",
  "setNotificationMessage",
  "setSuccess",
  "setMessage",
  "toast",
  "alert",
  "confirm",
  "prompt",
]);

const VALIDATION_CALLS = new Set(["email", "min", "max", "length", "regex", "refine", "superRefine"]);
const EXCLUDE_FILE_RE = /(^|\/)__tests__(\/|$)|\.test\.(t|j)sx?$|\.spec\.(t|j)sx?$/;

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeForCompare(value) {
  return normalizeWhitespace(value).toLowerCase();
}

function hasLetters(value) {
  return /\p{L}/u.test(value);
}

function isLikelyUserCopy(raw) {
  const value = normalizeWhitespace(raw);
  if (!value) return false;
  if (!hasLetters(value)) return false;
  if (value.length < 2) return false;

  if (/^(https?:\/\/|\/?api\/|\/?assets\/|\/?images\/)/i.test(value)) return false;
  if (/^(true|false|null|undefined)$/i.test(value)) return false;
  if (/^[0-9]+$/.test(value)) return false;

  if (/^(application\/json|content-type|one-time-code|numeric|serviceworker|passwordhash)$/i.test(value)) return false;
  if (/^(orbit|linear|infinite|ease-in-out|ease-out|translatex|rotate|arrowleft|arrowright|escape|enter)$/i.test(value)) return false;
  if (/(calc\(|translate|rotate\(|scale\(|ease-|linear|infinite)/i.test(value)) return false;

  if (/^[a-z0-9_.-]+$/.test(value) && !value.includes(" ")) {
    return false;
  }

  if (value.startsWith("{") && value.endsWith("}")) return false;
  if (value.startsWith("/") && !value.includes(" ")) return false;
  if (value.endsWith("(") || value.startsWith(")")) return false;
  if ((value.startsWith("\"") && !value.endsWith("\"")) || (!value.startsWith("\"") && value.endsWith("\""))) return false;
  if ((value.startsWith("'") && !value.endsWith("'")) || (!value.startsWith("'") && value.endsWith("'"))) return false;
  if (/^[A-Z][a-zA-Z0-9]+$/.test(value) && /^(Arrow|Loader|Dialog|Card|Button|Chevron|Refresh|Trash|Globe|Database|Zap)/.test(value)) return false;

  if (!value.includes(" ")) {
    if (/^[a-z]/.test(value)) return false;
    if (value.length <= 2 && !/^(UI|UX|AI|NL|EN|FR|SW|RQ|OK)$/i.test(value)) return false;
  }

  return true;
}

function propName(nameNode) {
  if (!nameNode) return null;
  if (ts.isIdentifier(nameNode) || ts.isPrivateIdentifier(nameNode)) return nameNode.text;
  if (ts.isStringLiteral(nameNode) || ts.isNumericLiteral(nameNode)) return nameNode.text;
  return null;
}

function calleeName(expr) {
  if (ts.isIdentifier(expr)) return expr.text;
  if (ts.isPropertyAccessExpression(expr)) {
    const left = calleeName(expr.expression);
    if (!left) return expr.name.text;
    return `${left}.${expr.name.text}`;
  }
  return null;
}

function hasAncestor(node, predicate) {
  let cur = node.parent;
  while (cur) {
    if (predicate(cur)) return cur;
    cur = cur.parent;
  }
  return null;
}

function getJsxAttributeAncestor(node) {
  return hasAncestor(node, (n) => ts.isJsxAttribute(n));
}

function isInJsxTree(node) {
  return Boolean(
    hasAncestor(
      node,
      (n) => ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n) || ts.isJsxExpression(n),
    ),
  );
}

function isConsoleCall(callName) {
  return callName.startsWith("console.");
}

async function listSourceFiles(dir) {
  const out = [];

  async function walk(current) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(abs);
        continue;
      }

      if (!/\.(ts|tsx)$/.test(entry.name)) continue;
      if (EXCLUDE_FILE_RE.test(abs)) continue;
      out.push(abs);
    }
  }

  await walk(dir);
  return out;
}

function buildAutoKey(text, existingKeys) {
  const hash = crypto.createHash("sha1").update(text).digest("hex").slice(0, 8);
  const slug = text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 48) || "copy";

  let key = `autogen.copy.${slug}.${hash}`;
  let i = 2;
  while (existingKeys.has(key)) {
    key = `autogen.copy.${slug}.${hash}.${i}`;
    i += 1;
  }
  existingKeys.add(key);
  return key;
}

async function airtableJson(url, options = {}) {
  const res = await fetch(url, options);
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`Airtable ${res.status}: ${body}`);
  }
  return body ? JSON.parse(body) : {};
}

async function findTableByName(name) {
  const meta = await airtableJson(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`, { headers });
  return meta.tables?.find((t) => t.name === name) || null;
}

async function fetchExistingTranslations(tableId) {
  const rows = [];
  let offset = null;

  do {
    const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${tableId}`);
    url.searchParams.set("pageSize", "100");
    url.searchParams.append("fields[]", "Key");
    url.searchParams.append("fields[]", "nl");
    if (offset) url.searchParams.set("offset", offset);

    const page = await airtableJson(url.toString(), { headers });
    rows.push(...(page.records || []));
    offset = page.offset || null;
  } while (offset);

  const existingByKey = new Map();
  const existingNlNorm = new Set();
  for (const row of rows) {
    const key = row.fields?.Key;
    const nl = row.fields?.nl;
    if (key) existingByKey.set(key, row);
    if (nl) existingNlNorm.add(normalizeForCompare(nl));
  }

  return { existingByKey, existingNlNorm, count: rows.length };
}

async function extractCopyCandidates() {
  const files = await listSourceFiles(SRC_ROOT);
  const byText = new Map();

  for (const file of files) {
    const content = await fs.readFile(file, "utf8");
    const scriptKind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const sf = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, scriptKind);

    function addCandidate(rawText, node, reason) {
      const text = normalizeWhitespace(rawText);
      if (!isLikelyUserCopy(text)) return;

      const norm = normalizeForCompare(text);
      const rel = path.relative(process.cwd(), file);
      const lc = sf.getLineAndCharacterOfPosition(node.getStart(sf));
      const location = `${rel}:${lc.line + 1}`;

      const existing = byText.get(norm);
      if (!existing) {
        byText.set(norm, {
          text,
          locations: [location],
          reason,
        });
        return;
      }

      if (existing.locations.length < 5 && !existing.locations.includes(location)) {
        existing.locations.push(location);
      }
    }

    function visit(node) {
      if (ts.isJsxText(node)) {
        addCandidate(node.getText(sf), node, "jsx-text");
      }

      if (ts.isStringLiteralLike(node)) {
        const parent = node.parent;
        const jsxAttr = getJsxAttributeAncestor(node);

        if (jsxAttr) {
          const name = jsxAttr.name.getText(sf).toLowerCase();
          if (COPY_ATTRS.has(name)) {
            addCandidate(node.text, node, `jsx-attr:${name}`);
          }
        } else if (isInJsxTree(node)) {
          addCandidate(node.text, node, "jsx-expression");
        } else if (ts.isCallExpression(parent)) {
          const name = calleeName(parent.expression) || "";
          const short = name.split(".").at(-1) || "";

          if (isConsoleCall(name)) {
            // Ignore logs.
          } else if (USER_COPY_CALLS.has(name) || USER_COPY_CALLS.has(short)) {
            addCandidate(node.text, node, `call:${name}`);
          } else if (VALIDATION_CALLS.has(short)) {
            addCandidate(node.text, node, `validation:${short}`);
          }
        } else if (ts.isPropertyAssignment(parent)) {
          const pn = propName(parent.name);
          if (pn && COPY_PROP_NAMES.has(pn)) {
            addCandidate(node.text, node, `prop:${pn}`);
          }
        } else if (ts.isConditionalExpression(parent) || ts.isBinaryExpression(parent)) {
          const vd = hasAncestor(node, (n) => ts.isVariableDeclaration(n));
          const varName = vd && ts.isIdentifier(vd.name) ? vd.name.text : "";
          if (/error|title|label|text|description|message|placeholder|status/i.test(varName)) {
            addCandidate(node.text, node, `var:${varName}`);
          }
        }
      }

      ts.forEachChild(node, visit);
    }

    visit(sf);
  }

  return Array.from(byText.values());
}

async function upsertRows(tableId, rows) {
  const batchSize = 10;
  let processed = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);

    await airtableJson(`https://api.airtable.com/v0/${BASE_ID}/${tableId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        performUpsert: { fieldsToMergeOn: ["Key"] },
        records: batch.map((row) => ({
          fields: {
            Key: row.key,
            nl: row.nl,
            fr: row.fr || "",
            en: row.en || "",
            Context: row.context || "",
          },
        })),
      }),
    });

    processed += batch.length;
    process.stdout.write(`\rUpserted ${processed}/${rows.length}`);

    if (i + batchSize < rows.length) {
      await new Promise((resolve) => setTimeout(resolve, 220));
    }
  }

  process.stdout.write("\n");
}

async function main() {
  const table = await findTableByName(TABLE_NAME);
  if (!table) {
    throw new Error(`Table '${TABLE_NAME}' does not exist. Run create table script first.`);
  }

  const { existingByKey, existingNlNorm, count } = await fetchExistingTranslations(table.id);
  const existingKeys = new Set(existingByKey.keys());

  console.log(`Using table ${TABLE_NAME} (${table.id})`);
  console.log(`Existing translation rows: ${count}`);

  const candidates = await extractCopyCandidates();
  console.log(`Detected user-facing copy candidates in src/: ${candidates.length}`);

  const missing = [];
  for (const c of candidates) {
    if (existingNlNorm.has(normalizeForCompare(c.text))) continue;

    const context = `Auto-extracted (${c.reason}): ${c.locations.slice(0, 3).join("; ")}`.slice(0, 250);
    missing.push({
      key: buildAutoKey(c.text, existingKeys),
      nl: c.text,
      fr: "",
      en: "",
      context,
    });
  }

  if (missing.length === 0) {
    console.log("No missing copy found. Vertalingen already covers detected UI copy.");
    return;
  }

  console.log(`Missing copy rows to add: ${missing.length}`);
  await upsertRows(table.id, missing);

  console.log("Done.");
  console.log(`Added ${missing.length} new rows to '${TABLE_NAME}'.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
