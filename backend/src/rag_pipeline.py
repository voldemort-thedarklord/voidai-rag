"""
RAG Pipeline Orchestrator
Coordinates semantic retrieval across all uploaded documents,
prompt synthesis, grounded LLM answer generation, citation extraction, and latency metrics.
"""

import time
import re
from typing import Dict, Any, List, Optional

from src.config import (
    DEFAULT_TOP_K,
    DEFAULT_OLLAMA_MODEL,
    DEFAULT_GEMINI_MODEL,
    DEFAULT_LLM_PROVIDER
)
from src.vector_store import VectorStoreManager
from src.llm_client import LLMClient


SYSTEM_PROMPT_TEMPLATE = """You are voidai, an intelligent document assistant.
Your goal is to provide accurate, concise, and helpful answers based on the user's uploaded documents.

GUIDELINES:
1. Base your answer on the provided document excerpts and document inventory.
2. For factual statements from excerpts, cite the document name and page number, e.g.: [document.pdf, Page 1].
3. If the user asks what documents are attached, uploaded, or available, list the filenames clearly from the available documents.
4. If the provided excerpts do not contain the answer, politely state:
   "The uploaded documents do not contain sufficient information to answer this question."
"""


class RAGPipeline:
    """End-to-end RAG orchestrator for querying user documents."""

    def __init__(self, vector_store: Optional[VectorStoreManager] = None):
        self.vector_store = vector_store or VectorStoreManager()

    def run(
        self,
        query: str,
        provider: str = "ollama",
        model: str = DEFAULT_OLLAMA_MODEL,
        top_k: int = DEFAULT_TOP_K,
        selected_documents: Optional[List[str]] = None,
        temperature: float = 0.1
    ) -> Dict[str, Any]:
        """
        Execute full RAG retrieval across documents and generate grounded answer.
        """
        start_time = time.time()

        # Retrieve available documents list
        indexed_docs = self.vector_store.list_indexed_documents()
        doc_names = [d["source"] for d in indexed_docs]

        # Handle queries asking what files/documents are attached
        q_lower = query.lower()
        is_asking_for_doc_list = any(phrase in q_lower for phrase in [
            "what documents are attached",
            "what documents are uploaded",
            "what documents do i have",
            "which documents",
            "what files",
            "list documents",
            "list files",
            "show documents",
            "attached documents"
        ])

        # Vector retrieval
        retrieval_start = time.time()
        retrieved_docs = self.vector_store.search(
            query=query,
            top_k=top_k,
            selected_documents=selected_documents
        )
        retrieval_duration = time.time() - retrieval_start

        # If user asks for document list and we have documents
        if is_asking_for_doc_list and doc_names:
            total_duration = time.time() - start_time
            file_bullets = "\n".join([f"- **{d['source']}** ({d.get('total_chunks', 1)} chunks, {d.get('max_pages', 1)} pages)" for d in indexed_docs])
            answer = f"The following documents are currently uploaded and ready for questions:\n\n{file_bullets}"
            return {
                "query": query,
                "answer": answer,
                "citations": [{"source": d["source"], "page": 1, "excerpt_snippet": f"Document: {d['source']}"} for d in indexed_docs],
                "retrieved_chunks": [],
                "groundedness_score": 1.0,
                "metrics": {
                    "retrieval_latency_ms": round(retrieval_duration * 1000, 2),
                    "generation_latency_ms": 0.0,
                    "total_latency_ms": round(total_duration * 1000, 2),
                    "chunks_retrieved": len(indexed_docs),
                    "provider": provider,
                    "model": model
                }
            }

        # If no documents retrieved and none available
        if not retrieved_docs:
            total_duration = time.time() - start_time
            if not doc_names:
                msg = "No documents have been uploaded yet. Please upload a PDF, DOCX, or text file to begin."
            else:
                msg = f"No relevant information was found in your uploaded documents ({', '.join(doc_names)}) for your query."
            return {
                "answer": msg,
                "citations": [],
                "retrieved_chunks": [],
                "metrics": {
                    "retrieval_latency_ms": round(retrieval_duration * 1000, 2),
                    "generation_latency_ms": 0.0,
                    "total_latency_ms": round(total_duration * 1000, 2),
                    "chunks_retrieved": 0,
                    "provider": provider,
                    "model": model
                }
            }

        # Format Context & Citations
        context_blocks = []
        citations_list = []
        seen_citations = set()

        for idx, doc in enumerate(retrieved_docs, start=1):
            meta = doc["metadata"]
            source = meta.get("source", "Unknown")
            page = meta.get("page", 1)
            sim_score = doc.get("similarity_score", 0.0)

            context_blocks.append(
                f"--- EXCERPT {idx} [Source: {source} | Page: {page} | Score: {sim_score:.2f}] ---\n"
                f"{doc['text']}\n"
            )

            cite_key = f"{source} (Page {page})"
            if cite_key not in seen_citations:
                seen_citations.add(cite_key)
                citations_list.append({
                    "source": source,
                    "page": page,
                    "similarity": sim_score,
                    "excerpt_snippet": doc['text'][:180] + "..."
                })

        formatted_context = "\n".join(context_blocks)

        user_prompt = (
            f"AVAILABLE DOCUMENTS: {', '.join(doc_names)}\n\n"
            f"DOCUMENT EXCERPTS:\n{formatted_context}\n\n"
            f"USER QUESTION: {query}\n\n"
            "Answer clearly and accurately based on the excerpts, citing sources with [Filename, Page X]:"
        )

        # Generation via LLM Client
        generation_start = time.time()
        llm = LLMClient(provider=provider, model=model, temperature=temperature)
        raw_answer = llm.generate(prompt=user_prompt, system_prompt=SYSTEM_PROMPT_TEMPLATE)
        generation_duration = time.time() - generation_start
        total_duration = time.time() - start_time

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

        has_citations = bool(re.search(r"(\[.*?(page|\.txt|\.pdf).*?\]|page\s+\d+)", answer, re.IGNORECASE))
        context_words = set(re.findall(r"\w{4,}", " ".join([d["text"] for d in retrieved_docs]).lower()))
        answer_words = set(re.findall(r"\w{4,}", answer.lower()))

        if not answer_words:
            return 0.5

        overlap = len(answer_words.intersection(context_words)) / len(answer_words)
        score = (overlap * 0.7) + (0.3 if has_citations else 0.0)
        return round(min(1.0, max(0.0, score)), 2)
