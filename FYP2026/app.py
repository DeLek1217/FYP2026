import streamlit as st
import pandas as pd
import sqlite3
from auditor_agent import AuditorAgent  # Importing the class we just made

# --- PAGE SETUP ---
st.set_page_config(layout="wide", page_title="ReguBot Prototype")
st.title("🤖 ReguBot: Autonomous Compliance Auditor")

# Initialize Session State
if 'generated_sql' not in st.session_state:
    st.session_state.generated_sql = ""
if 'audit_results' not in st.session_state:
    st.session_state.audit_results = None

# --- SIDEBAR ---
role = st.sidebar.radio("Select Module:", ["Module 2: Auditor (Execute)", "Module 1: Reader (Simulated)"])

if role == "Module 2: Auditor (Execute)":
    st.header("⚡ Module 2: Automated SQL Audit")
    st.info("Responsible: Wong De Lek")

    # 1. Input Rule
    rule_input = st.text_area("Regulatory Rule:", 
                              "Find all DEPOSIT transactions where the amount is greater than 25000.")

    col1, col2 = st.columns(2)

    # 2. Generate SQL
    with col1:
        if st.button("Generate SQL Audit Logic"):
            with st.spinner("Translating English to SQL..."):
                try:
                    # Initialize the agent (this uses your API key)
                    agent = AuditorAgent() 
                    sql_code = agent.generate_audit_query(rule_input)
                    st.session_state.generated_sql = sql_code
                    st.session_state.audit_results = None
                    st.success("SQL Generated!")
                except Exception as e:
                    st.error(f"Error: {e}")

    # 3. Verify & Execute
    with col2:
        if st.session_state.generated_sql:
            st.markdown("### 🔍 Verify Logic (Human-in-the-Loop)")
            verified_sql = st.text_area("Review Code:", st.session_state.generated_sql, height=150)
            
            if st.button("✅ Approve & Execute"):
                conn = sqlite3.connect("banking_data.sqlite")
                try:
                    results = pd.read_sql_query(verified_sql, conn)
                    st.session_state.audit_results = results
                    st.success(f"Audit Complete! {len(results)} violations found.")
                except Exception as e:
                    st.error(f"SQL Execution Failed: {e}")
                finally:
                    conn.close()

    # 4. Display Results
    if st.session_state.audit_results is not None:
        st.divider()
        st.subheader("🚩 Detected Violations")
        st.dataframe(st.session_state.audit_results, use_container_width=True)