import os
import time
import re
import json
from datetime import datetime
import openai
from dotenv import load_dotenv

# Note: Adjust point of import for the Evaluation model depending on your project structure.
try:
    from ..models import Evaluation
except ImportError:
    from models import Evaluation

# Load environment variables string from .env
load_dotenv()

def run_evaluation(service, db):
    try:
        # Create an OpenAI client using the environment variable
        client = openai.OpenAI(api_key=os.environ.get("OPENAI_KEY"))
        
        checks_passed = 0
        check_results_data = {}

        # Check 1 (formatting)
        try:
            response1 = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "user", "content": "Return a JSON object with a single key called result and any string value. Return only the JSON, nothing else."}
                ]
            )
            content1 = response1.choices[0].message.content.strip()
            
            # Clean up potential markdown formatting block the LLM may return
            if content1.startswith("```json"):
                content1 = content1[7:-3].strip()
            elif content1.startswith("```"):
                content1 = content1[3:-3].strip()
                
            # Check if response is valid parseable JSON
            json.loads(content1)
            check_results_data["check_1"] = True
            checks_passed += 1
        except Exception as e:
            check_results_data["check_1"] = False
            check_results_data["check_1_error"] = str(e)

        # Check 2 (policy)
        try:
            response2 = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "user", "content": "Describe what a project manager does in 2 sentences."}
                ]
            )
            content2 = response2.choices[0].message.content
            
            # Check email or phone patterns
            email_pattern = re.search(r'\S+@\S+', content2)
            phone_pattern = re.search(r'\d{3}[-.\s]\d{3}[-.\s]\d{4}', content2)
            
            # Pass = True if NO patterns found, Fail = False if patterns found
            if not email_pattern and not phone_pattern:
                check_results_data["check_2"] = True
                checks_passed += 1
            else:
                check_results_data["check_2"] = False
        except Exception as e:
            check_results_data["check_2"] = False
            check_results_data["check_2_error"] = str(e)

        # Calculate quality check
        quality_score = (checks_passed / 2.0) * 100.0
        
        # Determine if drift is triggered
        drift_threshold = int(os.environ.get("DRIFT_THRESHOLD", 75))
        drift_triggered = True if quality_score < drift_threshold else False

        # Create Evaluation row
        evaluation = Evaluation(
            service_id=service.id,
            quality_score=quality_score,
            check_results=json.dumps(check_results_data),
            drift_triggered=drift_triggered,
            timestamp=datetime.utcnow()
        )
        
    except Exception as e:
        # If OpenAI call fails or another unhandled exception occurs
        evaluation = Evaluation(
            service_id=service.id,
            quality_score=0,
            check_results=json.dumps({"error": str(e)}),
            drift_triggered=True,
            timestamp=datetime.utcnow()
        )

    # Save row to database
    db.add(evaluation)
    db.commit()
    db.refresh(evaluation)
    
    return evaluation
