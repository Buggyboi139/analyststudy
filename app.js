const UI = {
    homeLink: document.getElementById('home-link'),
    examSelect: document.getElementById('exam-select'),
    apiKeyInput: document.getElementById('api-key'),
    saveKeyBtn: document.getElementById('save-key-btn'),
    startBtn: document.getElementById('start-btn'),
    retestBtn: document.getElementById('retest-btn'),
    modeStandard: document.getElementById('mode-standard'),
    modeDefinitions: document.getElementById('mode-definitions'),
    configSection: document.getElementById('config-section'),
    quizContainer: document.getElementById('quiz-container'),
    questionText: document.getElementById('question-text'),
    optionsContainer: document.getElementById('options-container'),
    currentQNum: document.getElementById('current-q-num'),
    totalQNum: document.getElementById('total-q-num'),
    prevBtn: document.getElementById('prev-btn'),
    nextBtn: document.getElementById('next-btn'),
    hintBtn: document.getElementById('hint-btn'),
    hintContainer: document.getElementById('hint-container'),
    hintText: document.getElementById('hint-text'),
    feedbackCard: document.getElementById('feedback-card'),
    feedbackVerdict: document.getElementById('feedback-verdict'),
    feedbackDefinition: document.getElementById('feedback-definition'),
    aiTutorBtn: document.getElementById('ai-tutor-btn'),
    aiResponseContainer: document.getElementById('ai-response-container'),
    aiResponseText: document.getElementById('ai-response-text'),
    correctCount: document.getElementById('correct-count'),
    incorrectCount: document.getElementById('incorrect-count'),
    historyList: document.getElementById('history-list')
};

let state = {
    questions: [],
    currentIndex: 0,
    apiKey: '',
    selectedAnswer: null,
    answers: {},
    correct: 0,
    incorrect: 0,
    mode: 'standard',
    isRetest: false
};

const STORAGE_KEYS = {
    session: 'cysa_session',
    incorrect: 'cysa_incorrect_ids',
    apiKey: 'openRouterKey'
};

function hashQuestion(q) {
    let hash = 0;
    const str = q.question || '';
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
}

function init() {
    const savedKey = localStorage.getItem(STORAGE_KEYS.apiKey);
    if (savedKey) {
        UI.apiKeyInput.value = savedKey;
        state.apiKey = savedKey;
    }

    const savedMode = localStorage.getItem('cysa_mode');
    if (savedMode === 'definitions') {
        state.mode = 'definitions';
        UI.modeStandard.classList.remove('active');
        UI.modeDefinitions.classList.add('active');
    }

    UI.saveKeyBtn.addEventListener('click', () => {
        const key = UI.apiKeyInput.value.trim();
        if (key) {
            localStorage.setItem(STORAGE_KEYS.apiKey, key);
            state.apiKey = key;
            alert('Key saved locally.');
        }
    });

    UI.homeLink.addEventListener('click', resetApp);
    UI.startBtn.addEventListener('click', () => startStudyMode(false));
    UI.retestBtn.addEventListener('click', () => startStudyMode(true));
    UI.nextBtn.addEventListener('click', nextQuestion);
    UI.prevBtn.addEventListener('click', prevQuestion);
    UI.aiTutorBtn.addEventListener('click', handleAITutor);
    UI.hintBtn.addEventListener('click', handleHint);

    UI.modeStandard.addEventListener('click', () => setMode('standard'));
    UI.modeDefinitions.addEventListener('click', () => setMode('definitions'));

    updateRetestButton();
    restoreSession();
}

function setMode(mode) {
    if (state.questions.length > 0) {
        const confirmed = confirm('Switching modes will reset your current progress. Continue?');
        if (!confirmed) return;
        resetApp();
    }
    state.mode = mode;
    localStorage.setItem('cysa_mode', mode);
    UI.modeStandard.classList.toggle('active', mode === 'standard');
    UI.modeDefinitions.classList.toggle('active', mode === 'definitions');
}

function updateRetestButton() {
    const incorrect = getIncorrectIds();
    const count = incorrect.filter(item => item.mode === state.mode).length;
    if (count > 0) {
        UI.retestBtn.classList.remove('hidden-view');
        UI.retestBtn.innerHTML = `Retest Incorrect Items <span class="retest-badge">${count}</span>`;
    } else {
        UI.retestBtn.classList.add('hidden-view');
    }
}

function getIncorrectIds() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.incorrect)) || [];
    } catch {
        return [];
    }
}

function saveIncorrectIds(ids) {
    localStorage.setItem(STORAGE_KEYS.incorrect, JSON.stringify(ids));
    updateRetestButton();
}

function saveSession() {
    const session = {
        exam: UI.examSelect.value,
        mode: state.mode,
        isRetest: state.isRetest,
        currentIndex: state.currentIndex,
        answers: state.answers,
        correct: state.correct,
        incorrect: state.incorrect,
        questionIds: state.questions.map(q => q._id),
        timestamp: Date.now()
    };
    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session));
}

function restoreSession() {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.session);
        if (!raw) return;
        const session = JSON.parse(raw);
        if (session.exam !== 'cysa') return;

        const confirmed = confirm('Resume your previous CySA+ session?');
        if (!confirmed) {
            localStorage.removeItem(STORAGE_KEYS.session);
            return;
        }

        state.mode = session.mode || 'standard';
        state.isRetest = session.isRetest || false;
        state.currentIndex = session.currentIndex || 0;
        state.answers = session.answers || {};
        state.correct = session.correct || 0;
        state.incorrect = session.incorrect || 0;

        UI.modeStandard.classList.toggle('active', state.mode === 'standard');
        UI.modeDefinitions.classList.toggle('active', state.mode === 'definitions');

        startStudyMode(state.isRetest, session.questionIds).then(() => {
            updateScoreboard();
        });
    } catch {
        localStorage.removeItem(STORAGE_KEYS.session);
    }
}

function resetApp(e) {
    if (e) e.preventDefault();
    UI.quizContainer.classList.remove('active-view');
    UI.quizContainer.classList.add('hidden-view');
    UI.configSection.classList.remove('hidden-view');
    UI.configSection.classList.add('active-view');

    state.currentIndex = 0;
    state.answers = {};
    state.correct = 0;
    state.incorrect = 0;
    state.questions = [];
    state.isRetest = false;
    updateScoreboard();
    UI.historyList.innerHTML = '';
    localStorage.removeItem(STORAGE_KEYS.session);
    updateRetestButton();
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

async function startStudyMode(isRetest = false, restoreIds = null) {
    const selectedExam = UI.examSelect.value;
    const filename = selectedExam === 'cysa' ? 'cysa/cysa.json' : `${selectedExam}.json`;

    try {
        const res = await fetch(filename);
        if (!res.ok) throw new Error();

        const rawData = await res.json();
        let questions;

        if (selectedExam === 'cysa' && rawData.standard && rawData.definitions) {
            questions = state.mode === 'definitions' ? rawData.definitions : rawData.standard;
        } else {
            questions = rawData.questions || rawData;
        }

        questions = questions.map(q => {
            const normalized = typeof q.answer === 'string'
                ? { ...q, answer: q.options.indexOf(q.answer) }
                : { ...q };
            normalized._id = hashQuestion(normalized);
            return normalized;
        });

        if (isRetest) {
            const incorrectIds = getIncorrectIds();
            const targetIds = new Set(
                incorrectIds
                    .filter(item => item.mode === state.mode)
                    .map(item => item.id)
            );
            questions = questions.filter(q => targetIds.has(q._id));
            if (questions.length === 0) {
                alert('No incorrect items found for retest.');
                return;
            }
        }

        if (restoreIds) {
            const idMap = new Map(questions.map(q => [q._id, q]));
            const restored = [];
            for (const id of restoreIds) {
                const q = idMap.get(id);
                if (q) restored.push(q);
            }
            if (restored.length > 0) {
                questions = restored;
            }
        }

        state.questions = shuffleArray(questions);
        state.isRetest = isRetest;

        UI.totalQNum.textContent = state.questions.length;

        UI.configSection.classList.remove('active-view');
        UI.configSection.classList.add('hidden-view');
        UI.quizContainer.classList.remove('hidden-view');
        UI.quizContainer.classList.add('active-view');

        saveSession();
        loadQuestion();
    } catch (err) {
        alert(`Could not load ${filename}.`);
    }
}

function updateScoreboard() {
    UI.correctCount.textContent = state.correct;
    UI.incorrectCount.textContent = state.incorrect;
}

function renderHistory() {
    UI.historyList.innerHTML = '';

    for (let i = 0; i <= state.currentIndex; i++) {
        if (state.answers[i] === undefined && i !== state.currentIndex) continue;

        const item = document.createElement('button');
        item.className = `history-item ${i === state.currentIndex ? 'active' : ''}`;

        let icon = '❓';
        if (state.answers[i] !== undefined) {
            const isCorrect = state.answers[i] === state.questions[i].answer;
            icon = isCorrect ? '✅' : '❌';
        }

        item.innerHTML = `<span>Question ${i + 1}</span> <span>${icon}</span>`;
        item.addEventListener('click', () => {
            state.currentIndex = i;
            loadQuestion();
        });

        UI.historyList.appendChild(item);
    }
}

function loadQuestion() {
    UI.feedbackCard.classList.add('hidden-view');
    UI.feedbackCard.classList.remove('active-view');
    UI.aiResponseContainer.classList.add('hidden-view');
    UI.aiResponseContainer.classList.remove('active-view');
    UI.hintContainer.classList.add('hidden-view');
    UI.hintContainer.classList.remove('active-view');

    UI.aiResponseText.textContent = '';
    UI.hintText.textContent = '';

    UI.hintBtn.disabled = !state.apiKey;
    UI.hintBtn.textContent = 'Hint';

    state.selectedAnswer = state.answers[state.currentIndex] !== undefined ? state.answers[state.currentIndex] : null;

    const q = state.questions[state.currentIndex];
    UI.currentQNum.textContent = state.currentIndex + 1;
    UI.questionText.textContent = q.question;
    UI.optionsContainer.innerHTML = '';

    q.options.forEach((opt, index) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = opt;

        if (state.selectedAnswer !== null) {
            btn.disabled = true;
            if (index === q.answer) {
                btn.classList.add('correct');
            } else if (index === state.selectedAnswer) {
                btn.classList.add('incorrect');
            }
        } else {
            btn.addEventListener('click', () => handleAnswer(index));
        }

        UI.optionsContainer.appendChild(btn);
    });

    UI.prevBtn.disabled = state.currentIndex === 0;
    UI.nextBtn.textContent = state.currentIndex === state.questions.length - 1 ? 'Finish' : 'Next';

    renderHistory();

    if (state.selectedAnswer !== null) {
        showFeedback(q, state.selectedAnswer);
        UI.hintBtn.disabled = true;
    }
}

function handleAnswer(selectedIndex) {
    const q = state.questions[state.currentIndex];
    const isCorrect = selectedIndex === q.answer;

    state.selectedAnswer = selectedIndex;
    state.answers[state.currentIndex] = selectedIndex;

    if (isCorrect) {
        state.correct++;
        if (state.isRetest) {
            const incorrectIds = getIncorrectIds();
            const filtered = incorrectIds.filter(
                item => !(item.id === q._id && item.mode === state.mode)
            );
            saveIncorrectIds(filtered);
        }
    } else {
        state.incorrect++;
        const incorrectIds = getIncorrectIds();
        const exists = incorrectIds.some(
            item => item.id === q._id && item.mode === state.mode
        );
        if (!exists) {
            incorrectIds.push({ id: q._id, mode: state.mode });
            saveIncorrectIds(incorrectIds);
        }
    }

    updateScoreboard();
    saveSession();
    loadQuestion();
}

function showFeedback(q, selectedIndex) {
    UI.feedbackCard.classList.remove('hidden-view');
    UI.feedbackCard.classList.add('active-view');

    const isCorrect = selectedIndex === q.answer;

    UI.feedbackVerdict.textContent = isCorrect ? "Correct!" : "Incorrect.";
    UI.feedbackVerdict.style.color = isCorrect ? "var(--success)" : "var(--error)";
    UI.feedbackCard.style.borderLeftColor = isCorrect ? "var(--success)" : "var(--error)";
    UI.feedbackDefinition.textContent = q.definition || '';

    if (!isCorrect && state.apiKey) {
        UI.aiTutorBtn.classList.remove('hidden-view');
        UI.aiTutorBtn.classList.add('active-view');
    } else {
        UI.aiTutorBtn.classList.add('hidden-view');
        UI.aiTutorBtn.classList.remove('active-view');
    }
}

async function handleAITutor() {
    UI.aiTutorBtn.disabled = true;
    UI.aiTutorBtn.textContent = "Thinking...";
    UI.aiResponseContainer.classList.remove('hidden-view');
    UI.aiResponseContainer.classList.add('active-view');
    UI.aiResponseText.textContent = "Loading AI response...";

    const q = state.questions[state.currentIndex];
    const userChoiceText = q.options[state.selectedAnswer];

    const response = await fetchAITutorResponse(state.apiKey, q, userChoiceText);

    UI.aiResponseText.textContent = response;
    UI.aiTutorBtn.disabled = false;
    UI.aiTutorBtn.textContent = "Explain with AI Tutor";
}

async function handleHint() {
    UI.hintBtn.disabled = true;
    UI.hintBtn.textContent = "Loading...";
    UI.hintContainer.classList.remove('hidden-view');
    UI.hintContainer.classList.add('active-view');
    UI.hintText.textContent = "Fetching hint...";

    const q = state.questions[state.currentIndex];
    const response = await fetchAIHint(state.apiKey, q);

    UI.hintText.textContent = response;
    UI.hintBtn.textContent = "Hint Provided";
}

function nextQuestion() {
    if (state.currentIndex < state.questions.length - 1) {
        state.currentIndex++;
        saveSession();
        loadQuestion();
    } else {
        alert("End of quiz. Click the logo to return home.");
    }
}

function prevQuestion() {
    if (state.currentIndex > 0) {
        state.currentIndex--;
        saveSession();
        loadQuestion();
    }
}

document.addEventListener('DOMContentLoaded', init);
