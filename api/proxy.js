export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const { url } = req.query;

  if (!url) {
    res.status(400).json({ error: "Falta el parámetro 'url'" });
    return;
  }

  try {
    const targetResponse = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
    });

    const body = await targetResponse.text();

    res.status(targetResponse.status);
    res.setHeader(
      "Content-Type",
      targetResponse.headers.get("content-type") || "application/json",
    );
    res.send(body);
  } catch (error) {
    res.status(502).json({ error: "Error al contactar el destino", detail: error.message });
  }
}
