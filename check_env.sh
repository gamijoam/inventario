#!/bin/bash
echo "=== Checking Admin Panel API URL ==="
docker exec admin_panel_qa grep -r "api-qa" /usr/share/nginx/html/ 2>/dev/null | head -5

echo ""
echo "=== Checking Frontend API URL ==="
docker exec frontend_qa_server grep -r "api-qa" /usr/share/nginx/html/ 2>/dev/null | head -5

echo ""
echo "=== Container env vars ==="
docker exec admin_panel_qa env | grep -E 'VITE|API' || echo "No VITE/API vars"

echo ""
echo "=== Testing backend connectivity from admin container ==="
docker exec admin_panel_qa wget -O- -q http://backend_qa:8000/api/v1/health 2>&1 | head -3