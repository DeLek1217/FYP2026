import os
import json
from dotenv import load_dotenv
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_groq import ChatGroq

# Load environment variables securely
load_dotenv()

class ReaderAgent:
    def __init__(self):
        # Initialize Local Embeddings (Runs locally, 100% free, no rate limits)
        self.embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
        
        # Initialize Groq LLM (The ultra-fast inference engine)
        self.llm = ChatGroq(
            model="llama-3.3-70b-versatile",
            temperature=0,
            api_key=os.getenv("GROQ_API_KEY")
        )
        self.vector_store = None
        
        # Store full text for dynamic scanning and intent extraction
        self.full_document_text = "" 

    def ingest_pdf(self, pdf_file_path):
        """
        Reads a PDF, breaks it into chunks, and saves it in a searchable local index.
        """
        try:
            loader = PyPDFLoader(pdf_file_path)
            pages = loader.load()
            
            if not pages:
                return False, "PDF appears to be empty."

            # Store the full text of the PDF in memory for the Discovery Agent
            self.full_document_text = "\n".join([page.page_content for page in pages])

            # Split text into manageable chunks for the local vector store
            text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
            chunks = text_splitter.split_documents(pages)
            
            # Create the Vector Database (Search Index)
            self.vector_store = FAISS.from_documents(chunks, self.embeddings)
            return True, "PDF successfully indexed."
            
        except Exception as e:
            return False, f"Error reading PDF: {str(e)}"

    def auto_discover_rules(self):
        """
        Scans the entire uploaded document and dynamically extracts ALL rules.
        """
        if not self.full_document_text:
            return {"error": "No document loaded."}

        # Prompt formulated for robust zero-shot JSON extraction
        prompt = f"""
        You are an expert Compliance Data Extraction AI. 
        Read the regulatory document below and extract EVERY distinct transaction monitoring rule, threshold, or red flag.

        Document Text:
        {self.full_document_text}

        Task: Return a JSON array of objects. Each object must have:
        - "label": A short, 3-to-5 word title for the rule (e.g., "High-Value Deposits").
        - "text": A highly specific, single-sentence condition ready for a SQL agent (e.g., "Find all DEPOSIT transactions where amount > 50000").
        
        You must capture complex multi-condition rules if they exist (e.g., amount AND country AND status).
        Respond ONLY with a valid JSON array. No markdown, no explanations.
        """

        try:
            raw_response = self.llm.invoke(prompt).content
            cleaned_json = raw_response.replace("```json", "").replace("```", "").strip()
            rules_list = json.loads(cleaned_json)
            return {"status": "success", "rules": rules_list}
        except Exception as e:
            return {"error": f"Failed to dynamically parse document: {str(e)}"}
            
    def extract_rule_parameters(self, user_query):
        """
        Searches the PDF using a Manual RAG approach for custom user queries.
        Fallback method for manual text inputs bypassing the auto-discovery UI.
        """
        if not self.vector_store:
            return "Error: No document loaded. Please upload a PDF first."

        try:
            # Step 1: Context Retrieval
            relevant_docs = self.vector_store.similarity_search(user_query, k=3)
            context_text = "\n\n".join([doc.page_content for doc in relevant_docs])
            
            # Step 2: Generative Extraction
            prompt = (
                f"You are a Compliance Officer analyzing a regulatory document.\n\n"
                f"--- DOCUMENT CONTEXT ---\n"
                f"{context_text}\n"
                f"------------------------\n\n"
                f"Question: {user_query} \n"
                f"Task: Extract the specific regulatory condition mentioned in the context above. \n"
                f"Output Format: Write a single sentence describing the rule that can be passed to a SQL agent. \n"
                f"Example: 'Find all transactions where amount > 50000.' \n"
                f"Answer:"
            )
            
            response = self.llm.invoke(prompt)
            return response.content.strip()
            
        except Exception as e:
            return f"Extraction Failed: {str(e)}"
