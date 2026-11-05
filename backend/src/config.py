"""
Enterprise RAG Assistant Configuration
Centralized configuration for models, paths, RBAC mappings, and retrieval parameters.
"""

from pathlib import Path
import os
from dotenv import load_dotenv

load_dotenv()

# Base Paths
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
SAMPLE_POLICIES_DIR = DATA_DIR / "sample_policies"
CHROMA_PERSIST_DIR = BASE_DIR / "chroma_db"
UPLOADS_DIR = DATA_DIR / "uploads"

# Ensure required directories exist
for folder in [DATA_DIR, SAMPLE_POLICIES_DIR, CHROMA_PERSIST_DIR, UPLOADS_DIR]:
    folder.mkdir(parents=True, exist_ok=True)

# ChromaDB Settings
CHROMA_COLLECTION_NAME = "enterprise_documents"
DEFAULT_EMBEDDING_MODEL = "all-MiniLM-L6-v2"

# Chunking Parameters
DEFAULT_CHUNK_SIZE = 700
DEFAULT_CHUNK_OVERLAP = 120

# Retrieval Parameters
DEFAULT_TOP_K = 4
SIMILARITY_SCORE_THRESHOLD = 0.25  # Cosine distance threshold (lower is closer in Chroma L2/cosine)

# LLM Providers & Models
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
DEFAULT_OLLAMA_MODEL = os.getenv("DEFAULT_OLLAMA_MODEL", "llama3:latest")
DEFAULT_GEMINI_MODEL = os.getenv("DEFAULT_GEMINI_MODEL", "gemini-flash-lite-latest")

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

DEFAULT_LLM_PROVIDER = "gemini" if GEMINI_API_KEY else "ollama"

SUPPORTED_LLM_PROVIDERS = {
    "Google Gemini (Cloud Free)": "gemini",
    "Local Ollama (Offline / Private)": "ollama",
    "Groq (Fast Cloud Inference)": "groq",
    "OpenAI (GPT-4o mini)": "openai"
}
