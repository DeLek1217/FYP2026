import os
import json
import time
from dotenv import load_dotenv
from langchain_groq import ChatGroq  # 👈 换成了 Groq!

# Load API key
load_dotenv()

class AuditorAgent:
    def __init__(self, db_path="banking_data.sqlite"):
        # 👈 这里换成了最强的开源模型 Llama 3.3 70B，并且连接你的 Groq API Key
        self.llm = ChatGroq(
            model="llama-3.3-70b-versatile",
            temperature=0,
            api_key=os.getenv("GROQ_API_KEY") 
        )
        self.schema_info = """
        Table Name: transaction_ledger
        Columns: transaction_id, transaction_date, customer_name, customer_id, transaction_type, amount, currency, beneficiary_country, source_of_funds, risk_score
        """

    def run_agentic_workflow(self, rule, mode="audit", retries=2):
        """
        Agentic Workflow powered by Llama 3 via Groq.
        """
        thought_process = [
            {"type": "thought", "text": f"Initializing Llama-3 Agent in {mode.upper()} mode..."},
            {"type": "action", "text": "Structuring payload for Groq LPU fast-inference engine."}
        ]

        # 同样使用 Prompt Batching，Llama 3 处理 JSON 也很强
        combined_prompt = f"""
        You are an expert FinTech Compliance Auditor.
        Rule: '{rule}'
        Database Schema: {self.schema_info}
        Mode: '{mode}'

        Task:
        1. Formulate a brief compliance strategy explaining why this rule matters (max 3 sentences).
        2. If Mode is 'audit', write the raw SQLite query to find matching records. 
           (For example: SELECT * FROM transaction_ledger WHERE amount > 50000)
        3. If Mode is 'advisory', leave the SQL field completely empty.

        You MUST respond ONLY with a valid JSON object matching this exact structure, with no extra text or markdown:
        {{
            "strategy": "your explanation here",
            "sql_code": "SELECT ... or empty string"
        }}
        """

        for attempt in range(retries):
            try:
                thought_process.append({"type": "thought", "text": f"Connecting to Groq Llama-3 Engine (Attempt {attempt + 1})..."})
                
                # Call Groq API (Super fast!)
                raw_response = self.llm.invoke(combined_prompt).content
                
                # 帮 Llama 3 擦屁股：清理多余的 Markdown 符号
                cleaned_json = raw_response.replace("```json", "").replace("```", "").strip()
                agent_data = json.loads(cleaned_json)
                
                strategy_response = agent_data.get("strategy", "Strategy generated.")
                sql_code = agent_data.get("sql_code", "")

                thought_process.append({"type": "thought", "text": "Successfully parsed JSON response from Llama-3."})

                if mode == "audit" and sql_code:
                    thought_process.append({"type": "action", "text": f"Executing translated SQL: {sql_code}"})

                return {
                    "status": "success",
                    "strategy": strategy_response,
                    "thoughts": thought_process,
                    "sql_code": sql_code
                }

            except Exception as e:
                error_msg = str(e)
                wait_time = 3
                thought_process.append({"type": "error", "text": f"Parsing Error or Rate Limit. Retrying in {wait_time}s... Error: {error_msg}"})
                time.sleep(wait_time) 
                continue
        
        return {"error": "Failed after multiple retries. The AI output might not be valid JSON."}
