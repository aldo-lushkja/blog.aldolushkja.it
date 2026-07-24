import { getPipelineSecrets } from './secrets';

/** Sends a Markdown-formatted message to the configured Telegram chat. Errors are logged, not thrown. */
export async function notifyTelegram(text: string): Promise<void> {
  try {
    const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = await getPipelineSecrets();
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      console.warn('Telegram credentials missing, skipping notification');
      return;
    }

    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      console.error(`Telegram notification failed: ${response.status} ${await response.text()}`);
    }
  } catch (err) {
    console.error('Telegram notification threw', err);
  }
}
