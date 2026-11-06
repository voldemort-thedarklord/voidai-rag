"""
Supabase Backend Manager for VoidAI
Handles Authentication, Supabase Storage uploads/downloads,
and Postgres database operations for documents and profiles.
"""

import os
from pathlib import Path
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY") or os.getenv("SUPABASE_KEY", "")


class SupabaseManager:
    """Manages Supabase Auth, Storage, and Database tables."""

    def __init__(self, url: Optional[str] = None, key: Optional[str] = None):
        self.url = url or SUPABASE_URL
        self.key = key or SUPABASE_KEY
        if not self.url or not self.key:
            print("[SupabaseManager] Warning: SUPABASE_URL or SUPABASE_KEY is missing in .env")
            self.client: Optional[Client] = None
        else:
            self.client = create_client(self.url, self.key)

    def is_configured(self) -> bool:
        return self.client is not None

    # ==========================================
    # AUTHENTICATION
    # ==========================================
    def sign_up(
        self,
        email: str,
        password: str,
        full_name: str = ""
    ) -> Dict[str, Any]:
        """Sign up a new user, create confirmed account in Supabase, and return session."""
        if not self.client:
            raise RuntimeError("Supabase client not initialized")

        clean_email = email.strip().lower()
        clean_name = full_name.strip() or clean_email.split("@")[0]

        # Use our secure RPC to create the confirmed user avoiding SMTP rate limits
        try:
            rpc_res = self.client.rpc("create_voidai_user", {
                "p_email": clean_email,
                "p_password": password,
                "p_full_name": clean_name
            }).execute()
        except Exception as e:
            err_msg = str(e)
            if "already exists" in err_msg.lower():
                raise ValueError("An account with this email already exists.")
            # Fallback to standard sign_up if RPC not available
            resp = self.client.auth.sign_up({
                "email": clean_email,
                "password": password,
                "options": {
                    "data": {
                        "full_name": clean_name
                    }
                }
            })
            user = resp.user
            session = resp.session
            return {
                "user_id": user.id if user else None,
                "email": user.email if user else clean_email,
                "access_token": session.access_token if session else None,
                "refresh_token": session.refresh_token if session else None,
                "full_name": clean_name
            }

        # User is created & confirmed; immediately sign in to retrieve JWT access token
        return self.sign_in(clean_email, password)

    def sign_in(self, email: str, password: str) -> Dict[str, Any]:
        """Sign in with email and password."""
        if not self.client:
            raise RuntimeError("Supabase client not initialized")

        resp = self.client.auth.sign_in_with_password({
            "email": email,
            "password": password
        })
        user = resp.user
        session = resp.session
        if not user or not session:
            raise RuntimeError("Authentication failed")

        profile = self.get_profile(user.id)
        full_name = profile.get("full_name", email.split("@")[0]) if profile else email.split("@")[0]

        return {
            "user_id": user.id,
            "email": user.email,
            "access_token": session.access_token,
            "refresh_token": session.refresh_token,
            "full_name": full_name
        }

    def get_profile(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Fetch user profile from voidai_profiles."""
        if not self.client:
            return None
        try:
            res = self.client.table("voidai_profiles").select("*").eq("id", user_id).execute()
            if res.data and len(res.data) > 0:
                return res.data[0]
        except Exception as e:
            print(f"[SupabaseManager] Error fetching profile: {e}")
        return None

    def get_user_from_token(self, access_token: str) -> Optional[Dict[str, Any]]:
        """Verify JWT token and return authenticated user and profile."""
        if not self.client or not access_token:
            return None
        try:
            user_resp = self.client.auth.get_user(access_token)
            if user_resp and user_resp.user:
                profile = self.get_profile(user_resp.user.id)
                return {
                    "user_id": user_resp.user.id,
                    "email": user_resp.user.email,
                    "full_name": profile.get("full_name", "") if profile else ""
                }
        except Exception as e:
            print(f"[SupabaseManager] Token validation error: {e}")
        return None

    # ==========================================
    # FILE STORAGE & DOCUMENTS
    # ==========================================
    def upload_file_to_storage(
        self,
        filename: str,
        file_bytes: bytes,
        mime_type: str = "application/octet-stream"
    ) -> str:
        """Upload raw file bytes into Supabase Storage 'documents' bucket."""
        if not self.client:
            raise RuntimeError("Supabase client not initialized")

        storage_path = filename
        self.client.storage.from_("documents").upload(
            path=storage_path,
            file=file_bytes,
            file_options={"content-type": mime_type, "upsert": "true"}
        )
        return storage_path

    def record_document_in_db(
        self,
        filename: str,
        storage_path: str,
        file_size: int,
        mime_type: str,
        chunk_count: int,
        page_count: int,
        uploaded_by: Optional[str] = None
    ) -> Dict[str, Any]:
        """Record document metadata in public.voidai_documents."""
        if not self.client:
            raise RuntimeError("Supabase client not initialized")

        payload = {
            "filename": filename,
            "storage_path": storage_path,
            "file_size": file_size,
            "mime_type": mime_type,
            "chunk_count": chunk_count,
            "page_count": page_count,
            "uploaded_by": uploaded_by
        }
        res = self.client.table("voidai_documents").upsert(
            payload, on_conflict="filename"
        ).execute()
        return res.data[0] if res.data else payload

    def list_documents(self, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """List indexed documents stored in Supabase for the authenticated user."""
        if not self.client:
            return []
        try:
            query = self.client.table("voidai_documents").select("*").order("created_at", desc=True)
            if user_id:
                query = query.eq("uploaded_by", user_id)
            res = query.execute()
            docs = []
            for d in (res.data or []):
                docs.append({
                    "source": d["filename"],
                    "total_chunks": d.get("chunk_count", 0),
                    "max_pages": d.get("page_count", 1),
                    "file_size": d.get("file_size", 0),
                    "created_at": d.get("created_at")
                })
            return docs
        except Exception as e:
            print(f"[SupabaseManager] Error listing documents: {e}")
            return []

    def delete_document(self, filename: str, user_id: Optional[str] = None) -> bool:
        """Delete file from Supabase storage and delete from database."""
        if not self.client:
            return False
        try:
            # 1. Delete from database (scoped to user if user_id given)
            query = self.client.table("voidai_documents").delete().eq("filename", filename)
            if user_id:
                query = query.eq("uploaded_by", user_id)
            query.execute()
            # 2. Delete from storage
            self.client.storage.from_("documents").remove([filename])
            return True
        except Exception as e:
            print(f"[SupabaseManager] Error deleting document: {e}")
            return False

    def download_file_bytes(self, filename: str) -> Optional[bytes]:
        """Download file bytes from Supabase storage."""
        if not self.client:
            return None
        try:
            return self.client.storage.from_("documents").download(filename)
        except Exception as e:
            print(f"[SupabaseManager] Error downloading file: {e}")
            return None

    # ==========================================
    # CHAT HISTORY
    # ==========================================
    def save_chat_message(
        self,
        query: str,
        answer: str,
        citations: List[Dict[str, Any]],
        metrics: Dict[str, Any],
        user_id: Optional[str] = None
    ):
        """Persist conversation exchange to voidai_chat_history."""
        if not self.client:
            return
        try:
            self.client.table("voidai_chat_history").insert({
                "user_id": user_id,
                "user_role": "user",
                "query": query,
                "answer": answer,
                "citations": citations,
                "metrics": metrics
            }).execute()
        except Exception as e:
            print(f"[SupabaseManager] Error saving chat message: {e}")

    def get_chat_history(self, user_id: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        """Retrieve authentic conversation history for user from Supabase."""
        if not self.client:
            return []
        try:
            query = self.client.table("voidai_chat_history").select("*").order("created_at", desc=False)
            if user_id:
                query = query.eq("user_id", user_id)
            res = query.limit(limit).execute()
            return res.data or []
        except Exception as e:
            print(f"[SupabaseManager] Error getting chat history: {e}")
            return []
