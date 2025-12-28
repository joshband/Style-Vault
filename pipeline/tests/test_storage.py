"""
Tests for Storage Abstraction

Unit tests for blob, structured, and vector storage.
"""

import pytest
from pipeline.storage import (
    InMemoryBlobStorage,
    InMemoryStructuredStorage,
    InMemoryVectorStorage,
    UnifiedStorage,
)


class TestInMemoryBlobStorage:
    """Tests for in-memory blob storage."""
    
    @pytest.mark.asyncio
    async def test_upload_download(self):
        storage = InMemoryBlobStorage()
        
        await storage.upload("test/image.png", b"image data", "image/png")
        data = await storage.download("test/image.png")
        
        assert data == b"image data"
    
    @pytest.mark.asyncio
    async def test_exists(self):
        storage = InMemoryBlobStorage()
        
        assert await storage.exists("nonexistent") is False
        
        await storage.upload("exists.txt", b"data")
        assert await storage.exists("exists.txt") is True
    
    @pytest.mark.asyncio
    async def test_delete(self):
        storage = InMemoryBlobStorage()
        
        await storage.upload("to_delete.txt", b"data")
        assert await storage.exists("to_delete.txt") is True
        
        await storage.delete("to_delete.txt")
        assert await storage.exists("to_delete.txt") is False
    
    @pytest.mark.asyncio
    async def test_get_url(self):
        storage = InMemoryBlobStorage()
        
        await storage.upload("file.txt", b"data")
        url = await storage.get_url("file.txt")
        
        assert url is not None
        assert "file.txt" in url


class TestInMemoryStructuredStorage:
    """Tests for in-memory structured storage."""
    
    @pytest.mark.asyncio
    async def test_save_get_style(self):
        storage = InMemoryStructuredStorage()
        
        artifact = {"styleId": "style_1", "tokens": {}}
        await storage.save_style("style_1", artifact)
        
        retrieved = await storage.get_style("style_1")
        assert retrieved == artifact
    
    @pytest.mark.asyncio
    async def test_delete_style(self):
        storage = InMemoryStructuredStorage()
        
        await storage.save_style("to_delete", {"id": "test"})
        assert await storage.get_style("to_delete") is not None
        
        await storage.delete_style("to_delete")
        assert await storage.get_style("to_delete") is None
    
    @pytest.mark.asyncio
    async def test_list_styles(self):
        storage = InMemoryStructuredStorage()
        
        await storage.save_style("s1", {"category": "ui"})
        await storage.save_style("s2", {"category": "brand"})
        await storage.save_style("s3", {"category": "ui"})
        
        all_styles = await storage.list_styles()
        assert len(all_styles) == 3
        
        ui_styles = await storage.list_styles(filters={"category": "ui"})
        assert len(ui_styles) == 2
    
    @pytest.mark.asyncio
    async def test_update_style(self):
        storage = InMemoryStructuredStorage()
        
        await storage.save_style("s1", {"name": "Original"})
        await storage.update_style("s1", {"name": "Updated"})
        
        style = await storage.get_style("s1")
        assert style["name"] == "Updated"
    
    @pytest.mark.asyncio
    async def test_pagination(self):
        storage = InMemoryStructuredStorage()
        
        for i in range(10):
            await storage.save_style(f"style_{i}", {"index": i})
        
        page1 = await storage.list_styles(limit=5, offset=0)
        assert len(page1) == 5
        
        page2 = await storage.list_styles(limit=5, offset=5)
        assert len(page2) == 5


class TestInMemoryVectorStorage:
    """Tests for in-memory vector storage."""
    
    @pytest.mark.asyncio
    async def test_upsert_get(self):
        storage = InMemoryVectorStorage()
        
        await storage.upsert("vec_1", [0.1, 0.2, 0.3], {"tag": "test"})
        
        result = await storage.get("vec_1")
        assert result is not None
        assert result["vector"] == [0.1, 0.2, 0.3]
        assert result["metadata"]["tag"] == "test"
    
    @pytest.mark.asyncio
    async def test_search(self):
        storage = InMemoryVectorStorage()
        
        await storage.upsert("v1", [1.0, 0.0, 0.0], {"name": "red"})
        await storage.upsert("v2", [0.0, 1.0, 0.0], {"name": "green"})
        await storage.upsert("v3", [0.9, 0.1, 0.0], {"name": "orange"})
        
        results = await storage.search([1.0, 0.0, 0.0], top_k=2)
        
        assert len(results) == 2
        assert results[0]["id"] == "v1"  # Most similar
        assert results[1]["id"] == "v3"  # Second most similar
    
    @pytest.mark.asyncio
    async def test_search_with_filters(self):
        storage = InMemoryVectorStorage()
        
        await storage.upsert("v1", [1.0, 0.0], {"category": "a"})
        await storage.upsert("v2", [0.9, 0.1], {"category": "b"})
        await storage.upsert("v3", [0.8, 0.2], {"category": "a"})
        
        results = await storage.search(
            [1.0, 0.0],
            top_k=10,
            filters={"category": "a"}
        )
        
        assert len(results) == 2
        assert all(r["metadata"]["category"] == "a" for r in results)
    
    @pytest.mark.asyncio
    async def test_delete(self):
        storage = InMemoryVectorStorage()
        
        await storage.upsert("to_delete", [0.5, 0.5])
        assert await storage.get("to_delete") is not None
        
        await storage.delete("to_delete")
        assert await storage.get("to_delete") is None


class TestUnifiedStorage:
    """Tests for unified storage interface."""
    
    @pytest.mark.asyncio
    async def test_save_and_get_style(self):
        storage = UnifiedStorage()
        
        await storage.save_style_artifact(
            style_id="unified_1",
            artifact={"tokens": {}, "components": []},
            embedding=[0.1, 0.2, 0.3]
        )
        
        style = await storage.get_style("unified_1")
        assert style is not None
    
    @pytest.mark.asyncio
    async def test_save_with_blobs(self):
        storage = UnifiedStorage()
        
        await storage.save_style_artifact(
            style_id="with_blobs",
            artifact={"tokens": {}},
            blobs={
                "preview.png": b"image data",
                "depth.png": b"depth data"
            }
        )
        
        style = await storage.get_style("with_blobs")
        assert "blobUrls" in style
        assert "preview.png" in style["blobUrls"]
    
    @pytest.mark.asyncio
    async def test_search_similar(self):
        storage = UnifiedStorage()
        
        await storage.save_style_artifact("s1", {"tokens": {}}, [1.0, 0.0])
        await storage.save_style_artifact("s2", {"tokens": {}}, [0.9, 0.1])
        await storage.save_style_artifact("s3", {"tokens": {}}, [0.0, 1.0])
        
        similar = await storage.search_similar_styles([1.0, 0.0], top_k=2)
        
        assert len(similar) == 2
        assert similar[0]["id"] == "s1"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
