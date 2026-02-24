// Airtable Automation Script: User Sync Ping
//
// Trigger: "When record is created or updated" on Gebruikers table
//
// Setup:
// 1. Create Automation in Airtable
// 2. Trigger: "When record created" OR "When record updated" on Gebruikers
// 3. Action: "Run a script"
// 4. Input variables:
//    - recordId (string): Record ID from trigger step
// 5. Paste this script
//
// Auth: Plain shared secret via X-Sync-Secret header.
//       Must match the AIRTABLE_USER_SYNC_SECRET Docker secret on the server.
//
// Endpoint contract (POST /api/sync/users/inbound):
//   Body:    { recordId: "<Airtable record ID>" }
//   Headers: Content-Type: application/json, X-Sync-Secret: <secret>
//   The server fetches user data directly from Airtable — no user data in the payload.

const SECRET = "71f9bf74782c97d462678c7934cd7622adeffdc7422764faf0c834664413c658";
const PRODUCTION_URL = "https://mfa.drvn.be/api/sync/users/inbound";

const inputConfig = input.config();
const recordId = inputConfig.recordId;

const body = JSON.stringify({ recordId });
const headers = {
    "Content-Type": "application/json",
    "X-Sync-Secret": SECRET
};

try {
    const res = await fetch(PRODUCTION_URL, { method: "POST", headers, body });
    console.log(`Production: ${res.status} - ${await res.text()}`);
} catch (err) {
    console.error(`Production failed: ${err.message}`);
}