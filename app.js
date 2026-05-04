const UI = {
    homeLink: document.getElementById('home-link'),
    examSelect: document.getElementById('exam-select'),
    apiKeyInput: document.getElementById('api-key'),
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
    historyList: document.getElementById('history-list'),
    summarySection: document.getElementById('summary-section'),
    summaryCorrect: document.getElementById('summary-correct'),
    summaryIncorrect: document.getElementById('summary-incorrect'),
    summaryAccuracy: document.getElementById('summary-accuracy'),
    summaryHomeBtn: document.getElementById('summary-home-btn'),
    summaryRetestBtn: document.getElementById('summary-retest-btn')
};

let state = {
    exam: '',
    questions:[],
    currentIndex: 0,
    apiKey: '',
    selectedAnswer: null,
    answers: {},
    hints: {},
    aiResponses: {},
    correct: 0,
    incorrect: 0,
    mode: 'standard',
    isRetest: false
};

function getStorageKey(type) {
    return `${state.exam}_${type}`;
}

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

function parseMarkdown(text) {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');
}

function init() {
    state.exam = UI.examSelect.value;

    const savedKey = localStorage.getItem('openRouterKey');
    if (savedKey) {
        UI.apiKeyInput.value = savedKey;
        state.apiKey = savedKey;
    }

    const savedMode = localStorage.getItem('study_mode');
    if (savedMode === 'definitions') {
        state.mode = 'definitions';
        UI.modeStandard.classList.remove('active');
        UI.modeDefinitions.classList.add('active');
    }

    UI.homeLink.addEventListener('click', resetApp);
    UI.startBtn.addEventListener('click', () => startStudyMode(false));
    UI.retestBtn.addEventListener('click', () => startStudyMode(true));
    UI.nextBtn.addEventListener('click', nextQuestion);
    UI.prevBtn.addEventListener('click', prevQuestion);
    UI.aiTutorBtn.addEventListener('click', handleAITutor);
    UI.hintBtn.addEventListener('click', handleHint);
    UI.summaryHomeBtn.addEventListener('click', resetApp);
    UI.summaryRetestBtn.addEventListener('click', () => {
        resetApp();
        startStudyMode(true);
    });

    UI.modeStandard.addEventListener('click', () => setMode('standard'));
    UI.modeDefinitions.addEventListener('click', () => setMode('definitions'));

    UI.examSelect.addEventListener('change', (e) => {
        state.exam = e.target.value;
        updateRetestButton();
        restoreSession();
    });

    document.addEventListener('keydown', handleGlobalKeydown);

    updateRetestButton();
    restoreSession();
}

function handleGlobalKeydown(e) {
    if (!UI.quizContainer.classList.contains('active-view')) return;
    if (e.key === 'ArrowRight') nextQuestion();
    if (e.key === 'ArrowLeft') prevQuestion();
    if (['1', '2', '3', '4'].includes(e.key)) {
        const idx = parseInt(e.key) - 1;
        const q = state.questions[state.currentIndex];
        if (state.selectedAnswer === null && q && idx < q.options.length) {
            handleAnswer(idx);
        }
    }
}

function setMode(mode) {
    if (state.questions.length > 0) {
        const confirmed = confirm('Switching modes will reset your current progress. Continue?');
        if (!confirmed) return;
        resetApp();
    }
    state.mode = mode;
    localStorage.setItem('study_mode', mode);
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
        return JSON.parse(localStorage.getItem(getStorageKey('incorrect'))) || [];
    } catch {
        return[];
    }
}

function saveIncorrectIds(ids) {
    localStorage.setItem(getStorageKey('incorrect'), JSON.stringify(ids));
    updateRetestButton();
}

function saveSession() {
    const session = {
        exam: state.exam,
        mode: state.mode,
        isRetest: state.isRetest,
        currentIndex: state.currentIndex,
        answers: state.answers,
        correct: state.correct,
        incorrect: state.incorrect,
        questionIds: state.questions.map(q => q._id),
        hints: state.hints,
        aiResponses: state.aiResponses,
        timestamp: Date.now()
    };
    localStorage.setItem(getStorageKey('session'), JSON.stringify(session));
}

function restoreSession() {
    try {
        const raw = localStorage.getItem(getStorageKey('session'));
        if (!raw) return;
        const session = JSON.parse(raw);
        
        const examName = UI.examSelect.options[UI.examSelect.selectedIndex].text;
        const confirmed = confirm(`Resume your previous ${examName} session?`);
        if (!confirmed) {
            localStorage.removeItem(getStorageKey('session'));
            return;
        }

        state.mode = session.mode || 'standard';
        state.isRetest = session.isRetest || false;
        state.currentIndex = session.currentIndex || 0;
        state.answers = session.answers || {};
        state.correct = session.correct || 0;
        state.incorrect = session.incorrect || 0;
        state.hints = session.hints || {};
        state.aiResponses = session.aiResponses || {};

        UI.modeStandard.classList.toggle('active', state.mode === 'standard');
        UI.modeDefinitions.classList.toggle('active', state.mode === 'definitions');

        startStudyMode(state.isRetest, session.questionIds).then(() => {
            updateScoreboard();
        });
    } catch {
        localStorage.removeItem(getStorageKey('session'));
    }
}

function resetApp(e) {
    if (e) e.preventDefault();
    UI.quizContainer.classList.remove('active-view');
    UI.quizContainer.classList.add('hidden-view');
    UI.summarySection.classList.remove('active-view');
    UI.summarySection.classList.add('hidden-view');
    UI.configSection.classList.remove('hidden-view');
    UI.configSection.classList.add('active-view');

    state.currentIndex = 0;
    state.answers = {};
    state.correct = 0;
    state.incorrect = 0;
    state.questions =[];
    state.hints = {};
    state.aiResponses = {};
    state.isRetest = false;
    updateScoreboard();
    UI.historyList.innerHTML = '';
    localStorage.removeItem(getStorageKey('session'));
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
    const key = UI.apiKeyInput.value.trim();
    if (key) {
        localStorage.setItem('openRouterKey', key);
        state.apiKey = key;
    }

    state.exam = UI.examSelect.value;
    
    let res;
    try {
        res = await fetch(`${state.exam}/${state.exam}.json`);
        if (!res.ok) {
            res = await fetch(`${state.exam}.json`);
        }
        if (!res.ok) throw new Error();

        const rawData = await res.json();
        
        if (!rawData || (!rawData.questions && (!rawData.standard || !rawData.definitions) && !Array.isArray(rawData))) {
            throw new Error("Invalid schema");
        }

        let questions;

        if (rawData.standard && rawData.definitions) {
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
            const idMap = new Map(questions.map(q =>[q._id, q]));
            const restored =[];
            for (const id of restoreIds) {
                const q = idMap.get(id);
                if (q) restored.push(q);
            }
            if (restored.length > 0) {
                questions = restored;
            }
            state.questions = questions;
        } else {
            state.questions = shuffleArray(questions).slice(0, 25);
        }

        state.isRetest = isRetest;

        UI.totalQNum.textContent = state.questions.length;

        UI.configSection.classList.remove('active-view');
        UI.configSection.classList.add('hidden-view');
        UI.quizContainer.classList.remove('hidden-view');
        UI.quizContainer.classList.add('active-view');

        saveSession();
        loadQuestion();
    } catch (err) {
        alert(`Could not load valid dataset for ${UI.examSelect.options[UI.examSelect.selectedIndex].text}. Please verify the files.`);
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

    UI.aiResponseText.innerHTML = '';
    UI.hintText.innerHTML = '';

    UI.hintBtn.disabled = !state.apiKey;
    UI.hintBtn.textContent = 'Hint';

    if (state.hints[state.currentIndex]) {
        UI.hintContainer.classList.remove('hidden-view');
        UI.hintContainer.classList.add('active-view');
        UI.hintText.innerHTML = parseMarkdown(state.hints[state.currentIndex]);
        UI.hintBtn.disabled = true;
        UI.hintBtn.textContent = 'Hint Provided';
    }

    if (state.aiResponses[state.currentIndex]) {
        UI.aiResponseContainer.classList.remove('hidden-view');
        UI.aiResponseContainer.classList.add('active-view');
        UI.aiResponseText.innerHTML = parseMarkdown(state.aiResponses[state.currentIndex]);
        UI.aiTutorBtn.disabled = true;
        UI.aiTutorBtn.textContent = 'AI Tutor Used';
    }

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
    UI.aiResponseText.innerHTML = "Loading AI response...";

    const q = state.questions[state.currentIndex];
    const userChoiceText = q.options[state.selectedAnswer];
    const examName = UI.examSelect.options[UI.examSelect.selectedIndex].text;

    const response = await fetchAITutorResponse(state.apiKey, examName, q, userChoiceText);
    
    state.aiResponses[state.currentIndex] = response;
    saveSession();

    UI.aiResponseText.innerHTML = parseMarkdown(response);
    UI.aiTutorBtn.textContent = "AI Tutor Used";
}

async function handleHint() {
    UI.hintBtn.disabled = true;
    UI.hintBtn.textContent = "Loading...";
    UI.hintContainer.classList.remove('hidden-view');
    UI.hintContainer.classList.add('active-view');
    UI.hintText.innerHTML = "Fetching hint...";

    const q = state.questions[state.currentIndex];
    const examName = UI.examSelect.options[UI.examSelect.selectedIndex].text;
    
    const response = await fetchAIHint(state.apiKey, examName, q);

    state.hints[state.currentIndex] = response;
    saveSession();

    UI.hintText.innerHTML = parseMarkdown(response);
    UI.hintBtn.textContent = "Hint Provided";
}

function showSummary() {
    UI.quizContainer.classList.remove('active-view');
    UI.quizContainer.classList.add('hidden-view');
    UI.summarySection.classList.remove('hidden-view');
    UI.summarySection.classList.add('active-view');

    UI.summaryCorrect.textContent = state.correct;
    UI.summaryIncorrect.textContent = state.incorrect;
    
    const total = state.correct + state.incorrect;
    const accuracy = total > 0 ? Math.round((state.correct / total) * 100) : 0;
    UI.summaryAccuracy.textContent = `${accuracy}%`;

    const incorrectIds = getIncorrectIds();
    const count = incorrectIds.filter(item => item.mode === state.mode).length;
    if (count > 0) {
        UI.summaryRetestBtn.classList.remove('hidden-view');
    } else {
        UI.summaryRetestBtn.classList.add('hidden-view');
    }

    localStorage.removeItem(getStorageKey('session'));
}

function nextQuestion() {
    if (state.currentIndex < state.questions.length - 1) {
        state.currentIndex++;
        saveSession();
        loadQuestion();
    } else {
        showSummary();
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