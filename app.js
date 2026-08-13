const STORAGE_KEY = "sal9-meeting-room-v2";
const LEGACY_STORAGE_KEY = "sal9-meeting-room-v1";

const people = {
  salgu: { name: "살구", icon: "🍑", role: "대표·최종 결재" },
  opal: { name: "오팔", icon: "🩵", role: "총괄 PD·운영" },
  left: { name: "왼팔", icon: "🩷", role: "연구·교육 총괄" },
  web: { name: "웹개발팀", icon: "🌐", role: "웹·인터랙티브개발" }
};

const typeLabels = {
  message: "일반 의견",
  request: "검토 요청",
  answer: "검토 답변",
  approval: "결재 요청"
};

const defaultChannels = [
  { id: "studio", name: "스튜디오 운영", description: "살구 스튜디오의 조직, 공정, 우선순위를 논의합니다." },
  { id: "kangtaejin", name: "강태진 개편", description: "P001 강태진 작품의 개선 근거와 실행안을 교환합니다." },
  { id: "research", name: "크랙 연구", description: "플랫폼 조사 결과를 공유하고 제작 적용점을 검토합니다." }
];

const actorParam = new URLSearchParams(location.search).get("actor");
const currentActor = ["opal", "left", "web"].includes(actorParam) ? actorParam : "salgu";
const isOwner = currentActor === "salgu";
const broadcast = "BroadcastChannel" in window ? new BroadcastChannel("sal9-meeting-room") : null;

let state = loadState();
let currentChannel = state.channels[0]?.id || null;
let replyTarget = null;
let channelDialogMode = "create";
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
const channelDialog = document.getElementById("channelDialog");
const channelForm = document.getElementById("channelForm");
const channelDialogTitle = document.getElementById("channelDialogTitle");
const channelNameInput = document.getElementById("channelNameInput");
const channelDescriptionInput = document.getElementById("channelDescriptionInput");
const channelFormError = document.getElementById("channelFormError");
const syncState = document.getElementById("syncState");
const storageStatus = document.getElementById("storageStatus");

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.channels) && saved.channels.length && Array.isArray(saved.messages)) return saved;
  } catch { /* 손상된 데이터는 초기값으로 복구 */ }

  const initial = { channels: structuredClone(defaultChannels), messages: migrateLegacyMessages() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  return initial;
}

function migrateLegacyMessages() {
  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY));
    if (!Array.isArray(legacy)) return [];
    return legacy.map((message, index) => ({
      id: message.id || `legacy-${index}`,
      channelId: message.channel || "studio",
      author: people[message.author] ? message.author : "salgu",
      type: typeLabels[message.type] ? message.type : "message",
      body: String(message.body || ""),
      parentId: null,
      resolved: Boolean(message.resolved),
      createdAt: new Date(Date.now() - (legacy.length - index) * 60_000).toISOString()
    })).filter(message => message.body);
  } catch { return []; }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  syncState.textContent = "저장됨";
  storageStatus.textContent = "자동 저장";
  broadcast?.postMessage({ type: "state-updated", at: Date.now() });
}

function reloadFromStorage() {
  const preferred = currentChannel;
  state = loadState();
  currentChannel = state.channels.some(channel => channel.id === preferred) ? preferred : state.channels[0]?.id || null;
  renderAll();
  syncState.textContent = "새 코멘트 반영";
  setTimeout(() => { syncState.textContent = "저장됨"; }, 1400);
}

function configureActor() {
  const person = people[currentActor];
  document.getElementById("ownerAvatar").textContent = person.icon;
  document.getElementById("ownerName").textContent = person.name;
  document.getElementById("ownerRole").textContent = person.role;
  document.getElementById("ownerChip").setAttribute("aria-label", `현재 발신자 ${person.name}`);
  document.getElementById("senderIdentity").textContent = `${person.icon} ${person.name}`;
  document.getElementById("newMeetingButton").hidden = !isOwner;
  document.querySelector(".channel-actions").hidden = !isOwner;
}

function renderAll() {
  renderChannels();
  renderMessages();
  renderPending();
  renderCurrentChannel();
}

function renderChannels() {
  channelList.textContent = "";
  state.channels.forEach(channel => {
    const button = document.createElement("button");
    button.className = `channel-button${channel.id === currentChannel ? " is-active" : ""}`;
    button.type = "button";
    button.dataset.channel = channel.id;

    const icon = document.createElement("span");
    icon.className = "channel-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "#";
    const copy = document.createElement("span");
    copy.className = "channel-copy";
    const name = document.createElement("strong");
    name.textContent = channel.name;
    const description = document.createElement("small");
    description.textContent = channel.description;
    copy.append(name, description);
    const count = document.createElement("span");
    count.className = "channel-count";
    count.textContent = state.messages.filter(message => message.channelId === channel.id).length;
    button.append(icon, copy, count);
    channelList.appendChild(button);
  });
}

function renderCurrentChannel() {
  const channel = getCurrentChannel();
  channelTitle.textContent = channel?.name || "회의 채널";
  channelDescription.textContent = channel?.description || "";
  document.getElementById("deleteChannelButton").disabled = state.channels.length <= 1;
}

function renderMessages() {
  messageList.textContent = "";
  const visible = state.messages.filter(message => message.channelId === currentChannel);
  if (!visible.length) {
    showEmptyState("아직 코멘트가 없습니다.", "첫 의견이나 검토 요청을 남겨보세요.");
    return;
  }

  visible.forEach(message => {
    const person = people[message.author] || people.salgu;
    const article = document.createElement("article");
    article.className = `message${message.parentId ? " is-reply" : ""}`;
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
    type.textContent = typeLabels[message.type] || typeLabels.message;
    const time = document.createElement("time");
    time.className = "message-time";
    time.dateTime = message.createdAt;
    time.textContent = formatTime(message.createdAt);
    head.append(author, role, type, time);

    if (message.parentId) {
      const parent = state.messages.find(item => item.id === message.parentId);
      const replyLabel = document.createElement("div");
      replyLabel.className = "reply-label";
      replyLabel.textContent = parent ? `↳ ${people[parent.author]?.name || "이전 코멘트"}에게 답글` : "↳ 답글";
      main.appendChild(replyLabel);
    }

    const body = document.createElement("p");
    body.className = "message-body";
    body.appendChild(createMentionedText(message.body));
    const actions = document.createElement("div");
    actions.className = "message-actions";
    actions.appendChild(actionButton("답글 쓰기", () => startReply(message)));
    if (["request", "approval"].includes(message.type) && !message.resolved) {
      actions.appendChild(actionButton("처리 완료", () => resolveMessage(message.id)));
    }
    if (isOwner || message.author === currentActor) {
      actions.appendChild(actionButton("삭제", () => deleteMessage(message.id), "danger-text"));
    }
    main.append(head, body, actions);
    article.append(avatar, main);
    messageList.appendChild(article);
  });
  requestAnimationFrame(() => { messageList.scrollTop = messageList.scrollHeight; });
}

function renderPending() {
  const pending = state.messages.filter(message => ["request", "approval"].includes(message.type) && !message.resolved);
  pendingCount.textContent = `${pending.length}건`;
  pendingList.textContent = "";
  if (!pending.length) {
    const empty = document.createElement("div");
    empty.className = "pending-empty";
    empty.textContent = "처리 대기 코멘트가 없습니다.";
    pendingList.appendChild(empty);
    return;
  }
  pending.slice(0, 8).forEach(message => {
    const channel = state.channels.find(item => item.id === message.channelId);
    const item = document.createElement("button");
    item.type = "button";
    item.className = "pending-item pending-button";
    const label = document.createElement("strong");
    label.textContent = `${typeLabels[message.type]} · ${channel?.name || "삭제된 채널"}`;
    const detail = document.createElement("span");
    detail.textContent = `${people[message.author]?.name || message.author} · ${formatTime(message.createdAt)}`;
    item.append(label, detail);
    item.addEventListener("click", () => switchChannel(message.channelId));
    pendingList.appendChild(item);
  });
}

function showEmptyState(title, description) {
  const empty = document.createElement("div");
  empty.className = "empty-state";
  const copy = document.createElement("div");
  const strong = document.createElement("strong");
  strong.textContent = title;
  const span = document.createElement("span");
  span.textContent = description;
  copy.append(strong, span);
  empty.appendChild(copy);
  messageList.appendChild(empty);
}

function createMentionedText(text) {
  const fragment = document.createDocumentFragment();
  String(text).split(/(@오팔|@왼팔|@살구)/g).forEach(part => {
    if (/^@(오팔|왼팔|살구)$/.test(part)) {
      const mention = document.createElement("span");
      mention.className = "mention";
      mention.textContent = part;
      fragment.appendChild(mention);
    } else fragment.appendChild(document.createTextNode(part));
  });
  return fragment;
}

function actionButton(label, handler, className = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  if (className) button.className = className;
  button.addEventListener("click", handler);
  return button;
}

function switchChannel(id) {
  if (!state.channels.some(channel => channel.id === id)) return;
  currentChannel = id;
  replyTarget = null;
  messageInput.placeholder = "의견이나 검토 요청을 남겨주세요. Ctrl + Enter로 전송할 수 있습니다.";
  renderAll();
}

function startReply(message) {
  replyTarget = message.id;
  messageInput.value = `@${people[message.author]?.name || message.author} `;
  messageInput.placeholder = "답글 작성 중";
  updateCharacterCount();
  messageInput.focus();
}

function insertMention(mention) {
  const prefix = messageInput.value.trim() ? " " : "";
  messageInput.value += `${prefix}${mention} `;
  updateCharacterCount();
  messageInput.focus();
}

function resolveMessage(id) {
  const message = state.messages.find(item => item.id === id);
  if (!message) return;
  message.resolved = true;
  message.resolvedBy = currentActor;
  saveState();
  renderAll();
  showToast("코멘트를 처리 완료로 표시했습니다.");
}

function deleteMessage(id) {
  if (!confirm("이 코멘트와 연결된 답글을 삭제할까요? 이 작업은 되돌릴 수 없습니다.")) return;
  state.messages = state.messages.filter(message => message.id !== id && message.parentId !== id);
  saveState();
  renderAll();
  showToast("코멘트를 삭제했습니다.");
}

function openChannelDialog(mode) {
  if (!isOwner) return showToast("채널 관리는 살구 화면에서만 할 수 있습니다.");
  channelDialogMode = mode;
  channelFormError.textContent = "";
  const channel = getCurrentChannel();
  if (mode === "edit" && channel) {
    channelDialogTitle.textContent = "채널 수정";
    channelNameInput.value = channel.name;
    channelDescriptionInput.value = channel.description;
  } else {
    channelDialogTitle.textContent = "새 채널 만들기";
    channelNameInput.value = "";
    channelDescriptionInput.value = "";
  }
  channelDialog.showModal();
  requestAnimationFrame(() => channelNameInput.focus());
}

function getCurrentChannel() { return state.channels.find(channel => channel.id === currentChannel); }

function formatTime(value) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul"
  }).format(new Date(value));
}

function updateCharacterCount() { characterCount.textContent = `${messageInput.value.length} / 1200`; }

function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("is-visible");
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2400);
}

channelList.addEventListener("click", event => {
  const button = event.target.closest(".channel-button");
  if (button) switchChannel(button.dataset.channel);
});

document.querySelectorAll("[data-mention]").forEach(button => button.addEventListener("click", () => insertMention(button.dataset.mention)));
messageInput.addEventListener("input", updateCharacterCount);
messageInput.addEventListener("keydown", event => {
  if (event.ctrlKey && event.key === "Enter") {
    event.preventDefault();
    messageForm.requestSubmit();
  }
});

messageForm.addEventListener("submit", event => {
  event.preventDefault();
  const body = messageInput.value.trim();
  if (!body || !currentChannel) return;
  state.messages.push({
    id: `msg_${crypto.randomUUID()}`,
    channelId: currentChannel,
    author: currentActor,
    type: typeSelect.value,
    body,
    parentId: replyTarget,
    resolved: ["message", "answer"].includes(typeSelect.value),
    resolvedBy: null,
    createdAt: new Date().toISOString()
  });
  saveState();
  messageInput.value = "";
  typeSelect.value = "message";
  replyTarget = null;
  messageInput.placeholder = "의견이나 검토 요청을 남겨주세요. Ctrl + Enter로 전송할 수 있습니다.";
  updateCharacterCount();
  renderAll();
  showToast("회의실에 코멘트를 남겼습니다.");
});

document.getElementById("newMeetingButton").addEventListener("click", () => openChannelDialog("create"));
document.getElementById("editChannelButton").addEventListener("click", () => openChannelDialog("edit"));
document.getElementById("cancelChannelButton").addEventListener("click", () => channelDialog.close());

channelForm.addEventListener("submit", event => {
  event.preventDefault();
  const name = channelNameInput.value.trim();
  const description = channelDescriptionInput.value.trim();
  if (!name || !description) {
    channelFormError.textContent = "채널 이름과 설명을 모두 입력해주세요.";
    return;
  }
  if (channelDialogMode === "edit") {
    const channel = getCurrentChannel();
    channel.name = name;
    channel.description = description;
  } else {
    const channel = { id: `ch_${crypto.randomUUID()}`, name, description };
    state.channels.push(channel);
    currentChannel = channel.id;
  }
  saveState();
  channelDialog.close();
  renderAll();
  showToast(channelDialogMode === "edit" ? "채널을 수정했습니다." : "새 회의 채널을 만들었습니다.");
});

document.getElementById("deleteChannelButton").addEventListener("click", () => {
  const channel = getCurrentChannel();
  if (!channel || state.channels.length <= 1) return;
  const count = state.messages.filter(message => message.channelId === channel.id).length;
  if (!confirm(`‘${channel.name}’ 채널과 코멘트 ${count}개를 모두 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)) return;
  state.channels = state.channels.filter(item => item.id !== channel.id);
  state.messages = state.messages.filter(message => message.channelId !== channel.id);
  currentChannel = state.channels[0].id;
  saveState();
  renderAll();
  showToast("회의 채널을 삭제했습니다.");
});

window.addEventListener("storage", event => {
  if (event.key === STORAGE_KEY) reloadFromStorage();
});
broadcast?.addEventListener("message", event => {
  if (event.data?.type === "state-updated") reloadFromStorage();
});

configureActor();
renderAll();
