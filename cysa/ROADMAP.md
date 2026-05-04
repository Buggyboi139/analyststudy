# CySA+ Implementation Roadmap

## 1. Project Structure Reorganization

### Completed
- [x] Create dedicated `cysa/` folder at project root.
- [x] Move `cysa.json` into `cysa/cysa.json`.

### Remaining
- [ ] Update `app.js` fetch path from `cysa.json` to `cysa/cysa.json`.
- [ ] Preserve the existing wrapper schema:
  ```json
  {
    "exam": "CompTIA CySA+ CS0-003",
    "questions": [ ... ]
  }
  ```

---

## 2. Dataset Splitting Strategy

### Goal
Split the full `questions` array into two logical datasets without truncating any content.

### Classification Logic
Iterate through `cysa.json` and classify each item based on the `objective` field:

| Dataset | Identifier | Content Description |
|---------|------------|---------------------|
| **Standard Questions** | `objective` matches `/^\d+\.\d+$/` (e.g., `"1.1"`, `"2.3"`) | Scenario-based, situational questions with 4 options. |
| **Definition Questions** | `objective` === `"Acronyms"` | Term-matching or definition-based items (e.g., "What does ACL stand for?"). |

### File Structure Options

**Option A: Single File with Named Arrays (Recommended)**
Keep one file but split the `questions` array into two top-level keys:
```json
{
  "exam": "CompTIA CySA+ CS0-003",
  "standard": [ ... ],
  "definitions": [ ... ]
}
```
- **Pros:** One HTTP request, simple fetch logic, zero risk of content drift between files.
- **Cons:** Slightly larger single payload.

**Option B: Companion Files**
- `cysa/cysa-standard.json`
- `cysa/cysa-definitions.json`
- **Pros:** Smaller individual payloads; can load definitions lazily.
- **Cons:** More fetch logic; risk of version mismatch if updated independently.

**Decision:** Use **Option A** to maintain simplicity and guarantee content parity.

### Zero-Truncation Guarantee
- Before splitting, log the total count of `questions`.
- After splitting, assert that `standard.length + definitions.length === originalQuestions.length`.
- Every original object is copied by reference (or deep cloned) into its target array; no fields are dropped.

---

## 3. In-App Mode Toggle

### UI Design
Add a clean, prominent toggle control in the **Configuration Panel** (`#config-section`), positioned directly below the **Exam Select** dropdown.

#### HTML Structure
```html
<div class="input-group">
    <label>Question Mode</label>
    <div class="mode-toggle">
        <button id="mode-standard" class="mode-btn active">Standard</button>
        <button id="mode-definitions" class="mode-btn">Definitions</button>
    </div>
</div>
```

#### CSS Requirements
- `.mode-toggle`: flex row, gap, rounded container with a subtle border.
- `.mode-btn.active`: distinct background color (primary accent), white text.
- `.mode-btn`: neutral background, transitions on hover and active state.
- Ensure responsive behavior: buttons stack or remain side-by-side on mobile.

### State Management
Extend the `state` object:
```javascript
let state = {
    questions: [],
    currentIndex: 0,
    apiKey: '',
    selectedAnswer: null,
    answers: {},
    correct: 0,
    incorrect: 0,
    mode: 'standard' // 'standard' | 'definitions'
};
```

### Behavior
1. **On Toggle Click (before starting):**
   - Update `state.mode`.
   - Update button active classes.
   - Persist `state.mode` to `localStorage` immediately.

2. **On Start Study Mode:**
   - Fetch `cysa/cysa.json`.
   - Select the appropriate array based on `state.mode`:
     ```javascript
     const dataset = state.mode === 'standard' ? rawData.standard : rawData.definitions;
     ```
   - Normalize answers (string-to-index mapping if needed).
   - Shuffle and assign to `state.questions`.

3. **Dynamic Switching (Post-Start):**
   - If the user switches mode *after* starting a session, show a confirmation dialog: *"Switching modes will reset your current progress. Continue?"*
   - On confirm: reset `state.currentIndex`, `state.answers`, scores, and re-run `startStudyMode()` with the new mode.
   - On cancel: revert the toggle UI to the previous mode.

4. **Progress Tracking per Mode:**
   - Analytics and history should tag sessions with `mode` so that performance stats for "Standard" and "Definitions" remain isolated.

---

## 4. Local Storage Persistence Strategy

### Key Design Principle
Persist after **every single question interaction** so that a refresh at any moment restores the exact state.

### Storage Keys
| Key | Purpose |
|-----|---------|
| `cysa_session` | Current live session state. |
| `cysa_history` | Historical record of all completed sessions. |
| `cysa_incorrect_ids` | Accumulated list of incorrectly answered question identifiers. |
| `cysa_settings` | User preferences (mode, theme, etc.). |

### `cysa_session` Schema
```javascript
{
    exam: 'cysa',
    mode: 'standard',           // 'standard' | 'definitions'
    currentIndex: 12,
    answers: { 0: 2, 1: 0, ... }, // index -> selectedOptionIndex
    correct: 10,
    incorrect: 3,
    questionsSnapshot: [        // Optional: store shuffled order to restore exact sequence
        { id: 'hash1', ... },
        { id: 'hash2', ... }
    ],
    timestamp: 1714780800000
}
```

### Persistence Hooks
1. **`handleAnswer(selectedIndex)`:**
   - After updating `state.answers`, `state.correct`, and `state.incorrect`, immediately call `saveSession()`.

2. **`nextQuestion()` / `prevQuestion()`:**
   - After updating `state.currentIndex`, call `saveSession()`.

3. **`startStudyMode()`:**
   - On successful load, call `saveSession()` to store the initial shuffled order.

4. **`init()`:**
   - On app boot, check `localStorage.getItem('cysa_session')`.
   - If found and `exam === 'cysa'`, prompt: *"Resume your previous CySA+ session?"*
   - If yes: restore `state`, call `loadQuestion()`.
   - If no: clear `cysa_session` and show config panel.

### Incorrect Item History (`cysa_incorrect_ids`)
- **Identifier Strategy:** Since questions lack stable IDs, generate a deterministic hash (e.g., `btoa(questionText.slice(0, 32))` or a simple hash function) for each question at load time. Store this as `q._id`.
- **Update Rule:** In `handleAnswer()`, if the answer is incorrect, append `q._id` to the `cysa_incorrect_ids` Set (stored as an array in JSON).
- **Deduplication:** Use a `Set` to prevent duplicate entries.
- **Scope:** This history is **global** across sessions, not per-session, so it accumulates over time.

### Session History (`cysa_history`)
- When a session ends (user clicks "Finish" on the last question or resets the app), push a summary object to `cysa_history`:
  ```javascript
  {
      date: '2026-05-04T04:30:00Z',
      mode: 'standard',
      total: 75,
      correct: 60,
      incorrect: 15,
      accuracy: 80.0
  }
  ```

---

## 5. Retest Mechanism

### Goal
Expose a button that launches a new study session filtered to include only previously incorrect items.

### UI Placement
Add a new button in the **Configuration Panel**, below the standard "Start Study Mode" button:
```html
<button id="retest-btn" class="primary-btn retest">Retest Incorrect Items</button>
```
- **Visibility:** Only show this button if `cysa_incorrect_ids` has entries.
- **Badge:** Display a count badge on the button (e.g., "Retest Incorrect Items (23)").

### Data Flow
1. **On App Init:**
   - Read `cysa_incorrect_ids` from `localStorage`.
   - If the array is non-empty, render the retest button and update the badge count.

2. **On Retest Click:**
   - Load the full dataset for the currently selected mode (`standard` or `definitions`).
   - Filter the question array to only include items whose `_id` exists in `cysa_incorrect_ids`.
   - If the filtered array is empty (edge case), show an alert: *"No incorrect items found for retest."*
   - Shuffle the filtered array.
   - Assign to `state.questions` and proceed into the quiz view.
   - Set a flag `state.isRetest = true` so that the UI can optionally label the session as "Retest Mode" in the header.

3. **On Correct Answer During Retest:**
   - Remove the question's `_id` from `cysa_incorrect_ids` immediately.
   - Update `localStorage`.
   - If the retest session empties the incorrect list, show a congratulatory message on completion.

4. **Cross-Mode Consideration:**
   - The `cysa_incorrect_ids` list should ideally store `{ id, mode }` pairs so that a "Definitions" retest doesn't accidentally pull from "Standard" questions.
   - Updated schema:
     ```javascript
     cysa_incorrect_ids: [
         { id: 'hash1', mode: 'standard' },
         { id: 'hash2', mode: 'definitions' }
     ]
     ```

---

## 6. Implementation Order

| Step | Task | Rationale |
|------|------|-----------|
| 1 | Split `cysa.json` into `standard` and `definitions` arrays. | Data foundation for all subsequent features. |
| 2 | Update `app.js` fetch path and array selection logic. | Reconnect the app to the reorganized data. |
| 3 | Add mode toggle UI and `state.mode` management. | Enables user to choose their study focus. |
| 4 | Implement `cysa_session` persistence with per-interaction saves. | Ensures zero data loss on refresh. |
| 5 | Implement question hashing (`_id`) and `cysa_incorrect_ids` accumulation. | Powers the retest feature. |
| 6 | Build retest button, filtering logic, and incorrect-ID removal on success. | Closes the learning loop. |
| 7 | Add session history (`cysa_history`) and analytics display. | Provides long-term progress visibility. |

---

## 7. Edge Cases & Considerations

- **Empty Dataset:** If the user selects a mode with zero questions, show a clear message and disable the start button.
- **Schema Versioning:** Add a `"version": 1` field to `cysa.json` so that future schema changes can be detected and migrated.
- **Storage Limits:** `localStorage` is ~5MB. If question snapshots are too large, store only question `_id` arrays in `cysa_session` and re-fetch/re-shuffle on resume (accepting a new shuffle order).
- **Concurrent Sessions:** If the user opens the app in two tabs, the last tab to write wins. This is acceptable for a local study app.
- **Retest Exhaustion:** If a user retests and answers all incorrectly-flagged items correctly, the retest button should hide or disable itself until new incorrect answers are accumulated.
