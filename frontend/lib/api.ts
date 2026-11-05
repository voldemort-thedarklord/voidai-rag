import { DocumentItem, ChatMessage } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8501";

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
    throw new Error(errorData.detail || `Upload failed: ${res.statusText}`);
  }
  return res.json();
}

export async function sendChatMessage(
  query: string,
  selectedDocuments?: string[],
  provider: string = "gemini",
  token?: string
): Promise<any> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: getHeaders(token),
    body: JSON.stringify({
      query,
      provider,
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
  supported_providers: string[];
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
    supported_providers: ["gemini", "ollama"],
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
