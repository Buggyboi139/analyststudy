const UI = {
    homeLink: document.getElementById('home-link'),
    examSelect: document.getElementById('exam-select'),
    apiKeyInput: document.getElementById('api-key'),
    saveKeyBtn: document.getElementById('save-key-btn'),
    startBtn: document.getElementById('start-btn'),
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
    incorrect: 0
};

function init() {
    const savedKey = localStorage.getItem('openRouterKey');
    if (savedKey) {
        UI.apiKeyInput.value = savedKey;
        state.apiKey = savedKey;
    }

    UI.saveKeyBtn.addEventListener('click', () => {
        const key = UI.apiKeyInput.value.trim();
        if (key) {
            localStorage.setItem('openRouterKey', key);
            state.apiKey = key;
            alert('Key saved locally.');
        }
    });

    UI.homeLink.addEventListener('click', resetApp);
    UI.startBtn.addEventListener('click', startStudyMode);
    UI.nextBtn.addEventListener('click', nextQuestion);
    UI.prevBtn.addEventListener('click', prevQuestion);
    UI.aiTutorBtn.addEventListener('click', handleAITutor);
    UI.hintBtn.addEventListener('click', handleHint);
}

function resetApp(e) {
    if(e) e.preventDefault();
    UI.quizContainer.classList.remove('active-view');
    UI.quizContainer.classList.add('hidden-view');
    UI.configSection.classList.remove('hidden-view');
    UI.configSection.classList.add('active-view');
    
    state.currentIndex = 0;
    state.answers = {};
    state.correct = 0;
    state.incorrect = 0;
    updateScoreboard();
    UI.historyList.innerHTML = '';
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

async function startStudyMode() {
    const selectedExam = UI.examSelect.value;
    const filename = `${selectedExam}.json`;

    try {
        const res = await fetch(filename);
        if (!res.ok) throw new Error();
        
        const rawData = await res.json();
        state.questions = shuffleArray(rawData);
        
        UI.totalQNum.textContent = state.questions.length;
        
        UI.configSection.classList.remove('active-view');
        UI.configSection.classList.add('hidden-view');
        UI.quizContainer.classList.remove('hidden-view');
        UI.quizContainer.classList.add('active-view');
        
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
    } else {
        state.incorrect++;
    }
    
    updateScoreboard();
    loadQuestion();
}

function showFeedback(q, selectedIndex) {
    UI.feedbackCard.classList.remove('hidden-view');
    UI.feedbackCard.classList.add('active-view');
    
    const isCorrect = selectedIndex === q.answer;
    
    UI.feedbackVerdict.textContent = isCorrect ? "Correct!" : "Incorrect.";
    UI.feedbackVerdict.style.color = isCorrect ? "var(--success)" : "var(--error)";
    UI.feedbackCard.style.borderLeftColor = isCorrect ? "var(--success)" : "var(--error)";
    UI.feedbackDefinition.textContent = q.definition;

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
        loadQuestion();
    } else {
        alert("End of quiz. Click the logo to return home.");
    }
}

function prevQuestion() {
    if (state.currentIndex > 0) {
        state.currentIndex--;
        loadQuestion();
    }
}

document.addEventListener('DOMContentLoaded', init);