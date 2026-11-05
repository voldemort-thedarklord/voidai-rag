"use client";

import React, { useState } from "react";
import { BenchmarkScorecard, BenchmarkResult } from "@/types";
import { X } from "lucide-react";

interface BenchmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRunBenchmark: () => Promise<{
    scorecard: BenchmarkScorecard;
    results: BenchmarkResult[];
  }>;
}

export default function BenchmarkModal({
  isOpen,
  onClose,
  onRunBenchmark,
}: BenchmarkModalProps) {
  const [running, setRunning] = useState(false);
  const [scorecard, setScorecard] = useState<BenchmarkScorecard | null>(null);
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [statusMsg, setStatusMsg] = useState("Benchmark harness ready");

  if (!isOpen) return null;

  const handleRun = async () => {
    setRunning(true);
    setStatusMsg("Running benchmark test suite against indexed repository...");
    try {
      const data = await onRunBenchmark();
      setScorecard(data.scorecard);
      setResults(data.results);
      setStatusMsg("Benchmark complete. Real metrics recorded.");
    } catch (err: any) {
      setStatusMsg("Error running benchmark: " + err.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-[#0A0A0A] border border-[#222222] rounded-lg p-6 w-full max-w-3xl shadow-2xl space-y-4 max-h-[85vh] flex flex-col font-mono">
        <div className="flex justify-between items-center border-b border-[#222222] pb-3">
          <h3 className="text-xs font-semibold text-white tracking-wider uppercase">
            RAG Benchmark & Evaluation Suite
          </h3>
          <button onClick={onClose} className="text-[#737373] hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto flex-1 pr-1 text-xs">
          <p className="text-[#A3A3A3]">
            Automated verification testing across Factual QA, RBAC permission barriers, and Hallucination rejection.
          </p>

          {/* Scorecard Cards */}
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-[#141414] p-3 rounded border border-[#222222] text-center">
              <span className="text-[10px] text-[#737373] block uppercase">Precision</span>
              <span className="text-base font-bold text-white">
                {scorecard ? scorecard["Overall Accuracy"] : "--"}
              </span>
            </div>
            <div className="bg-[#141414] p-3 rounded border border-[#222222] text-center">
              <span className="text-[10px] text-[#737373] block uppercase">Test Pass</span>
              <span className="text-base font-bold text-white">
                {scorecard
                  ? `${scorecard["Tests Passed"]} / ${scorecard["Total Test Cases"]}`
                  : "--"}
              </span>
            </div>
            <div className="bg-[#141414] p-3 rounded border border-[#222222] text-center">
              <span className="text-[10px] text-[#737373] block uppercase">Latency</span>
              <span className="text-base font-bold text-white">
                {scorecard ? scorecard["Avg Retrieval Latency"] : "--"}
              </span>
            </div>
            <div className="bg-[#141414] p-3 rounded border border-[#222222] text-center">
              <span className="text-[10px] text-[#737373] block uppercase">Security</span>
              <span className="text-base font-bold text-white">
                {scorecard ? scorecard["RBAC Access Security"] : "--"}
              </span>
            </div>
          </div>

          {/* Results Table */}
          <div className="border border-[#222222] rounded overflow-hidden text-[11px]">
            {results.length === 0 ? (
              <div className="p-6 text-center text-[#737373]">
                No benchmark executed. Click &apos;RUN BENCHMARK SUITE&apos; below to evaluate performance against indexed documents.
              </div>
            ) : (
              <table className="w-full text-left border-collapse font-mono">
                <thead className="bg-[#141414] text-[#A3A3A3]">
                  <tr>
                    <th className="p-2 border-b border-[#222222]">ID</th>
                    <th className="p-2 border-b border-[#222222]">CATEGORY</th>
                    <th className="p-2 border-b border-[#222222]">ROLE</th>
                    <th className="p-2 border-b border-[#222222]">STATUS</th>
                    <th className="p-2 border-b border-[#222222]">HIT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#141414]">
                  {results.map((r) => (
                    <tr key={r["Test ID"]} className="hover:bg-[#141414]/50">
                      <td className="p-2 text-[#D4D4D4] font-bold">{r["Test ID"]}</td>
                      <td className="p-2 text-[#D4D4D4]">{r["Category"]}</td>
                      <td className="p-2 text-[#A3A3A3]">{r["Role Used"]}</td>
                      <td
                        className={`p-2 font-bold ${
                          r["Status"] === "PASS" ? "text-white" : "text-[#737373]"
                        }`}
                      >
                        {r["Status"]}
                      </td>
                      <td className="p-2">{r["Retrieval Hit"]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="flex justify-between items-center pt-3 border-t border-[#222222]">
          <span className="text-xs text-[#737373]">{statusMsg}</span>
          <button
            onClick={handleRun}
            disabled={running}
            className="px-4 py-1.5 bg-white hover:bg-[#E5E5E5] disabled:opacity-40 text-black text-xs font-semibold rounded"
          >
            {running ? "TESTING..." : "RUN BENCHMARK SUITE"}
          </button>
        </div>
      </div>
    </div>
  );
}
