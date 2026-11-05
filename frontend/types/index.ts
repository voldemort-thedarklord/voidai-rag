export interface UserProfile {
  user_id: string;
  email: string;
  role: string;
  department: string;
  full_name: string;
}

export interface DocumentItem {
  source: string;
  department: string;
  total_chunks: number;
  max_pages: number;
  file_size: number;
  created_at?: string;
}

export interface Citation {
  source: string;
  page: number;
  chunk_id: string;
  excerpt_snippet: string;
  relevance_score?: number;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  citations?: Citation[];
  metrics?: {
    total_latency_ms?: number;
    retrieval_ms?: number;
    llm_generation_ms?: number;
    user_role?: string;
    chunks_retrieved?: number;
  };
  timestamp?: string;
}

export interface BenchmarkScorecard {
  'Overall Accuracy': string;
  'Tests Passed': number;
  'Total Test Cases': number;
  'Avg Retrieval Latency': string;
  'RBAC Access Security': string;
}

export interface BenchmarkResult {
  'Test ID': string;
  'Category': string;
  'Role Used': string;
  'Status': 'PASS' | 'FAIL';
  'Retrieval Hit': string;
}
