const express = require("express");
const fetch = require("node-fetch");
const app = express();
app.use(express.json());

const {
  VERIFY_TOKEN,
  FORWARD_URL,
  META_APP_ID,
  META_APP_SECRET,
  META_LONG_USER_TOKEN,
  PAGE_ID
} = process.env;

let PAGE_ACCESS_TOKEN = null;

// Fetch Page Token (never-expiring)
async function fetchPageAccessToken() {
  try {
    const res = await fetch(`https://graph.facebook.com/v23.0/me/accounts?access_token=${META_LONG_USER_TOKEN}`);
    const data = await res.json();
    const page = data.data.find(p => p.id === PAGE_ID);
    PAGE_ACCESS_TOKEN = page?.access_token;

    if (!PAGE_ACCESS_TOKEN) {
      throw new Error("Page token not found for given PAGE_ID.");
    }

    console.log("✅ Page access token fetched and stored.");
  } catch (err) {
    console.error("Failed to fetch Page access token:", err);
  }
}

// Meta Webhook Verification
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Webhook POST Handler
app.post("/webhook", async (req, res) => {
  try {
    const change = req.body?.entry?.[0]?.changes?.[0];
    const leadgenId = change?.value?.leadgen_id;

    if (!leadgenId) {
      console.error("Leadgen ID missing in webhook payload");
      return res.sendStatus(400);
    }

    if (!PAGE_ACCESS_TOKEN) await fetchPageAccessToken();

    const leadRes = await fetch(`https://graph.facebook.com/v23.0/${leadgenId}?access_token=${PAGE_ACCESS_TOKEN}`);
    const leadData = await leadRes.json();

    if (!leadData || !Array.isArray(leadData.field_data)) {
      console.error("Invalid lead data response:", leadData);
      return res.sendStatus(500);
    }

    const parsedLead = {};
    leadData.field_data.forEach(field => {
      parsedLead[field.name] = field.values?.[0] || "";
    });

    // Clean phone number
    let phone = parsedLead["puhelinnumero"]?.replace(/\s+/g, '');
    if (phone && !phone.startsWith("+358")) {
      if (phone.startsWith("358")) {
        phone = "+" + phone;
      } else if (phone.startsWith("0")) {
        phone = "+358" + phone.slice(1);
      }
    }
    parsedLead["puhelinnumero"] = phone;

    // Forward to CRM
    const forwardRes = await fetch(FORWARD_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsedLead)
    });

    console.log("✅ Lead forwarded to CRM, status:", forwardRes.status);
    res.sendStatus(200);
  } catch (err) {
    console.error("❌ Error processing lead:", err);
    res.sendStatus(500);
  }
});

// Start server
app.listen(3000, async () => {
  console.log("🚀 Server running on port 3000");
  await fetchPageAccessToken(); // Preload token at startup
});
