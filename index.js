// ===============================================
// AIさん 出会い・マッチング版（LINE Bot）
// ・恋愛相談/記憶/寄り添いに特化
// ・Supabase にユーザーの恋愛情報を保存
// ・優しく柔らかい“お姉さんAI”
// ===============================================

import express from "express";
import * as line from "@line/bot-sdk";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

/* ========= LINE ========= */
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};
const lineClient = new line.Client(config);

/* ========= OpenAI ========= */
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/* ========= Supabase ========= */
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

/* ========= Server ========= */
const app = express();
app.get("/", (_req, res) => res.send("AI-san (match) running"));

/* ========= Webhook ========= */
app.post("/callback", line.middleware(config), async (req, res) => {
  try {
    const events = req.body.events ?? [];
    await Promise.all(events.map(handleEvent));
  } catch (e) {
    console.error(e);
  }
  res.status(200).end();
});

/* ========= MAIN HANDLER ========= */
async function handleEvent(event) {
  if (event.type !== "message" || event.message.type !== "text") return;

  const lineUserId = event.source.userId;
  const userMessage = event.message.text;

  // ① Supabase からユーザー情報を取得 or 作成
  const userData = await loadOrCreateUser(lineUserId);

  // ② AI返答を生成（過去記憶つき）
  const aiText = await generateReply(userMessage, userData);

  // ③ 最新の相談内容を保存
  await updateLastMessage(lineUserId, userMessage);

  // ④ LINE へ返信
  return lineClient.replyMessage(event.replyToken, {
    type: "text",
    text: aiText,
  });
}

/* ========= Load or Create User ========= */
async function loadOrCreateUser(lineUserId) {
  const { data, error } = await supabase
    .from("users_match")
    .select("*")
    .eq("line_user_id", lineUserId)
    .single();

  if (data) return data;

  // 新規作成
  const { data: newUser } = await supabase
    .from("users_match")
    .insert({
      line_user_id: lineUserId,
      love_status: null,
      love_target: null,
      personality: null,
      last_message: null,
    })
    .select()
    .single();

  return newUser;
}

/* ========= Update: Save last message ========= */
async function updateLastMessage(lineUserId, message) {
  await supabase
    .from("users_match")
    .update({
      last_message: message,
      updated_at: new Date(),
    })
    .eq("line_user_id", lineUserId);
}

/* ========= AI Reply (memory-based) ========= */
async function generateReply(userMessage, userData) {
  try {
    const memoryText = `
【あなたの過去の相談情報】
- 好きな人：${userData.love_target ?? "未登録"}
- 恋愛状況：${userData.love_status ?? "まだ情報がありません"}
- あなたの性格：${userData.personality ?? "まだ情報がありません"}
- 最近の相談内容：${userData.last_message ?? "なし"}

【今回の相談】
${userMessage}
`;

    const prompt = `
あなたは「AIさん」。
恋愛相談に優しく寄り添い、ユーザーの気持ちを否定しません。
過去の相談内容も覚えて、自然に反映します。

◆ 返答スタイル
1. 最初に共感
2. 次に優しいアドバイス
3. 最後に軽い一言（次を促す）

◆ NG
- 医療判断
- 個人特定
- 断定しすぎ

【記憶データ】
${memoryText}

この情報をふまえて、AIさんとして最適な返答を作ってください。
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "あなたは優しい女性AIアシスタント「AIさん」です。" },
        { role: "user", content: prompt },
      ],
    });

    return completion.choices[0].message.content.trim();
  } catch (err) {
    console.error("OpenAI Error:", err);
    return "少し混み合ってるみたい…もう一度送ってくれる？🥺";
  }
}

/* ========= Start ========= */
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`AIさん (match) running on port ${port}`);
});
