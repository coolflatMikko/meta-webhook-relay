app.post("/webhook", async (req, res) => {
  try {
    const change = req.body?.entry?.[0]?.changes?.[0];
    const leadgenId = change?.value?.leadgen_id;

    if (!leadgenId) {
      console.error("Leadgen ID missing in webhook payload");
      return res.sendStatus(400);
    }

    // Fetch lead data from Meta
    const metaRes = await fetch(`https://graph.facebook.com/v23.0/${leadgenId}?access_token=${META_ACCESS_TOKEN}`);
    const leadData = await metaRes.json();

    if (!leadData || !Array.isArray(leadData.field_data)) {
      console.error("Invalid lead data response:", leadData);
      return res.sendStatus(500);
    }

    // Parse field data into object
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

    // Forward to no-code CRM
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
