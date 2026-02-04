import os
import google.generativeai as genai

# 1. Setup your key (I included the code to read it from environment or paste it)
# PASTE YOUR KEY BELOW IF NOT SET IN ENVIRONMENT
os.environ["GOOGLE_API_KEY"] = "AIzaSyBg1DAjAZUgUuSh9IoJP7eok5YGG1lUkxk"

genai.configure(api_key=os.environ["GOOGLE_API_KEY"])

print("Checking available models for your API key...")
try:
    for m in genai.list_models():
        # Only show models that support text generation (chat)
        if 'generateContent' in m.supported_generation_methods:
            print(f"- {m.name}")
except Exception as e:
    print(f"Error: {e}")