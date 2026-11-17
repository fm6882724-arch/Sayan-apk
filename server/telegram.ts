import { config } from './config.ts';

export interface TelegramSendResult {
  configured: boolean;
  sent: boolean;
  error?: string;
}

export function isTelegramConfigured(): boolean {
  return Boolean(config.telegramBotToken && config.telegramChatId);
}

export async function sendTelegramFeedback(params: {
  userId: string;
  message: string;
  deviceModel?: string;
  androidVersion?: string;
}): Promise<TelegramSendResult> {
  if (!isTelegramConfigured()) {
    return {
      configured: false,
      sent: false,
      error: 'Telegram bot credentials not configured on server.',
    };
  }

  const text = [
    'SAYAN MODE Feedback',
    `User ID: ${params.userId}`,
    `Device: ${params.deviceModel || 'Unknown'} (${params.androidVersion || 'Unknown'})`,
    `Time: ${new Date().toISOString()}`,
    '',
    params.message,
  ].join('\n');

  try {
    const endpoint = `https://api.telegram.org/bot${encodeURIComponent(config.telegramBotToken)}/sendMessage`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: config.telegramChatId,
        text,
      }),
    });

    if (!response.ok) {
      const bodyText = await response.text().catch(() => '');
      return {
        configured: true,
        sent: false,
        error: `Telegram API HTTP ${response.status}${bodyText ? `: ${bodyText.slice(0, 120)}` : ''}`,
      };
    }

    return { configured: true, sent: true };
  } catch (err) {
    return {
      configured: true,
      sent: false,
      error: err instanceof Error ? err.message : 'Telegram request failed.',
    };
  }
}
