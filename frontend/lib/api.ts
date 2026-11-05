import { DocumentItem, ChatMessage } from "@/types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://voidai-rag-backend.onrender.com";

function getHeaders(token?: string): HeadersInit {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export async function fetchDocuments(token?: string): Promise<{
  documents: DocumentItem[];
  total_documents: number;
  total_chunks: number;
  storage_mb: number;
}> {
  const res = await fetch(`${API_BASE}/api/documents`, {
    headers: getHeaders(token),
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch documents: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchDocumentPage(
  filename: string,
  pageNum: number,
  token?: string
): Promise<{
  filename: string;
  page_num: number;
  total_pages: number;
  text: string;
}> {
  const res = await fetch(
    `${API_BASE}/api/document/${encodeURIComponent(filename)}/page/${pageNum}`,
    {
      headers: getHeaders(token),
    }
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch page ${pageNum}: ${res.statusText}`);
  }
  return res.json();
}

export async function deleteDocument(
  filename: string,
  token?: string
): Promise<{ success: boolean; filename: string }> {
  const res = await fetch(
    `${API_BASE}/api/document/${encodeURIComponent(filename)}`,
    {
      method: "DELETE",
      headers: getHeaders(token),
    }
  );
  if (!res.ok) {
    throw new Error(`Failed to delete document: ${res.statusText}`);
  }
  return res.json();
}

export async function uploadDocument(
  file: File,
  token?: string
): Promise<any> {
  const formData = new FormData();
  formData.append("file", file);

  const headers: HeadersInit = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}/api/upload`, {
    method: "POST",
    headers,
    body: formData,
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Upload failed (${res.status}): ${res.statusText}`);
  }
  return res.json();
}

export async function uploadDocuments(
  files: File[],
  token?: string,
  onProgress?: (current: number, total: number, filename: string) => void
): Promise<{
  success: boolean;
  message: string;
  files: any[];
  errors?: string[];
  chunks_added: number;
  total_pages: number;
}> {
  const results: any[] = [];
  const errors: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (onProgress) {
      onProgress(i + 1, files.length, f.name);
    }
    try {
      const res = await uploadDocument(f, token);
      results.push(res);
    } catch (e: any) {
      errors.push(`${f.name}: ${e.message}`);
    }
  }

  if (results.length === 0 && errors.length > 0) {
    throw new Error(errors.join("; "));
  }

  return {
    success: true,
    message: `Processed ${results.length} of ${files.length} document(s)`,
    files: results,
    errors: errors.length > 0 ? errors : undefined,
    chunks_added: results.reduce((acc, r) => acc + (r.chunks_added || 0), 0),
    total_pages: results.reduce((acc, r) => acc + (r.total_pages || 0), 0),
  };
}

export async function sendChatMessage(
  query: string,
  selectedDocuments?: string[],
  token?: string
): Promise<any> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: getHeaders(token),
    body: JSON.stringify({
      query,
      provider: "gemini",
      selected_documents: selectedDocuments,
    }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Chat query failed: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchSystemStatus(): Promise<{
  gemini_configured: boolean;
  default_provider: string;
  default_model: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/api/system/status`);
    if (res.ok) return res.json();
  } catch (e) {
    console.warn("Could not fetch system status:", e);
  }
  return {
    gemini_configured: true,
    default_provider: "gemini",
    default_model: "gemini-flash-lite-latest",
  };
}

export async function fetchChatHistory(token?: string): Promise<{
  success: boolean;
  history: Array<{
    query: string;
    answer: string;
    citations?: any[];
    metrics?: any;
    created_at?: string;
  }>;
}> {
  const res = await fetch(`${API_BASE}/api/chat/history`, {
    headers: getHeaders(token),
  });
  if (!res.ok) {
    return { success: true, history: [] };
  }
  return res.json();
}
