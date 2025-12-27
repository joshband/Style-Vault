"""
Tests for Job Queue System

Unit tests for async job-based execution.
"""

import pytest
import asyncio
from pipeline.api.job_queue import (
    Job,
    JobStatus,
    JobPriority,
    InMemoryJobQueue,
    JobProcessor,
    create_job,
)


class TestJob:
    """Tests for Job dataclass."""
    
    def test_create_job(self):
        job = create_job(
            job_type="test_job",
            payload={"key": "value"}
        )
        
        assert job.job_id is not None
        assert job.job_type == "test_job"
        assert job.payload == {"key": "value"}
        assert job.status == JobStatus.PENDING
    
    def test_job_with_priority(self):
        job = create_job(
            job_type="important",
            payload={},
            priority=JobPriority.HIGH
        )
        
        assert job.priority == JobPriority.HIGH
    
    def test_job_to_dict(self):
        job = create_job("test", {"data": 1})
        d = job.to_dict()
        
        assert "jobId" in d
        assert "jobType" in d
        assert "status" in d
        assert d["status"] == "pending"


class TestInMemoryJobQueue:
    """Tests for in-memory job queue."""
    
    @pytest.mark.asyncio
    async def test_enqueue_dequeue(self):
        queue = InMemoryJobQueue()
        job = create_job("test", {})
        
        await queue.enqueue(job)
        dequeued = await queue.dequeue()
        
        assert dequeued is not None
        assert dequeued.job_id == job.job_id
        assert dequeued.status == JobStatus.RUNNING
    
    @pytest.mark.asyncio
    async def test_priority_ordering(self):
        queue = InMemoryJobQueue()
        
        low = create_job("low", {}, priority=JobPriority.LOW)
        high = create_job("high", {}, priority=JobPriority.HIGH)
        normal = create_job("normal", {}, priority=JobPriority.NORMAL)
        
        await queue.enqueue(low)
        await queue.enqueue(normal)
        await queue.enqueue(high)
        
        first = await queue.dequeue()
        assert first.job_type == "high"
    
    @pytest.mark.asyncio
    async def test_get_job(self):
        queue = InMemoryJobQueue()
        job = create_job("test", {"key": "value"})
        
        await queue.enqueue(job)
        retrieved = await queue.get_job(job.job_id)
        
        assert retrieved is not None
        assert retrieved.payload == {"key": "value"}
    
    @pytest.mark.asyncio
    async def test_update_job(self):
        queue = InMemoryJobQueue()
        job = create_job("test", {})
        
        await queue.enqueue(job)
        job.status = JobStatus.COMPLETED
        job.result = {"output": "done"}
        await queue.update_job(job)
        
        retrieved = await queue.get_job(job.job_id)
        assert retrieved.status == JobStatus.COMPLETED
        assert retrieved.result == {"output": "done"}
    
    @pytest.mark.asyncio
    async def test_get_pending_jobs(self):
        queue = InMemoryJobQueue()
        
        await queue.enqueue(create_job("job1", {}))
        await queue.enqueue(create_job("job2", {}))
        
        pending = await queue.get_pending_jobs()
        assert len(pending) == 2
        
        await queue.dequeue()
        
        pending = await queue.get_pending_jobs()
        assert len(pending) == 1


class TestJobProcessor:
    """Tests for job processor."""
    
    @pytest.mark.asyncio
    async def test_process_job_with_handler(self):
        queue = InMemoryJobQueue()
        
        async def test_handler(job: Job):
            return {"processed": job.payload}
        
        processor = JobProcessor(queue, {"test": test_handler})
        job = create_job("test", {"input": "data"})
        await queue.enqueue(job)
        
        job = await queue.dequeue()
        await processor._process_job(job)
        
        updated = await queue.get_job(job.job_id)
        assert updated.status == JobStatus.COMPLETED
        assert updated.result == {"processed": {"input": "data"}}
    
    @pytest.mark.asyncio
    async def test_process_job_no_handler(self):
        queue = InMemoryJobQueue()
        processor = JobProcessor(queue, {})
        
        job = create_job("unknown_type", {})
        await queue.enqueue(job)
        
        job = await queue.dequeue()
        await processor._process_job(job)
        
        updated = await queue.get_job(job.job_id)
        assert updated.status == JobStatus.FAILED
        assert "No handler" in updated.error
    
    @pytest.mark.asyncio
    async def test_register_handler(self):
        queue = InMemoryJobQueue()
        processor = JobProcessor(queue)
        
        async def my_handler(job):
            return {}
        
        processor.register_handler("custom", my_handler)
        assert "custom" in processor.handlers


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
