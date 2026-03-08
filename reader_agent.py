import os
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI

class ReaderAgent:
    def __init__(self):
        # 1. Initialize Embeddings (Used to turn text into numbers/vectors)
        self.embeddings = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001")
        
        # 2. Initialize LLM (The Brain that answers questions about the PDF)
        self.llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            temperature=0
        )
        self.vector_store = None

    def ingest_pdf(self, pdf_file_path):
        """
        Reads a PDF, breaks it into small chunks, and saves it in a searchable index.
        """
        try:
            loader = PyPDFLoader(pdf_file_path)
            pages = loader.load()
            
            if not pages:
                return False, "PDF appears to be empty."

            # Split text into 1000-character chunks so Gemini can read it easily
            text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
            chunks = text_splitter.split_documents(pages)
            
            # Create the Vector Database (Search Index)
            self.vector_store = FAISS.from_documents(chunks, self.embeddings)
            return True, "PDF successfully indexed and ready for rules extraction."
            
        except Exception as e:
            return False, f"Error reading PDF: {str(e)}"

    def extract_rule_parameters(self, user_query):
        """
        Searches the PDF using a Manual RAG approach (Bypassing broken Chains).
        """
        if not self.vector_store:
            return "Error: No document loaded. Please upload a PDF first."

        try:
            # STEP 1: RETRIEVAL
            relevant_docs = self.vector_store.similarity_search(user_query, k=3)
            context_text = "\n\n".join([doc.page_content for doc in relevant_docs])
            
            # STEP 2 & 3: AUGMENTATION & GENERATION
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