"""
FastAPI Server for VoidAI Enterprise RAG Assistant
Powered by Supabase Auth, Supabase Storage, Postgres DB, ChromaDB, and Local Ollama.
All routes (including home) are protected with Supabase Auth validation.
"""

import sys
from pathlib import Path
import shutil
from typing import List, Dict, Any, Optional
from fastapi import (
    FastAPI,
    UploadFile,
    File,
    Form,
    HTTPException,
    Header,
    Depends,
    Request,
    Response,
    status
)
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
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
from src.clerk_verifier import verify_clerk_token

app = FastAPI(title="VOIDAI Enterprise RAG")

# Enable CORS for Next.js frontend (port 3000) and backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8501",
        "http://127.0.0.1:8501",
    ],
    allow_origin_regex=r"https?://.*",
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


# ==========================================
# AUTHENTICATION GUARD & DEPENDENCY
# ==========================================
def extract_token_from_request(
    request: Request,
    authorization: Optional[str] = None
) -> Optional[str]:
    """Extracts JWT token from Authorization header (Bearer ...) or cookie."""
    if authorization and authorization.startswith("Bearer "):
        return authorization.split("Bearer ")[1].strip()
    auth_header = request.headers.get("authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header.split("Bearer ")[1].strip()
    if "voidai_token" in request.cookies:
        return request.cookies.get("voidai_token")
    return None


async def get_current_user(
    request: Request,
    authorization: Optional[str] = Header(None)
) -> Dict[str, Any]:
    """
    Enforces authentication on protected routes.
    Validates token against Clerk JWKS or Supabase Auth.
    """
    token = extract_token_from_request(request, authorization)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in."
        )

    # 1. Try Clerk verification
    clerk_user = verify_clerk_token(token)
    if clerk_user:
        return clerk_user

    # 2. Try Supabase verification
    user = supabase_manager.get_user_from_token(token)
    if user:
        return user

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired session token. Please sign in again."
    )


# ==========================================
# ROUTE 1: HOME ROUTE (STRICTLY PROTECTED)
# ==========================================
@app.get("/")
async def serve_home(
    request: Request,
    authorization: Optional[str] = Header(None)
):
    """
    Protected Home Route.
    Requires an active authenticated session.
    If unauthenticated:
      - Browser: Redirects (307) to /login
      - API Client: Returns 401 Unauthorized
    """
    token = extract_token_from_request(request, authorization)
    user = None
    if token:
        user = verify_clerk_token(token) or supabase_manager.get_user_from_token(token)

    if not user:
        accept_header = request.headers.get("accept", "")
        # If accessing from browser, redirect to login page
        if "text/html" in accept_header:
            return RedirectResponse(url="/login", status_code=status.HTTP_307_TEMPORARY_REDIRECT)
        # API caller gets strict 401
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to access VoidAI workspace."
        )

    index_path = BASE_DIR / "static" / "index.html"
    if not index_path.exists():
        raise HTTPException(status_code=404, detail="index.html not found")
    return FileResponse(index_path)


# ==========================================
# ROUTE 2: LOGIN / IAM PAGE (PUBLIC)
# ==========================================
@app.get("/login")
async def serve_login():
    """Serves the VoidAI IAM Login & Registration Gateway."""
    login_path = BASE_DIR / "static" / "login.html"
    if not login_path.exists():
        raise HTTPException(status_code=404, detail="login.html not found")
    return FileResponse(login_path)


# ==========================================
# PUBLIC AUTH ENDPOINTS (SIGN IN, SIGN UP, SIGN OUT)
# ==========================================
@app.post("/api/auth/signup")
async def signup(req: SignUpRequest, response: Response):
    """Register a new user with Supabase Auth, auto-confirm, and set cookie."""
    try:
        user_data = supabase_manager.sign_up(
            email=req.email,
            password=req.password,
            full_name=req.full_name or "",
            role=req.role,
            department=req.department
        )
        # Set session cookie for seamless page navigation
        if user_data.get("access_token"):
            response.set_cookie(
                key="voidai_token",
                value=user_data["access_token"],
                httponly=False,
                samesite="lax",
                max_age=86400 * 7,
                path="/"
            )
        return {
            "success": True,
            "message": "User registered successfully",
            "data": user_data
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/auth/signin")
async def signin(req: SignInRequest, response: Response):
    """Authenticate existing user with Supabase Auth and set session cookie."""
    try:
        auth_data = supabase_manager.sign_in(
            email=req.email,
            password=req.password
        )
        # Set session cookie for seamless page navigation
        if auth_data.get("access_token"):
            response.set_cookie(
                key="voidai_token",
                value=auth_data["access_token"],
                httponly=False,
                samesite="lax",
                max_age=86400 * 7,
                path="/"
            )
        return {
            "success": True,
            "data": auth_data
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid credentials or user not found: {str(e)}"
        )


@app.post("/api/auth/signout")
async def signout(response: Response):
    """Clear session cookie and sign out."""
    response.delete_cookie(key="voidai_token", path="/")
    return {"success": True, "message": "Signed out successfully"}


# ==========================================
# PROTECTED API ENDPOINTS (REQUIRE SUPABASE AUTH)
# ==========================================
@app.get("/api/auth/me")
async def get_me(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Retrieve verified user profile from Supabase JWT session."""
    return {"success": True, "user": current_user}


@app.get("/api/documents")
async def get_documents(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Protected: Returns real documents from Supabase DB or vector store."""
    supabase_docs = supabase_manager.list_documents() if supabase_manager.is_configured() else []
    
    if supabase_docs:
        docs = supabase_docs
    else:
        docs = vector_store.list_indexed_documents()

    total_chunks = vector_store.get_total_chunk_count()
    total_bytes = sum(d.get("file_size", 0) for d in docs)
    storage_mb = round(total_bytes / (1024 * 1024), 2) if total_bytes > 0 else 0.0

    return {
        "documents": docs,
        "total_documents": len(docs),
        "total_chunks": total_chunks,
        "storage_mb": storage_mb
    }


@app.post("/api/upload")
async def upload_document(
    file: UploadFile = File(...),
    department: str = Form("General"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Protected: Uploads file to Supabase Storage, chunks in ChromaDB,
    and records ownership to authenticated user in Supabase DB.
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

        # 5. Record metadata in Supabase PostgreSQL
        user_id = current_user.get("user_id")
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
async def get_document_page(
    filename: str,
    page_num: int,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Protected: Returns text for a specific page of a document for the Document Viewer."""
    target_path = UPLOADS_DIR / filename
    if not target_path.exists():
        target_path = SAMPLE_POLICIES_DIR / filename
    
    # If not on local disk, download from Supabase Storage
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
async def delete_document(
    filename: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Protected: Deletes document from ChromaDB vector store, Supabase Storage, and Supabase DB."""
    try:
        # ChromaDB deletion
        count = vector_store.delete_document(filename)
        # Supabase deletion
        if supabase_manager.is_configured():
            supabase_manager.delete_document(filename)
        return {"success": True, "filename": filename, "chunks_deleted": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/chat")
async def chat_endpoint(
    req: ChatRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Protected: Runs query through RAG pipeline and persists history in Supabase."""
    try:
        user_role = current_user.get("role") or req.user_role
        user_id = current_user.get("user_id")

        result = rag_pipeline.run(
            query=req.query,
            user_role=user_role,
            provider=req.provider,
            model=req.model,
            top_k=req.top_k
        )

        # Persist conversation in Supabase
        if supabase_manager.is_configured():
            supabase_manager.save_chat_message(
                query=req.query,
                answer=result.get("answer", ""),
                user_role=user_role,
                citations=result.get("citations", []),
                metrics=result.get("metrics", {}),
                user_id=user_id
            )

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/chat/history")
async def get_chat_history_endpoint(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Protected: Returns authentic conversation history for authenticated user."""
    user_id = current_user.get("user_id")
    history = supabase_manager.get_chat_history(user_id=user_id)
    return {"success": True, "history": history}


@app.get("/api/eval")
async def run_evaluation(
    provider: str = "ollama",
    model: str = DEFAULT_OLLAMA_MODEL,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Protected: Runs automated benchmark evaluation suite."""
    evaluator = RAGEvaluator(pipeline=rag_pipeline)
    res = evaluator.run_benchmark(provider=provider, model=model)
    return {
        "scorecard": res["scorecard"],
        "results": res["raw_results"]
    }


@app.get("/api/roles")
async def get_roles(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Protected: Returns available RBAC roles and permissions."""
    return {
        "roles": ROLES_PERMISSIONS,
        "departments": ALL_DEPARTMENTS
    }


# Mount static files
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")

if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8501, reload=False)
