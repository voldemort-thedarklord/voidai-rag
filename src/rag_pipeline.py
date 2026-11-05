"""
RAG Pipeline Orchestrator
Coordinates retrieval with RBAC filtering, prompt synthesis,
grounded LLM answer generation, citation extraction, and latency metrics.
"""

import time
import re
from typing import Dict, Any, List, Optional

from src.config import (
    ROLES_PERMISSIONS,
    DEFAULT_TOP_K,
    DEFAULT_OLLAMA_MODEL
)
from src.vector_store import VectorStoreManager
from src.llm_client import LLMClient


SYSTEM_PROMPT_TEMPLATE = """You are an Enterprise Document AI Assistant for Acme Enterprise Corp.
Your primary directive is to provide highly accurate, grounded answers strictly based on the provided enterprise document excerpts.

CRITICAL RULES:
1. Base your answer EXCLUSIVELY on the provided document excerpts below. Do NOT use outside knowledge, speculate, or extrapolate.
2. For every factual statement, explicitly cite the source document and page number in square brackets, for example: [HR_Leave_Policy.txt, Page 1].
3. If the provided excerpts do not contain enough information to answer the question, state:
   "The available enterprise documentation does not contain sufficient information to answer this question."
4. If the user asks about topics or numbers that appear in the excerpts, provide the exact numbers, policies, or procedures mentioned.
5. Maintain a professional, executive enterprise tone.
"""


class RAGPipeline:
    """End-to-end RAG orchestrator for querying enterprise knowledge bases."""

    def __init__(self, vector_store: Optional[VectorStoreManager] = None):
        self.vector_store = vector_store or VectorStoreManager()

    def run(
        self,
        query: str,
        user_role: str = "Admin",
        provider: str = "ollama",
        model: str = DEFAULT_OLLAMA_MODEL,
        top_k: int = DEFAULT_TOP_K,
        temperature: float = 0.1
    ) -> Dict[str, Any]:
        """
        Execute full RAG retrieval, RBAC authorization, and grounded answer generation.
        """
        start_time = time.time()

        # Step 1: RBAC authorization mapping
        allowed_depts = ROLES_PERMISSIONS.get(user_role, ["General"])

        # Step 2: Vector retrieval with department filtering
        retrieval_start = time.time()
        retrieved_docs = self.vector_store.search(
            query=query,
            top_k=top_k,
            allowed_departments=allowed_depts
        )
        retrieval_duration = time.time() - retrieval_start

        # If no documents retrieved
        if not retrieved_docs:
            total_duration = time.time() - start_time
            return {
                "answer": (
                    "ℹ️ No relevant enterprise documentation was found for your query, "
                    f"or your current role (**{user_role}**) does not have permission "
                    f"to access the restricted department documents covering this topic.\n\n"
                    f"*Allowed departments for your role: {', '.join(allowed_depts)}*"
                ),
                "citations": [],
                "retrieved_chunks": [],
                "metrics": {
                    "retrieval_latency_ms": round(retrieval_duration * 1000, 2),
                    "generation_latency_ms": 0.0,
                    "total_latency_ms": round(total_duration * 1000, 2),
                    "chunks_retrieved": 0,
                    "user_role": user_role,
                    "allowed_departments": allowed_depts
                }
            }

        # Step 3: Format Context & Citations
        context_blocks = []
        citations_list = []
        seen_citations = set()

        for idx, doc in enumerate(retrieved_docs, start=1):
            meta = doc["metadata"]
            source = meta.get("source", "Unknown")
            page = meta.get("page", 1)
            dept = meta.get("department", "General")
            sim_score = doc.get("similarity_score", 0.0)

            context_blocks.append(
                f"--- EXCERPT {idx} [Source: {source} | Page: {page} | Department: {dept} | Relevance: {sim_score:.2f}] ---\n"
                f"{doc['text']}\n"
            )

            cite_key = f"{source} (Page {page})"
            if cite_key not in seen_citations:
                seen_citations.add(cite_key)
                citations_list.append({
                    "source": source,
                    "page": page,
                    "department": dept,
                    "similarity": sim_score,
                    "excerpt_snippet": doc['text'][:180] + "..."
                })

        formatted_context = "\n".join(context_blocks)

        user_prompt = (
            f"ENTERPRISE CONTEXT EXCERPTS:\n{formatted_context}\n\n"
            f"USER QUESTION: {query}\n\n"
            "Provide a grounded, comprehensive answer citing the sources:"
        )

        # Step 4: Generation via LLM Client
        generation_start = time.time()
        llm = LLMClient(provider=provider, model=model, temperature=temperature)
        raw_answer = llm.generate(prompt=user_prompt, system_prompt=SYSTEM_PROMPT_TEMPLATE)
        generation_duration = time.time() - generation_start
        total_duration = time.time() - start_time

        # Step 5: Groundedness & confidence check
        groundedness_score = self._compute_faithfulness(raw_answer, retrieved_docs)

        return {
            "query": query,
            "answer": raw_answer,
            "citations": citations_list,
            "retrieved_chunks": retrieved_docs,
            "groundedness_score": groundedness_score,
            "metrics": {
                "retrieval_latency_ms": round(retrieval_duration * 1000, 2),
                "generation_latency_ms": round(generation_duration * 1000, 2),
                "total_latency_ms": round(total_duration * 1000, 2),
                "chunks_retrieved": len(retrieved_docs),
                "user_role": user_role,
                "allowed_departments": allowed_depts,
                "provider": provider,
                "model": model
            }
        }

    def _compute_faithfulness(self, answer: str, retrieved_docs: List[Dict[str, Any]]) -> float:
        """
        Simple lexical and citation groundedness check:
        Verifies presence of key words from context and source citations.
        Returns a score between 0.0 and 1.0.
        """
        if "not contain sufficient information" in answer.lower():
            return 1.0

        if not retrieved_docs or not answer:
            return 0.0

        # Check for citation mentions like [HR_Leave, Page 1] or Page X
        has_citations = bool(re.search(r"(\[.*?(page|\.txt|\.pdf).*?\]|page\s+\d+)", answer, re.IGNORECASE))

        # Check keyword overlap between answer and retrieved text
        context_words = set(re.findall(r"\w{4,}", " ".join([d["text"] for d in retrieved_docs]).lower()))
        answer_words = set(re.findall(r"\w{4,}", answer.lower()))

        if not answer_words:
            return 0.5

        overlap = len(answer_words.intersection(context_words)) / len(answer_words)
        score = (overlap * 0.7) + (0.3 if has_citations else 0.0)
        return round(min(1.0, max(0.0, score)), 2)
