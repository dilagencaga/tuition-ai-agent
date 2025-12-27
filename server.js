process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import express from "express";
import cors from "cors";
import "dotenv/config";
import OpenAI from "openai";
import admin from "firebase-admin";
import { readFileSync } from "fs";

const app = express();
app.use(cors());
app.use(express.json());

// Frontend (UI) dosyalarını servis et
app.use(express.static("public"));

// ===== Firebase Admin Initialization =====
const serviceAccount = JSON.parse(readFileSync("./firebase.json", "utf-8"));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DB_URL || "https://se4458-tuition-chat-default-rtdb.firebaseio.com"
});

const db = admin.firestore();
const messagesCollection = db.collection("messages");

/**
 * OpenAI client (opsiyonel)
 * - OPENAI_API_KEY yoksa sadece keyword fallback ile çalışır
 */
const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
const client = hasOpenAIKey ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const TUITION_API_BASE_URL =
  process.env.TUITION_API_BASE_URL || "http://localhost:5254";

// --- Simple in-memory JWT cache for protected endpoints (Payments/Admin)
let cachedToken = null;
let cachedTokenExpiresAt = 0;

// ✅ Hafıza: “şu an hangi intent için öğrenci no bekliyorum?”
let pendingIntent = null; // "QUERY_TUITION" | "PAY_TUITION" | null

// ✅ Hafıza: “en son konuştuğumuz öğrenci no”
let lastStudentNo = null; // "1001" gibi

async function callMidtermApi({ method, path, body, token }) {
  const url = `${TUITION_API_BASE_URL}${path}`;

  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new Error(`fetch failed: ${e?.message || e}`);
  }

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  return { ok: res.ok, status: res.status, data };
}

async function getAdminToken() {
  const now = Date.now();
  if (cachedToken && now < cachedTokenExpiresAt - 30_000) return cachedToken;

  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "123456";

  const r = await callMidtermApi({
    method: "POST",
    path: "/api/v1/Auth/login",
    body: { username, password },
  });

  if (!r.ok) {
    throw new Error(`Auth/login failed (${r.status})`);
  }

  cachedToken = r.data?.token;
  cachedTokenExpiresAt = r.data?.expiresAtUtc
    ? new Date(r.data.expiresAtUtc).getTime()
    : now + 110 * 60 * 1000;

  return cachedToken;
}

// ✅ Öğrenci var mı kontrol et - Midterm API'den gelen yanıtı analiz et
// Midterm API olmayan öğrenciler için: 400/404 döndürür VEYA 200 OK + studentNo field'ı olmayan data döndürür
function isStudentNotFound(apiResponse, requestedStudentNo) {
  console.log(`🔍 Checking if student ${requestedStudentNo} exists...`, {
    ok: apiResponse.ok,
    status: apiResponse.status,
    hasData: !!apiResponse.data
  });

  // 1) API 400, 404 ya da başka hata kodu döndüyse
  if (!apiResponse.ok) {
    if (apiResponse.status === 400 || apiResponse.status === 404) {
      console.log(`❌ Student ${requestedStudentNo} NOT FOUND: API returned ${apiResponse.status}`);
      return true;
    }
    // Diğer hatalar için (500, 401 vs) false dön - bu durumu ayrıca handle edeceğiz
    console.log(`⚠️ API error ${apiResponse.status} - not treating as "not found"`);
    return false;
  }

  // 2) API 200 OK döndü AMA data null/undefined/boş
  if (!apiResponse.data || Object.keys(apiResponse.data).length === 0) {
    console.log(`❌ Student ${requestedStudentNo} NOT FOUND: API returned empty data`);
    return true;
  }

  // 3) API 200 OK döndü AMA studentNo field'ı yok veya eşleşmiyor
  const d = apiResponse.data;
  const studentNoInResponse = d.studentNo || d.StudentNo || d.studentNumber || d.StudentNumber || d.studentId || d.StudentId;

  if (!studentNoInResponse) {
    console.log(`❌ Student ${requestedStudentNo} NOT FOUND: API response has no studentNo field`, d);
    return true;
  }

  // 4) StudentNo eşleşmiyorsa (API başka öğrenci bilgisi döndürmüş olabilir)
  if (String(studentNoInResponse) !== String(requestedStudentNo)) {
    console.log(`❌ Student ${requestedStudentNo} NOT FOUND: API returned different studentNo (${studentNoInResponse})`);
    return true;
  }

  console.log(`✅ Student ${requestedStudentNo} EXISTS`);
  return false;
}

// ---------------- INTENT PARSING ----------------

function extractStudentNo(text) {
  // ✅ 2-12 hane (88 dahil)
  const match = String(text || "").match(/\b(\d{2,12})\b/);
  return match ? match[1] : null;
}

function keywordFallback(msg) {
  const m = String(msg || "").toLowerCase();

  if (m.includes("ödenmemiş") || m.includes("unpaid")) {
    return { intent: "UNPAID_TUITION", studentNo: null };
  }

  if (m.includes("öde") || m.includes("ödeme") || m.includes("pay")) {
    return { intent: "PAY_TUITION", studentNo: extractStudentNo(m) };
  }

  if (m.includes("harç") || m.includes("harc") || m.includes("tuition")) {
    return { intent: "QUERY_TUITION", studentNo: extractStudentNo(m) };
  }

  return null;
}

async function parseIntent(userMessage) {
  const fallback = keywordFallback(userMessage);
  if (fallback) {
    if (!fallback.studentNo && (fallback.intent === "QUERY_TUITION" || fallback.intent === "PAY_TUITION")) {
      return {
        intent: fallback.intent,
        studentNo: null,
        missingFields: ["studentNo"],
        clarifyingQuestion: "Öğrenci numaran nedir?/ What is your Student id number",
      };
    }
    return {
      intent: fallback.intent,
      studentNo: fallback.studentNo,
      missingFields: [],
      clarifyingQuestion: null,
    };
  }

  // OpenAI varsa (opsiyonel)
  if (hasOpenAIKey) {
    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Return intent JSON" },
        { role: "user", content: userMessage },
      ],
    });

    return JSON.parse(completion.choices[0].message.content);
  }

  return { intent: "UNKNOWN", studentNo: null, missingFields: [] };
}

// ---------------- ROUTING ----------------

async function routeByIntent(parsed) {
  const { intent, studentNo } = parsed;

  // Eksik alan varsa (studentNo vs.) UI ile iste
  if (parsed.missingFields?.length) {
    return {
      stage: "clarify",
      intent,
      message: parsed.clarifyingQuestion || "Eksik bilgi var.",
      ui: {
        type: "ask_student_no",
        title: "Student Number",
        placeholder: "Enter student number",
      },
    };
  }

  // 1) QUERY_TUITION
  if (intent === "QUERY_TUITION") {
    console.log(`🔍 QUERY_TUITION: Fetching tuition for student ${studentNo}...`);

    const r = await callMidtermApi({
      method: "GET",
      path: `/api/v1/tuition/${encodeURIComponent(studentNo)}`,
    });

    console.log(`📞 QUERY_TUITION API Response for ${studentNo}:`, {
      ok: r.ok,
      status: r.status,
      data: r.data
    });

    // ✅ CRITICAL: Check if student exists using our validation function
    if (isStudentNotFound(r, studentNo)) {
      return {
        stage: "not_found",
        intent,
        success: false,
        api: r,
        message: `Öğrenci bulunamadı./ Student not found (Student No: ${studentNo}).`,
        ui: { type: "error", title: "Not Found" },
      };
    }

    // Check for other API errors (500, 401, etc.)
    if (!r.ok) {
      return {
        stage: "error",
        intent,
        success: false,
        api: r,
        message: `API hatası: ${r.status} - ${r.data?.message || "Bilinmeyen hata"}`,
        ui: { type: "error", title: "API Error" },
      };
    }

    console.log(`✅ QUERY_TUITION: Student ${studentNo} found, returning tuition card`);

    return {
      stage: "api",
      intent,
      success: true,
      api: r,
      ui: { type: "tuition_card", title: "Tuition" },
    };
  }

  // 2) UNPAID_TUITION
  if (intent === "UNPAID_TUITION") {
    const token = await getAdminToken();
    const r = await callMidtermApi({
      method: "GET",
      path: `/api/v1/Admin/unpaid`,
      token,
    });

    if (!r.ok) {
      return {
        stage: "error",
        intent,
        success: false,
        api: r,
        message: `API hatası: ${r.status} - ${r.data?.message || "Bilinmeyen hata"}`,
        ui: { type: "error", title: "API Error" },
      };
    }

    return {
      stage: "api",
      intent,
      success: true,
      api: r,
      ui: { type: "unpaid_list", title: "Unpaid Tuitions" },
    };
  }

  // 3) PAY_TUITION
  if (intent === "PAY_TUITION") {
    if (!studentNo) {
      return {
        stage: "clarify",
        intent,
        message: "Ödeme için öğrenci numarası gerekli.",
        ui: {
          type: "ask_student_no",
          title: "Student Number",
          placeholder: "Enter student number",
        },
      };
    }

    console.log(`🔍 PAY_TUITION: Fetching tuition for student ${studentNo}...`);

    const tr = await callMidtermApi({
      method: "GET",
      path: `/api/v1/tuition/${encodeURIComponent(studentNo)}`,
    });

    console.log(`📞 PAY_TUITION API Response for ${studentNo}:`, {
      ok: tr.ok,
      status: tr.status,
      data: tr.data
    });

    // ✅ CRITICAL: Check if student exists FIRST - NEVER show payment card for non-existent students
    if (isStudentNotFound(tr, studentNo)) {
      return {
        stage: "not_found",
        intent,
        success: false,
        api: tr,
        message: `Öğrenci bulunamadı (Student No: ${studentNo}). Ödeme yapılamaz.`,
        ui: { type: "error", title: "Not Found" },
      };
    }

    // Check for other API errors (500, 401, etc.)
    if (!tr.ok) {
      return {
        stage: "error",
        intent,
        success: false,
        api: tr,
        message: `API hatası: ${tr.status} - ${tr.data?.message || "Bilinmeyen hata"}`,
        ui: { type: "error", title: "API Error" },
      };
    }

    // ✅ Student exists, extract payment data
    const d = tr.data || {};
    const term = d.term ?? d.Term ?? "";
    const amountRaw =
      d.balance ??
      d.Balance ??
      d.amount ??
      d.Amount ??
      d.tuitionTotal ??
      d.TuitionTotal ??
      0;

    const amount = Number(amountRaw);

    console.log(`💰 PAY_TUITION: Extracted payment data for ${studentNo}:`, {
      term,
      amount
    });

    if (!term || Number.isNaN(amount)) {
      return {
        stage: "error",
        intent,
        success: false,
        message:
          "Term veya Amount bilgisi eksik/okunamadı (API response alan adlarını kontrol et).",
        api: tr,
        ui: { type: "error", title: "Error" },
      };
    }

    console.log(`✅ PAY_TUITION: Showing payment card for student ${studentNo}`);

    return {
      stage: "confirm_pay",
      intent,
      success: true,
      ui: {
        type: "pay_card",
        title: "Pay Tuition",
        paymentRequest: { studentNo, term, amount },
      },
      api: tr,
    };
  }

  return {
    stage: "unknown",
    intent: "UNKNOWN",
    success: false,
    message: "Bu mesaj için uygun bir işlem bulamadım. /I couldn’t find a suitable action for this message.",
    ui: { type: "error", title: "Unknown" },
  };
}

// ---------------- FIRESTORE MESSAGE HANDLERS ----------------

/**
 * Save a message to Firestore
 */
async function saveMessage(sessionId, message, role = "user", metadata = {}) {
  // Remove undefined values from metadata
  const cleanMetadata = JSON.parse(JSON.stringify(metadata || {}));

  const msgDoc = {
    sessionId,
    message,
    role, // "user" | "bot"
    metadata: cleanMetadata,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: new Date().toISOString()
  };

  const docRef = await messagesCollection.add(msgDoc);
  return { id: docRef.id, ...msgDoc };
}

/**
 * Process incoming user message with LLM and APIs
 */
async function processUserMessage(sessionId, userMessage) {
  let parsed = await parseIntent(userMessage);

  // ✅ 1) Kullanıcı sadece sayı yazdıysa ve pendingIntent varsa:
  const onlyNumber = /^\s*\d{2,12}\s*$/.test(userMessage);
  if (onlyNumber && pendingIntent) {
    parsed.intent = pendingIntent;
    parsed.studentNo = userMessage.trim();
    parsed.missingFields = [];
    parsed.clarifyingQuestion = null;
  }

  // ✅ 2) Mesajın içinden öğrenci numarasını yakala
  if (!parsed.studentNo) {
    const m = userMessage.match(/\b\d{2,12}\b/);
    if (m) {
      parsed.studentNo = m[0];
      parsed.missingFields = (parsed.missingFields || []).filter(f => f !== "studentNo");
      if ((parsed.missingFields || []).length === 0) parsed.clarifyingQuestion = null;
    }
  }

  // ✅ 3) Kullanıcı "harç öde" dedi ama numara yazmadıysa:
  if (parsed.intent === "PAY_TUITION" && !parsed.studentNo && lastStudentNo) {
    parsed.studentNo = lastStudentNo;
    parsed.missingFields = (parsed.missingFields || []).filter(f => f !== "studentNo");
    parsed.clarifyingQuestion = null;
    lastStudentNo = null;
  }

  // ✅ 4) Eğer studentNo eksikse: pendingIntent'i set et
  const needsStudent =
    (parsed.intent === "QUERY_TUITION" || parsed.intent === "PAY_TUITION") &&
    (parsed.missingFields || []).includes("studentNo");

  if (needsStudent) {
    pendingIntent = parsed.intent;
  }

  const routed = await routeByIntent(parsed);

  // ✅ 5) Başarılı akışta lastStudentNo güncelle
  if (parsed.studentNo) {
    if (parsed.intent === "QUERY_TUITION" && routed.stage === "api" && routed.api?.ok) {
      lastStudentNo = String(parsed.studentNo);
    }
  }

  // ✅ 6) Clarify değilse pendingIntent sıfırla
  if (routed.stage !== "clarify") pendingIntent = null;

  return { userMessage, ...routed };
}

// ---------------- ENDPOINTS ----------------

/**
 * New endpoint: Save message to Firestore and process with LLM
 */
app.post("/chat/firestore", async (req, res) => {
  try {
    const { sessionId, message } = req.body;

    if (!sessionId || !message) {
      return res.status(400).json({ error: "sessionId and message are required" });
    }

    // 1) Save user message to Firestore
    const userMsg = await saveMessage(sessionId, message, "user");

    // 2) Process with LLM and APIs
    const response = await processUserMessage(sessionId, message);

    // 3) Save bot response to Firestore
    const botMsg = await saveMessage(sessionId, response.message || "Processing...", "bot", {
      stage: response.stage,
      intent: response.intent,
      ui: response.ui,
      api: response.api,
      success: response.success
    });

    return res.json({
      success: true,
      userMessageId: userMsg.id,
      botMessageId: botMsg.id,
      response
    });
  } catch (err) {
    console.error("Firestore chat error:", err);
    return res.status(500).json({ error: "Chat failed", details: err.message });
  }
});

/**
 * Get chat history for a session
 */
app.get("/chat/history/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const snapshot = await messagesCollection
      .where("sessionId", "==", sessionId)
      .orderBy("createdAt", "asc")
      .limit(limit)
      .get();

    const messages = [];
    snapshot.forEach(doc => {
      messages.push({ id: doc.id, ...doc.data() });
    });

    return res.json({ sessionId, messages, count: messages.length });
  } catch (err) {
    console.error("Get history error:", err);
    return res.status(500).json({ error: "Failed to get history", details: err.message });
  }
});

/**
 * Original chat endpoint (backward compatible)
 */
app.post("/chat", async (req, res) => {
  try {
    const userMessage = String(req.body.message || "").trim();
    let parsed = await parseIntent(userMessage);

    // ✅ 1) Kullanıcı sadece sayı yazdıysa ve pendingIntent varsa:
    // ör: "harç sorgulama" -> sonra "1001"
    const onlyNumber = /^\s*\d{2,12}\s*$/.test(userMessage);
    if (onlyNumber && pendingIntent) {
      parsed.intent = pendingIntent;
      parsed.studentNo = userMessage.trim();
      parsed.missingFields = [];
      parsed.clarifyingQuestion = null;
    }

    // ✅ 2) Mesajın içinden öğrenci numarasını yakala (harç öde 88 gibi)
    if (!parsed.studentNo) {
      const m = userMessage.match(/\b\d{2,12}\b/);
      if (m) {
        parsed.studentNo = m[0];
        parsed.missingFields = (parsed.missingFields || []).filter(f => f !== "studentNo");
        if ((parsed.missingFields || []).length === 0) parsed.clarifyingQuestion = null;
      }
    }

    // ✅ 3) Kullanıcı "harç öde" dedi ama numara yazmadıysa:
    // daha önce sorguladığı öğrenci varsa onu kullan
  // ✅ 3) Kullanıcı "harç öde" dedi ama numara yazmadıysa:
// sadece 1 KERE lastStudentNo'yu kullan, sonra sıfırla
if (parsed.intent === "PAY_TUITION" && !parsed.studentNo && lastStudentNo) {
  parsed.studentNo = lastStudentNo;

  parsed.missingFields = (parsed.missingFields || []).filter(f => f !== "studentNo");
  parsed.clarifyingQuestion = null;

  // 🔥 TEK KULLANIMLIK: bu "harç öde" çağrısından sonra unut
  lastStudentNo = null;
}


    // ✅ 4) Eğer studentNo eksikse: pendingIntent’i buradan set et
    // (harç sorgulama / harç öde yazınca studentNo sorulsun)
    const needsStudent =
      (parsed.intent === "QUERY_TUITION" || parsed.intent === "PAY_TUITION") &&
      (parsed.missingFields || []).includes("studentNo");

    if (needsStudent) {
      pendingIntent = parsed.intent; // bundan sonra sayı gelirse bu intent çalışır
    }

    const routed = await routeByIntent(parsed);

    // ✅ 5) Başarılı akışta lastStudentNo güncelle
    if (parsed.studentNo) {
      if (parsed.intent === "QUERY_TUITION" && routed.stage === "api" && routed.api?.ok) {
        lastStudentNo = String(parsed.studentNo);
      }
      
    }

    // ✅ 6) Clarify değilse pendingIntent sıfırla
    if (routed.stage !== "clarify") pendingIntent = null;

    return res.json({ userMessage, ...routed });
  } catch (err) {
    return res.status(500).json({ error: "Chat failed", details: err.message });
  }
});

// Direct Tuition fetch (no intent parsing)
app.get("/tuition/:studentNo", async (req, res) => {
  try {
    const studentNo = req.params.studentNo;
    const r = await callMidtermApi({
      method: "GET",
      path: `/api/v1/tuition/${encodeURIComponent(studentNo)}`,
    });

    return res.status(r.ok ? 200 : r.status).json(r);
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// PAY NOW: butondan gelir, midterm API’ye POST atar
app.post("/pay", async (req, res) => {
  try {
    const { studentNo, term, amount } = req.body || {};

    if (!studentNo || term == null || amount == null) {
      return res.status(400).json({
        error: "studentNo, term, amount are required",
      });
    }

    const token = await getAdminToken();

    const r = await callMidtermApi({
      method: "POST",
      path: `/api/v1/Payments`,
      token,
      body: { studentNo, term, amount },
    });

    return res.json({
      success: r.ok,
      stage: "paid",
      api: r,
      ui: {
        type: "payment_success",
        title: "Payment",
        success: r.ok,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: "Payment failed", details: err.message });
  }
});

// Delete all messages for a session (for testing)
app.delete("/chat/history/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const snapshot = await messagesCollection
      .where("sessionId", "==", sessionId)
      .get();

    const batch = db.batch();
    snapshot.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    return res.json({ success: true, deleted: snapshot.size });
  } catch (err) {
    console.error("Delete history error:", err);
    return res.status(500).json({ error: "Failed to delete history", details: err.message });
  }
});

// 🔥 NUCLEAR OPTION: Delete ALL messages from Firestore (for cleaning corrupted data)
app.delete("/chat/clear-all", async (req, res) => {
  try {
    const snapshot = await messagesCollection.get();

    const batch = db.batch();
    snapshot.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    console.log(`🔥 Deleted ${snapshot.size} messages from Firestore`);
    return res.json({ success: true, deleted: snapshot.size, message: "All messages cleared" });
  } catch (err) {
    console.error("Clear all error:", err);
    return res.status(500).json({ error: "Failed to clear all messages", details: err.message });
  }
});

app.listen(3001, () => {
  console.log("✅ Server running on http://localhost:3001");
});
