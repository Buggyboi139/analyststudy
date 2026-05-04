const UI = {
    themeToggle: document.getElementById('theme-toggle'),
    examSelect: document.getElementById('exam-select'),
    apiKeyInput: document.getElementById('api-key'),
    saveKeyBtn: document.getElementById('save-key-btn'),
    startBtn: document.getElementById('start-btn'),
    configSection: document.getElementById('config-section'),
    quizSection: document.getElementById('quiz-section'),
    questionText: document.getElementById('question-text'),
    optionsContainer: document.getElementById('options-container'),
    currentQNum: document.getElementById('current-q-num'),
    totalQNum: document.getElementById('total-q-num'),
    prevBtn: document.getElementById('prev-btn'),
    nextBtn: document.getElementById('next-btn'),
    feedbackCard: document.getElementById('feedback-card'),
    feedbackVerdict: document.getElementById('feedback-verdict'),
    feedbackDefinition: document.getElementById('feedback-definition'),
    aiTutorBtn: document.getElementById('ai-tutor-btn'),
    aiResponseContainer: document.getElementById('ai-response-container'),
    aiResponseText: document.getElementById('ai-response-text')
};

let state = {
    questions: [],
    currentIndex: 0,
    apiKey: '',
    selectedAnswer: null,
    answers: {}
};

function init() {
    const savedKey = localStorage.getItem('openRouterKey');
    if (savedKey) {
        UI.apiKeyInput.value = savedKey;
        state.apiKey = savedKey;
    }

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
    }

    UI.saveKeyBtn.addEventListener('click', () => {
        const key = UI.apiKeyInput.value.trim();
        if (key) {
            localStorage.setItem('openRouterKey', key);
            state.apiKey = key;
            alert('Key saved locally.');
        }
    });

    UI.themeToggle.addEventListener('click', () => {
        const isDark = document.body.getAttribute('data-theme') === 'dark';
        if (isDark) {
            document.body.removeAttribute('data-theme');
            localStorage.setItem('theme', 'light');
        } else {
            document.body.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
        }
    });

    UI.startBtn.addEventListener('click', startStudyMode);
    UI.nextBtn.addEventListener('click', nextQuestion);
    UI.prevBtn.addEventListener('click', prevQuestion);
    UI.aiTutorBtn.addEventListener('click', handleAITutor);
}

async function startStudyMode() {
    const selectedExam = UI.examSelect.value;
    const filename = `${selectedExam}.json`;

    try {
        const res = await fetch(filename);
        if (!res.ok) {
            throw new Error(`Failed to load ${filename}`);
        }
        state.questions = await res.json();
        UI.totalQNum.textContent = state.questions.length;
        UI.configSection.classList.add('hidden');
        UI.quizSection.classList.remove('hidden');
        loadQuestion();
    } catch (err) {
        alert(`Could not load ${filename}. Ensure the file exists in the directory and you are running a local server.`);
    }
}

function loadQuestion() {
    UI.feedbackCard.classList.add('hidden');
    UI.aiResponseContainer.classList.add('hidden');
    UI.aiResponseText.textContent = '';
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

    if (state.selectedAnswer !== null) {
        showFeedback(q, state.selectedAnswer);
    }
}

function handleAnswer(selectedIndex) {
    state.selectedAnswer = selectedIndex;
    state.answers[state.currentIndex] = selectedIndex;
    loadQuestion();
}

function showFeedback(q, selectedIndex) {
    UI.feedbackCard.classList.remove('hidden');
    const isCorrect = selectedIndex === q.answer;
    
    UI.feedbackVerdict.textContent = isCorrect ? "Correct!" : "Incorrect.";
    UI.feedbackVerdict.style.color = isCorrect ? "var(--correct-color)" : "var(--incorrect-color)";
    UI.feedbackDefinition.textContent = q.definition;

    if (!isCorrect && state.apiKey) {
        UI.aiTutorBtn.classList.remove('hidden');
    } else {
        UI.aiTutorBtn.classList.add('hidden');
    }
}

async function handleAITutor() {
    UI.aiTutorBtn.disabled = true;
    UI.aiTutorBtn.textContent = "Thinking...";
    UI.aiResponseContainer.classList.remove('hidden');
    UI.aiResponseText.textContent = "Loading AI response...";

    const q = state.questions[state.currentIndex];
    const userChoiceText = q.options[state.selectedAnswer];
    
    const response = await fetchAITutorResponse(state.apiKey, q, userChoiceText);
    
    UI.aiResponseText.textContent = response;
    UI.aiTutorBtn.disabled = false;
    UI.aiTutorBtn.textContent = "Explain with AI Tutor";
}

function nextQuestion() {
    if (state.currentIndex < state.questions.length - 1) {
        state.currentIndex++;
        loadQuestion();
    } else {
        alert("End of quiz. Refresh to restart.");
    }
}

function prevQuestion() {
    if (state.currentIndex > 0) {
        state.currentIndex--;
        loadQuestion();
    }
}

document.addEventListener('DOMContentLoaded', init);
