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

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error("AI Fetch Error:", error);
        return "Error contacting AI Tutor. Please check your API key and connection.";
    }
}
