(() => {
  const STORAGE_KEY = 'numeral-trainer-v1';
  const DEFAULT_STATE = {
    mode: 'squares',
    difficulty: 'easy',
    score: 0,
    answered: 0,
    correct: 0,
    startedAt: Date.now(),
    current: null,
    misses: [],
    reviewing: false,
    submitted: false
  };

  const elements = {
    modeButtons: [...document.querySelectorAll('[data-mode]')],
    difficultyButtons: [...document.querySelectorAll('[data-difficulty]')],
    restart: document.querySelector('#restart-button'),
    questionKind: document.querySelector('#question-kind'),
    questionPosition: document.querySelector('#question-position'),
    baseNumber: document.querySelector('#base-number'),
    powerNumber: document.querySelector('#power-number'),
    hintLine: document.querySelector('#hint-line'),
    answerHint: document.querySelector('#answer-hint'),
    answerForm: document.querySelector('#answer-form'),
    answerInput: document.querySelector('#answer-input'),
    checkButton: document.querySelector('#check-button'),
    feedback: document.querySelector('#feedback-message'),
    next: document.querySelector('#next-button'),
    revisionCount: document.querySelector('#revision-count'),
    revisionLabel: document.querySelector('#revision-label'),
    revisionButton: document.querySelector('#revision-button'),
    score: document.querySelector('#score-value'),
    accuracy: document.querySelector('#accuracy-value'),
    answered: document.querySelector('#answered-value'),
    time: document.querySelector('#time-value'),
    today: document.querySelector('#today-label'),
    toast: document.querySelector('#toast')
  };

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!saved || typeof saved !== 'object') return { ...DEFAULT_STATE, current: createQuestion('squares') };
      const state = {
        ...DEFAULT_STATE,
        ...saved,
        score: Math.max(0, Number(saved.score) || 0),
        answered: Math.max(0, Number(saved.answered) || 0),
        correct: Math.max(0, Number(saved.correct) || 0),
        misses: Array.isArray(saved.misses) ? saved.misses.filter(isValidQuestion) : [],
        startedAt: Number(saved.startedAt) || Date.now(),
        submitted: Boolean(saved.submitted),
        reviewing: Boolean(saved.reviewing),
        mode: ['squares', 'cubes', 'mixed'].includes(saved.mode) ? saved.mode : 'squares',
        difficulty: ['easy', 'medium', 'hard'].includes(saved.difficulty) ? saved.difficulty : 'easy'
      };
      if (!isValidQuestion(state.current)) state.current = createQuestion(state.mode);
      if (state.reviewing && state.misses.length === 0) state.reviewing = false;
      return state;
    } catch {
      return { ...DEFAULT_STATE, current: createQuestion('squares') };
    }
  }

  function isValidQuestion(question) {
    return question && ['squares', 'cubes'].includes(question.kind) && Number.isInteger(question.base) && question.base >= 1 && question.base <= (question.kind === 'squares' ? 50 : 20);
  }

  function answerFor(question) {
    return question.kind === 'squares' ? question.base ** 2 : question.base ** 3;
  }

  function createQuestion(mode, excluded = null) {
    const kind = mode === 'mixed' ? (Math.random() < 0.5 ? 'squares' : 'cubes') : mode;
    const max = kind === 'squares' ? 50 : 20;
    let base = 1 + Math.floor(Math.random() * max);
    if (excluded && excluded.kind === kind && excluded.base === base && max > 1) base = base === max ? 1 : base + 1;
    return { kind, base };
  }

  let state = loadState();
  let toastTimer;
  let autoAdvanceTimer;
  elements.today.textContent = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' }).format(new Date());

  function clearAutoAdvance() {
    window.clearTimeout(autoAdvanceTimer);
    autoAdvanceTimer = null;
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      showToast('Progress could not be saved in this browser.');
    }
  }

  function hintFor(question) {
    const answer = String(answerFor(question));
    if (state.difficulty === 'hard') return { label: 'No hints', value: '' };
    if (state.difficulty === 'easy') return { label: 'First digit revealed', value: answer[0] + '_'.repeat(answer.length - 1) };
    return { label: 'Last digit revealed', value: '_'.repeat(answer.length - 1) + answer.at(-1) };
  }

  function renderQuestion() {
    const question = state.current;
    if (!question) return;
    const hint = hintFor(question);
    elements.questionKind.textContent = question.kind.toUpperCase();
    elements.questionPosition.textContent = `QUESTION ${String(state.answered + 1).padStart(2, '0')}`;
    elements.baseNumber.textContent = question.base;
    elements.powerNumber.textContent = question.kind === 'squares' ? '2' : '3';
    elements.hintLine.firstChild.textContent = `${hint.label} `;
    elements.answerHint.textContent = hint.value;
    elements.answerHint.setAttribute('aria-label', hint.value || 'No hint');
    elements.answerHint.hidden = !hint.value;
    elements.hintLine.querySelector('.hint-divider').hidden = !hint.value;
    elements.answerInput.value = '';
    elements.answerInput.disabled = state.submitted;
    elements.checkButton.disabled = state.submitted;
    elements.next.disabled = !state.submitted;
    elements.feedback.className = 'feedback-message';
    elements.feedback.textContent = state.submitted ? 'Answer submitted. Move on when you are ready.' : 'Type your answer and press Enter.';
    renderControls();
  }

  function renderControls() {
    elements.modeButtons.forEach((button) => {
      const selected = button.dataset.mode === state.mode;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    elements.difficultyButtons.forEach((button) => {
      const selected = button.dataset.difficulty === state.difficulty;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  function renderStats() {
    elements.score.innerHTML = `${state.score}<span class="stat-unit"> pts</span>`;
    elements.accuracy.textContent = state.answered ? `${Math.round((state.correct / state.answered) * 100)}%` : '—';
    elements.answered.textContent = state.answered;
    elements.revisionCount.textContent = state.misses.length;
    elements.revisionLabel.textContent = state.misses.length === 1 ? 'question waiting for review' : 'questions waiting for review';
    elements.revisionButton.disabled = state.misses.length === 0;
    elements.revisionButton.textContent = state.reviewing ? 'Exit review' : 'Review misses';
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - state.startedAt) / 1000));
    elements.time.textContent = `${String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:${String(elapsedSeconds % 60).padStart(2, '0')}`;
  }

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => elements.toast.classList.remove('is-visible'), 2400);
  }

  function storeMiss(question) {
    if (!state.misses.some((miss) => miss.kind === question.kind && miss.base === question.base)) {
      state.misses.push({ ...question });
    }
  }

  function removeMiss(question) {
    state.misses = state.misses.filter((miss) => miss.kind !== question.kind || miss.base !== question.base);
  }

  function submitAnswer(event) {
    event.preventDefault();
    if (state.submitted) return;
    clearAutoAdvance();
    const raw = elements.answerInput.value.trim();
    if (!/^\d+$/.test(raw)) {
      elements.feedback.className = 'feedback-message is-incorrect';
      elements.feedback.textContent = 'Enter a whole number to check your answer.';
      elements.answerInput.setAttribute('aria-invalid', 'true');
      elements.answerInput.focus();
      return;
    }

    elements.answerInput.removeAttribute('aria-invalid');
    const question = state.current;
    const isCorrect = Number(raw) === answerFor(question);
    state.submitted = true;
    state.answered += 1;
    if (isCorrect) {
      state.correct += 1;
      state.score += 1;
      removeMiss(question);
      elements.feedback.className = 'feedback-message is-correct';
      elements.feedback.textContent = 'Exactly right. Nice recall.';
    } else {
      storeMiss(question);
      elements.feedback.className = 'feedback-message is-incorrect';
      elements.feedback.textContent = `Not quite. The answer is ${answerFor(question)}.`;
    }
    elements.answerInput.disabled = true;
    elements.checkButton.disabled = true;
    elements.next.disabled = false;
    renderStats();
    saveState();
    autoAdvanceTimer = window.setTimeout(() => {
      autoAdvanceTimer = null;
      if (state.submitted) advanceQuestion();
    }, 500);
  }

  function advanceQuestion() {
    clearAutoAdvance();
    if (state.reviewing && state.misses.length) {
      const currentMissIndex = state.misses.findIndex((miss) => miss.kind === state.current.kind && miss.base === state.current.base);
      if (currentMissIndex >= 0 && state.misses.length > 1) {
        state.misses.push(state.misses.splice(currentMissIndex, 1)[0]);
      }
      state.current = { ...state.misses[0] };
    } else {
      if (state.reviewing) {
        state.reviewing = false;
        showToast('Revision complete. Back to regular practice.');
      }
      state.current = createQuestion(state.mode, state.current);
    }
    state.submitted = false;
    renderStats();
    saveState();
    renderQuestion();
    elements.answerInput.focus();
  }

  function setMode(mode) {
    clearAutoAdvance();
    state.mode = mode;
    state.reviewing = false;
    state.current = createQuestion(mode, state.current);
    state.submitted = false;
    saveState();
    renderQuestion();
  }

  function setDifficulty(difficulty) {
    state.difficulty = difficulty;
    saveState();
    renderQuestion();
  }

  function toggleRevision() {
    if (!state.misses.length && !state.reviewing) return;
    clearAutoAdvance();
    state.reviewing = !state.reviewing;
    if (state.reviewing) state.current = { ...state.misses[0] };
    else state.current = createQuestion(state.mode, state.current);
    state.submitted = false;
    saveState();
    renderQuestion();
    showToast(state.reviewing ? 'Reviewing previously missed questions.' : 'Back to regular practice.');
  }

  function restartSession() {
    const confirmed = window.confirm('Restart this session? Your session score and timer will reset. Missed questions will stay in your revision list.');
    if (!confirmed) return;
    clearAutoAdvance();
    state.score = 0;
    state.answered = 0;
    state.correct = 0;
    state.startedAt = Date.now();
    state.reviewing = false;
    state.submitted = false;
    state.current = createQuestion(state.mode);
    saveState();
    renderQuestion();
    renderStats();
    showToast('Fresh session started. Your revision list is saved.');
  }

  elements.modeButtons.forEach((button) => button.addEventListener('click', () => setMode(button.dataset.mode)));
  elements.difficultyButtons.forEach((button) => button.addEventListener('click', () => setDifficulty(button.dataset.difficulty)));
  elements.answerForm.addEventListener('submit', submitAnswer);
  elements.next.addEventListener('click', advanceQuestion);
  elements.revisionButton.addEventListener('click', toggleRevision);
  elements.restart.addEventListener('click', restartSession);
  elements.answerInput.addEventListener('input', () => elements.answerInput.removeAttribute('aria-invalid'));

  renderQuestion();
  renderStats();
  window.setInterval(renderStats, 1000);
})();
