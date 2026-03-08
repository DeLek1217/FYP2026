import os
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI

# Load your secret API key
load_dotenv()

class AuditorAgent:
    def __init__(self, db_path="banking_data.sqlite"):
        # Initialize the newest Gemini Brain
        self.llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            temperature=0
        )

    def generate_audit_query(self, rule):
        try:
            # The "Cheat Sheet" telling Gemini the exact table and column names
            schema_info = """
            Table Name: transaction_ledger
            Columns: transaction_id, transaction_date, customer_name, customer_id, transaction_type, amount, currency, beneficiary_country, source_of_funds, risk_score
            """
            
            prompt = (
                f"You are a SQL expert. \n"
                f"Schema: {schema_info}\n"
                f"Rule to check: {rule}\n"
                f"Task: Write a SQLite query to find all records that match this rule.\n"
                f"Requirement: Return ONLY the raw SQL code. Do not use markdown formatting like ```sql."
            )
            
            # Ask Gemini for the SQL
            response = self.llm.invoke(prompt)
            raw_output = response.content
            
            # Clean up the output safely
            if isinstance(raw_output, list):
                raw_output = raw_output[0].get("text", "")
                
            sql_code = raw_output.replace("```sql", "").replace("```", "").strip()
            
            return sql_code
            
        except Exception as e:
            return f"Error generating SQL: {str(e)}"