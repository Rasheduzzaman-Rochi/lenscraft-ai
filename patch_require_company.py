import sys

def main():
    file_path = "backend/app/services/tool_service.py"
    with open(file_path, 'r') as f:
        content = f.read()
        
    old_code = """    def _require_company(
        self,
        company_id: UUID,
    ) -> None:

        if company_id != self.company_id:

            raise PermissionError(
"""
    new_code = """    def _require_company(
        self,
        company_id: UUID | None,
    ) -> None:

        if company_id is not None and company_id != self.company_id:

            raise PermissionError(
"""
    if old_code in content:
        content = content.replace(old_code, new_code)
        with open(file_path, 'w') as f:
            f.write(content)
        print("Success")
    else:
        print("Old code not found")

main()
