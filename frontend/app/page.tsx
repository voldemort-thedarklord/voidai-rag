"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth, SignInButton, SignUpButton } from "@clerk/nextjs";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import ChatPanel from "@/components/ChatPanel";
import DocInspector from "@/components/DocInspector";
import IngestModal from "@/components/IngestModal";
import {
  fetchDocuments,
  fetchDocumentPage,
  deleteDocument,
  uploadDocument,
  sendChatMessage,
  fetchChatHistory,
  clearChatHistory,
} from "@/lib/api";
import { DocumentItem, ChatMessage } from "@/types";
import { MessageSquare, Files, FileText } from "lucide-react";

export default function WorkspacePage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  // Mobile tab state: 'chat' | 'docs' | 'viewer'
  const [mobileTab, setMobileTab] = useState<"chat" | "docs" | "viewer">("chat");

  // Repository state
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
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

  // Modal
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  // Load documents
  const loadDocuments = useCallback(async () => {
    setDocsLoading(true);
    try {
      const token = await getToken();
      const data = await fetchDocuments(token || undefined);
      setDocuments(data.documents || []);
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

  useEffect(() => {
    if (isSignedIn) {
      loadDocuments();
      loadHistory();
    }
  }, [isSignedIn, loadDocuments, loadHistory]);

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
      const res = await sendChatMessage(query, selectedDocs, token || undefined);

      const assistantMsg: ChatMessage = {
        id: `asst-${Date.now()}`,
        sender: "assistant",
        text: res.answer || "No response generated.",
        citations: res.citations || [],
        metrics: res.metrics,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      if (res.citations && res.citations.length > 0) {
        const first = res.citations[0];
        loadDocPage(first.source, first.page, first.excerpt_snippet || "");
      }
    } catch (err: any) {
      console.error("Chat error:", err);
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: "assistant",
        text: `Error: ${err.message}`,
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleUploadSingle = async (file: File) => {
    // Request a fresh session token before each file upload to avoid expiration during long batch transfers
    let token: string | null = null;
    try {
      token = await getToken({ skipCache: true });
    } catch {
      token = await getToken();
    }
    await uploadDocument(file, token || undefined);
    await loadDocuments();
  };

  const handleDeleteDoc = async (filename: string) => {
    if (!confirm(`Delete ${filename}?`)) return;
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

  const handleCitationClick = (
    source: string,
    page: number,
    snippet: string
  ) => {
    loadDocPage(source, page, snippet);
    // On mobile, auto-switch to viewer so user sees the highlighted citation
    setMobileTab("viewer");
  };

  const handleClearChat = async () => {
    if (!confirm("Are you sure you want to clear your entire chat history?")) return;
    try {
      const token = await getToken();
      await clearChatHistory(token || undefined);
      setMessages([]);
    } catch (err) {
      console.error("Failed to clear chat history:", err);
      alert("Failed to clear chat history. Please try again.");
    }
  };

  const handleSelectDoc = (source: string) => {
    loadDocPage(source, 1);
    // On mobile, auto-switch to viewer
    setMobileTab("viewer");
  };

  const handleZoom = (delta: number) => {
    setZoom((prev) => Math.max(70, Math.min(140, prev + delta)));
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      loadDocPage(activeDocName, newPage, highlightPhrase);
    }
  };

  // Simple clean login state when signed out
  if (isLoaded && !isSignedIn) {
    return (
      <div className="min-h-screen bg-[#000000] text-[#E5E5E5] flex flex-col justify-center items-center p-6 font-sans">
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="flex items-center justify-center space-x-2">
            <div className="w-5 h-5 border border-white/20 bg-[#141414] rounded flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-xs"></div>
            </div>
            <span className="text-base font-semibold tracking-wide text-white lowercase font-mono">
              voidai
            </span>
          </div>

          <div className="space-y-1">
            <h1 className="text-sm font-medium text-white">
              Sign in to voidai
            </h1>
            <p className="text-xs text-[#737373]">
              Upload documents and ask questions with exact citations.
            </p>
          </div>

          <div className="flex items-center justify-center space-x-3 pt-2 font-mono">
            <SignInButton mode="modal">
              <button className="px-5 py-2 text-xs font-semibold text-black bg-white hover:bg-[#E5E5E5] active:scale-95 rounded-md transition">
                Sign in
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="px-5 py-2 text-xs text-[#D4D4D4] hover:text-white bg-[#141414] border border-[#222222] hover:border-[#525252] active:scale-95 rounded-md transition">
                Sign up
              </button>
            </SignUpButton>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#000000] text-[#E5E5E5] flex flex-col justify-between p-2.5 sm:p-5">
      {/* Header */}
      <Header onOpenUpload={() => setIsUploadOpen(true)} />

      {/* Main Container */}
      <main className="w-full max-w-[1420px] mx-auto my-2 sm:my-3 flex-1 flex flex-col justify-center">
        {/* Mobile View Switcher (< lg screens) */}
        <div className="lg:hidden flex items-center justify-around bg-[#0A0A0A] border border-[#222222] rounded-lg p-1 mb-2 font-mono text-xs select-none shadow-xs">
          <button
            type="button"
            onClick={() => setMobileTab("chat")}
            className={`flex-1 flex items-center justify-center space-x-1.5 py-1.5 rounded-md transition ${
              mobileTab === "chat"
                ? "bg-[#1F1F1F] text-white font-semibold shadow-xs"
                : "text-[#737373] hover:text-[#D4D4D4]"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Chat</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("docs")}
            className={`flex-1 flex items-center justify-center space-x-1.5 py-1.5 rounded-md transition ${
              mobileTab === "docs"
                ? "bg-[#1F1F1F] text-white font-semibold shadow-xs"
                : "text-[#737373] hover:text-[#D4D4D4]"
            }`}
          >
            <Files className="w-3.5 h-3.5" />
            <span>Docs ({documents.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("viewer")}
            className={`flex-1 flex items-center justify-center space-x-1.5 py-1.5 rounded-md transition ${
              mobileTab === "viewer"
                ? "bg-[#1F1F1F] text-white font-semibold shadow-xs"
                : "text-[#737373] hover:text-[#D4D4D4]"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Viewer{activeDocName ? " •" : ""}</span>
          </button>
        </div>

        {/* 3-Panel Workspace Container */}
        <div className="w-full bg-[#0A0A0A] border border-[#222222] rounded-xl overflow-hidden flex h-[calc(100dvh-130px)] sm:h-[calc(100dvh-110px)] lg:h-[calc(100vh-90px)] max-h-[860px] shadow-2xl">
          {/* Column 1: Documents Sidebar */}
          <div
            className={`w-full lg:w-auto h-full ${
              mobileTab === "docs" ? "flex" : "hidden lg:flex"
            }`}
          >
            <Sidebar
              documents={documents}
              selectedDocs={selectedDocs}
              onToggleSelectAll={handleToggleSelectAll}
              onToggleDoc={handleToggleDoc}
              onSelectDoc={handleSelectDoc}
              onDeleteDoc={handleDeleteDoc}
              onOpenUpload={() => setIsUploadOpen(true)}
              onRefresh={loadDocuments}
              loading={docsLoading}
            />
          </div>

          {/* Column 2: Chat Pane */}
          <div
            className={`w-full flex-1 h-full ${
              mobileTab === "chat" ? "flex" : "hidden lg:flex"
            }`}
          >
            <ChatPanel
              messages={messages}
              onSendMessage={handleSendMessage}
              onCitationClick={handleCitationClick}
              onClearChat={handleClearChat}
              selectedCount={selectedDocs.length}
              loading={chatLoading}
            />
          </div>

          {/* Column 3: Document Inspector */}
          <div
            className={`w-full lg:w-auto h-full ${
              mobileTab === "viewer" ? "flex" : "hidden lg:flex"
            }`}
          >
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
              onBackToChat={() => setMobileTab("chat")}
            />
          </div>
        </div>
      </main>

      {/* Upload Modal */}
      <IngestModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSingle={handleUploadSingle}
      />
    </div>
  );
}
