import os
from langchain_community.utilities import SQLDatabase
from langchain_community.agent_toolkits import create_sql_agent
from langchain_google_genai import ChatGoogleGenerativeAI

# --- CONFIGURATION ---
# PASTE YOUR GOOGLE GEMINI KEY BELOW
os.environ["GOOGLE_API_KEY"] = "AIzaSyBg1DAjAZUgUuSh9IoJP7eok5YGG1lUkxk"

class AuditorAgent:
    def __init__(self, db_path="banking_data.sqlite"):
        """
        Initializes the Auditor Agent using Google Gemini 2.0 Flash.
        """
        # 1. Connect to the Synthetic Database
        self.db = SQLDatabase.from_uri(f"sqlite:///{db_path}")
        
        # 2. Initialize the LLM
        # We selected "gemini-2.0-flash" from your available list
        self.llm = ChatGoogleGenerativeAI(
            model="gemini-flash-latest", 
            temperature=0,
            convert_system_message_to_human=True
        )
        
        # 3. Create the SQL Agent
        self.agent_executor = create_sql_agent(
            llm=self.llm,
            db=self.db,
            agent_type="zero-shot-react-description",
            verbose=True,
            handle_parsing_errors=True
        )

    def generate_audit_query(self, regulatory_rule):
        """
        Translates a natural language regulatory rule into an executable SQL query.
        """
        prompt = (
            f"You are an expert SQL Data Analyst. \n"
            f"Write a standard SQL query (sqlite) for the following rule: '{regulatory_rule}' \n"
            f"The table name is 'transaction_ledger'. \n"
            f"IMPORTANT: Return ONLY the raw SQL code. Do not use Markdown (```). Do not explain."
        )
        
        try:
            response = self.llm.invoke(prompt)
            clean_sql = response.content.replace("```sql", "").replace("```", "").strip()
            return clean_sql
        except Exception as e:
            return f"Error generating SQL: {str(e)}"

if __name__ == "__main__":
    # Test it immediately
    agent = AuditorAgent()
    print("Testing Gemini Connection...")
    print(agent.generate_audit_query("Find transactions over 50000"))