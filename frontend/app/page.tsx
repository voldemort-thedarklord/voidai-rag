"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth, SignInButton, SignUpButton } from "@clerk/nextjs";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import ChatPanel from "@/components/ChatPanel";
import DocInspector from "@/components/DocInspector";
import IngestModal from "@/components/IngestModal";
import BenchmarkModal from "@/components/BenchmarkModal";
import {
  fetchDocuments,
  fetchDocumentPage,
  deleteDocument,
  uploadDocument,
  sendChatMessage,
  fetchChatHistory,
  runEvaluation,
} from "@/lib/api";
import { DocumentItem, ChatMessage, Citation } from "@/types";

export default function WorkspacePage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  // Navigation & Role
  const [currentRole, setCurrentRole] = useState("Admin");
  const [activeTab, setActiveTab] = useState("knowledge");

  // Repository state
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [totalChunks, setTotalChunks] = useState(0);
  const [storageMb, setStorageMb] = useState(0);
  const [docsLoading, setDocsLoading] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  // Inspector state
  const [activeDocName, setActiveDocName] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageContent, setPageContent] = useState("");
  const [highlightPhrase, setHighlightPhrase] = useState("");
  const [zoom, setZoom] = useState(100);

  // Modals
  const [isIngestOpen, setIsIngestOpen] = useState(false);
  const [isEvalOpen, setIsEvalOpen] = useState(false);

  // Load documents
  const loadDocuments = useCallback(async () => {
    setDocsLoading(true);
    try {
      const token = await getToken();
      const data = await fetchDocuments(token || undefined);
      setDocuments(data.documents || []);
      setTotalChunks(data.total_chunks || 0);
      setStorageMb(data.storage_mb || 0);
      // Select all by default
      setSelectedDocs((data.documents || []).map((d) => d.source));
    } catch (err) {
      console.error("Failed to load documents:", err);
    } finally {
      setDocsLoading(false);
    }
  }, [getToken]);

  // Load chat history
  const loadHistory = useCallback(async () => {
    try {
      const token = await getToken();
      const data = await fetchChatHistory(token || undefined);
      if (data.history && data.history.length > 0) {
        const loadedMsgs: ChatMessage[] = [];
        data.history.forEach((h, idx) => {
          loadedMsgs.push({
            id: `hist-user-${idx}`,
            sender: "user",
            text: h.query,
          });
          loadedMsgs.push({
            id: `hist-asst-${idx}`,
            sender: "assistant",
            text: h.answer,
            citations: h.citations,
            metrics: h.metrics,
          });
        });
        setMessages(loadedMsgs);
      }
    } catch (err) {
      console.error("Failed to load history:", err);
    }
  }, [getToken]);

  // Initialize data once auth is ready
  useEffect(() => {
    if (isSignedIn) {
      loadDocuments();
      loadHistory();
    }
  }, [isSignedIn, loadDocuments, loadHistory]);

  // Handle document page fetch
  const loadDocPage = async (
    filename: string,
    page: number = 1,
    phrase: string = ""
  ) => {
    if (!filename) return;
    setActiveDocName(filename);
    setCurrentPage(page);
    setHighlightPhrase(phrase);

    try {
      const token = await getToken();
      const data = await fetchDocumentPage(filename, page, token || undefined);
      setPageContent(data.text || "");
      setTotalPages(data.total_pages || 1);
    } catch (err) {
      console.error("Failed to load document page:", err);
      setPageContent("");
    }
  };

  // Chat submission
  const handleSendMessage = async (query: string) => {
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: query,
    };
    setMessages((prev) => [...prev, userMsg]);
    setChatLoading(true);

    try {
      const token = await getToken();
      const res = await sendChatMessage(query, currentRole, token || undefined);

      const assistantMsg: ChatMessage = {
        id: `asst-${Date.now()}`,
        sender: "assistant",
        text: res.answer || "No response generated.",
        citations: res.citations || [],
        metrics: res.metrics,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // Automatically inspect the first citation if present
      if (res.citations && res.citations.length > 0) {
        const first = res.citations[0];
        loadDocPage(first.source, first.page, first.excerpt_snippet || "");
      }
    } catch (err: any) {
      console.error("Chat error:", err);
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: "assistant",
        text: `Error processing query: ${err.message}`,
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setChatLoading(false);
    }
  };

  // Document management
  const handleUpload = async (file: File, dept: string) => {
    const token = await getToken();
    await uploadDocument(file, dept, token || undefined);
    await loadDocuments();
  };

  const handleDeleteDoc = async (filename: string) => {
    if (!confirm(`Permanently delete ${filename} from database and vector index?`)) {
      return;
    }
    const token = await getToken();
    await deleteDocument(filename, token || undefined);
    if (activeDocName === filename) {
      setActiveDocName("");
      setPageContent("");
    }
    await loadDocuments();
  };

  const handleToggleSelectAll = (checked: boolean) => {
    setSelectedDocs(checked ? documents.map((d) => d.source) : []);
  };

  const handleToggleDoc = (source: string) => {
    setSelectedDocs((prev) =>
      prev.includes(source)
        ? prev.filter((s) => s !== source)
        : [...prev, source]
    );
  };

  // Citation click handler
  const handleCitationClick = (
    source: string,
    page: number,
    snippet: string
  ) => {
    loadDocPage(source, page, snippet);
  };

  // Zoom handlers
  const handleZoom = (delta: number) => {
    setZoom((prev) => Math.max(70, Math.min(140, prev + delta)));
  };

  // Page handlers
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      loadDocPage(activeDocName, newPage, highlightPhrase);
    }
  };

  // Unauthenticated landing state
  if (isLoaded && !isSignedIn) {
    return (
      <div className="min-h-screen bg-[#000000] text-[#E5E5E5] flex flex-col justify-between p-6">
        <header className="w-full max-w-4xl mx-auto flex items-center justify-between py-4 border-b border-[#222222]">
          <div className="flex items-center space-x-3">
            <div className="w-6 h-6 border border-white/20 bg-[#141414] rounded flex items-center justify-center">
              <div className="w-2.5 h-2.5 bg-white rounded-sm"></div>
            </div>
            <div className="flex items-center space-x-2 font-mono">
              <span className="text-xs font-semibold tracking-wider uppercase text-white">VOIDAI</span>
              <span className="text-[10px] text-[#737373]">// enterprise gateway</span>
            </div>
          </div>
          <div className="text-[11px] font-mono text-[#737373] flex items-center space-x-2">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
            <span>PROTECTED GATEWAY</span>
          </div>
        </header>

        <main className="w-full max-w-md mx-auto my-auto text-center space-y-6 font-mono py-12">
          <div className="w-12 h-12 mx-auto rounded-lg border border-[#333333] bg-[#0A0A0A] flex items-center justify-center text-white text-lg">
            ∅
          </div>
          <div className="space-y-2">
            <h1 className="text-sm font-semibold tracking-widest uppercase text-white">
              Enterprise Identity Access Required
            </h1>
            <p className="text-xs text-[#737373] font-sans max-w-sm mx-auto">
              Authenticate via Clerk to access confidential internal documents, dense semantic retrieval, and citations.
            </p>
          </div>

          <div className="flex items-center justify-center space-x-3 pt-2">
            <SignInButton mode="modal">
              <button className="px-5 py-2 text-xs font-mono font-semibold text-black bg-white hover:bg-[#E5E5E5] rounded-md transition tracking-wider">
                SIGN IN →
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="px-5 py-2 text-xs font-mono text-[#D4D4D4] hover:text-white bg-[#141414] border border-[#222222] hover:border-[#525252] rounded-md transition tracking-wider">
                SIGN UP
              </button>
            </SignUpButton>
          </div>
        </main>

        <footer className="w-full max-w-4xl mx-auto flex items-center justify-between text-[11px] font-mono text-[#525252] py-3 border-t border-[#141414]">
          <div>VOIDAI // AUTONOMOUS ENTERPRISE DOCUMENT ASSISTANT</div>
          <div>ZERO-TRUST ARCHITECTURE</div>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#000000] text-[#E5E5E5] flex flex-col justify-between p-3 sm:p-5">
      {/* Top Header */}
      <Header
        currentRole={currentRole}
        onRoleChange={setCurrentRole}
        onOpenIngest={() => setIsIngestOpen(true)}
        onOpenEval={() => setIsEvalOpen(true)}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Main 3-Panel Workspace Container */}
      <main className="w-full max-w-[1420px] mx-auto my-3 flex-1 flex flex-col justify-center">
        <div className="w-full bg-[#0A0A0A] border border-[#222222] rounded-xl overflow-hidden flex flex-col h-[760px] shadow-2xl">
          {/* Window Chrome Bar */}
          <div className="h-9 bg-[#000000] border-b border-[#222222] px-4 flex items-center justify-between select-none font-mono">
            <div className="flex items-center space-x-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#333333] border border-[#525252]"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-[#222222] border border-[#333333]"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-[#222222] border border-[#333333]"></div>
            </div>

            <div className="flex items-center space-x-2 px-4 py-0.5 rounded bg-[#141414] border border-[#222222] text-[11px] text-[#A3A3A3]">
              <span className="text-[#D4D4D4]">voidai // zero-trust enterprise repository</span>
            </div>

            <div className="flex items-center space-x-2 text-[10px] text-[#737373]">
              <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
              <span>WORKSPACE ACTIVE</span>
            </div>
          </div>

          {/* Three Split Columns */}
          <div className="flex-1 flex overflow-hidden">
            {/* Column 1: Knowledge Base Sidebar */}
            <Sidebar
              documents={documents}
              selectedDocs={selectedDocs}
              onToggleSelectAll={handleToggleSelectAll}
              onToggleDoc={handleToggleDoc}
              onSelectDoc={(source) => loadDocPage(source, 1)}
              onDeleteDoc={handleDeleteDoc}
              onOpenIngest={() => setIsIngestOpen(true)}
              onRefresh={loadDocuments}
              loading={docsLoading}
            />

            {/* Column 2: Chat Pane */}
            <ChatPanel
              messages={messages}
              onSendMessage={handleSendMessage}
              onCitationClick={handleCitationClick}
              selectedCount={selectedDocs.length}
              loading={chatLoading}
            />

            {/* Column 3: Document Inspector */}
            <DocInspector
              filename={activeDocName}
              currentPage={currentPage}
              totalPages={totalPages}
              pageContent={pageContent}
              highlightPhrase={highlightPhrase}
              zoom={zoom}
              onPageChange={handlePageChange}
              onZoomChange={handleZoom}
              onClearHighlight={() => setHighlightPhrase("")}
            />
          </div>
        </div>
      </main>

      {/* Bottom Metrics Bar */}
      <footer className="w-full max-w-[1420px] mx-auto flex items-center justify-between text-[11px] font-mono text-[#737373] pt-2 border-t border-[#141414]">
        <div className="flex items-center space-x-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#525252]"></span>
          <span>HNSW VECTOR INDEX: CHROMADB</span>
        </div>
        <div className="text-[#A3A3A3] text-center">
          VOIDAI // DENSE SEMANTIC RETRIEVAL // GROUNDED REASONING WITH EXACT PAGE CITATIONS
        </div>
        <div className="flex items-center space-x-4 text-[#A3A3A3]">
          <span>
            CHUNKS: <strong className="text-white">{totalChunks}</strong>
          </span>
          <span>
            STORAGE: <strong className="text-white">{storageMb.toFixed(2)} MB</strong>
          </span>
          <span>TOP-K: 4</span>
        </div>
      </footer>

      {/* Modals */}
      <IngestModal
        isOpen={isIngestOpen}
        onClose={() => setIsIngestOpen(false)}
        onUpload={handleUpload}
      />

      <BenchmarkModal
        isOpen={isEvalOpen}
        onClose={() => setIsEvalOpen(false)}
        onRunBenchmark={async () => {
          const token = await getToken();
          return runEvaluation(token || undefined);
        }}
      />
    </div>
  );
}
