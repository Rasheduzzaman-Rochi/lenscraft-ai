import sys

file_path = "backend/app/repositories/booking_repository.py"
with open(file_path, 'r') as f:
    content = f.read()

old_code = """
        if str(request.company_id) != self.company_id:
"""
new_code = """
        if request.company_id is not None and str(request.company_id) != self.company_id:
"""
if old_code in content:
    with open(file_path, 'w') as f:
        f.write(content.replace(old_code, new_code))
    print("Patched booking repo.")
else:
    print("Not found.")

