// ===============================================
// AIさん 出会い・マッチング版（LINE Bot）
// ・恋愛相談 / 出会いアドバイスに特化
// ・丁寧・優しい・寄り添う会話スタイル
// ・検索が必要な内容は簡易調査（SerpAPI 無し版）
// ・画像解析なし（必要なら後で追加します）
// ===============================================

import express from "express";
import * as line from "@line/bot-sdk";
import OpenAI from "openai";

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

/* ========= Server ========= */
const app = express();

// Health check
app.get("/", (_req, res) => res.send("AI-san (match) running"));

/* ========= Webhook ========= */
app.post("/callback", line.middleware(config), async (req, res) => {
  try {
    const events = req.body.events ?? [];
    await Promise.all(events.map(handleEvent));
    return res.status(200).end();
  } catch (e) {
    console.error("Webhook error:", e);
    return res.status(200).end();
  }
});

/* ========= Core Event Handler ========= */
async function handleEvent(event) {
  if (event.type !== "message" || event.message.type !== "text") {
    return;
  }

  const userMessage = event.message.text;

  const replyText = await generateReply(userMessage);

  return lineClient.replyMessage(event.replyToken, {
    type: "text",
    text: replyText,
  });
}

/* ========= AI Response Logic ========= */
async function generateReply(userMessage) {
  try {
    const prompt = `
あなたは優しく寄り添う女性AIアシスタント「AIさん」です。
テーマは「恋愛・出会い・マッチング」に特化しています。

◆ あなたの性格
- 優しい
- 共感する
- 否定しない
- フレンドリー
- 笑顔で寄り添う
- 少しだけ恋バナが得意な“頼れるお姉さん”

◆ 返答ルール
1. 必ず「優しく共感」→「具体的アドバイス」→「次の一言」の3段階で返す  
2. 文章の長さは 3〜5 行ほど  
3. 重すぎず軽すぎず、恋愛相談の温度感  
4. 語尾はやわらかく  
5. 相手を励ます言い回しを多めにする

◆ NG
- 断定的な決めつけ（例：「絶対こうすべき」）
- 攻撃的な言い方
- 医療・法律判断

◆ ユーザーの発言:
「${userMessage}」

これに対して、AIさんとして最適な返答を作ってください。
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
    return "ごめんね…少し混み合ってるみたい。もう一度送ってくれる？🥺";
  }
}

/* ========= Start ========= */
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`AIさん (match) running on port ${port}`);
});
