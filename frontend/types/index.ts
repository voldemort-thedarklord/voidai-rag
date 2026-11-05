export interface UserProfile {
  user_id: string;
  email: string;
  full_name: string;
}

export interface DocumentItem {
  source: string;
  total_chunks: number;
  max_pages: number;
  file_size: number;
  created_at?: string;
}

export interface Citation {
  source: string;
  page: number;
  chunk_id?: string;
  excerpt_snippet: string;
  similarity?: number;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  citations?: Citation[];
  metrics?: {
    total_latency_ms?: number;
    retrieval_latency_ms?: number;
    generation_latency_ms?: number;
    chunks_retrieved?: number;
    provider?: string;
    model?: string;
  };
  timestamp?: string;
}
