"""
Enterprise Document Assistant - Streamlit Wrapper
Renders the pixel-perfect Denser.ai-styled Dark Mode UI.
"""

from pathlib import Path
import streamlit as st
import streamlit.components.v1 as components

st.set_page_config(
    page_title="voidai — enterprise knowledge engine",
    page_icon="🏢",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# Hide Streamlit chrome for full immersion
st.markdown("""
<style>
    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
    header {visibility: hidden;}
    .block-container {
        padding: 0rem !important;
        max-width: 100% !important;
    }
</style>
""", unsafe_allow_html=True)

index_file = Path(__file__).resolve().parent / "static" / "index.html"
if index_file.exists():
    with open(index_file, "r", encoding="utf-8") as f:
        html_code = f.read()
    components.html(html_code, height=920, scrolling=True)
else:
    st.error("static/index.html not found.")
