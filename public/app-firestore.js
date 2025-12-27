// ===== Firestore Real-time Messaging Version =====

const chatEl = document.getElementById("chat");
const inputEl = document.getElementById("msg");
const sendEl = document.getElementById("send");

// Firebase Firestore configuration
const firebaseConfig = {
  apiKey: "AIzaSyDSknztmet6QVWMenB_LPh-0UxZWI-1OsI",
  authDomain: "se4458-tuition-chat.firebaseapp.com",
  databaseURL: "https://se4458-tuition-chat-default-rtdb.firebaseio.com",
  projectId: "se4458-tuition-chat",
  storageBucket: "se4458-tuition-chat.firebasestorage.app",
  messagingSenderId: "393114146436",
  appId: "1:393114146436:web:353696e05cc65ba69914d1",
  measurementId: "G-1K1663JFT6"
};

// Initialize Firebase
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
const messagesRef = db.collection('messages');

// Session ID from localStorage
const SESSION_ID = window.SESSION_ID;

// Simple client-side conversation hinting
let awaitingStudentNoForIntent = null;
let messageListener = null;

// Track displayed message IDs to prevent duplicates
const displayedMessageIds = new Set();

// Track when we started listening (to ignore old messages from real-time listener)
let listenerStartTime = null;

// Helper functions for UI (same as before)
function addBubble(role, text) {
  const row = document.createElement("div");
  row.className = `row ${role}`;

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;

  row.appendChild(bubble);
  chatEl.appendChild(row);
  chatEl.scrollTop = chatEl.scrollHeight;
}

function addCard(title, rows, actions = []) {
  const row = document.createElement("div");
  row.className = "row bot";

  const card = document.createElement("div");
  card.className = "card";

  const h = document.createElement("h3");
  h.textContent = title;
  card.appendChild(h);

  const kv = document.createElement("div");
  kv.className = "kv";

  rows.forEach(({ k, v }) => {
    const kk = document.createElement("div");
    kk.className = "k";
    kk.textContent = k;

    const vv = document.createElement("div");
    vv.className = "v";
    vv.textContent = v ?? "";

    kv.appendChild(kk);
    kv.appendChild(vv);
  });

  card.appendChild(kv);

  if (actions.length) {
    const a = document.createElement("div");
    a.className = "actions";
    actions.forEach(btn => a.appendChild(btn));
    card.appendChild(a);
  }

  row.appendChild(card);
  chatEl.appendChild(row);
  chatEl.scrollTop = chatEl.scrollHeight;
}

function addSuccess(text) {
  const row = document.createElement("div");
  row.className = "row bot";

  const badge = document.createElement("div");
  badge.className = "badge";

  const dot = document.createElement("div");
  dot.className = "dot";

  const t = document.createElement("div");
  t.textContent = text;

  badge.appendChild(dot);
  badge.appendChild(t);

  row.appendChild(badge);
  chatEl.appendChild(row);
  chatEl.scrollTop = chatEl.scrollHeight;
}

function addStudentNoCard({ title = "Student Number", placeholder = "Enter student number", intentHint = null } = {}) {
  const row = document.createElement("div");
  row.className = "row bot";

  const card = document.createElement("div");
  card.className = "card";

  const h = document.createElement("h3");
  h.textContent = title;
  card.appendChild(h);

  const wrap = document.createElement("div");
  wrap.style.display = "flex";
  wrap.style.gap = "10px";

  const inp = document.createElement("input");
  inp.className = "input";
  inp.placeholder = placeholder;
  inp.inputMode = "numeric";
  inp.style.flex = "1";

  const btn = document.createElement("button");
  btn.className = "btn";
  btn.textContent = "Send";

  const sendStudentNo = async () => {
    const studentNo = (inp.value || "").trim();
    if (!studentNo) return;
    awaitingStudentNoForIntent = null;
    await sendMessageProgrammatically(`My student number is ${studentNo}.`);
  };

  btn.onclick = sendStudentNo;
  inp.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendStudentNo();
  });

  wrap.appendChild(inp);
  wrap.appendChild(btn);
  card.appendChild(wrap);

  row.appendChild(card);
  chatEl.appendChild(row);
  chatEl.scrollTop = chatEl.scrollHeight;

  if (intentHint) awaitingStudentNoForIntent = intentHint;
  setTimeout(() => inp.focus(), 50);
}

async function postJSON(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `HTTP ${res.status}`);
  }
  return data;
}

function pretty(obj) {
  try { return JSON.stringify(obj, null, 2); } catch { return String(obj); }
}

// ===== REAL-TIME FIRESTORE LISTENER =====

function setupRealtimeListener() {
  // Set listener start time to ignore old messages
  listenerStartTime = new Date().toISOString();

  // Listen to new messages for this session
  messageListener = messagesRef
    .where('sessionId', '==', SESSION_ID)
    .orderBy('createdAt', 'asc')
    .onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const msgId = change.doc.id;
          const msg = change.doc.data();

          // Only process messages created after listener started (to ignore history)
          if (msg.createdAt && msg.createdAt >= listenerStartTime) {
            handleIncomingMessage(msgId, msg);
          }
        }
      });
    }, (error) => {
      console.error("Firestore listener error:", error);
      addBubble("bot", "Error: Real-time connection failed. " + error.message);
    });
}

function handleIncomingMessage(msgId, msg) {
  // Skip if we already displayed this message
  if (displayedMessageIds.has(msgId)) {
    return;
  }
  displayedMessageIds.add(msgId);

  const { role, message, metadata } = msg;

  if (role === 'user') {
    // User messages are already displayed when sent
    return;
  }

  if (role === 'bot') {
    // Handle not_found and error stages specially - only show text
    if (metadata?.stage === "not_found" || metadata?.stage === "error") {
      addBubble("bot", message || "Bir hata oluştu.");
      awaitingStudentNoForIntent = null;
      return;
    }

    const resp = {
      stage: metadata?.stage,
      intent: metadata?.intent,
      ui: metadata?.ui,
      api: metadata?.api,
      success: metadata?.success,
      message: message
    };

    renderBotResponse(resp);
  }
}

function renderBotResponse(resp) {
  // 1) Hata durumları önce kontrol et (not_found, error)
  if (resp.stage === "not_found" || resp.stage === "error") {
    addBubble("bot", resp.message || "Bir hata oluştu.");
    awaitingStudentNoForIntent = null;
    return;
  }

  // 2) Eksik alan varsa: studentNo ise kart göster
  if (resp.stage === "clarify") {
    const missing = resp.parsed?.missingFields || [];
    awaitingStudentNoForIntent = resp.parsed?.intent || null;

    if (missing.includes("studentNo")) {
      addBubble("bot", "Sure, I can help with that.");
      addStudentNoCard({ title: "Student Number", placeholder: "Enter student number" });
      return;
    }

    addBubble("bot", resp.message || "Eksik bilgi var.");
    return;
  }

  // 3) API cevabı geldiyse kart bas
  if (resp.stage === "api") {
    const apiData = resp.api?.data;

    if (resp.ui?.type === "tuition_card") {
      const studentNo = apiData?.studentNo ?? apiData?.StudentNo ?? resp.parsed?.studentNo;
      const term = apiData?.term ?? apiData?.Term ?? resp.parsed?.term;
      const tuitionTotal = apiData?.tuitionTotal ?? apiData?.TuitionTotal;
      const balance = apiData?.balance ?? apiData?.Balance;

      const rows = [
        { k: "Student Number", v: studentNo },
        { k: "Term", v: term },
        { k: "Amount Due", v: balance ?? tuitionTotal },
      ];

      addCard("Tuition", rows);
      awaitingStudentNoForIntent = null;
      return;
    }

    if (resp.ui?.type === "unpaid_list") {
      const items = Array.isArray(apiData?.items) ? apiData.items : [];

      addCard("Unpaid Tuitions", [
        { k: "Status", v: resp.api?.status },
        { k: "Total", v: apiData?.totalCount ?? items.length },
      ]);

      if (!items.length) {
        addBubble("bot", "Ödenmemiş harç bulunamadı.");
        return;
      }

      items.forEach((it) => {
        const studentNo = it.studentNo ?? it.StudentNo ?? "";
        const term = it.term ?? it.Term ?? "";
        const balance = it.balance ?? it.Balance ?? it.amount ?? it.Amount ?? "";
        const tuitionTotal = it.tuitionTotal ?? it.TuitionTotal ?? "";

        const payBtn = document.createElement("button");
        payBtn.className = "btn";
        payBtn.textContent = "Pay Now";

        payBtn.onclick = async () => {
          payBtn.disabled = true;
          await sendMessageProgrammatically(`harç öde ${studentNo}`);
          payBtn.disabled = false;
        };

        addCard(
          `Student ${studentNo}`,
          [
            { k: "Student Number", v: studentNo },
            { k: "Term", v: term },
            { k: "Amount Due", v: balance || tuitionTotal },
          ],
          [payBtn]
        );
      });

      return;
    }

    addBubble("bot", "API:\n" + pretty(resp.api));
    return;
  }

  // 4) Ödeme için confirm ekranı
  if (resp.stage === "confirm_pay") {
    const pr = resp.ui?.paymentRequest || {};

    const amt = Number(pr.amount);
    const noBalance = !Number.isFinite(amt) || amt <= 0;

    const payBtn = document.createElement("button");
    payBtn.className = "btn";
    payBtn.textContent = noBalance ? "Paid" : "Pay Now";
    payBtn.disabled = noBalance;

    if (noBalance) {
      addCard("Pay Tuition", [
        { k: "Student Number", v: pr.studentNo },
        { k: "Term", v: pr.term },
        { k: "Amount", v: pr.amount },
      ], [payBtn]);

      addBubble("bot", "Bu harç zaten ödenmiş görünüyor/ Already paid (Amount: 0).");
      addSuccess("Payment already completed.");
      awaitingStudentNoForIntent = null;
      return;
    }

    payBtn.onclick = async () => {
      payBtn.disabled = true;
      try {
        const payResp = await postJSON("/pay", pr);
        if (payResp.success) {
          addBubble("bot", "Payment successful.");
          addSuccess("Payment successful.");
        } else {
          addBubble("bot", "Payment failed.\n" + pretty(payResp));
        }
      } catch (e) {
        addBubble("bot", "Payment error: " + e.message);
      }
    };

    addCard("Pay Tuition", [
      { k: "Student Number", v: pr.studentNo },
      { k: "Term", v: pr.term },
      { k: "Amount", v: pr.amount },
    ], [payBtn]);

    awaitingStudentNoForIntent = null;
    return;
  }

  // 5) Unknown
  if (resp.message) {
    addBubble("bot", resp.message);
  }
}

async function sendMessageProgrammatically(text) {
  inputEl.value = text;
  await handleSend();
}

async function handleSend(forcedText) {
  let text = (forcedText ?? inputEl.value).trim();
  if (!text) return;

  // If we previously asked for a student number, user may just type "123456"
  if (awaitingStudentNoForIntent && /^[0-9]{4,12}$/.test(text)) {
    text = `My student number for ${awaitingStudentNoForIntent} is ${text}.`;
    awaitingStudentNoForIntent = null;
  }

  addBubble("user", text);
  inputEl.value = "";
  sendEl.disabled = true;

  try {
    // Send to Firestore endpoint
    const resp = await postJSON("/chat/firestore", {
      sessionId: SESSION_ID,
      message: text
    });

    console.log("Message sent to Firestore:", resp);

    // Real-time listener will handle the bot response
    // DON'T render here to avoid duplicates - let Firestore listener handle it

  } catch (e) {
    addBubble("bot", "Hata: " + e.message);
  } finally {
    sendEl.disabled = false;
  }
}

sendEl.addEventListener("click", handleSend);
inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleSend();
});

// ===== CLEAR CHAT FUNCTIONALITY =====
const clearChatBtn = document.getElementById("clearChat");

clearChatBtn.addEventListener("click", async () => {
  // Clear the UI
  chatEl.innerHTML = '';

  // Clear displayed message IDs
  displayedMessageIds.clear();

  // Reset listener start time
  listenerStartTime = null;

  // Stop current listener
  if (messageListener) {
    messageListener();
    messageListener = null;
  }

  // Delete current session messages from Firestore
  try {
    await fetch(`/chat/history/${SESSION_ID}`, { method: 'DELETE' });
  } catch (e) {
    console.error("Failed to delete session messages:", e);
  }

  // Generate new session ID
  const newSessionId = "sess_" + Math.random().toString(36).substring(2, 10) + "_" + Date.now();
  localStorage.setItem("sessionId", newSessionId);
  window.SESSION_ID = newSessionId;

  // Reload page to start fresh with new session
  location.reload();
});

// ===== INITIALIZATION =====

async function loadChatHistory() {
  try {
    const response = await fetch(`/chat/history/${SESSION_ID}`);
    const data = await response.json();

    if (data.messages && data.messages.length > 0) {
      data.messages.forEach(msg => {
        // Mark as displayed to prevent duplicates
        displayedMessageIds.add(msg.id || msg._id);

        if (msg.role === 'user') {
          addBubble("user", msg.message);
        } else if (msg.role === 'bot') {
          const stage = msg.metadata?.stage;

          // SKIP confirm_pay, not_found, and error stages from history - only show text
          if (stage === "confirm_pay" || stage === "not_found" || stage === "error") {
            addBubble("bot", msg.message || "Bir hata oluştu.");
          } else {
            const resp = {
              stage: msg.metadata?.stage,
              intent: msg.metadata?.intent,
              ui: msg.metadata?.ui,
              api: msg.metadata?.api,
              success: msg.metadata?.success,
              message: msg.message
            };
            renderBotResponse(resp);
          }
        }
      });
    } else {
      // başlangıç mesajı
      addBubble("bot", "Merhaba! Harç sorgulama / ödenmemiş harç / ödeme için yazabilirsin.\nHello! You can type: check tuition / unpaid tuition / pay tuition.");
    }
  } catch (e) {
    console.error("Failed to load history:", e);
    addBubble("bot", "Merhaba! Harç sorgulama / ödenmemiş harç / ödeme için yazabilirsin.\nHello! You can type: check tuition / unpaid tuition / pay tuition.");
  }
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', async () => {
  console.log("Session ID:", SESSION_ID);

  // Load chat history first
  await loadChatHistory();

  // Then setup real-time listener for new messages
  setupRealtimeListener();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (messageListener) {
    messageListener();
  }
});
