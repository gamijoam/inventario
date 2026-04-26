#!/usr/bin/env python3
with open('/root/deploy/qa/code/ferreteria_refactor/backend_api/routers/inventory.py', 'r') as f:
    lines = f.readlines()

# Remove all logging lines after "data = request.model_dump()"
# and replace with proper logging
new_lines = []
skip_until_return = False
for i, line in enumerate(lines):
    if 'data = request.model_dump()' in line:
        new_lines.append(line)
        new_lines.append('    logger = logging.getLogger(__name__)\n')
        new_lines.append('    logger.warning(f"[ROUTER] source_schema from request={request.source_schema}")\n')
        new_lines.append('    logger.warning(f"[ROUTER] data.keys={list(data.keys())}")\n')
        skip_until_return = True
    elif skip_until_return and 'logger = logging.getLogger(__name__);' in line:
        continue  # Skip old logging line
    elif skip_until_return and 'return InventoryService.process_transfer_package_v2' in line:
        skip_until_return = False
        new_lines.append(line)
    else:
        new_lines.append(line)

with open('/root/deploy/qa/code/ferreteria_refactor/backend_api/routers/inventory.py', 'w') as f:
    f.writelines(new_lines)

print("Done")