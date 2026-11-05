"""
FastAPI Server for Enterprise RAG Document Assistant
Serves the high-fidelity Denser.ai-styled Dark Mode UI and REST endpoints.
"""

import sys
from pathlib import Path
import shutil
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# Ensure project root is in sys.path
BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from src.config import (
    ROLES_PERMISSIONS,
    ALL_DEPARTMENTS,
    DEFAULT_TOP_K,
    DEFAULT_OLLAMA_MODEL,
    SAMPLE_POLICIES_DIR,
    UPLOADS_DIR,
    CHROMA_PERSIST_DIR
)
from src.document_processor import DocumentProcessor
from src.vector_store import VectorStoreManager
from src.rag_pipeline import RAGPipeline
from src.llm_client import LLMClient
from src.evaluator import RAGEvaluator

app = FastAPI(title="voidai API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize vector store and pipeline
vector_store = VectorStoreManager()
rag_pipeline = RAGPipeline(vector_store=vector_store)
doc_processor = DocumentProcessor()


class ChatRequest(BaseModel):
    query: str
    user_role: str = "Admin"
    provider: str = "ollama"
    model: str = DEFAULT_OLLAMA_MODEL
    top_k: int = DEFAULT_TOP_K
    selected_documents: Optional[List[str]] = None


@app.get("/")
async def serve_index():
    index_path = BASE_DIR / "static" / "index.html"
    if not index_path.exists():
        raise HTTPException(status_code=404, detail="index.html not found")
    return FileResponse(index_path)


@app.get("/api/documents")
async def get_documents():
    """Returns list of currently indexed documents with metadata."""
    docs = vector_store.list_indexed_documents()
    total_chunks = vector_store.get_total_chunk_count()
    return {
        "documents": docs,
        "total_documents": len(docs),
        "total_chunks": total_chunks,
        "storage_mb": round((sum(f.stat().st_size for f in SAMPLE_POLICIES_DIR.glob("*.*") if f.is_file()) / (1024 * 1024)), 2)
    }


@app.post("/api/chat")
async def chat_endpoint(req: ChatRequest):
    """Processes chat question with RAG pipeline and returns answer with citations."""
    try:
        result = rag_pipeline.run(
            query=req.query,
            user_role=req.role if hasattr(req, "role") else req.user_role,
            provider=req.provider,
            model=req.model,
            top_k=req.top_k
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/document/{filename}/page/{page_num}")
async def get_document_page(filename: str, page_num: int):
    """Returns the text for a specific page of a document for the Document Viewer."""
    # Check sample policies first, then uploads
    target_path = SAMPLE_POLICIES_DIR / filename
    if not target_path.exists():
        target_path = UPLOADS_DIR / filename
    if not target_path.exists():
        raise HTTPException(status_code=404, detail=f"Document {filename} not found")

    try:
        page_data = doc_processor.get_document_page_text(target_path, page_num=page_num)
        return {
            "filename": filename,
            "page_num": page_data["page_num"],
            "total_pages": page_data["total_pages"],
            "text": page_data["text"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/upload")
async def upload_document(file: UploadFile = File(...), department: str = Form("General")):
    """Uploads, chunks, and indexes a new document."""
    try:
        save_path = UPLOADS_DIR / file.filename
        with open(save_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        chunks = doc_processor.process_file(save_path, department=department)
        count = vector_store.add_chunks(chunks)
        return {
            "success": True,
            "filename": file.filename,
            "department": department,
            "chunks_added": count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/document/{filename}")
async def delete_document(filename: str):
    """Deletes all chunks of a document from vector store."""
    try:
        count = vector_store.delete_document(filename)
        return {"success": True, "filename": filename, "chunks_deleted": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/eval")
async def run_evaluation(provider: str = "ollama", model: str = DEFAULT_OLLAMA_MODEL):
    """Runs automated benchmark evaluation suite."""
    evaluator = RAGEvaluator(pipeline=rag_pipeline)
    res = evaluator.run_benchmark(provider=provider, model=model)
    return {
        "scorecard": res["scorecard"],
        "results": res["raw_results"]
    }


@app.get("/api/roles")
async def get_roles():
    """Returns available RBAC roles and permissions."""
    return {
        "roles": ROLES_PERMISSIONS,
        "departments": ALL_DEPARTMENTS
    }


# Mount static files
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")

if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8501, reload=False)

