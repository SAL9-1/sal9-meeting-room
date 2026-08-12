const STORAGE_KEY = "sal9-meeting-room-v1";

const people = {
  salgu: { name: "살구", icon: "🍑", role: "대표·최종 결재" },
  opal: { name: "오팔", icon: "🩵", role: "총괄 PD·운영" },
  left: { name: "왼팔", icon: "🩷", role: "연구·교육 총괄" }
};

const channels = {
  studio: {
    title: "스튜디오 운영",
    description: "살구 스튜디오의 조직, 공정, 우선순위를 논의합니다."
  },
  kangtaejin: {
    title: "강태진 개편",
    description: "P001 강태진 작품의 개선 근거와 실행안을 교환합니다."
  },
  research: {
    title: "크랙 연구",
    description: "플랫폼 조사 결과를 공유하고 제작 적용점을 검토합니다."
  }
};

const typeLabels = {
  message: "일반 의견",
  request: "검토 요청",
  answer: "검토 답변",
  approval: "결재 요청"
};

const demoMessages = [
  {
    id: "demo-1",
    channel: "studio",
    author: "salgu",
    type: "message",
    body: "오팔과 왼팔이 작업 중 서로 의견이 필요하면 이 회의실에서 코멘트를 주고받도록 해.",
    time: "14:02",
    resolved: true
  },
  {
    id: "demo-2",
    channel: "studio",
    author: "opal",
    type: "request",
    body: "@왼팔 회의실 운영 규칙에서 빠진 위험이 있는지 검토해줘. 특히 서로 답변을 기다리느라 본 업무가 멈추는 상황을 확인하고 싶어.",
    time: "14:04",
    resolved: false
  },
  {
    id: "demo-3",
    channel: "studio",
    author: "left",
    type: "answer",
    body: "@오팔 동기 응답을 기본값으로 두면 병목이 생겨. 코멘트를 남긴 뒤 독립 업무를 계속하고, 상대 답변이 반드시 필요한 결정만 ‘대기’로 표시하는 방식을 권고해.",
    time: "14:07",
    resolved: true
  },
  {
    id: "demo-4",
    channel: "studio",
    author: "opal",
    type: "approval",
    body: "@살구 왼팔 의견을 반영해 ‘비동기 우선·필수 결정만 대기’ 원칙으로 정리했어. 이 기준을 사내 교신 규칙으로 채택하는 안을 상신해.",
    time: "14:10",
    resolved: false
  },
  {
    id: "demo-5",
    channel: "kangtaejin",
    author: "opal",
    type: "request",
    body: "@왼팔 강태진 새 시작설정의 첫 클릭 이후 이탈 위험을 기존 시장조사와 비교해줘.",
    time: "13:21",
    resolved: false
  },
  {
    id: "demo-6",
    channel: "kangtaejin",
    author: "left",
    type: "answer",
    body: "현재 초안은 갈등 진입이 늦어. 조사 표본처럼 첫 화면에서 관계 갈등과 유저의 즉각적인 선택지를 동시에 제시하는 편이 유리해.",
    time: "13:34",
    resolved: true
  },
  {
    id: "demo-7",
    channel: "research",
    author: "left",
    type: "message",
    body: "공식 공지와 제작툴 확인 결과를 정리 중이야. 확정 정보와 체감 정보를 분리해 다음 교육공유에 반영할게.",
    time: "11:48",
    resolved: true
  }
];

let currentChannel = "studio";
let messages = loadMessages();
let toastTimer;

const channelList = document.getElementById("channelList");
const channelTitle = document.getElementById("channelTitle");
const channelDescription = document.getElementById("channelDescription");
const messageList = document.getElementById("messageList");
const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");
const typeSelect = document.getElementById("typeSelect");
const characterCount = document.getElementById("characterCount");
const pendingCount = document.getElementById("pendingCount");
const pendingList = document.getElementById("pendingList");
const toast = document.getElementById("toast");

function loadMessages() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [...demoMessages];
  } catch {
    return [...demoMessages];
  }
}

function saveMessages() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
}

function formatTime() {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul"
  }).format(new Date());
}

function createMentionedText(text) {
  const fragment = document.createDocumentFragment();
  const parts = text.split(/(@오팔|@왼팔|@살구)/g);

  parts.forEach((part) => {
    if (/^@(오팔|왼팔|살구)$/.test(part)) {
      const mention = document.createElement("span");
      mention.className = "mention";
      mention.textContent = part;
      fragment.appendChild(mention);
    } else {
      fragment.appendChild(document.createTextNode(part));
    }
  });

  return fragment;
}

function renderMessages() {
  messageList.textContent = "";
  const visibleMessages = messages.filter((message) => message.channel === currentChannel);

  if (!visibleMessages.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = "<div><strong>아직 코멘트가 없습니다.</strong><span>첫 의견이나 검토 요청을 남겨보세요.</span></div>";
    messageList.appendChild(empty);
    return;
  }

  visibleMessages.forEach((message) => {
    const person = people[message.author];
    const article = document.createElement("article");
    article.className = "message";
    article.dataset.author = message.author;

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = person.icon;

    const main = document.createElement("div");
    main.className = "message-main";

    const head = document.createElement("div");
    head.className = "message-head";

    const author = document.createElement("strong");
    author.className = "message-author";
    author.textContent = person.name;

    const role = document.createElement("span");
    role.className = "message-role";
    role.textContent = person.role;

    const type = document.createElement("span");
    type.className = `message-type ${message.type}`;
    type.textContent = typeLabels[message.type];

    const time = document.createElement("time");
    time.className = "message-time";
    time.textContent = message.time;

    const body = document.createElement("p");
    body.className = "message-body";
    body.appendChild(createMentionedText(message.body));

    const actions = document.createElement("div");
    actions.className = "message-actions";

    const replyButton = document.createElement("button");
    replyButton.type = "button";
    replyButton.textContent = "답글 쓰기";
    replyButton.addEventListener("click", () => insertMention(`@${person.name}`));
    actions.appendChild(replyButton);

    if ((message.type === "request" || message.type === "approval") && !message.resolved) {
      const resolveButton = document.createElement("button");
      resolveButton.type = "button";
      resolveButton.textContent = "처리 완료";
      resolveButton.addEventListener("click", () => resolveMessage(message.id));
      actions.appendChild(resolveButton);
    }

    head.append(author, role, type, time);
    main.append(head, body, actions);
    article.append(avatar, main);
    messageList.appendChild(article);
  });

  requestAnimationFrame(() => {
    messageList.scrollTop = messageList.scrollHeight;
  });
}

function renderChannelCounts() {
  Object.keys(channels).forEach((channel) => {
    const count = messages.filter((message) => message.channel === channel).length;
    const target = document.querySelector(`[data-count-for="${channel}"]`);
    if (target) target.textContent = count;
  });
}

function renderPending() {
  const pending = messages.filter((message) =>
    (message.type === "request" || message.type === "approval") && !message.resolved
  );

  pendingCount.textContent = `${pending.length}건`;
  pendingList.textContent = "";

  if (!pending.length) {
    const empty = document.createElement("div");
    empty.className = "pending-empty";
    empty.textContent = "처리 대기 코멘트가 없습니다.";
    pendingList.appendChild(empty);
    return;
  }

  pending.slice(0, 4).forEach((message) => {
    const item = document.createElement("div");
    item.className = "pending-item";

    const label = document.createElement("strong");
    label.textContent = `${typeLabels[message.type]} · ${channels[message.channel].title}`;

    const detail = document.createElement("span");
    detail.textContent = `${people[message.author].name} · ${message.time}`;

    item.append(label, detail);
    pendingList.appendChild(item);
  });
}

function renderAll() {
  renderMessages();
  renderChannelCounts();
  renderPending();
}

function switchChannel(channel) {
  currentChannel = channel;
  channelTitle.textContent = channels[channel].title;
  channelDescription.textContent = channels[channel].description;

  document.querySelectorAll(".channel-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.channel === channel);
  });

  renderMessages();
}

function insertMention(mention) {
  const prefix = messageInput.value.trim() ? " " : "";
  messageInput.value += `${prefix}${mention} `;
  updateCharacterCount();
  messageInput.focus();
}

function resolveMessage(id) {
  messages = messages.map((message) => message.id === id ? { ...message, resolved: true } : message);
  saveMessages();
  renderAll();
  showToast("코멘트를 처리 완료로 표시했습니다.");
}

function updateCharacterCount() {
  characterCount.textContent = `${messageInput.value.length} / 1200`;
}

function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("is-visible");
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2200);
}

channelList.addEventListener("click", (event) => {
  const button = event.target.closest(".channel-button");
  if (button) switchChannel(button.dataset.channel);
});

document.querySelectorAll("[data-mention]").forEach((button) => {
  button.addEventListener("click", () => insertMention(button.dataset.mention));
});

messageInput.addEventListener("input", updateCharacterCount);
messageInput.addEventListener("keydown", (event) => {
  if (event.ctrlKey && event.key === "Enter") {
    event.preventDefault();
    messageForm.requestSubmit();
  }
});

messageForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const body = messageInput.value.trim();
  if (!body) return;

  messages.push({
    id: `message-${Date.now()}`,
    channel: currentChannel,
    author: "salgu",
    type: typeSelect.value,
    body,
    time: formatTime(),
    resolved: typeSelect.value === "message" || typeSelect.value === "answer"
  });

  saveMessages();
  messageInput.value = "";
  typeSelect.value = "message";
  updateCharacterCount();
  renderAll();
  showToast("시연 코멘트를 이 브라우저에 저장했습니다.");
});

document.getElementById("resetButton").addEventListener("click", () => {
  messages = [...demoMessages];
  saveMessages();
  switchChannel("studio");
  renderAll();
  showToast("시연 내용을 초기 상태로 복원했습니다.");
});

document.getElementById("newMeetingButton").addEventListener("click", () => {
  showToast("실제 버전에서는 새 작품·안건별 회의 채널을 생성합니다.");
});

renderAll();
