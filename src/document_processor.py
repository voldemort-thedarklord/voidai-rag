"""
Document Processor Module
Handles text extraction from PDF, DOCX, and TXT files, followed by
recursive character-aware chunking and metadata preservation.
"""

from pathlib import Path
import hashlib
from typing import List, Dict, Any, Optional
import pymupdf
import docx

from src.config import DEFAULT_CHUNK_SIZE, DEFAULT_CHUNK_OVERLAP


class DocumentChunk:
    """Represents a single processed chunk with its text and metadata."""
    def __init__(
        self,
        chunk_id: str,
        text: str,
        source: str,
        page: int,
        chunk_index: int,
        department: str,
        metadata: Optional[Dict[str, Any]] = None
    ):
        self.chunk_id = chunk_id
        self.text = text
        self.source = source
        self.page = page
        self.chunk_index = chunk_index
        self.department = department
        self.metadata = metadata or {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "chunk_id": self.chunk_id,
            "text": self.text,
            "metadata": {
                "source": self.source,
                "page": self.page,
                "chunk_index": self.chunk_index,
                "department": self.department,
                **self.metadata
            }
        }


class DocumentProcessor:
    """Extracts, cleans, and chunks enterprise documents."""

    def __init__(
        self,
        chunk_size: int = DEFAULT_CHUNK_SIZE,
        chunk_overlap: int = DEFAULT_CHUNK_OVERLAP
    ):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    @staticmethod
    def compute_file_hash(file_path: Path) -> str:
        """Compute SHA256 hash of a file for integrity and duplicate detection."""
        hasher = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                hasher.update(byte_block)
        return hasher.hexdigest()[:12]

    def extract_text_from_pdf(self, file_path: Path) -> List[Dict[str, Any]]:
        """Extract text page-by-page from PDF using PyMuPDF."""
        pages_content = []
        doc = pymupdf.open(file_path)
        try:
            for page_idx, page in enumerate(doc, start=1):
                text = page.get_text("text").strip()
                if text:
                    pages_content.append({"page": page_idx, "text": text})
        finally:
            doc.close()
        return pages_content

    def extract_text_from_docx(self, file_path: Path) -> List[Dict[str, Any]]:
        """Extract text from DOCX file."""
        doc = docx.Document(file_path)
        full_text = []
        for para in doc.paragraphs:
            if para.text.strip():
                full_text.append(para.text.strip())
        combined_text = "\n\n".join(full_text)
        return [{"page": 1, "text": combined_text}] if combined_text else []

    def extract_text_from_txt(self, file_path: Path) -> List[Dict[str, Any]]:
        """Extract text from plain text or markdown file."""
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            text = f.read().strip()
        return [{"page": 1, "text": text}] if text else []

    def extract_text(self, file_path: Path) -> List[Dict[str, Any]]:
        """Extract text based on file suffix."""
        suffix = file_path.suffix.lower()
        if suffix == ".pdf":
            return self.extract_text_from_pdf(file_path)
        elif suffix in [".docx", ".doc"]:
            return self.extract_text_from_docx(file_path)
        elif suffix in [".txt", ".md", ".log"]:
            return self.extract_text_from_txt(file_path)
        else:
            raise ValueError(f"Unsupported file format: {suffix}")

    def recursive_split_text(self, text: str) -> List[str]:
        """
        Recursively splits text on natural boundaries:
        1. Paragraphs (\n\n)
        2. Lines (\n)
        3. Sentences (. )
        4. Spaces (' ')
        Ensures chunks do not break in the middle of sentences when possible.
        """
        if len(text) <= self.chunk_size:
            return [text.strip()] if text.strip() else []

        separators = ["\n\n", "\n", ". ", " "]
        
        def _split(txt: str, sep_idx: int) -> List[str]:
            if len(txt) <= self.chunk_size or sep_idx >= len(separators):
                # Fallback: slice directly if no further separators
                chunks = []
                step = max(1, self.chunk_size - self.chunk_overlap)
                for start in range(0, len(txt), step):
                    ch = txt[start:start + self.chunk_size].strip()
                    if ch:
                        chunks.append(ch)
                return chunks

            sep = separators[sep_idx]
            parts = txt.split(sep)
            chunks = []
            current_chunk = ""

            for part in parts:
                candidate = f"{current_chunk}{sep}{part}" if current_chunk else part
                if len(candidate) <= self.chunk_size:
                    current_chunk = candidate
                else:
                    if current_chunk:
                        chunks.append(current_chunk.strip())
                    # If this single part itself exceeds chunk size, split it with next separator
                    if len(part) > self.chunk_size:
                        sub_chunks = _split(part, sep_idx + 1)
                        chunks.extend(sub_chunks)
                        current_chunk = ""
                    else:
                        current_chunk = part

            if current_chunk and current_chunk.strip():
                chunks.append(current_chunk.strip())

            return chunks

        raw_chunks = _split(text, 0)
        
        # Merge small residual chunks and apply overlap
        refined_chunks = []
        for i, ch in enumerate(raw_chunks):
            if len(ch) < 30 and i > 0:
                # Merge tiny fragment into previous chunk if space allows
                if len(refined_chunks[-1]) + len(ch) + 1 <= self.chunk_size:
                    refined_chunks[-1] = f"{refined_chunks[-1]} {ch}"
                    continue
            refined_chunks.append(ch)

        return refined_chunks

    def process_file(
        self,
        file_path: Path,
        department: str = "General"
    ) -> List[DocumentChunk]:
        """
        Processes a single file: extracts text, splits into chunks, and
        attaches granular metadata (source, page, department, chunk_id).
        """
        pages = self.extract_text(file_path)
        file_hash = self.compute_file_hash(file_path)
        filename = file_path.name
        stem = file_path.stem.replace(" ", "_")

        processed_chunks: List[DocumentChunk] = []

        for page_info in pages:
            page_num = page_info["page"]
            page_text = page_info["text"]

            text_chunks = self.recursive_split_text(page_text)
            for idx, chunk_text in enumerate(text_chunks):
                chunk_id = f"{stem}-p{page_num}-c{idx}-{file_hash}"
                chunk = DocumentChunk(
                    chunk_id=chunk_id,
                    text=chunk_text,
                    source=filename,
                    page=page_num,
                    chunk_index=idx,
                    department=department,
                    metadata={
                        "char_count": len(chunk_text),
                        "file_hash": file_hash
                    }
                )
                processed_chunks.append(chunk)

        return processed_chunks
