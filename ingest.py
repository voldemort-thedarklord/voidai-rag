"""
CLI Document Ingestion & Quick Retrieval Script
Allows indexing documents from the terminal and testing vector search with RBAC.
"""

import sys
from pathlib import Path

# Add project root to path
BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from src.config import SAMPLE_POLICIES_DIR
from src.document_processor import DocumentProcessor
from src.vector_store import VectorStoreManager
from src.rag_pipeline import RAGPipeline


DEPARTMENT_MAPPING = {
    "HR_Leave_and_Attendance_Policy.txt": "HR",
    "HR_Leave_and_Attendance_Policy.pdf": "HR",
    "IT_Security_and_BYOD_Guidelines.txt": "General",
    "IT_Security_and_BYOD_Guidelines.pdf": "General",
    "Finance_and_Travel_Expense_Policy.txt": "Finance",
    "Engineering_Coding_and_Deployment_Standard.txt": "Engineering",
    "Engineering_Coding_and_Deployment_Standard.docx": "Engineering",
    "Executive_Compensation_Matrix_Confidential.txt": "Executive"
}


def index_all_sample_documents():
    """Extracts, chunks, and indexes all sample enterprise policies."""
    print("=" * 65)
    print("🚀 Acme Enterprise RAG - Batch Document Ingestion")
    print("=" * 65)

    processor = DocumentProcessor()
    vector_store = VectorStoreManager()

    total_chunks = 0
    files = list(SAMPLE_POLICIES_DIR.glob("*.*"))

    if not files:
        print(f"⚠️ No documents found in {SAMPLE_POLICIES_DIR}")
        return

    for file_path in files:
        dept = DEPARTMENT_MAPPING.get(file_path.name, "General")
        print(f"📄 Processing: {file_path.name} [Dept: {dept}]...")
        chunks = processor.process_file(file_path, department=dept)
        count = vector_store.add_chunks(chunks)
        total_chunks += count
        print(f"   ↳ Extracted & Indexed {count} vector chunks.")

    print("-" * 65)
    print(f"✅ Ingestion Complete! Total chunks stored in ChromaDB: {vector_store.get_total_chunk_count()}")
    print("=" * 65)


def interactive_cli_query():
    """Interactive command-line query loop for testing retrieval and generation."""
    pipeline = RAGPipeline()

    print("\n🔍 Interactive Knowledge QA Shell")
    print("Type your question below (or 'exit' to quit).\n")

    while True:
        try:
            role = input("\nEnter Role [Admin / HR Manager / Software Engineer / Finance Analyst / General Employee] (default: Admin): ").strip()
            if not role:
                role = "Admin"

            query = input(f"[{role}] Ask a question: ").strip()
            if query.lower() in ["exit", "quit", "q"]:
                print("Exiting...")
                break

            if not query:
                continue

            print("\nSearching knowledge base & generating response...")
            result = pipeline.run(query=query, user_role=role)

            print("\n" + "=" * 50)
            print("💡 GROUNDED ANSWER:")
            print("=" * 50)
            print(result["answer"])
            print("=" * 50)

            citations = result.get("citations", [])
            if citations:
                print("\n📑 CITATIONS:")
                for idx, c in enumerate(citations, 1):
                    print(f"  [{idx}] {c['source']} (Page {c['page']}) | Dept: {c['department']} | Similarity: {c['similarity']}")

            metrics = result.get("metrics", {})
            print(f"\n⏱️ Latency: Retrieval={metrics.get('retrieval_latency_ms')}ms | Generation={metrics.get('generation_latency_ms')}ms | Total={metrics.get('total_latency_ms')}ms")

        except (KeyboardInterrupt, EOFError):
            print("\nExiting...")
            break


if __name__ == "__main__":
    index_all_sample_documents()
    interactive_cli_query()
