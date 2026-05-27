import json
from abc import ABC, abstractmethod

from google import genai
from google.genai.types import GenerateContentConfig

from app.core.config import settings
from app.schemas.schemas import FlashcardGenerationResponse


GENERATION_PROMPT = """You are an expert tutor and curriculum designer. Your task is to create high-quality spaced-repetition flashcards from the provided Markdown study material.

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
      "front_content": "def foo(x):\\n    return x * 2\\n\\nprint(foo('a'))",
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
"""

REMEDIAL_PLAN_PROMPT = """You are an expert tutor creating a personalized remedial study plan. The student is struggling with the following concepts in the topic "{topic_name}":

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
"""

TOPIC_GENERATION_PROMPT = """You are an expert technical writer and curriculum designer. 
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
"""

TOPIC_SUPPLEMENT_PROMPT = """You are an expert technical writer and tutor. 
Your task is to analyze the student's study notes on "{topic_name}", identify any missing core or foundational concepts, and generate a supplemental section to enrich their notes.

## Student's Current Notes:
{current_content}

## Instructions
1. Identify key basic or core concepts of "{topic_name}" that are missing from the student's notes.
2. Generate structured Markdown content covering these missing concepts.
3. Do not repeat concepts already clearly explained in the current notes.
4. Return ONLY the new supplemental Markdown content (starting with a clear heading like "## Supplemental Foundations"). Do not include any JSON wrapper or frontmatter.
"""


class BaseLLMService(ABC):
    """Abstract base for LLM interactions. Swap implementations to change providers."""

    @abstractmethod
    async def generate_flashcards(self, markdown_text: str) -> FlashcardGenerationResponse:
        """Generate flashcards from raw Markdown material."""
        ...

    @abstractmethod
    async def generate_remedial_plan(self, topic_name: str, weak_concepts: str) -> str:
        """Generate a Markdown study plan targeting weak areas."""
        ...

    @abstractmethod
    async def generate_topic_content(self, topic_name: str) -> str:
        """Generate complete study notes for a topic."""
        ...

    @abstractmethod
    async def supplement_topic_content(self, topic_name: str, current_content: str) -> str:
        """Identify missing basics and generate supplemental notes."""
        ...


class GeminiService(BaseLLMService):
    """Gemini API implementation of the LLM service."""

    def __init__(self, api_key: str | None = None) -> None:
        self.client = genai.Client(api_key=api_key or settings.GEMINI_API_KEY)
        self._flashcard_config = GenerateContentConfig(
            temperature=0.7,
            max_output_tokens=8192,
            response_mime_type="application/json",
        )
        self._remedial_config = GenerateContentConfig(
            temperature=0.8,
            max_output_tokens=4096,
        )
        self._generation_config = GenerateContentConfig(
            temperature=0.7,
            max_output_tokens=4096,
        )

    async def generate_flashcards(self, markdown_text: str) -> FlashcardGenerationResponse:
        """Call Gemini, parse structured JSON, and return validated flashcards."""
        full_prompt = f"{GENERATION_PROMPT}\n\n## Study Material\n\n{markdown_text}"
        response = await self.client.aio.models.generate_content(
            model="gemini-3.5-flash",
            contents=full_prompt,
            config=self._flashcard_config,
        )
        raw = response.text
        parsed = json.loads(raw)
        return FlashcardGenerationResponse.model_validate(parsed)

    async def generate_remedial_plan(self, topic_name: str, weak_concepts: str) -> str:
        """Generate a Markdown remedial study plan."""
        prompt = REMEDIAL_PLAN_PROMPT.format(
            topic_name=topic_name,
            weak_concepts=weak_concepts,
        )
        response = await self.client.aio.models.generate_content(
            model="gemini-3.5-flash",
            contents=prompt,
            config=self._remedial_config,
        )
        return response.text

    async def generate_topic_content(self, topic_name: str) -> str:
        """Generate complete Markdown study notes for a topic."""
        prompt = TOPIC_GENERATION_PROMPT.format(topic_name=topic_name)
        response = await self.client.aio.models.generate_content(
            model="gemini-3.5-flash",
            contents=prompt,
            config=self._generation_config,
        )
        return response.text

    async def supplement_topic_content(self, topic_name: str, current_content: str) -> str:
        """Analyze notes, find missing concepts, and return supplemental Markdown."""
        prompt = TOPIC_SUPPLEMENT_PROMPT.format(
            topic_name=topic_name,
            current_content=current_content,
        )
        response = await self.client.aio.models.generate_content(
            model="gemini-3.5-flash",
            contents=prompt,
            config=self._generation_config,
        )
        return response.text


def get_llm_service() -> GeminiService:
    """Factory for the LLM service. Replace GeminiService with a different implementation to swap providers."""
    return GeminiService()
