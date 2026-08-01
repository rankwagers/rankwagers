export async function sendTelegramMessage(
  chatId: number,
  text: string
): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.TELEGRAM_INVITE_BOT_TOKEN?.trim();
  if (!token) {
    return { ok: false, error: "TELEGRAM_INVITE_BOT_TOKEN is not set" };
  }
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: text.slice(0, 4096),
      disable_web_page_preview: false,
    }),
  });
  const data = (await res.json()) as { ok?: boolean; description?: string };
  if (!res.ok || !data.ok) {
    return { ok: false, error: data.description || res.statusText };
  }
  return { ok: true };
}
