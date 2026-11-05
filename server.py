"""
FastAPI Server for VoidAI Enterprise RAG Assistant
Powered by Supabase Auth, Supabase Storage, Postgres DB, ChromaDB, and Local Ollama.
"""

import sys
from pathlib import Path
import shutil
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Header, Depends
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
from src.supabase_manager import SupabaseManager

app = FastAPI(title="voidai API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize subsystems
vector_store = VectorStoreManager()
rag_pipeline = RAGPipeline(vector_store=vector_store)
doc_processor = DocumentProcessor()
supabase_manager = SupabaseManager()


# ==========================================
# PYDANTIC SCHEMAS
# ==========================================
class SignUpRequest(BaseModel):
    email: str
    password: str
    full_name: Optional[str] = ""
    role: str = "General Employee"
    department: str = "General"


class SignInRequest(BaseModel):
    email: str
    password: str


class ChatRequest(BaseModel):
    query: str
    user_role: str = "Admin"
    provider: str = "ollama"
    model: str = DEFAULT_OLLAMA_MODEL
    top_k: int = DEFAULT_TOP_K
    selected_documents: Optional[List[str]] = None
    user_id: Optional[str] = None


# Helper to get auth header
async def get_current_user_token(authorization: Optional[str] = Header(None)) -> Optional[str]:
    if authorization and authorization.startswith("Bearer "):
        return authorization.split(" ")[1]
    return None


@app.get("/")
async def serve_index():
    index_path = BASE_DIR / "static" / "index.html"
    if not index_path.exists():
        raise HTTPException(status_code=404, detail="index.html not found")
    return FileResponse(index_path)


# ==========================================
# AUTHENTICATION ENDPOINTS (SUPABASE AUTH)
# ==========================================
@app.post("/api/auth/signup")
async def signup(req: SignUpRequest):
    """Register a new user with Supabase Auth and auto-create profile."""
    try:
        user_data = supabase_manager.sign_up(
            email=req.email,
            password=req.password,
            full_name=req.full_name or "",
            role=req.role,
            department=req.department
        )
        return {
            "success": True,
            "message": "User registered successfully",
            "data": user_data
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/auth/signin")
async def signin(req: SignInRequest):
    """Authenticate existing user with Supabase Auth and return profile."""
    try:
        auth_data = supabase_manager.sign_in(
            email=req.email,
            password=req.password
        )
        return {
            "success": True,
            "data": auth_data
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid credentials or user not found: {str(e)}")


@app.get("/api/auth/me")
async def get_me(token: Optional[str] = Depends(get_current_user_token)):
    """Retrieve verified user profile from Supabase JWT token."""
    if not token:
        raise HTTPException(status_code=401, detail="No authorization token provided")
    user = supabase_manager.get_user_from_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session token")
    return {"success": True, "user": user}


# ==========================================
# DOCUMENTS & STORAGE ENDPOINTS
# ==========================================
@app.get("/api/documents")
async def get_documents():
    """Returns list of documents from Supabase DB or vector store fallback."""
    supabase_docs = supabase_manager.list_documents() if supabase_manager.is_configured() else []
    
    if supabase_docs:
        docs = supabase_docs
    else:
        docs = vector_store.list_indexed_documents()

    total_chunks = vector_store.get_total_chunk_count()
    return {
        "documents": docs,
        "total_documents": len(docs),
        "total_chunks": total_chunks,
        "storage_mb": round((sum(d.get("file_size", 0) for d in docs) / (1024 * 1024)), 2) or 0.08
    }


@app.post("/api/upload")
async def upload_document(
    file: UploadFile = File(...),
    department: str = Form("General"),
    token: Optional[str] = Depends(get_current_user_token)
):
    """
    Full Enterprise Ingestion Pipeline:
    1. Uploads file to Supabase Storage 'documents' bucket.
    2. Extracts text & page count with PyMuPDF / docx.
    3. Chunks text and indexes into ChromaDB vector store.
    4. Records metadata & ownership in Supabase PostgreSQL 'voidai_documents' table.
    """
    try:
        file_bytes = await file.read()
        filename = file.filename
        mime_type = file.content_type or "application/octet-stream"

        # 1. Upload to Supabase Storage
        storage_path = filename
        if supabase_manager.is_configured():
            try:
                storage_path = supabase_manager.upload_file_to_storage(filename, file_bytes, mime_type=mime_type)
            except Exception as se:
                print(f"[Upload] Supabase Storage warning: {se}")

        # 2. Save locally for document processing
        save_path = UPLOADS_DIR / filename
        with open(save_path, "wb") as f:
            f.write(file_bytes)

        # 3. Process into chunks & index in Vector Store
        chunks = doc_processor.process_file(save_path, department=department)
        count = vector_store.add_chunks(chunks)

        # 4. Get page count
        page_info = doc_processor.get_document_page_text(save_path, 1)
        total_pages = page_info.get("total_pages", 1)

        # 5. Extract user id if logged in
        user_id = None
        if token and supabase_manager.is_configured():
            auth_user = supabase_manager.get_user_from_token(token)
            if auth_user:
                user_id = auth_user.get("user_id")

        # 6. Record metadata in Supabase PostgreSQL
        if supabase_manager.is_configured():
            supabase_manager.record_document_in_db(
                filename=filename,
                storage_path=storage_path,
                file_size=len(file_bytes),
                mime_type=mime_type,
                department=department,
                chunk_count=len(chunks),
                page_count=total_pages,
                uploaded_by=user_id
            )

        return {
            "success": True,
            "filename": filename,
            "department": department,
            "chunks_added": count,
            "total_pages": total_pages,
            "storage_path": storage_path
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/document/{filename}/page/{page_num}")
async def get_document_page(filename: str, page_num: int):
    """Returns text for a specific page of a document for the Document Viewer."""
    target_path = SAMPLE_POLICIES_DIR / filename
    if not target_path.exists():
        target_path = UPLOADS_DIR / filename
    
    # If not on local disk, download from Supabase Storage!
    if not target_path.exists() and supabase_manager.is_configured():
        file_bytes = supabase_manager.download_file_bytes(filename)
        if file_bytes:
            with open(target_path, "wb") as f:
                f.write(file_bytes)

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


@app.delete("/api/document/{filename}")
async def delete_document(filename: str):
    """Deletes document from ChromaDB vector store, Supabase Storage, and Supabase DB."""
    try:
        # ChromaDB deletion
        count = vector_store.delete_document(filename)
        # Supabase deletion
        if supabase_manager.is_configured():
            supabase_manager.delete_document(filename)
        return {"success": True, "filename": filename, "chunks_deleted": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================
# CHAT & EVALUATION ENDPOINTS
# ==========================================
@app.post("/api/chat")
async def chat_endpoint(req: ChatRequest):
    """Runs query through RAG pipeline and persists history in Supabase."""
    try:
        result = rag_pipeline.run(
            query=req.query,
            user_role=req.user_role,
            provider=req.provider,
            model=req.model,
            top_k=req.top_k
        )

        # Persist conversation in Supabase
        if supabase_manager.is_configured():
            supabase_manager.save_chat_message(
                query=req.query,
                answer=result.get("answer", ""),
                user_role=req.user_role,
                citations=result.get("citations", []),
                metrics=result.get("metrics", {}),
                user_id=req.user_id
            )

        return result
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
