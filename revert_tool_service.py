import sys

file_path = "backend/app/services/tool_service.py"
with open(file_path, 'r') as f:
    content = f.read()

old_code = """
        result = await self.knowledge.retrieve_relevant_knowledge(

            KnowledgeSearchRequest(

                company_id=self.company_id,
"""
new_code = """
        result = await self.knowledge.retrieve_relevant_knowledge(

            KnowledgeSearchRequest(

                company_id=request.company_id,
"""
if old_code in content:
    with open(file_path, 'w') as f:
        f.write(content.replace(old_code, new_code))
    print("Reverted.")
else:
    print("Not found.")
