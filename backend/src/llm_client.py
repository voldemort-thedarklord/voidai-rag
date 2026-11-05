"""
Unified Cloud LLM Client
Exclusively powered by Google Gemini Free Cloud Tier.
"""

from typing import Dict, Any, List, Optional
import requests

from src.config import (
    DEFAULT_GEMINI_MODEL,
    GEMINI_API_KEY
)


class LLMClient:
    """Dispatches generation requests directly to Google Gemini Cloud API."""

    def __init__(
        self,
        provider: str = "gemini",
        model: Optional[str] = None,
        temperature: float = 0.1
    ):
        self.provider = "gemini"
        self.model = model or DEFAULT_GEMINI_MODEL
        self.temperature = temperature

    def generate(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        """Generate completion using Google Gemini Cloud API."""
        return self._call_gemini(prompt, system_prompt)

    def _call_gemini(self, prompt: str, system_prompt: Optional[str]) -> str:
        """Query Google Gemini API with automatic backup model retry."""
        api_key = GEMINI_API_KEY
        if not api_key:
            return "⚠️ Gemini API Key missing in environment (GEMINI_API_KEY)."

        model_name = self.model if "gemini" in (self.model or "") else DEFAULT_GEMINI_MODEL
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        headers = {"Content-Type": "application/json"}

        payload: Dict[str, Any] = {
            "contents": [
                {
                    "parts": [{"text": prompt}]
                }
            ],
            "generationConfig": {
                "temperature": self.temperature
            }
        }

        if system_prompt:
            payload["system_instruction"] = {
                "parts": [{"text": system_prompt}]
            }

        try:
            resp = requests.post(url, headers=headers, json=payload, timeout=35)
            if resp.status_code == 200:
                data = resp.json()
                candidates = data.get("candidates", [])
                if candidates and "content" in candidates[0]:
                    parts = candidates[0]["content"].get("parts", [])
                    if parts:
                        return parts[0].get("text", "").strip()
                return "The model returned an empty response."

            # If 503 (high demand) or 404, try backup model gemini-3.5-flash-lite
            elif resp.status_code in (503, 404) and model_name != "gemini-3.5-flash-lite":
                fallback_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key={api_key}"
                fallback_resp = requests.post(fallback_url, headers=headers, json=payload, timeout=35)
                if fallback_resp.status_code == 200:
                    fb_data = fallback_resp.json()
                    candidates = fb_data.get("candidates", [])
                    if candidates and "content" in candidates[0]:
                        parts = candidates[0]["content"].get("parts", [])
                        if parts:
                            return parts[0].get("text", "").strip()

            elif resp.status_code == 402:
                return (
                    "⚠️ Gemini Error (402): Prepayment credits depleted on this project.\n\n"
                    "To use the 100% Free Tier ($0 cost, 15 RPM, 1,500 requests/day):\n"
                    "1. Go to https://aistudio.google.com/app/apikey\n"
                    "2. Click 'Create API key' > 'Create API key in new project'\n"
                    "3. Copy the new key into your environment variables."
                )

            elif resp.status_code in (401, 403):
                return f"⚠️ Gemini Authentication Error ({resp.status_code}): Invalid or unauthorized API key."

            elif resp.status_code == 429:
                return "⚠️ Gemini Rate Limit Exceeded (429): Free tier quota limit reached. Please wait a moment."

            return f"⚠️ Gemini API Error ({resp.status_code}): {resp.text}"

        except requests.exceptions.Timeout:
            return "⚠️ Gemini request timed out after 35 seconds."
        except Exception as e:
            return f"⚠️ Error querying Gemini: {str(e)}"
