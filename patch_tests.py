import sys

file_path = "backend/tests/test_tools.py"
with open(file_path, 'r') as f:
    content = f.read()

tests_code = """
    def test_knowledge_tool_valid_queries_succeed_and_missing_are_rejected(self):
        expected = SearchKnowledgeResponse(
            context="[Knowledge source: Info]\\nSome context.",
            sources=[KnowledgeSource(id=uuid4(), title="Info", relevance=0.5)],
            retrieval_mode="full_text",
        )
        with patch.object(ToolService, "search_knowledge", AsyncMock(return_value=expected)) as mock_method:
            # valid short question
            res = self.send("/api/v1/tools/search-knowledge", {"question": "Delivery?"})
            self.assertEqual(res.status_code, 200)

            # valid long natural-language question
            res = self.send("/api/v1/tools/search-knowledge", {"question": "What photography services do you offer for clothing brands?"})
            self.assertEqual(res.status_code, 200)

            # empty input
            res = self.send("/api/v1/tools/search-knowledge", {"question": ""})
            self.assertEqual(res.status_code, 422)

            # whitespace-only input
            res = self.send("/api/v1/tools/search-knowledge", {"question": "   "})
            self.assertEqual(res.status_code, 422)
            
            # missing input
            res = self.send("/api/v1/tools/search-knowledge", {})
            self.assertEqual(res.status_code, 422)

    def test_knowledge_tool_graceful_no_match(self):
        expected = SearchKnowledgeResponse(
            context="",
            sources=[],
            retrieval_mode="full_text",
        )
        with patch.object(ToolService, "search_knowledge", AsyncMock(return_value=expected)) as mock_method:
            # no-match knowledge query returns HTTP 200 with empty context
            res = self.send("/api/v1/tools/search-knowledge", {"question": "Is this a valid question?"})
            self.assertEqual(res.status_code, 200)
            self.assertEqual(res.json()["context"], "")
            self.assertEqual(res.json()["sources"], [])
"""

bad_code = """
    def test_knowledge_tool_valid_queries_succeed_and_missing_are_rejected(self):
        expected = SearchKnowledgeResponse(
            context="[Knowledge source: Info]\nSome context.",
            sources=[KnowledgeSource(id=uuid4(), title="Info", relevance=0.5)],
            retrieval_mode="full_text",
        )
        with patch.object(ToolService, "search_knowledge", AsyncMock(return_value=expected)) as mock_method:
            # valid short question
            res = self.send("/api/v1/tools/search-knowledge", {"question": "Delivery?"})
            self.assertEqual(res.status_code, 200)

            # valid long natural-language question
            res = self.send("/api/v1/tools/search-knowledge", {"question": "What photography services do you offer for clothing brands?"})
            self.assertEqual(res.status_code, 200)

            # empty input
            res = self.send("/api/v1/tools/search-knowledge", {"question": ""})
            self.assertEqual(res.status_code, 422)

            # whitespace-only input
            res = self.send("/api/v1/tools/search-knowledge", {"question": "   "})
            self.assertEqual(res.status_code, 422)
            
            # missing input
            res = self.send("/api/v1/tools/search-knowledge", {})
            self.assertEqual(res.status_code, 422)

    def test_knowledge_tool_graceful_no_match(self):
        expected = SearchKnowledgeResponse(
            context="",
            sources=[],
            retrieval_mode="full_text",
        )
        with patch.object(ToolService, "search_knowledge", AsyncMock(return_value=expected)) as mock_method:
            # no-match knowledge query returns HTTP 200 with empty context
            res = self.send("/api/v1/tools/search-knowledge", {"question": "Is this a valid question?"})
            self.assertEqual(res.status_code, 200)
            self.assertEqual(res.json()["context"], "")
            self.assertEqual(res.json()["sources"], [])
"""

if bad_code in content:
    content = content.replace(bad_code, tests_code)
    with open(file_path, 'w') as f:
        f.write(content)
    print("Fixed tests script successfully.")
else:
    print("Could not find bad code")
