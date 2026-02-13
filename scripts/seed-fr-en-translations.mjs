#!/usr/bin/env node

import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const BASE_ID = process.env.AIRTABLE_BASE_ID;
const TOKEN = process.env.AIRTABLE_ACCESS_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TABLE_NAME = "Vertalingen";
const OPENAI_MODEL = process.env.OPENAI_TRANSLATION_MODEL || "gpt-4.1-mini";

if (!BASE_ID || !TOKEN) {
  console.error("Missing AIRTABLE_BASE_ID or AIRTABLE_ACCESS_TOKEN in .env.local");
  process.exit(1);
}

if (!OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY in .env.local");
  process.exit(1);
}

const airtableHeaders = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
};

const openaiHeaders = {
  Authorization: `Bearer ${OPENAI_API_KEY}`,
  "Content-Type": "application/json",
};

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  const meta = await airtableJson(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`, {
    headers: airtableHeaders,
  });
  return meta.tables?.find((t) => t.name === name) || null;
}

async function fetchAllRows(tableId) {
  const rows = [];
  let offset = null;

  do {
    const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${tableId}`);
    url.searchParams.set("pageSize", "100");
    url.searchParams.append("fields[]", "Key");
    url.searchParams.append("fields[]", "nl");
    url.searchParams.append("fields[]", "fr");
    url.searchParams.append("fields[]", "en");
    if (offset) url.searchParams.set("offset", offset);

    const page = await airtableJson(url.toString(), { headers: airtableHeaders });
    rows.push(...(page.records || []));
    offset = page.offset || null;
  } while (offset);

  return rows;
}

function protectPlaceholders(text) {
  const tokens = [];
  let protectedText = text;

  const patterns = [
    /\{\{[^{}]+\}\}/g, // {{name}}
    /\{\d+\}/g, // {0}
    /%\d*\$?[sdif]/g, // %s %d
    /:[a-zA-Z_][a-zA-Z0-9_]*/g, // :count
  ];

  for (const pattern of patterns) {
    protectedText = protectedText.replace(pattern, (match) => {
      const token = `__PH_${tokens.length}__`;
      tokens.push(match);
      return token;
    });
  }

  return { protectedText, tokens };
}

function restorePlaceholders(text, tokens) {
  let result = text;
  for (let i = 0; i < tokens.length; i += 1) {
    const token = `__PH_${i}__`;
    result = result.split(token).join(tokens[i]);
  }
  return result;
}

function chunk(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

function extractTextFromResponse(data) {
  if (Array.isArray(data?.output)) {
    const chunks = [];
    for (const item of data.output) {
      if (!Array.isArray(item?.content)) continue;
      for (const c of item.content) {
        if (typeof c?.text === "string") chunks.push(c.text);
      }
    }
    if (chunks.length > 0) return chunks.join("\n");
  }

  if (typeof data?.output_text === "string" && data.output_text) {
    return data.output_text;
  }

  if (typeof data?.text === "string" && data.text) {
    return data.text;
  }

  return "";
}

function parseJsonLoose(text) {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Empty model response");

  try {
    return JSON.parse(trimmed);
  } catch {
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const maybe = trimmed.slice(firstBrace, lastBrace + 1);
      return JSON.parse(maybe);
    }
    throw new Error("Model did not return valid JSON");
  }
}

async function openaiTranslateBatch(items, targetLangLabel) {
  const payload = {
    model: OPENAI_MODEL,
    input: [
      {
        role: "system",
        content:
          "You are a professional UI translator. Translate Dutch text to the target language. Keep placeholders exactly unchanged: __PH_n__, {{var}}, {0}, %s, %d, :count. Preserve newlines and concise UI tone. Return JSON only.",
      },
      {
        role: "user",
        content: `Target language: ${targetLangLabel}\n\nTranslate these items and return JSON in shape {\"translations\":[{\"id\":\"...\",\"text\":\"...\"}]}. Do not omit any id.\n\n${JSON.stringify(items)}`,
      },
    ],
    temperature: 0,
  };

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: openaiHeaders,
    body: JSON.stringify(payload),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`OpenAI ${res.status}: ${raw}`);
  }

  const data = raw ? JSON.parse(raw) : {};
  const text = extractTextFromResponse(data);
  const parsed = parseJsonLoose(text);

  if (!Array.isArray(parsed?.translations)) {
    throw new Error("Invalid translation payload shape from model");
  }

  const out = new Map();
  for (const row of parsed.translations) {
    if (!row || typeof row.id !== "string" || typeof row.text !== "string") continue;
    out.set(row.id, row.text);
  }

  if (out.size !== items.length) {
    throw new Error(`Model returned ${out.size}/${items.length} translations`);
  }

  return out;
}

async function translateUniqueStrings(uniqueNlTexts, targetLangCode) {
  const targetLangLabel = targetLangCode === "fr" ? "French (France)" : "English (UK)";
  const entries = Array.from(uniqueNlTexts.values());
  const batches = chunk(entries, 35);
  const translations = new Map();

  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i];
    const modelItems = batch.map((item) => ({ id: item.id, text: item.protectedText }));

    let done = false;
    let lastErr = null;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const translated = await openaiTranslateBatch(modelItems, targetLangLabel);
        for (const item of batch) {
          const rawTranslated = translated.get(item.id) || item.protectedText;
          const restored = restorePlaceholders(rawTranslated, item.tokens);
          translations.set(item.originalNl, normalizeWhitespace(restored));
        }
        done = true;
        break;
      } catch (err) {
        lastErr = err;
        await sleep(500 * attempt);
      }
    }

    if (!done) {
      throw new Error(`Failed ${targetLangCode} batch ${i + 1}/${batches.length}: ${lastErr?.message || String(lastErr)}`);
    }

    process.stdout.write(`\r${targetLangCode.toUpperCase()} translated batches: ${i + 1}/${batches.length}`);
    await sleep(120);
  }

  process.stdout.write("\n");
  return translations;
}

async function updateRows(tableId, rowsToUpdate) {
  const batches = chunk(rowsToUpdate, 10);

  for (let i = 0; i < batches.length; i += 1) {
    const records = batches[i].map((row) => ({
      id: row.id,
      fields: row.fields,
    }));

    await airtableJson(`https://api.airtable.com/v0/${BASE_ID}/${tableId}`, {
      method: "PATCH",
      headers: airtableHeaders,
      body: JSON.stringify({ records }),
    });

    process.stdout.write(`\rUpdated Airtable rows: ${Math.min((i + 1) * 10, rowsToUpdate.length)}/${rowsToUpdate.length}`);
    await sleep(220);
  }

  process.stdout.write("\n");
}

async function main() {
  const table = await findTableByName(TABLE_NAME);
  if (!table) {
    throw new Error(`Table '${TABLE_NAME}' does not exist.`);
  }

  const rows = await fetchAllRows(table.id);
  const missingFr = rows.filter((r) => r.fields?.nl && !String(r.fields?.fr || "").trim());
  const missingEn = rows.filter((r) => r.fields?.nl && !String(r.fields?.en || "").trim());

  console.log(`Using table ${TABLE_NAME} (${table.id})`);
  console.log(`Rows total: ${rows.length}`);
  console.log(`Rows missing fr: ${missingFr.length}`);
  console.log(`Rows missing en: ${missingEn.length}`);

  if (missingFr.length === 0 && missingEn.length === 0) {
    console.log("Nothing to seed. fr/en already filled.");
    return;
  }

  const frUnique = new Map();
  for (const row of missingFr) {
    const nl = String(row.fields.nl);
    if (!frUnique.has(nl)) {
      const { protectedText, tokens } = protectPlaceholders(nl);
      frUnique.set(nl, {
        id: `nl_${frUnique.size + 1}`,
        originalNl: nl,
        protectedText,
        tokens,
      });
    }
  }

  const enUnique = new Map();
  for (const row of missingEn) {
    const nl = String(row.fields.nl);
    if (!enUnique.has(nl)) {
      const { protectedText, tokens } = protectPlaceholders(nl);
      enUnique.set(nl, {
        id: `nl_${enUnique.size + 1}`,
        originalNl: nl,
        protectedText,
        tokens,
      });
    }
  }

  console.log(`Unique NL strings for fr: ${frUnique.size}`);
  console.log(`Unique NL strings for en: ${enUnique.size}`);

  const frTranslations = missingFr.length ? await translateUniqueStrings(frUnique, "fr") : new Map();
  const enTranslations = missingEn.length ? await translateUniqueStrings(enUnique, "en") : new Map();

  const updates = [];
  for (const row of rows) {
    const nl = String(row.fields?.nl || "");
    if (!nl) continue;

    const hasFr = String(row.fields?.fr || "").trim().length > 0;
    const hasEn = String(row.fields?.en || "").trim().length > 0;

    const fields = {};
    if (!hasFr) {
      const translated = frTranslations.get(nl);
      if (translated) fields.fr = translated;
    }

    if (!hasEn) {
      const translated = enTranslations.get(nl);
      if (translated) fields.en = translated;
    }

    if (Object.keys(fields).length > 0) {
      updates.push({ id: row.id, fields });
    }
  }

  console.log(`Rows to update in Airtable: ${updates.length}`);
  await updateRows(table.id, updates);

  console.log("Done.");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
