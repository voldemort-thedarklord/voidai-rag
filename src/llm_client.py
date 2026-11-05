"""
Unified LLM Client
Provides a clean, modular abstraction for querying Local Ollama
and Cloud LLM providers (Groq, OpenAI, Google Gemini).
"""

import json
from typing import Dict, Any, List, Optional
import requests

from src.config import (
    OLLAMA_BASE_URL,
    DEFAULT_OLLAMA_MODEL,
    GROQ_API_KEY,
    OPENAI_API_KEY,
    GEMINI_API_KEY
)


class LLMClient:
    """Dispatches generation requests to Ollama or Cloud APIs."""

    def __init__(
        self,
        provider: str = "ollama",
        model: str = DEFAULT_OLLAMA_MODEL,
        temperature: float = 0.1
    ):
        self.provider = provider.lower()
        self.model = model
        self.temperature = temperature

    @staticmethod
    def get_available_ollama_models() -> List[str]:
        """Fetch list of models available in the local Ollama instance."""
        try:
            resp = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=3)
            if resp.status_code == 200:
                data = resp.json()
                models = [m["name"] for m in data.get("models", [])]
                if models:
                    return models
        except Exception:
            pass
        return ["llama3:latest", "qwen2.5-coder:7b", "mistral:latest"]

    def generate(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        """
        Generate completion based on configured provider.
        """
        if self.provider == "ollama":
            return self._call_ollama(prompt, system_prompt)
        elif self.provider == "groq":
            return self._call_groq(prompt, system_prompt)
        elif self.provider == "openai":
            return self._call_openai(prompt, system_prompt)
        elif self.provider == "gemini":
            return self._call_gemini(prompt, system_prompt)
        else:
            raise ValueError(f"Unsupported LLM provider: {self.provider}")

    def _call_ollama(self, prompt: str, system_prompt: Optional[str]) -> str:
        """Query local Ollama server."""
        url = f"{OLLAMA_BASE_URL}/api/generate"
        payload = {
            "model": self.model or "llama3:latest",
            "prompt": prompt,
            "system": system_prompt or "",
            "stream": False,
            "options": {
                "temperature": self.temperature
            }
        }
        try:
            resp = requests.post(url, json=payload, timeout=90)
            if resp.status_code == 200:
                data = resp.json()
                return data.get("response", "").strip()
            else:
                return (
                    f"⚠️ Ollama Error ({resp.status_code}): {resp.text}\n\n"
                    "Please verify that Ollama is running with `ollama serve`."
                )
        except requests.exceptions.ConnectionError:
            return (
                "⚠️ Could not connect to local Ollama server at "
                f"{OLLAMA_BASE_URL}. Ensure Ollama is running (`ollama serve`)."
            )
        except Exception as e:
            return f"⚠️ Error querying Ollama: {str(e)}"

    def _call_groq(self, prompt: str, system_prompt: Optional[str]) -> str:
        """Query Groq cloud API using OpenAI-compatible endpoint."""
        api_key = GROQ_API_KEY
        if not api_key:
            return "⚠️ Groq API Key missing. Please provide `GROQ_API_KEY` in .env or the UI."

        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.model if "llama" in self.model else "llama-3.3-70b-versatile",
            "messages": messages,
            "temperature": self.temperature
        }
        try:
            resp = requests.post(url, headers=headers, json=payload, timeout=45)
            if resp.status_code == 200:
                data = resp.json()
                return data["choices"][0]["message"]["content"].strip()
            return f"⚠️ Groq API Error ({resp.status_code}): {resp.text}"
        except Exception as e:
            return f"⚠️ Error querying Groq: {str(e)}"

    def _call_openai(self, prompt: str, system_prompt: Optional[str]) -> str:
        """Query OpenAI API."""
        api_key = OPENAI_API_KEY
        if not api_key:
            return "⚠️ OpenAI API Key missing. Please provide `OPENAI_API_KEY` in .env or the UI."

        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.model if "gpt" in self.model else "gpt-4o-mini",
            "messages": messages,
            "temperature": self.temperature
        }
        try:
            resp = requests.post(url, headers=headers, json=payload, timeout=45)
            if resp.status_code == 200:
                data = resp.json()
                return data["choices"][0]["message"]["content"].strip()
            return f"⚠️ OpenAI API Error ({resp.status_code}): {resp.text}"
        except Exception as e:
            return f"⚠️ Error querying OpenAI: {str(e)}"

    def _call_gemini(self, prompt: str, system_prompt: Optional[str]) -> str:
        """Query Google Gemini API via REST endpoint."""
        api_key = GEMINI_API_KEY
        if not api_key:
            return "⚠️ Gemini API Key missing. Please provide `GEMINI_API_KEY` in .env or the UI."

        model_name = self.model if "gemini" in self.model else "gemini-1.5-flash"
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        headers = {"Content-Type": "application/json"}

        full_prompt = f"{system_prompt}\n\nUser Question:\n{prompt}" if system_prompt else prompt
        payload = {
            "contents": [
                {
                    "parts": [{"text": full_prompt}]
                }
            ],
            "generationConfig": {
                "temperature": self.temperature
            }
        }
        try:
            resp = requests.post(url, headers=headers, json=payload, timeout=45)
            if resp.status_code == 200:
                data = resp.json()
                candidates = data.get("candidates", [])
                if candidates and "content" in candidates[0]:
                    parts = candidates[0]["content"].get("parts", [])
                    if parts:
                        return parts[0].get("text", "").strip()
            return f"⚠️ Gemini API Error ({resp.status_code}): {resp.text}"
        except Exception as e:
            return f"⚠️ Error querying Gemini: {str(e)}"
