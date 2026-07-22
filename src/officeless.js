export async function uploadToOfficeless(base64, filename) {
  const url = process.env.OFFICELESS_UPLOAD_URL;
  if (!url) throw new Error("OFFICELESS_UPLOAD_URL is not set");

  const token = process.env.OFFICELESS_TOKEN;
  const fileField = "content";
  const nameField = "filename";
  const urlPath = process.env.OFFICELESS_URL_PATH || "data.url";

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: token }), // raw token — "Bearer " prefix gets 401
    },
    body: JSON.stringify({ [fileField]: base64, [nameField]: filename }),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`officeless upload failed ${res.status}: ${text}`);

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`officeless returned non-JSON: ${text.slice(0, 200)}`);
  }

  const found = urlPath
    .split(".")
    .reduce((o, k) => (o == null ? undefined : o[k]), json);
  if (typeof found !== "string" || !found)
    throw new Error(
      `no URL at path "${urlPath}" in officeless response: ${text.slice(0, 200)}`,
    );
  return found;
}
