const express = require("express");
const fetch = require("node-fetch");
const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const FORWARD_URL = process.env.FORWARD_URL;

// Meta's webhook verification endpoint
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("Verification GET:", req.query); // Optional: shows in Render logs

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403); // Token mismatch or incorrect request
  }
});

// Handle incoming POSTs (leadgen payloads)
app.post("/webhook", async (req, res) => {
  console.log("Webhook POST received:", JSON.stringify(req.body, null, 2));

  try {
    const response = await fetch(FORWARD_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(req.body)
    });

    console.log("Forwarded to no-code webhook, status:", response.status);
  } catch (err) {
    console.error("Error forwarding to no-code webhook:", err);
  }

  res.sendStatus(200); // Always reply 200 to Meta
});

app.listen(3000, () => console.log("Server running on port 3000"));
