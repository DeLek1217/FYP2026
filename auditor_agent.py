import os
import json
import time
from dotenv import load_dotenv
from langchain_groq import ChatGroq

# Load environment variables securely
load_dotenv()

class AuditorAgent:
    def __init__(self, db_path="banking_data.sqlite"):
        # Initialize the Groq LLM with Llama 3
        self.llm = ChatGroq(
            model="llama-3.3-70b-versatile",
            temperature=0,
            api_key=os.getenv("GROQ_API_KEY") 
        )
        
        # Define the relational schema mapping for the LLM
        self.schema_info = """
        Database contains 3 relational tables:
        
        Table 1: customers
        - Columns: customer_id (PK), full_name, dob, nationality, industry, annual_income_myr, is_pep (1/0), kyc_risk_rating
        
        Table 2: accounts
        - Columns: account_id (PK), customer_id (FK), account_type, date_opened, current_balance_myr, account_status
        
        Table 3: transactions
        - Columns: transaction_id (PK), account_id (FK), timestamp, transaction_type, amount_myr, beneficiary_country, is_cross_border (1/0), source_of_funds, calculated_risk_score
        
        CRITICAL SQL INSTRUCTIONS:
        - To get Customer details for a Transaction, you MUST JOIN transactions -> accounts -> customers.
        - ALWAYS SELECT t.transaction_id, c.full_name AS customer_name, c.industry, c.is_pep, c.annual_income_myr, a.account_status, t.timestamp AS transaction_date, t.amount_myr AS amount, t.calculated_risk_score AS risk_score, t.beneficiary_country, t.transaction_type, t.is_cross_border, t.source_of_funds
        - NEW REQUIREMENT: You MUST include a column named `violation_reason` in your SELECT clause. If auditing multiple rules, use a `CASE WHEN ... THEN ... ELSE 'Multiple Violations' END AS violation_reason` statement to label EXACTLY which rule was broken (e.g., 'Sanctioned Country', 'High-Value Deposit', 'Unknown Fund Source'). If only one rule is provided, just use a static string like `'High-Value Deposit' AS violation_reason`.
        """

    def run_agentic_workflow(self, rule, retries=2):
        # Initialize execution log array
        thought_process = [
            {"type": "thought", "text": f"Analyzing intent for input: '{rule[:50]}...'"},
            {"type": "action", "text": "Determining if database retrieval is required."}
        ]

        # Formulate prompt for single-pass JSON execution
        combined_prompt = f"""
        You are an expert FinTech Compliance Auditor.
        Input: '{rule}'
        Database Schema: {self.schema_info}

        Task:
        1. Formulate a brief compliance strategy explaining this rule or answering the question.
        2. INTENT CLASSIFICATION: Determine if the input requires querying the database for specific transactions. 
           - If YES (e.g., finding specific transactions or violations), write the raw SQLite query.
           - If NO (e.g., it is just a general question about policies), leave the sql_code completely empty ("").

        You MUST respond ONLY with a valid JSON object matching this exact structure:
        {{
            "strategy": "your explanation here",
            "sql_code": "SELECT ... or empty string"
        }}
        """

        # Execute LLM call with built-in retry mechanism for resilience
        for attempt in range(retries):
            try:
                thought_process.append({"type": "thought", "text": f"Requesting inference from LLM Engine (Attempt {attempt + 1})..."})
                
                raw_response = self.llm.invoke(combined_prompt).content
                cleaned_json = raw_response.replace("```json", "").replace("```", "").strip()
                agent_data = json.loads(cleaned_json)
                
                strategy_response = agent_data.get("strategy", "Strategy generated.")
                sql_code = agent_data.get("sql_code", "")

                thought_process.append({"type": "thought", "text": "Successfully parsed intent and parameters."})

                if sql_code:
                    thought_process.append({"type": "action", "text": "Intent classified as DATA RETRIEVAL. Preparing SQL execution."})
                else:
                    thought_process.append({"type": "action", "text": "Intent classified as ADVISORY. No database execution required."})

                return {
                    "status": "success",
                    "strategy": strategy_response,
                    "thoughts": thought_process,
                    "sql_code": sql_code
                }

            except Exception as e:
                error_msg = str(e)
                wait_time = 3
                thought_process.append({"type": "error", "text": f"Parsing Error. Retrying in {wait_time}s... Error: {error_msg}"})
                time.sleep(wait_time) 
                continue
        
        return {"error": "Failed after multiple retries."}
