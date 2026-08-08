import { getD1 } from "@/db/index";

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const MAX_PUSH_BATCH_SIZE = 100;
const MAX_EMAIL_QUERY_SIZE = 50;

export type PushNotificationInput = {
  id: string;
  userEmail: string;
  activityId?: string | null;
  type: string;
  title: string;
  message: string;
};

type PushTokenRow = {
  token: string;
  user_email: string;
};

type ExpoPushTicket = {
  status?: "ok" | "error";
  details?: { error?: string };
};

type PushMessage = {
  to: string;
  sound: "default";
  title: string;
  body: string;
  data: {
    activityId: string | null;
    notificationId: string;
    type: string;
    url: string;
  };
};

function chunks<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

async function listEnabledTokens(userEmails: string[]) {
  if (userEmails.length === 0) return [];
  const db = getD1();
  const rows: PushTokenRow[] = [];

  for (const emailChunk of chunks(userEmails, MAX_EMAIL_QUERY_SIZE)) {
    const placeholders = emailChunk.map(() => "?").join(", ");
    const result = await db
      .prepare(
        `SELECT token, user_email
         FROM push_tokens
         WHERE enabled = 1 AND user_email IN (${placeholders})`,
      )
      .bind(...emailChunk)
      .all<PushTokenRow>();
    rows.push(...result.results);
  }

  return rows;
}

async function disableInvalidTokens(tokens: string[]) {
  if (tokens.length === 0) return;
  const db = getD1();
  await db.batch(
    [...new Set(tokens)].map((token) =>
      db.prepare(`UPDATE push_tokens SET enabled = 0 WHERE token = ?`).bind(token),
    ),
  );
}

export async function sendPushNotifications(items: PushNotificationInput[]) {
  const userEmails = [...new Set(items.map((item) => item.userEmail))];
  const tokens = await listEnabledTokens(userEmails);
  if (tokens.length === 0) return;

  const tokensByUser = new Map<string, string[]>();
  for (const row of tokens) {
    const userTokens = tokensByUser.get(row.user_email) ?? [];
    userTokens.push(row.token);
    tokensByUser.set(row.user_email, userTokens);
  }

  const messages: PushMessage[] = [];
  for (const item of items) {
    for (const token of tokensByUser.get(item.userEmail) ?? []) {
      messages.push({
        to: token,
        sound: "default",
        title: item.title,
        body: item.message,
        data: {
          activityId: item.activityId ?? null,
          notificationId: item.id,
          type: item.type,
          url: item.activityId ? `/?activity=${encodeURIComponent(item.activityId)}` : "/",
        },
      });
    }
  }

  for (const messageChunk of chunks(messages, MAX_PUSH_BATCH_SIZE)) {
    const response = await fetch(EXPO_PUSH_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messageChunk),
    });
    if (!response.ok) {
      throw new Error(`Expo push request failed with ${response.status}`);
    }

    const payload = (await response.json()) as { data?: ExpoPushTicket[] };
    const invalidTokens: string[] = [];
    for (const [index, ticket] of (payload.data ?? []).entries()) {
      if (
        ticket.status === "error" &&
        ticket.details?.error === "DeviceNotRegistered"
      ) {
        invalidTokens.push(messageChunk[index]?.to ?? "");
      }
    }
    await disableInvalidTokens(invalidTokens.filter(Boolean));
  }
}
