async function fetchAITutorResponse(apiKey, questionData, userChoiceText) {
    const prompt = `You are a CompTIA CySA+ tutor. Use the provided factual explanation to help the student understand why they were wrong. Do not introduce conflicting facts. Be concise.

Question: ${questionData.question}
Correct Answer: ${questionData.options[questionData.answer]}
Official Explanation: ${questionData.definition}
Student chose: ${userChoiceText}

Explain why the student's choice is incorrect based on the official explanation.`;

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "model": "google/gemini-2.5-flash",
                "messages": [
                    {"role": "user", "content": prompt}
                ]
            })
        });

        if (!response.ok) throw new Error();
        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        return "Error contacting AI Tutor.";
    }
}

async function fetchAIHint(apiKey, questionData) {
    const prompt = `You are an expert CompTIA CySA+ tutor. The student needs a hint.
Question: ${questionData.question}
Correct Answer: ${questionData.options[questionData.answer]}

Provide a 1-2 sentence hint that guides their thinking toward the underlying concept. DO NOT reveal the correct answer and DO NOT explicitly eliminate any options.`;

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "model": "google/gemini-2.5-flash",
                "messages": [
                    {"role": "user", "content": prompt}
                ]
            })
        });

        if (!response.ok) throw new Error();
        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        return "Error fetching hint.";
    }
}
