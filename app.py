"""
Enterprise Document Assistant - Streamlit Application
A modern, production-grade interface featuring semantic search,
source citations, Role-Based Access Control (RBAC), multi-format ingestion,
and an automated benchmark evaluation suite.
"""

import sys
from pathlib import Path
import streamlit as st
import pandas as pd
import plotly.express as px

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
    UPLOADS_DIR
)
from src.document_processor import DocumentProcessor
from src.vector_store import VectorStoreManager
from src.rag_pipeline import RAGPipeline
from src.llm_client import LLMClient
from src.evaluator import RAGEvaluator


# Page Configuration
st.set_page_config(
    page_title="Enterprise Document Assistant",
    page_icon="🏢",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS for polished enterprise look
st.markdown("""
<style>
    .main-header {
        font-size: 2.1rem;
        font-weight: 700;
        color: #1E293B;
        margin-bottom: 0.2rem;
    }
    .sub-header {
        font-size: 1.0rem;
        color: #64748B;
        margin-bottom: 1.5rem;
    }
    .metric-badge {
        display: inline-block;
        padding: 4px 10px;
        border-radius: 6px;
        background-color: #F1F5F9;
        color: #0F172A;
        font-weight: 600;
        font-size: 0.85rem;
        margin-right: 8px;
    }
    .citation-box {
        border-left: 3px solid #3B82F6;
        background-color: #F8FAFC;
        padding: 10px 14px;
        margin: 8px 0;
        border-radius: 0 6px 6px 0;
    }
    .rbac-tag {
        background-color: #EFF6FF;
        color: #1D4ED8;
        font-weight: 600;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 0.8rem;
    }
</style>
""", unsafe_allow_html=True)


# Initialize Session State
@st.cache_resource
def get_vector_store():
    return VectorStoreManager()

vector_store = get_vector_store()
rag_pipeline = RAGPipeline(vector_store=vector_store)

if "chat_history" not in st.session_state:
    st.session_state.chat_history = []


# ==========================================
# SIDEBAR CONFIGURATION
# ==========================================
with st.sidebar:
    st.title("🏢 Acme Enterprise RAG")
    st.caption("AI-Powered Knowledge Retrieval & Compliance")
    st.divider()

    # RBAC Role Selector
    st.subheader("👤 User Identity & RBAC")
    user_role = st.selectbox(
        "Current Active Role",
        options=list(ROLES_PERMISSIONS.keys()),
        index=0,
        help="Simulates enterprise role-based security. Governs which document departments are visible."
    )
    allowed_depts = ROLES_PERMISSIONS[user_role]
    st.markdown(
        f"**Authorized Depts:** " + " ".join([f"`{d}`" for d in allowed_depts])
    )
    st.divider()

    # LLM Settings
    st.subheader("⚙️ LLM Engine")
    provider_option = st.selectbox(
        "LLM Provider",
        options=["Local Ollama (Offline / Private)", "Groq (Fast Cloud)", "OpenAI", "Google Gemini"],
        index=0
    )

    provider_map = {
        "Local Ollama (Offline / Private)": "ollama",
        "Groq (Fast Cloud)": "groq",
        "OpenAI": "openai",
        "Google Gemini": "gemini"
    }
    selected_provider = provider_map[provider_option]

    # Model selector depending on provider
    if selected_provider == "ollama":
        available_models = LLMClient.get_available_ollama_models()
        selected_model = st.selectbox("Ollama Model", options=available_models, index=0)
    elif selected_provider == "groq":
        selected_model = st.selectbox("Groq Model", ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"], index=0)
    elif selected_provider == "openai":
        selected_model = st.selectbox("OpenAI Model", ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"], index=0)
    else:
        selected_model = st.selectbox("Gemini Model", ["gemini-1.5-flash", "gemini-2.0-flash"], index=0)

    top_k = st.slider("Retrieval Passages (Top-K)", min_value=1, max_value=8, value=DEFAULT_TOP_K)
    temperature = st.slider("Temperature (Hallucination Control)", min_value=0.0, max_value=0.7, value=0.1, step=0.05)

    st.divider()

    # Knowledge Base Stats & Seeding
    st.subheader("📚 Knowledge Base")
    total_chunks = vector_store.get_total_chunk_count()
    indexed_docs = vector_store.list_indexed_documents()
    st.write(f"**Documents Indexed:** {len(indexed_docs)}")
    st.write(f"**Total Chunks:** {total_chunks}")

    if st.button("🔄 Auto-Seed Sample Policies", use_container_width=True):
        processor = DocumentProcessor()
        seeded_count = 0

        # Department classification map for sample policies
        sample_dept_map = {
            "HR_Leave_and_Attendance_Policy.txt": "HR",
            "HR_Leave_and_Attendance_Policy.pdf": "HR",
            "IT_Security_and_BYOD_Guidelines.txt": "General",
            "IT_Security_and_BYOD_Guidelines.pdf": "General",
            "Finance_and_Travel_Expense_Policy.txt": "Finance",
            "Engineering_Coding_and_Deployment_Standard.txt": "Engineering",
            "Engineering_Coding_and_Deployment_Standard.docx": "Engineering",
            "Executive_Compensation_Matrix_Confidential.txt": "Executive"
        }

        with st.spinner("Indexing sample enterprise policies..."):
            for sample_file in SAMPLE_POLICIES_DIR.glob("*.*"):
                dept = sample_dept_map.get(sample_file.name, "General")
                chunks = processor.process_file(sample_file, department=dept)
                vector_store.add_chunks(chunks)
                seeded_count += len(chunks)

        st.success(f"Successfully indexed {seeded_count} chunks from sample policies!")
        st.rerun()


# ==========================================
# MAIN CONTENT TABS
# ==========================================
st.markdown('<div class="main-header">RAG-Powered Enterprise Document Assistant</div>', unsafe_allow_html=True)
st.markdown(
    '<div class="sub-header">BTech CSE AIML Portfolio Project • Grounded QA • Source Citations • RBAC Vector Filtering</div>',
    unsafe_allow_html=True
)

tab_chat, tab_docs, tab_rbac, tab_eval = st.tabs([
    "💬 Knowledge QA Assistant",
    "📁 Document Repository",
    "🛡️ RBAC Architecture",
    "📊 Evaluation & Viva Benchmark"
])


# ------------------------------------------
# TAB 1: KNOWLEDGE QA ASSISTANT
# ------------------------------------------
with tab_chat:
    col_input, col_suggestions = st.columns([3, 1])

    with col_suggestions:
        st.markdown("**💡 Try Sample Prompts:**")
        sample_queries = [
            "How many days of paid leave can an employee take?",
            "What is the maximum daily meal per-diem limit?",
            "What is the minimum unit test code coverage required?",
            "What is the executive bonus multiplier formula?",
            "Can employees bring pet dogs into the cafeteria?"
        ]
        for q in sample_queries:
            if st.button(q, key=f"btn_{q}"):
                st.session_state["active_prompt"] = q

    with col_input:
        default_query = st.session_state.pop("active_prompt", "")
        user_query = st.text_input(
            "Ask a question regarding company policies, technical manuals, or guidelines:",
            value=default_query,
            placeholder="e.g. How many days of paid leave can an employee take?"
        )
        submit_btn = st.button("🔍 Search & Generate Answer", type="primary")

    if submit_btn and user_query.strip():
        with st.spinner("Retrieving relevant passages and synthesizing grounded answer..."):
            result = rag_pipeline.run(
                query=user_query.strip(),
                user_role=user_role,
                provider=selected_provider,
                model=selected_model,
                top_k=top_k,
                temperature=temperature
            )

            # Store in session state
            st.session_state.chat_history.insert(0, result)

    # Render History / Active Result
    if st.session_state.chat_history:
        for idx, chat in enumerate(st.session_state.chat_history):
            st.markdown("---")
            q_col, meta_col = st.columns([3, 1])
            with q_col:
                st.markdown(f"### ❓ {chat['query']}")
            with meta_col:
                metrics = chat.get("metrics", {})
                st.markdown(f"<span class='metric-badge'>⏱️ {metrics.get('total_latency_ms', 0)} ms</span>", unsafe_allow_html=True)
                st.markdown(f"<span class='rbac-tag'>Role: {metrics.get('user_role')}</span>", unsafe_allow_html=True)

            # Display generated answer
            st.markdown("#### 💡 Grounded Response")
            st.markdown(chat["answer"])

            # Citations Section
            citations = chat.get("citations", [])
            if citations:
                with st.expander(f"📑 Verified Source Citations ({len(citations)} references found)", expanded=True):
                    for c_idx, cite in enumerate(citations, 1):
                        st.markdown(
                            f"""
                            <div class="citation-box">
                                <strong>[{c_idx}] Source: {cite['source']}</strong> (Page {cite['page']}) | 
                                <span class="rbac-tag">Dept: {cite['department']}</span> | 
                                <em>Similarity Score: {cite['similarity']:.2f}</em>
                                <br><small style="color: #475569;">"{cite['excerpt_snippet']}"</small>
                            </div>
                            """,
                            unsafe_allow_html=True
                        )

            # Retrieved chunks inspect
            retrieved = chat.get("retrieved_chunks", [])
            if retrieved:
                with st.expander("🔍 Inspect Raw Retrieved Passages (Evidence Context)"):
                    for i, doc in enumerate(retrieved, start=1):
                        st.markdown(f"**Chunk #{i} — Source: {doc['metadata'].get('source')} (Page {doc['metadata'].get('page')})**")
                        st.code(doc["text"], language="text")


# ------------------------------------------
# TAB 2: DOCUMENT REPOSITORY & INGESTION
# ------------------------------------------
with tab_docs:
    st.subheader("📁 Enterprise Document Management")
    st.caption("Upload new corporate documents or inspect currently indexed vector store files.")

    col_up, col_list = st.columns([1, 1])

    with col_up:
        st.markdown("#### 📤 Upload New Document")
        uploaded_file = st.file_uploader(
            "Choose a document (PDF, DOCX, or TXT)",
            type=["pdf", "docx", "txt", "md"]
        )
        upload_dept = st.selectbox(
            "Classify Document Department / RBAC Access",
            options=ALL_DEPARTMENTS,
            index=0,
            help="Designates which department role will have clearance to search this document."
        )

        if st.button("🚀 Process & Ingest Into Vector Database", type="primary", disabled=uploaded_file is None):
            if uploaded_file:
                # Save file to disk
                save_path = UPLOADS_DIR / uploaded_file.name
                with open(save_path, "wb") as f:
                    f.write(uploaded_file.getbuffer())

                with st.spinner("Extracting text, chunking, and embedding vectors..."):
                    processor = DocumentProcessor()
                    chunks = processor.process_file(save_path, department=upload_dept)
                    count = vector_store.add_chunks(chunks)

                st.success(f"Ingested '{uploaded_file.name}'! Created and stored {count} vector chunks under '{upload_dept}' department.")
                st.rerun()

    with col_list:
        st.markdown("#### 📚 Currently Indexed Documents")
        current_docs = vector_store.list_indexed_documents()
        if not current_docs:
            st.info("No documents are currently indexed. Click 'Auto-Seed Sample Policies' in the sidebar or upload a document!")
        else:
            df_docs = pd.DataFrame(current_docs)
            st.dataframe(df_docs, use_container_width=True)

            del_target = st.selectbox("Select document to delete", options=[d["source"] for d in current_docs])
            if st.button("🗑️ Delete Selected Document", type="secondary"):
                del_count = vector_store.delete_document(del_target)
                st.success(f"Deleted {del_count} chunks for '{del_target}' from vector store.")
                st.rerun()


# ------------------------------------------
# TAB 3: RBAC ARCHITECTURE
# ------------------------------------------
with tab_rbac:
    st.subheader("🛡️ Enterprise Role-Based Access Control (RBAC)")
    st.markdown("""
    In enterprise environments, employees must not have access to all internal documents. For instance:
    * A **Software Engineer** should not have access to **Executive Compensation** or **Confidential Board Minutes**.
    * A **Finance Analyst** should access **Travel Reimbursements & Budgets**, but not proprietary **DevSecOps source keys**.
    
    ### How our RAG System Enforces RBAC:
    1. **Metadata Tagging**: Every chunk ingested into ChromaDB is tagged with a `department` attribute (e.g. `General`, `HR`, `Engineering`, `Finance`, `Executive`).
    2. **Vector Space Filtering**: When a user queries the assistant, their role is resolved into an authorized list of departments.
    3. **Cryptographic / Partitioned Query**: ChromaDB's search query applies a strict metadata filter:
       ```python
       where={"department": {"$in": user_allowed_departments}}
       ```
    4. **Zero-Information Leakage**: Unauthorized chunks are never retrieved or passed into the LLM context window, completely eliminating access leakage.
    """)

    st.markdown("#### 📋 Role Permission Matrix")
    matrix_data = []
    for role, depts in ROLES_PERMISSIONS.items():
        row = {"Role": role}
        for dept in ALL_DEPARTMENTS:
            row[dept] = "✅ Allowed" if dept in depts else "❌ Denied"
        matrix_data.append(row)

    st.dataframe(pd.DataFrame(matrix_data), use_container_width=True)


# ------------------------------------------
# TAB 4: EVALUATION & VIVA BENCHMARK
# ------------------------------------------
with tab_eval:
    st.subheader("📊 RAG Evaluation & Viva Benchmark Suite")
    st.markdown("""
    Academic project presentations require rigorous testing and empirical metrics.
    This automated test harness benchmarks:
    * **Retrieval Precision@K**: Verifies the vector database pulls the exact source file.
    * **Grounding & Keyword Verification**: Confirms factual numbers (e.g. 24 PTO days, $75 meal allowance) are present in answers.
    * **Hallucination Defense**: Verifies the system rejects ungrounded/out-of-domain questions rather than inventing answers.
    * **RBAC Enforcement**: Proves that unauthorized roles are denied access to restricted policies.
    """)

    if st.button("▶️ Run Automated Benchmark Evaluation", type="primary"):
        evaluator = RAGEvaluator(pipeline=rag_pipeline)
        progress_bar = st.progress(0.0)
        status_text = st.empty()

        def update_progress(pct, msg):
            progress_bar.progress(pct)
            status_text.text(msg)

        bench_results = evaluator.run_benchmark(
            provider=selected_provider,
            model=selected_model,
            progress_callback=update_progress
        )

        st.markdown("### 🏆 Benchmark Scorecard")
        sc = bench_results["scorecard"]
        m_col1, m_col2, m_col3, m_col4 = st.columns(4)
        m_col1.metric("Overall Accuracy", sc["Overall Accuracy"])
        m_col2.metric("Tests Passed", f"{sc['Tests Passed']} / {sc['Total Test Cases']}")
        m_col3.metric("Avg Retrieval Latency", sc["Avg Retrieval Latency"])
        m_col4.metric("Avg Generation Latency", sc["Avg Generation Latency"])

        # Display details table
        st.markdown("#### 📋 Detailed Test Case Results")
        st.dataframe(bench_results["details_df"], use_container_width=True)

        # Plot Latency Comparison
        fig = px.bar(
            bench_results["details_df"],
            x="Test ID",
            y=["Retrieval Time (ms)", "Generation Time (ms)"],
            title="Latency Breakdown per Test Case (ms)",
            barmode="group",
            color_discrete_sequence=["#3B82F6", "#10B981"]
        )
        st.plotly_chart(fig, use_container_width=True)
