const express = require("express");
const fetch = require("node-fetch");
const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const FORWARD_URL = process.env.FORWARD_URL;
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN; // Move token to .env for security

// Meta's webhook verification
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

// Handle lead webhook
app.post("/webhook", async (req, res) => {
  try {
    const change = req.body?.entry?.[0]?.changes?.[0];
    const leadgenId = change?.value?.leadgen_id;

    if (!leadgenId) {
      console.error("Leadgen ID missing in webhook payload");
      return res.sendStatus(400);
    }

    // Fetch lead data from Meta
    const metaResponse = await fetch(`https://graph.facebook.com/v23.0/${leadgenId}?access_token=${META_ACCESS_TOKEN}`);
    const leadData = await metaResponse.json();

    const parsedLead = {};
    for (const field of leadData.field_data) {
      parsedLead[field.name] = field.values[0];
    }

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

    // Forward cleaned data
    const forwardResponse = await fetch(FORWARD_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsedLead)
    });

    console.log("Forwarded to CRM, status:", forwardResponse.status);
    res.sendStatus(200);
  } catch (err) {
    console.error("Error processing lead:", err);
    res.sendStatus(500);
  }
});

app.listen(3000, () => console.log("Server running on port 3000"));
