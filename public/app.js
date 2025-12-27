const chatEl = document.getElementById("chat");
const inputEl = document.getElementById("msg");
const sendEl = document.getElementById("send");

// Simple client-side conversation hinting:
// if we asked for a student number, user can just type it.
let awaitingStudentNoForIntent = null; // "QUERY_TUITION" | "PAY_TUITION" | "UNPAID_TUITION" | null

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
    // Store intent hint so if they type only a number later, we can guide.
    awaitingStudentNoForIntent = null;
    // Make it easy for the LLM: send a clear sentence.
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

  // Keep a hint in case user types just a number in the main composer.
  if (intentHint) awaitingStudentNoForIntent = intentHint;
  setTimeout(() => inp.focus(), 50);
}

async function sendMessageProgrammatically(text) {
  inputEl.value = text;
  await handleSend();
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

async function handleSend(forcedText) {
  let text = (forcedText ?? inputEl.value).trim();
  if (!text) return;

  // If we previously asked for a student number, user may just type "123456".
  if (awaitingStudentNoForIntent && /^[0-9]{4,12}$/.test(text)) {
    text = `My student number for ${awaitingStudentNoForIntent} is ${text}.`;
    awaitingStudentNoForIntent = null;
  }

  addBubble("user", text);
  inputEl.value = "";
  sendEl.disabled = true;

  try {
    const resp = await postJSON("/chat", { message: text });

    // 1) Eksik alan varsa: studentNo ise kart göster (görseldeki akış)
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

    // 2) API cevabı geldiyse kart bas
    if (resp.stage === "api") {
      // Genel fallback: API datayı göster
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

  // Liste boşsa
  if (!items.length) {
    addBubble("bot", "Ödenmemiş harç bulunamadı. / No unpaid tuition fee found");
    return;
  }

  // Her item için kart + Öde butonu
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
      // Pay card'ı açsın diye chat’e yönlendiriyoruz
      await handleSend(`harç öde ${studentNo}`);
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

    // 3) Ödeme için confirm ekranı
    if (resp.stage === "confirm_pay") {
      const pr = resp.ui?.paymentRequest || {};

      // ✅ If amount is 0 (already paid / no balance), don't call /pay
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

      //addBubble("bot", resp.message || "Okay, I can assist you with that");
      awaitingStudentNoForIntent = null;
      return;
    }

    // 3.5) Balance yoksa
    if (resp.stage === "no_balance") {
      if (resp.api?.data) {
        const apiData = resp.api.data;
        const rows = [
          { k: "Student Number", v: apiData?.studentNo ?? apiData?.StudentNo },
          { k: "Term", v: apiData?.term ?? apiData?.Term },
          { k: "Amount Due", v: apiData?.balance ?? apiData?.Balance },
        ];
        addCard("Tuition", rows);
      }
      addBubble("bot", resp.message || "No outstanding balance.");
      awaitingStudentNoForIntent = null;
      return;
    }

    // 4) Unknown
    addBubble("bot", resp.message || "Bir şey anlamadım, tekrar dener misin?");
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

// başlangıç mesajı
addBubble("bot", "Merhaba! Harç sorgulama / ödenmemiş harç / ödeme için yazabilirsin.\nHello! You can type: check tuition / unpaid tuition / pay tuition.");
