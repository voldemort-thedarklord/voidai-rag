"""
Vector Store Management Module
Handles ChromaDB collection initialization, vector embeddings, upserts,
document deletion, and Role-Based Access Control (RBAC) filtered retrieval.
"""

from pathlib import Path
from typing import List, Dict, Any, Optional
import chromadb
from chromadb.utils import embedding_functions

from src.config import (
    CHROMA_PERSIST_DIR,
    CHROMA_COLLECTION_NAME,
    DEFAULT_EMBEDDING_MODEL,
    DEFAULT_TOP_K
)
from src.document_processor import DocumentChunk


class VectorStoreManager:
    """Manages document vector storage and RBAC similarity queries using ChromaDB."""

    def __init__(
        self,
        persist_dir: Path = CHROMA_PERSIST_DIR,
        collection_name: str = CHROMA_COLLECTION_NAME,
        model_name: str = DEFAULT_EMBEDDING_MODEL
    ):
        self.persist_dir = str(persist_dir)
        self.collection_name = collection_name
        self.model_name = model_name

        # Setup persistent client
        self.client = chromadb.PersistentClient(path=self.persist_dir)

        # Setup ONNX-accelerated all-MiniLM-L6-v2 embedding function
        self.embedding_fn = embedding_functions.DefaultEmbeddingFunction()

        # Get or create collection
        self.collection = self.client.get_or_create_collection(
            name=self.collection_name,
            embedding_function=self.embedding_fn,
            metadata={"hnsw:space": "cosine"}
        )

    def add_chunks(self, chunks: List[DocumentChunk]) -> int:
        """
        Upsert processed chunks into ChromaDB collection.
        Returns count of upserted chunks.
        """
        if not chunks:
            return 0

        ids = [chunk.chunk_id for chunk in chunks]
        documents = [chunk.text for chunk in chunks]
        metadatas = [chunk.to_dict()["metadata"] for chunk in chunks]

        # ChromaDB upsert handles updates/duplicates automatically
        self.collection.upsert(
            ids=ids,
            documents=documents,
            metadatas=metadatas
        )
        return len(chunks)

    def search(
        self,
        query: str,
        top_k: int = DEFAULT_TOP_K,
        selected_documents: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Perform semantic similarity search across indexed documents.
        Optionally filter by selected_documents list.
        """
        where_filter = None
        if selected_documents:
            if len(selected_documents) == 1:
                where_filter = {"source": selected_documents[0]}
            else:
                where_filter = {"source": {"$in": selected_documents}}

        results = self.collection.query(
            query_texts=[query],
            n_results=top_k,
            where=where_filter,
            include=["documents", "metadatas", "distances"]
        )

        formatted_results = []
        if results and "documents" in results and results["documents"]:
            docs = results["documents"][0]
            metas = results["metadatas"][0] if "metadatas" in results else [{}] * len(docs)
            distances = results["distances"][0] if "distances" in results else [0.0] * len(docs)

            for doc, meta, dist in zip(docs, metas, distances):
                # For cosine distance, similarity is approximately 1.0 - distance
                similarity_score = max(0.0, min(1.0, 1.0 - dist))
                formatted_results.append({
                    "text": doc,
                    "metadata": meta,
                    "distance": dist,
                    "similarity_score": round(similarity_score, 4)
                })

        return formatted_results

    def list_indexed_documents(self) -> List[Dict[str, Any]]:
        """
        Scan collection metadatas to return summary statistics of all indexed documents.
        """
        all_data = self.collection.get(include=["metadatas"])
        if not all_data or not all_data["metadatas"]:
            return []

        doc_summary: Dict[str, Dict[str, Any]] = {}
        for meta in all_data["metadatas"]:
            source = meta.get("source", "Unknown")
            page = meta.get("page", 1)

            if source not in doc_summary:
                doc_summary[source] = {
                    "source": source,
                    "total_chunks": 0,
                    "max_pages": 1
                }
            doc_summary[source]["total_chunks"] += 1
            if page > doc_summary[source]["max_pages"]:
                doc_summary[source]["max_pages"] = page

        return list(doc_summary.values())

    def delete_document(self, filename: str) -> int:
        """
        Delete all chunks belonging to a specific document filename.
        """
        # Query chunks with matching source
        existing = self.collection.get(
            where={"source": filename},
            include=["metadatas"]
        )
        if existing and existing["ids"]:
            count = len(existing["ids"])
            self.collection.delete(ids=existing["ids"])
            return count
        return 0

    def get_total_chunk_count(self) -> int:
        """Returns total number of chunks currently indexed in ChromaDB."""
        return self.collection.count()
