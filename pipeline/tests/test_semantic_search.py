"""
Tests for Semantic Search

Unit tests for style search and recommendation.
"""

import pytest
from pipeline.search import (
    StyleIndexer,
    SemanticSearchEngine,
    create_search_engine,
)
from pipeline.storage import InMemoryVectorStorage, InMemoryStructuredStorage


class TestStyleIndexer:
    """Tests for style indexer."""
    
    @pytest.mark.asyncio
    async def test_index_style(self):
        vector_storage = InMemoryVectorStorage()
        indexer = StyleIndexer(vector_storage)
        
        await indexer.index_style(
            style_id="style_1",
            embedding=[0.1, 0.2, 0.3],
            tags=["modern", "minimal"],
            components=["button", "card"],
            materials=["glass"]
        )
        
        assert "style_1" in indexer.get_styles_by_tag("modern")
        assert "style_1" in indexer.get_styles_by_component("button")
        assert "style_1" in indexer.get_styles_by_material("glass")
    
    def test_get_styles_by_tag(self):
        vector_storage = InMemoryVectorStorage()
        indexer = StyleIndexer(vector_storage)
        
        indexer._tag_index["modern"] = ["s1", "s2"]
        indexer._tag_index["vintage"] = ["s3"]
        
        assert indexer.get_styles_by_tag("modern") == ["s1", "s2"]
        assert indexer.get_styles_by_tag("nonexistent") == []


class TestSemanticSearchEngine:
    """Tests for semantic search engine."""
    
    @pytest.fixture
    def engine(self):
        vector_storage = InMemoryVectorStorage()
        structured_storage = InMemoryStructuredStorage()
        return SemanticSearchEngine(vector_storage, structured_storage)
    
    @pytest.mark.asyncio
    async def test_text_to_embedding(self, engine):
        embedding = await engine.text_to_embedding("dark glossy audio UI")
        
        assert isinstance(embedding, list)
        assert len(embedding) > 0
        assert all(isinstance(x, float) for x in embedding)
    
    @pytest.mark.asyncio
    async def test_search(self, engine):
        await engine.vector_storage.upsert(
            "style_1",
            await engine.text_to_embedding("dark audio interface"),
            {"styleId": "style_1", "tags": ["dark", "audio"]}
        )
        
        results = await engine.search("dark UI", top_k=5)
        
        assert results.query == "dark UI"
        assert len(results.results) > 0
    
    @pytest.mark.asyncio
    async def test_find_similar(self, engine):
        embedding = [1.0, 0.0, 0.0]
        await engine.vector_storage.upsert("ref", embedding, {"name": "reference"})
        await engine.vector_storage.upsert("sim", [0.9, 0.1, 0.0], {"name": "similar"})
        await engine.vector_storage.upsert("diff", [0.0, 1.0, 0.0], {"name": "different"})
        
        results = await engine.find_similar("ref", top_k=5)
        
        assert len(results.results) > 0
        assert results.results[0].style_id == "sim"
    
    @pytest.mark.asyncio
    async def test_search_by_components(self, engine):
        await engine.indexer.index_style(
            "s1", [0.1, 0.2], ["modern"], ["button", "card"], []
        )
        await engine.indexer.index_style(
            "s2", [0.3, 0.4], ["vintage"], ["button"], []
        )
        await engine.indexer.index_style(
            "s3", [0.5, 0.6], ["modern"], ["card"], []
        )
        
        results = await engine.search_by_components(["button", "card"], top_k=5)
        
        assert len(results.results) > 0
        assert results.results[0].style_id == "s1"
        assert results.results[0].score == 1.0
    
    @pytest.mark.asyncio
    async def test_search_response_format(self, engine):
        await engine.vector_storage.upsert(
            "test",
            [0.5, 0.5],
            {"tags": ["test"]}
        )
        
        response = await engine.search("test query")
        d = response.to_dict()
        
        assert "query" in d
        assert "results" in d
        assert "totalMatches" in d
        assert "searchTimeMs" in d


class TestSearchExplanations:
    """Tests for explainable search results."""
    
    @pytest.fixture
    def engine(self):
        return SemanticSearchEngine(
            InMemoryVectorStorage(),
            InMemoryStructuredStorage()
        )
    
    def test_generate_explanation(self, engine):
        metadata = {"tags": ["modern", "dark"], "components": ["button"]}
        explanation = engine._generate_explanation("modern design", metadata)
        
        assert "modern" in explanation.lower()
    
    def test_generate_similarity_explanation(self, engine):
        ref = {"tags": ["modern", "minimal"], "components": ["card"]}
        match = {"tags": ["modern", "clean"], "components": ["card", "button"]}
        
        explanation = engine._generate_similarity_explanation(ref, match)
        
        assert "modern" in explanation.lower() or "card" in explanation.lower()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
