# AI Pipeline Documentation

The AI pipeline is the intelligence layer of Personal Learner. It uses **Google Gemini 3.5 Flash** via the `google-genai` SDK to generate flashcards, create study notes, and supplement existing content with missing concepts.

---

## Architecture

```
app/services/llm_service.py
    │
    ├── BaseLLMService (abstract base class)
    │     ├── generate_flashcards(markdown_text) → FlashcardGenerationResponse
    │     ├── generate_remedial_plan(topic_name, weak_concepts) → str
    │     ├── generate_topic_content(topic_name) → str
    │     └── supplement_topic_content(topic_name, current_content) → str
    │
    └── GeminiService (concrete implementation)
          │
          └── Uses: google.genai.Client
                 google.genai.types.GenerateContentConfig
```

### Abstraction Layer

The `BaseLLMService` abstract class defines the interface that any LLM provider must implement. This enables swapping Gemini for another provider (e.g., OpenAI, Anthropic, DeepSeek) without changing the API routes or ingestion logic.

To swap providers:
1. Create a new class inheriting from `BaseLLMService`
2. Implement the four abstract methods
3. Update `get_llm_service()` to return the new implementation

```python
class BaseLLMService(ABC):
    @abstractmethod
    async def generate_flashcards(self, markdown_text: str) -> FlashcardGenerationResponse: ...
    @abstractmethod
    async def generate_remedial_plan(self, topic_name: str, weak_concepts: str) -> str: ...
    @abstractmethod
    async def generate_topic_content(self, topic_name: str) -> str: ...
    @abstractmethod
    async def supplement_topic_content(self, topic_name: str, current_content: str) -> str: ...

def get_llm_service() -> GeminiService:  # Change this line to swap
    return GeminiService()
```

---

## Model Configuration

### Model: `gemini-3.5-flash`

The project uses Gemini 3.5 Flash — Google's most intelligent model for sustained frontier performance in agentic and coding tasks. It was selected for its balance of quality, speed, and cost for flashcard generation.

**Why not Gemini 2.0/2.5 Flash?** The project was originally built on Gemini 2.0 Flash, upgraded to 3.5 Flash (via `Plan.md` Step 3.0) as newer models became available. The model string is hardcoded in the prompt calls, not in config — to change it, update the `model=` parameter in each `generate_content()` call.

### Generation Configs

Three separate `GenerateContentConfig` instances control output behavior:

| Config | Used For | Temperature | Max Tokens | Response MIME |
|---|---|---|---|---|
| `_flashcard_config` | Flashcard generation | 0.7 | 8192 | `application/json` |
| `_remedial_config` | Remedial study plans | 0.8 | 4096 | (default text) |
| `_generation_config` | Content generation/supplement | 0.7 | 4096 | (default text) |

**Temperature 0.7:** Chosen for a balance between creativity and consistency. The model needs to generate varied yet accurate educational content.
**Higher temperature (0.8) for remedial plans:** Encourages more creative and encouraging language in study plans.
**`response_mime_type: "application/json"`:** Forces the model to output only JSON for flashcard generation, ensuring parseable structured data.

---

## Prompt 1: Flashcard Generation

### Purpose
Generate a mixed set of standard (Q&A) and code-MCQ flashcards from raw Markdown study notes.

### Full Prompt Template

```
You are an expert tutor and curriculum designer. Your task is to create high-quality spaced-repetition flashcards from the provided Markdown study material.

## Instructions
1. Analyze the provided Markdown text carefully. Identify key concepts, definitions, relationships, code patterns, and potential areas of confusion.
2. Generate a mix of **standard** (Q&A) and **code_mcq** (code multiple-choice) flashcards that comprehensively cover the material.
3. For standard cards: create clear, focused questions with concise but complete answers.
4. For code_mcq cards: extract or create code snippets that test understanding, provide 4 answer options, mark the correct index, and include an explanation.
5. Assign a difficulty_level from 1 (trivial recall) to 5 (requires deep synthesis).
6. For each code_mcq card, ensure `options` contains exactly 4 strings and `correct_index` is a valid 0-based index.
7. Return ONLY valid JSON conforming to the schema below. Do not include any text outside the JSON.

## Output Format
{
  "flashcards": [
    {
      "card_type": "standard",
      "front_content": "What is a binary search tree?",
      "back_content": "A binary tree where each node's left subtree contains values less than the node and the right subtree contains values greater.",
      "difficulty_level": 2
    },
    {
      "card_type": "code_mcq",
      "front_content": "def foo(x):\n    return x * 2\n\nprint(foo('a'))",
      "back_content": "'aa' - Python multiplies strings by integers, repeating the string.",
      "difficulty_level": 3,
      "extra_data": {
        "language": "python",
        "options": ["Error: cannot multiply string by int", "'aa'", "'a2'", "2"],
        "correct_index": 1,
        "explanation": "In Python, the * operator on a string repeats it. 'a' * 2 produces 'aa'."
      }
    }
  ]
}

## Study Material

{markdown_text}
```

### How It's Called

```python
full_prompt = f"{GENERATION_PROMPT}\n\n## Study Material\n\n{markdown_text}"
response = await self.client.aio.models.generate_content(
    model="gemini-3.5-flash",
    contents=full_prompt,
    config=self._flashcard_config,        # temperature=0.7, max_tokens=8192, json mime
)
raw = response.text
parsed = json.loads(raw)                  # Parse the JSON string
return FlashcardGenerationResponse.model_validate(parsed)  # Validate with Pydantic
```

### Validation Chain

1. **Gemini outputs JSON string** — enforced by `response_mime_type: "application/json"`
2. **`json.loads(raw)`** — Python's JSON parser ensures the string is valid JSON
3. **`FlashcardGenerationResponse.model_validate(parsed)`** — Pydantic validates:
   - `flashcards` is a list
   - Each item has required fields (`card_type`, `front_content`, `back_content`, `difficulty_level`)
   - `difficulty_level` is between 1 and 5
   - `card_type` is exactly `"standard"` or `"code_mcq"`
   - For `code_mcq`: `extra_data` must include `language`, `options` (list of 4+ strings), `correct_index` (valid index), `explanation`
4. **If validation fails:** Pydantic raises a `ValidationError`, which FastAPI converts to a 500 error. The error message includes the specific validation failure for debugging.

### Error Handling

The current implementation does not have retry logic. If Gemini returns invalid JSON or Pydantic validation fails, the error propagates to the API endpoint. Future improvements could include:
- Retry with a corrected prompt on parse failure
- Fallback to stripping markdown code fences (` ```json ... ``` `)
- Logging the raw response for debugging

---

## Prompt 2: Topic Content Generation

### Purpose
Generate comprehensive, structured Markdown study notes for a brand-new topic.

### Full Prompt

```
You are an expert technical writer and curriculum designer. 
Your task is to write comprehensive, structured, and high-quality Markdown study notes for the topic "{topic_name}".

## Instructions
1. Cover the topic thoroughly, starting from foundational/basic concepts and moving to intermediate and advanced concepts.
2. Include:
   - Clear explanations of core components and architecture.
   - Code examples or configuration snippets with comments where relevant.
   - Use cases, standard commands, and best practices.
   - Common pitfalls and how to avoid them.
3. Organize the content with clear headings (H2, H3), bullet points, and code blocks.
4. Return ONLY the Markdown content. Do not include any HTML, wrapper JSON, or frontmatter.
```

### Use Case
When a user creates an Obsidian note with an empty body (just frontmatter), the watcher calls `POST /api/generate-content`, which triggers this prompt. The generated content is written directly back into the `.md` file.

### Configuration
- Temperature: 0.7
- Max tokens: 4096
- No JSON enforcement (output is raw Markdown)

---

## Prompt 3: Content Supplementation

### Purpose
Analyze existing student notes, identify missing core concepts, and generate supplemental Markdown to fill gaps.

### Full Prompt

```
You are an expert technical writer and tutor. 
Your task is to analyze the student's study notes on "{topic_name}", identify any missing core or foundational concepts, and generate a supplemental section to enrich their notes.

## Student's Current Notes:
{current_content}

## Instructions
1. Identify key basic or core concepts of "{topic_name}" that are missing from the student's notes.
2. Generate structured Markdown content covering these missing concepts.
3. Do not repeat concepts already clearly explained in the current notes.
4. Return ONLY the new supplemental Markdown content (starting with a clear heading like "## Supplemental Foundations"). Do not include any JSON wrapper or frontmatter.
```

### Use Case
When frontmatter has `supplement_on_sync: true`, the watcher sends the body content to `POST /api/supplement-content`. The generated supplemental section is appended to the existing `.md` file, and `supplement_on_sync` is set to `false`.

---

## Prompt 4: Remedial Study Plan (Stub)

### Purpose
Generate a personalized Markdown study guide targeting weak areas. **Currently defined but not yet wired into any endpoint.**

### Full Prompt

```
You are an expert tutor creating a personalized remedial study plan. The student is struggling with the following concepts in the topic "{topic_name}":

{weak_concepts}

## Instructions
1. Create a short, focused Markdown study guide that addresses these weak areas.
2. Include:
   - A brief overview explaining why these concepts are important
   - Key points to focus on for each weak concept
   - 2-3 targeted practice suggestions per concept
   - Recommended learning resources or mental models
3. Keep the tone encouraging and constructive.
4. Return ONLY valid Markdown text. Do not wrap in JSON.
```

---

## API Integration Flow

### `generate_flashcards()` — The Core Pipeline

```
Markdown text (from Obsidian note)
    │
    ▼
gemini-3.5-flash.generate_content()
    ├── System prompt (tutor persona + instructions)
    ├── Output format example (1 standard + 1 code_mcq)
    ├── Study material (appended markdown text)
    └── Config: temperature=0.7, max_tokens=8192, json mime
    │
    ▼
JSON string response
    │
    ▼
json.loads(raw) → Python dict
    │
    ▼
FlashcardGenerationResponse.model_validate(parsed)
    ├── Validates list[StandardFlashcardSchema | CodeMCQSchema]
    ├── Pydantic v2 with strict typing (Literal, Field constraints)
    └── Either returns validated model or raises ValidationError
    │
    ▼
Iterate flashcards → Create Flaskcard ORM instances → Commit to DB
```

### Async Architecture

All LLM calls are **async** using `client.aio.models.generate_content()`. This is critical because:
- The FastAPI server is async — blocking calls would stall the event loop
- Flashcard generation can take 5-30 seconds depending on content length
- Other requests can be served concurrently while waiting for the LLM

The `google-genai` SDK supports both sync and async clients. The project uses async exclusively.

---

## Token Usage & Costs

Token usage is tracked by Gemini and returned in the API response but **not currently logged or stored** by the application. The `response.usage` object contains:
- `total_input_tokens`
- `total_output_tokens`
- `total_thought_tokens` (for models with thinking/reasoning)
- `total_tokens`

Future improvements could include logging token usage per generation call for cost tracking.

---

## Future Capabilities

### Planned: Adaptive Difficulty

Currently, difficulty is assigned by the AI during generation but not used by the review system. The plan is to:
1. Use the diagnostic quiz results (from `Plan.md`) to adjust difficulty
2. Prioritize easier cards when a topic is new, harder cards as mastery grows
3. Auto-generate higher-difficulty cards when `ready_for_advanced` flag is set

### Planned: Remedial Material Write-Back

When `topic_proficiency.needs_remedial_material` is true:
1. A background task triggers `generate_remedial_plan()`
2. The generated Markdown is written back to the Obsidian vault via the watcher
3. This creates a closed feedback loop: study → assess → remediate

### Planned: Provider Swapping

The `BaseLLMService` abstraction makes it straightforward to add:
- **OpenAI** (GPT-4o, o1) for potentially higher-quality flashcards
- **Anthropic Claude** for longer context windows on large study notes
- **DeepSeek** for cost optimization on bulk generation

Each would be a new class implementing the same interface.
