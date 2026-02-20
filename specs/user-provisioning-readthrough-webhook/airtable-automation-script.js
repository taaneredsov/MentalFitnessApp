// Airtable Automation Script: User Webhook
// Trigger: When a record in "Gebruikers" is created or updated
//
// Setup in Airtable:
// 1. Create an Automation with trigger "When record created" or "When record updated" on Gebruikers table
// 2. Add action "Run a script"
// 3. Configure input variables:
//    - recordId: the record ID from trigger
//    - eventType: "user.created" or "user.updated" (set based on trigger type)
// 4. Paste this script

// --- Configuration ---
const SECRET = "71f9bf74782c97d462678c7934cd7622adeffdc7422764faf0c834664413c658";
const PRODUCTION_URL = "https://mfa.drvn.be/api/sync/users/inbound";
const LOCAL_URL = "http://localhost:3333/api/sync/users/inbound";

// --- Input variables from automation trigger ---
const inputConfig = input.config();
const recordId = inputConfig.recordId;
const eventType = inputConfig.eventType || "user.updated";

// --- Fetch the full user record ---
const table = base.getTable("Gebruikers");
const record = await table.selectRecordAsync(recordId, {
    fields: [
        "Naam",
        "E-mailadres",
        "Rol",
        "Taalcode",
        "Paswoord Hash",
        "Status"
    ]
});

if (!record) {
    console.log(`Record ${recordId} not found, skipping`);
    // noinspection ExceptionCaughtLocallyJS
    throw new Error(`Record ${recordId} not found`);
}

const name = record.getCellValueAsString("Naam");
const email = record.getCellValueAsString("E-mailadres");
const role = record.getCellValueAsString("Rol") || undefined;
const languageCode = record.getCellValueAsString("Taalcode") || undefined;
const passwordHash = record.getCellValueAsString("Paswoord Hash") || undefined;
const status = record.getCellValueAsString("Status") || "Actief";

// Map Airtable status to internal status for the webhook eventType
let resolvedEventType = eventType;
if (status === "Geen toegang") {
    resolvedEventType = "user.deleted";
}

const eventId = `at-${recordId}-${Date.now()}`;

const payload = {
    eventId,
    eventType: resolvedEventType,
    occurredAt: new Date().toISOString(),
    user: {
        id: recordId,
        email,
        name,
        ...(role && { role }),
        ...(languageCode && { languageCode }),
        ...(passwordHash && { passwordHash })
    }
};

// --- HMAC-SHA256 signature ---
// Airtable scripting doesn't have native crypto.createHmac, so we use a
// pure-JS HMAC-SHA256 implementation via the Web Crypto API (available in
// Airtable automation scripts).

async function hmacSha256(secret, message) {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const msgData = encoder.encode(message);

    const key = await crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );

    const signature = await crypto.subtle.sign("HMAC", key, msgData);
    return Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
}

const bodyString = JSON.stringify(payload);
const signature = await hmacSha256(SECRET, bodyString);

const headers = {
    "Content-Type": "application/json",
    "X-Signature": signature
};

console.log(`Sending ${resolvedEventType} for ${email} (${recordId})`);

// --- Send to production ---
try {
    const prodResponse = await fetch(PRODUCTION_URL, {
        method: "POST",
        headers,
        body: bodyString
    });
    const prodResult = await prodResponse.text();
    console.log(`Production: ${prodResponse.status} - ${prodResult}`);
} catch (err) {
    console.error(`Production failed: ${err.message}`);
}

// --- Send to local dev (optional, won't fail if local is not running) ---
try {
    const localResponse = await fetch(LOCAL_URL, {
        method: "POST",
        headers,
        body: bodyString
    });
    const localResult = await localResponse.text();
    console.log(`Local: ${localResponse.status} - ${localResult}`);
} catch (err) {
    console.log(`Local not available (expected in production): ${err.message}`);
}

console.log(`Done: eventId=${eventId}`);
