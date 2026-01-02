"""
Debug script to test Z-Report payload generation
"""
import sys
sys.path.insert(0, 'c:/Users/Gamijoam/Documents/ferreteria')

from ferreteria_refactor.backend_api.database.db import SessionLocal
from ferreteria_refactor.backend_api.services.sales_service import SalesService
import json

# Create DB session
db = SessionLocal()

try:
    # Test with session ID 1 (adjust if needed)
    session_id = 1
    
    print(f"Testing Z-Report payload generation for session {session_id}...")
    print("=" * 60)
    
    payload = SalesService.generate_z_report_payload(db, session_id)
    
    if not payload:
        print("❌ Payload is None - session not found")
    else:
        print("✅ Payload generated successfully")
        print("\n📋 TEMPLATE:")
        print("-" * 60)
        print(payload.get('template', 'NO TEMPLATE'))
        print("-" * 60)
        
        print("\n📊 CONTEXT:")
        print("-" * 60)
        context = payload.get('context', {})
        print(json.dumps(context, indent=2, default=str))
        print("-" * 60)
        
        # Test template rendering
        print("\n🔍 TESTING TEMPLATE RENDERING:")
        print("-" * 60)
        from jinja2 import Template
        template = Template(payload['template'])
        rendered = template.render(context)
        print(rendered)
        print("-" * 60)
        
finally:
    db.close()
