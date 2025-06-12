const express = require("express");
const fetch = require("node-fetch");
const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const FORWARD_URL = process.env.FORWARD_URL;

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post("/webhook", async (req, res) => {
  console.log("Received webhook:", JSON.stringify(req.body, null, 2));

  try {
    const response = await fetch(FORWARD_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(req.body)
    });

    console.log("Forwarded:", response.status);
  } catch (err) {
    console.error("Forwarding failed:", err);
  }

  res.sendStatus(200);
});

app.listen(3000, () => console.log("Server running on port 3000"));
