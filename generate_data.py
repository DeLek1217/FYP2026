Skip to content
DeLek1217
FYP2026
Repository navigation
Code
Issues
Pull requests
Actions
Projects
Wiki
Security
Insights
Settings
Files
Go to file
t
.env
App.jsx
BNM_AML_Directive_2026.pdf
README.md
auditor_agent.py
banking_data.sqlite
flask_app.py
generate_data.py
reader_agent.py
train_model.py
FYP2026
/
generate_data.py
in
testingchy

Edit

Preview
Indent mode

Spaces
Indent size

4
Line wrap mode

No wrap
Editing generate_data.py file contents
  1
  2
  3
  4
  5
  6
  7
  8
  9
 10
 11
 12
 13
 14
 15
 16
 17
 18
 19
 20
 21
 22
 23
 24
 25
 26
 27
 28
 29
 30
 31
 32
 33
 34
 35
 36
import sqlite3
import pandas as pd
import random
from faker import Faker
from datetime import datetime, timedelta

fake = Faker()

def generate_enterprise_db(num_cust=800, num_acc=1200, num_txn=5000):
    print("Architecting Enterprise 3-Tier Banking Database...")
    
    # --- 1. CUSTOMERS TABLE (KYC Data) ---
    customers = []
    industries = ['Technology', 'Real Estate', 'Retail', 'Unemployed', 'Student', 'Politics', 'Import/Export']
    nationalities = ['MY', 'SG', 'US', 'GB', 'CN', 'KP', 'IR', 'RU', 'AE']
    
    for _ in range(num_cust):
        customers.append({
            "customer_id": fake.unique.random_int(min=100000, max=999999),
            "full_name": fake.name(),
            "dob": fake.date_of_birth(minimum_age=18, maximum_age=80).strftime("%Y-%m-%d"),
            "nationality": random.choice(nationalities),
            "industry": random.choice(industries),
            "annual_income_myr": round(random.uniform(12000, 500000), 2),
            "is_pep": 1 if random.random() < 0.05 else 0, # 5% are Politically Exposed
            "kyc_risk_rating": random.choice(['Low', 'Medium', 'High'])
        })
    df_customers = pd.DataFrame(customers)

    # --- 2. ACCOUNTS TABLE ---
    accounts = []
    acc_types = ['Personal Savings', 'Current Account', 'Corporate Checking', 'Crypto Wallet']
    
    for _ in range(num_acc):
        cust = random.choice(customers)
        status = random.choices(['Active', 'Dormant', 'Frozen'], weights=[0.8, 0.15, 0.05])[0]
Use Control + Shift + m to toggle the tab key moving focus. Alternatively, use esc then tab to move to the next interactive element on the page.
 
