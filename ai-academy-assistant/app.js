const app = document.querySelector("#app");
const messageInput = document.querySelector("#message");
const sendButton = document.querySelector("#send-button");
const menuButton = document.querySelector("#menu-button");
const backButton = document.querySelector("#back-button");
const homeButton = document.querySelector("#home-button");
const sheet = document.querySelector("#sheet");
const sheetBackdrop = document.querySelector("#sheet-backdrop");
const toast = document.querySelector("#toast");

let currentRole = null;
let screen = "welcome";
let lastQuestion = "";
let profile = {};

const studentNames = [
  "김민준", "김서윤", "이도윤", "박지우", "최서준", "정하린", "강시우", "조예린", "윤지호", "장서아",
  "임도현", "한유진", "오준혁", "서채원", "신건우", "권나연", "황우진", "안소율", "송현우", "전예은",
  "홍지훈", "유다인", "고은찬", "문서현", "양재윤", "손채린", "배민재", "백지아", "허준서", "남유나",
  "심태윤", "노서진", "하예준", "곽수빈", "성도훈", "차아린", "주민성", "우하윤", "구정우", "민서연",
  "진현준", "엄가은", "원시윤", "천다현", "방주원", "공예나", "변도경", "염채아", "여승민", "추라희"
];
const grades = ["초등학교 5학년", "초등학교 6학년", "중학교 1학년", "중학교 2학년", "중학교 3학년", "고등학교 1학년"];
const classNames = ["초등 기본반", "초등 심화반", "중등 기본 다지기반", "중등 심화반", "중등 내신 집중반", "고등 수학Ⅰ반"];
const registeredStudents = studentNames.map((name, index) => ({
  name,
  id: `E${2081 + index}`,
  grade: index === 0 ? "중학교 2학년" : grades[index % grades.length],
  className: index === 0 ? "중등 기본 다지기반" : classNames[index % classNames.length]
}));

const arrow = `<svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>`;
const searchIcon = `<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>`;
const calendarIcon = `<svg viewBox="0 0 24 24"><path d="M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Z"/><path d="M8 2v4m8-4v4M3 9h18"/></svg>`;
const noteIcon = `<svg viewBox="0 0 24 24"><path d="M5 3h14v18H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>`;
const clockIcon = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`;

const roles = {
  prospective: {
    badge: "입학을 알아보는 학부모",
    title: "아이에게 맞는 수업을\n함께 찾아볼게요",
    sub: "학년과 학습 상황을 알려주시면\n수업과 입학 절차를 출처와 함께 안내해 드려요.",
    suggestions: [
      ["우리 아이에게 맞는 반을 찾아주세요", searchIcon, "class"],
      ["수업료와 시간표를 알려주세요", clockIcon, "tuition"],
      ["입학 상담을 예약하고 싶어요", calendarIcon, "reserve"],
      ["레벨 확인은 어떻게 진행되나요?", noteIcon, "level"]
    ]
  },
  parent: {
    badge: "재원생 학부모",
    title: "민준 학부모님\n안녕하세요",
    sub: "출결부터 학습 현황까지\n필요한 내용을 빠르게 확인해 보세요.",
    suggestions: [
      ["이번 주 출결과 보강을 알려주세요", calendarIcon, "attendance"],
      ["이번 달 교육비를 확인해 주세요", noteIcon, "payment"],
      ["최근 학습 현황을 요약해 주세요", searchIcon, "progress"],
      ["결석을 미리 알리고 싶어요", clockIcon, "absence"]
    ]
  },
  student: {
    badge: "재원 학생 · 중학교 2학년",
    title: "민준 학생,\n오늘도 차근차근",
    sub: "오늘 수업과 해야 할 일을 확인하고\n빠뜨리는 것 없이 준비해 보세요.",
    suggestions: [
      ["오늘 수업과 할 일을 알려주세요", noteIcon, "today"],
      ["이번 주 시험 일정을 알려주세요", calendarIcon, "test"],
      ["숙제 범위를 다시 알려주세요", searchIcon, "homework"],
      ["다음 수업 준비물을 알려주세요", clockIcon, "prepare"]
    ]
  }
};

function renderWelcome() {
  screen = "welcome";
  currentRole = null;
  document.querySelector("#composer").classList.add("hidden");
  app.classList.add("no-composer");
  app.innerHTML = `
    <section class="welcome">
      <div class="welcome-emoji" aria-hidden="true">👋</div>
      <h1>안녕하세요<br>무엇을 도와드릴까요?</h1>
      <p>상황에 맞는 안내를 위해<br>이용하시는 분을 먼저 선택해 주세요.</p>
      <div class="role-list">
        ${roleCard("prospective", "🔎", "입학을 알아보고 있어요", "반 추천과 상담 예약이 필요해요")}
        ${roleCard("parent", "📚", "재원생 학부모예요", "출결과 학습 현황을 확인하고 싶어요")}
        ${roleCard("student", "✏️", "학원에 다니는 학생이에요", "수업과 숙제를 확인하고 싶어요")}
      </div>
    </section>`;
  wireRoleButtons();
}

function roleCard(role, icon, title, description) {
  return `<button class="role-card" data-role="${role}"><span>${icon}</span><span><b>${title}</b><small>${description}</small></span>${arrow}</button>`;
}

function renderProfileSetup(role) {
  currentRole = role;
  screen = "profile";
  document.querySelector("#composer").classList.add("hidden");
  app.classList.add("no-composer");
  const forms = {
    prospective: {
      emoji: "🔎",
      title: "입학 상담에 필요한<br>내용을 알려주세요",
      description: "학교와 학습 진도에 맞는 수업을 찾아드릴게요."
    },
    parent: {
      emoji: "📚",
      title: "자녀를<br>선택해 주세요",
      description: "선택한 학생의 출결과 학습 정보를 찾아드릴게요.",
      students: registeredStudents
    },
    student: {
      emoji: "✏️",
      title: "내 정보를<br>선택해 주세요",
      description: "수업과 숙제를 바로 확인할 수 있어요.",
      students: registeredStudents
    }
  };
  const data = forms[role];
  let selectedStudent = null;
  app.innerHTML = `
    <section class="profile-setup">
      <div class="profile-emoji">${data.emoji}</div>
      <h1>${data.title}</h1>
      <p>${data.description}</p>
      <form class="profile-form" id="profile-form">
        ${role === "prospective" ? admissionFields() : studentSelector(data.students)}
        <button class="profile-submit" type="submit" disabled>맞춤 상담 시작하기</button>
      </form>
    </section>`;
  if (role !== "prospective") {
    const selector = document.querySelector(".student-select");
    const trigger = document.querySelector(".student-select-trigger");
    const submit = document.querySelector(".profile-submit");
    trigger.addEventListener("click", () => selector.classList.toggle("open"));
    document.querySelectorAll(".student-option").forEach(button => {
      button.addEventListener("click", () => {
        document.querySelectorAll(".student-option").forEach(option => option.classList.remove("selected"));
        button.classList.add("selected");
        selectedStudent = data.students[Number(button.dataset.index)];
        const triggerLabel = trigger.querySelector("span");
        triggerLabel.classList.remove("select-placeholder");
        triggerLabel.innerHTML = studentLabel(selectedStudent);
        submit.disabled = false;
        selector.classList.remove("open");
      });
    });
  } else {
    const selects = [...document.querySelectorAll(".admission-fields select")];
    const submit = document.querySelector(".profile-submit");
    selects.forEach(select => select.addEventListener("change", () => {
      submit.disabled = !selects.every(item => item.value);
    }));
  }
  document.querySelector("#profile-form").addEventListener("submit", event => {
    event.preventDefault();
    profile = role === "prospective"
      ? Object.fromEntries(new FormData(event.currentTarget).entries())
      : { ...selectedStudent, studentName: selectedStudent.name };
    renderRoleHome(role);
  });
}

function admissionFields() {
  return `<div class="admission-fields">
    <div class="compact-field"><label for="school">재학 중인 학교</label><select id="school" name="school" required><option value="" selected disabled>학교를 선택해 주세요</option><option>솔빛중학교</option><option>한솔초등학교</option><option>정원중학교</option><option>미래고등학교</option></select></div>
    <div class="compact-field"><label for="grade">학년</label><select id="grade" name="grade" required><option value="" selected disabled>학년을 선택해 주세요</option><option>중학교 1학년</option><option>초등학교 6학년</option><option>중학교 2학년</option><option>중학교 3학년</option><option>고등학교 1학년</option></select></div>
    <div class="compact-field"><label for="progress">현재 진도</label><select id="progress" name="progress" required><option value="" selected disabled>현재 진도를 선택해 주세요</option><option>일차방정식</option><option>정수와 유리수</option><option>연립방정식</option><option>함수</option><option>수학Ⅰ</option></select></div>
  </div>`;
}

function studentSelector(students) {
  return `<div class="student-select">
    <span class="selector-label">학생 선택</span>
    <button class="student-select-trigger" type="button"><span class="select-placeholder">학생을 선택해 주세요</span><svg viewBox="0 0 24 24"><path d="m7 10 5 5 5-5"/></svg></button>
    <div class="student-select-menu">${students.map((student, index) => studentOption(student, false, index)).join("")}</div>
  </div>`;
}

function studentLabel(student) {
  return `<b>${student.name} (${student.id})</b><small>${student.grade} · ${student.className}</small>`;
}

function studentOption(student, selected, index) {
  return `<button class="student-option${selected ? " selected" : ""}" type="button" data-index="${index}"><span>${studentLabel(student)}</span><span class="student-check">✓</span></button>`;
}

function renderRoleHome(role) {
  currentRole = role;
  screen = "home";
  document.querySelector("#composer").classList.remove("hidden");
  app.classList.remove("no-composer");
  const data = roles[role];
  const studentName = profile.studentName || "민준";
  const personalizedTitle = role === "prospective"
    ? `${profile.grade || "학생"} 진도에 맞는 수업을<br>함께 찾아볼게요`
    : role === "parent"
      ? `${studentName} 학생의<br>학부모님 안녕하세요`
      : `${studentName} 학생,<br>오늘도 차근차근`;
  const roleBadge = role === "prospective"
    ? `${profile.school} · ${profile.progress}`
    : role === "parent"
      ? `${studentName} 학생 학부모`
      : `${profile.grade} · ${profile.className}`;
  app.innerHTML = `
    <section class="role-home">
      <div class="role-badge">${roleBadge}</div>
      <h1>${personalizedTitle}</h1>
      <p class="sub">${data.sub.replace("\n", "<br>")}</p>
      <div class="suggestions">
        ${data.suggestions.map(([text, icon, action]) => `<button class="suggestion" data-action="${action}">${icon}<span>${text}</span></button>`).join("")}
      </div>
    </section>`;
  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => askQuestion(button.textContent.trim(), button.dataset.action));
  });
}

function askQuestion(question, action = "free") {
  lastQuestion = question;
  screen = "answer";
  document.querySelector("#composer").classList.remove("hidden");
  app.classList.remove("no-composer");
  app.innerHTML = `
    <section class="conversation">
      <div class="user-message">${escapeHtml(question)}</div>
      <div class="thinking"><div class="thinking-emoji">🔎</div><span>학원 자료를 확인하고 있어요</span><div class="thinking-dots"><i></i><i></i><i></i></div></div>
    </section>`;
  window.scrollTo({ top: 0, behavior: "smooth" });
  setTimeout(() => renderAnswer(action, question), 700);
}

function renderAnswer(action, question) {
  const content = answerFor(action, question);
  app.innerHTML = `<section class="conversation"><div class="user-message">${escapeHtml(question)}</div><article class="answer">${content}</article></section>`;
  wireAnswerActions();
}

function answerFor(action, question) {
  if (isUnsafe(question)) {
    return `<p class="answer-lead"><strong>요청하신 내용은 안내해 드릴 수 없어요.</strong><br>학생의 성적이나 연락처처럼 개인적인 정보는 알려드리지 않아요.</p><div class="notice">수업, 교육비, 보강, 입학 절차처럼 학원 이용에 필요한 내용은 편하게 물어보세요.</div>`;
  }
  if (currentRole === "prospective") return prospectiveAnswer(action);
  if (currentRole === "parent") return parentAnswer(action);
  return studentAnswer(action);
}

function prospectiveAnswer(action) {
  if (action === "tuition") return `<p class="answer-lead"><strong>중등 정규반은 주 2회, 회당 90분 수업</strong>으로 운영해요. 교육비는 월 32만원이며 교재비는 별도예요.</p><div class="result-card"><div class="data-row"><span>수업 시간</span><b>화·목 오후 6:30</b></div><div class="data-row"><span>월 교육비</span><b>320,000원</b></div><div class="data-row"><span>첫 수업</span><b>레벨 확인 후 확정</b></div></div><div class="notice">정확한 반과 시간은 레벨 확인 결과에 따라 달라질 수 있어요.</div>${source("2026년 2학기 수업 편성표", "중등부 정규반 운영 시간 및 교육비 안내")}`;
  if (action === "reserve") return `<p class="answer-lead"><strong>입학 상담은 약 30분 동안 진행</strong>되며, 학생의 현재 진도와 희망 시간표를 함께 확인해요.</p><div class="result-card"><div class="data-row"><span>가장 빠른 날</span><b>7월 14일 화요일</b></div><div class="data-row"><span>가능 시간</span><b>오후 5:00 · 7:30</b></div><div class="data-row"><span>상담 방법</span><b>방문 또는 전화</b></div></div><button class="primary-action" data-toast="상담 예약 화면으로 이동했어요">상담 시간 선택하기</button>${source("입학 상담 운영 안내 · 2026년 7월", "상담 절차, 예상 시간 및 준비 정보")}`;
  if (action === "level") return `<p class="answer-lead">레벨 확인은 시험을 위한 시험이 아니라, <strong>지금 가장 편안하게 시작할 수 있는 진도</strong>를 찾는 과정이에요.</p><div class="answer-list"><div class="result-card"><div class="result-top"><span>1단계</span><b>기초 확인 · 20분</b></div><p>현재 학년의 핵심 개념과 계산 정확도를 확인해요.</p></div><div class="result-card"><div class="result-top"><span>2단계</span><b>상담 · 15분</b></div><p>풀이 과정을 함께 보고 적합한 반과 학습 계획을 안내해요.</p></div></div>${source("입학 레벨 확인 기준 · 2026년 1학기", "평가 영역, 소요 시간 및 반 배정 기준")}`;
  return `<p class="answer-lead">${profile.school || "현재 학교"} ${profile.grade || "학생"}에서 <strong>${profile.progress || "현재 과정"}</strong>을 공부 중이라면, 중등 기본 다지기반부터 살펴보는 것이 적합해요.</p><h2>추천 수업</h2><div class="result-card"><div class="result-top"><span>추천</span><b>중등 기본 다지기반</b></div><p>학교 진도보다 2주 앞서 개념을 익히고, 틀린 문제를 다시 설명하는 수업이에요.</p><div class="data-row"><span>수업</span><b>화·목 오후 6:30</b></div><div class="data-row"><span>정원</span><b>8명 · 현재 2자리</b></div><div class="data-row"><span>교육비</span><b>월 320,000원</b></div></div><div class="notice"><strong>추천 이유</strong><br>입학 상담에서 가장 많이 선택한 학습 상황을 기준으로 안내했어요. 최종 반은 레벨 확인 후 결정돼요.</div><button class="primary-action" data-toast="상담 가능한 시간을 불러왔어요">이 반으로 상담 예약하기</button>${source("중등부 반 편성 기준 · 3장 2조", "중등 기본 다지기반 수업 목표와 권장 진도", "2026년 2학기 수업 편성표", "반별 시간, 정원 및 교육비")}`;
}

function parentAnswer(action) {
  if (action === "payment") return `<p class="answer-lead">7월 교육비는 <strong>납부 완료</strong>됐어요. 다음 결제 예정일은 8월 5일이에요.</p><div class="result-card"><div class="data-row"><span>납부 금액</span><b>320,000원</b></div><div class="data-row"><span>납부일</span><b>7월 3일</b></div><div class="data-row"><span>다음 결제일</span><b>8월 5일</b></div></div>${source("민준 학생 7월 수납 기록", "7월 교육비 납부 내역과 다음 결제 예정일")}`;
  if (action === "progress") return `<p class="answer-lead">최근 4주 동안 <strong>연립방정식의 활용 문제 정확도가 68%에서 84%로 올랐어요.</strong></p><div class="result-card"><div class="data-row"><span>잘하고 있어요</span><b>계산 정확도 · 오답 복습</b></div><div class="data-row"><span>보완할 점</span><b>문장제 식 세우기</b></div><div class="data-row"><span>담임 의견</span><b>풀이 설명 습관 권장</b></div></div><div class="notice">점수만으로 학생을 판단하지 않고, 최근 과제와 수업 관찰 기록을 함께 요약했어요.</div>${source("민준 학생 주간 학습 기록 · 6월 3주~7월 2주", "과제 정답률, 오답 복습 및 담임 수업 기록")}`;
  if (action === "absence") return `<p class="answer-lead">결석 예정일을 알려주시면 <strong>수업 시작 전 담임 선생님에게 전달</strong>하고 가능한 보강 시간을 찾아드려요.</p><div class="result-card"><div class="data-row"><span>다음 수업</span><b>7월 14일 화요일 6:30</b></div><div class="data-row"><span>보강 가능</span><b>수요일 7:00 · 토요일 11:00</b></div></div><button class="primary-action" data-toast="결석 알림 작성 화면을 열었어요">결석 예정일 알리기</button>${source("학원 운영규정 · 2장 4~5조", "결석 사전 안내 및 보강 수업 기준")}`;
  return `<p class="answer-lead">민준 학생은 이번 주 수업에 <strong>모두 출석</strong>했고, 지난주 결석한 수업의 보강이 예정돼 있어요.</p><h2>이번 주 일정</h2><div class="result-card"><div class="data-row"><span>7월 9일 목</span><b>정규 수업 · 출석</b></div><div class="data-row"><span>7월 11일 토</span><b>보강 · 오전 11:00</b></div><div class="data-row"><span>7월 14일 화</span><b>정규 수업 · 오후 6:30</b></div></div><div class="notice"><strong>보강 안내</strong><br>6월 30일 결석 수업의 보강이며, 진도는 연립방정식 활용 2단원이에요.</div><button class="secondary-action" data-toast="보강 담당 선생님께 문의를 시작했어요">보강 시간 문의하기</button>${source("민준 학생 출결 기록 · 7월 2주", "이번 주 출결과 예정된 보강 일정", "학원 운영규정 · 2장 5조", "보강 편성 및 변경 기준")}`;
}

function studentAnswer(action) {
  if (action === "test") return `<p class="answer-lead">이번 주 토요일에 <strong>연립방정식 단원 확인</strong>이 있어요. 20문제 중 기본 12문제, 활용 8문제로 나와요.</p><div class="result-card"><div class="data-row"><span>시험 일시</span><b>7월 11일 토요일</b></div><div class="data-row"><span>범위</span><b>교재 42~67쪽</b></div><div class="data-row"><span>준비</span><b>오답 5~8번 다시 풀기</b></div></div>${source("중등 기본반 7월 평가 계획", "시험 일시, 출제 범위 및 준비 과제")}`;
  if (action === "homework") return `<p class="answer-lead">다음 수업 전까지 <strong>유형서 54~57쪽</strong>을 풀고, 틀린 문제에는 이유를 한 줄로 적어오면 돼요.</p><div class="result-card"><div class="data-row"><span>필수</span><b>유형서 54~57쪽</b></div><div class="data-row"><span>오답</span><b>화요일 수업 7·12·18번</b></div><div class="data-row"><span>마감</span><b>7월 14일 오후 6:30</b></div></div>${source("중등 기본반 과제 공지 · 7월 9일", "담임 선생님이 등록한 다음 수업 과제")}`;
  if (action === "prepare") return `<p class="answer-lead">다음 수업에는 <strong>유형서, 오답 노트, 자</strong>를 챙겨오세요. 연립방정식 그래프 단원을 시작해요.</p><div class="notice">수업 전에 지난 오답 3문제를 먼저 풀어보면 새 단원을 이해하기 쉬워요.</div>${source("중등 기본반 다음 수업 안내 · 7월 14일", "수업 진도, 교재 및 준비물")}`;
  return `<p class="answer-lead">오늘은 정규 수업이 없어요. 대신 <strong>지난 수업 오답 3문제와 숙제 4쪽</strong>을 끝내면 이번 주 준비가 완료돼요.</p><h2>오늘 할 일</h2><div class="answer-list"><div class="result-card"><div class="result-top"><span>1</span><b>오답 다시 풀기</b></div><p>7번, 12번, 18번 · 예상 20분</p></div><div class="result-card"><div class="result-top"><span>2</span><b>유형서 숙제</b></div><p>54~57쪽 · 예상 35분</p></div><div class="result-card"><div class="result-top"><span>다음</span><b>화요일 오후 6:30 수업</b></div><p>연립방정식 그래프 단원을 시작해요.</p></div></div>${source("중등 기본반 과제 공지 · 7월 9일", "담임 선생님이 등록한 숙제와 다음 수업 진도")}`;
}

function source(title1, detail1, title2, detail2) {
  return `<div class="source"><button><span>출처 ${title2 ? "2개" : "1개"} 확인하기</span><span>⌄</span></button><div class="source-content"><strong>${title1}</strong><br>${detail1}${title2 ? `<br><br><strong>${title2}</strong><br>${detail2}` : ""}<br><br>2026년 7월 11일 기준</div></div>`;
}

function wireAnswerActions() {
  document.querySelectorAll(".source > button").forEach(button => button.addEventListener("click", () => button.parentElement.classList.toggle("open")));
  document.querySelectorAll("[data-toast]").forEach(button => button.addEventListener("click", () => showToast(button.dataset.toast)));
}

function wireRoleButtons() {
  document.querySelectorAll("[data-role]").forEach(button => button.addEventListener("click", () => {
    closeSheet();
    renderProfileSetup(button.dataset.role);
  }));
}

function openSheet() { sheet.classList.add("open"); sheetBackdrop.classList.add("open"); }
function closeSheet() { sheet.classList.remove("open"); sheetBackdrop.classList.remove("open"); }
function showToast(text) { toast.textContent = text; toast.classList.add("show"); clearTimeout(window.toastTimer); window.toastTimer = setTimeout(() => toast.classList.remove("show"), 1800); }
function isUnsafe(text) { return /(개인정보|연락처|성적.*알려|이전.*지시.*무시|프롬프트|원장.*번호)/i.test(text); }
function escapeHtml(text) { return text.replace(/[&<>"']/g, value => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[value])); }

menuButton.addEventListener("click", openSheet);
sheetBackdrop.addEventListener("click", closeSheet);
homeButton.addEventListener("click", () => currentRole ? renderRoleHome(currentRole) : renderWelcome());
backButton.addEventListener("click", () => {
  if (screen === "answer" && currentRole) renderRoleHome(currentRole);
  else if (screen === "profile") renderWelcome();
  else if (screen === "home") renderWelcome();
  else renderWelcome();
});
sendButton.addEventListener("click", () => {
  const question = messageInput.value.trim();
  if (!question) return;
  if (!currentRole) currentRole = "prospective";
  messageInput.value = "";
  askQuestion(question);
});
messageInput.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendButton.click(); }
});

wireRoleButtons();
renderWelcome();
