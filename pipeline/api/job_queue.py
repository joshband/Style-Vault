"""
Job Queue System

Provides async job-based execution for pipeline stages.
Supports pluggable backends (in-memory, Redis, Pub/Sub).
"""

from typing import Dict, Any, Optional, List, Callable, Awaitable
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import uuid
import asyncio
import json


class JobStatus(str, Enum):
    """Job execution status."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class JobPriority(int, Enum):
    """Job priority levels."""
    LOW = 1
    NORMAL = 5
    HIGH = 10
    CRITICAL = 20


@dataclass
class Job:
    """Represents a pipeline job."""
    job_id: str
    job_type: str
    payload: Dict[str, Any]
    status: JobStatus = JobStatus.PENDING
    priority: JobPriority = JobPriority.NORMAL
    created_at: str = ""
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    retries: int = 0
    max_retries: int = 3
    timeout_seconds: int = 300
    
    def __post_init__(self):
        if not self.created_at:
            self.created_at = datetime.utcnow().isoformat() + "Z"
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "jobId": self.job_id,
            "jobType": self.job_type,
            "payload": self.payload,
            "status": self.status.value,
            "priority": self.priority.value,
            "createdAt": self.created_at,
            "startedAt": self.started_at,
            "completedAt": self.completed_at,
            "result": self.result,
            "error": self.error,
            "retries": self.retries,
            "maxRetries": self.max_retries,
            "timeoutSeconds": self.timeout_seconds,
        }


class JobQueueBackend:
    """Abstract base for job queue backends."""
    
    async def enqueue(self, job: Job) -> str:
        raise NotImplementedError
    
    async def dequeue(self) -> Optional[Job]:
        raise NotImplementedError
    
    async def get_job(self, job_id: str) -> Optional[Job]:
        raise NotImplementedError
    
    async def update_job(self, job: Job) -> None:
        raise NotImplementedError
    
    async def get_pending_jobs(self) -> List[Job]:
        raise NotImplementedError


class InMemoryJobQueue(JobQueueBackend):
    """In-memory job queue for development/testing."""
    
    def __init__(self):
        self._jobs: Dict[str, Job] = {}
        self._queue: List[str] = []
        self._lock = asyncio.Lock()
    
    async def enqueue(self, job: Job) -> str:
        async with self._lock:
            self._jobs[job.job_id] = job
            self._queue.append(job.job_id)
            self._queue.sort(
                key=lambda jid: -self._jobs[jid].priority.value
            )
        return job.job_id
    
    async def dequeue(self) -> Optional[Job]:
        async with self._lock:
            pending = [
                jid for jid in self._queue
                if self._jobs[jid].status == JobStatus.PENDING
            ]
            if not pending:
                return None
            
            job_id = pending[0]
            job = self._jobs[job_id]
            job.status = JobStatus.RUNNING
            job.started_at = datetime.utcnow().isoformat() + "Z"
            return job
    
    async def get_job(self, job_id: str) -> Optional[Job]:
        return self._jobs.get(job_id)
    
    async def update_job(self, job: Job) -> None:
        async with self._lock:
            self._jobs[job.job_id] = job
    
    async def get_pending_jobs(self) -> List[Job]:
        return [
            job for job in self._jobs.values()
            if job.status == JobStatus.PENDING
        ]
    
    async def list_jobs(self) -> List[Job]:
        """Return all jobs."""
        return list(self._jobs.values())


JobHandler = Callable[[Job], Awaitable[Dict[str, Any]]]


class JobProcessor:
    """Processes jobs from the queue."""
    
    def __init__(
        self,
        queue: JobQueueBackend,
        handlers: Optional[Dict[str, JobHandler]] = None,
        concurrency: int = 4
    ):
        self.queue = queue
        self.handlers: Dict[str, JobHandler] = handlers or {}
        self.concurrency = concurrency
        self._running = False
        self._workers: List[asyncio.Task] = []
    
    def register_handler(self, job_type: str, handler: JobHandler):
        """Register a handler for a job type."""
        self.handlers[job_type] = handler
    
    async def _process_job(self, job: Job) -> None:
        """Process a single job."""
        handler = self.handlers.get(job.job_type)
        
        if not handler:
            job.status = JobStatus.FAILED
            job.error = f"No handler for job type: {job.job_type}"
            job.completed_at = datetime.utcnow().isoformat() + "Z"
            await self.queue.update_job(job)
            return
        
        try:
            result = await asyncio.wait_for(
                handler(job),
                timeout=job.timeout_seconds
            )
            job.status = JobStatus.COMPLETED
            job.result = result
            job.completed_at = datetime.utcnow().isoformat() + "Z"
            
        except asyncio.TimeoutError:
            job.retries += 1
            if job.retries >= job.max_retries:
                job.status = JobStatus.FAILED
                job.error = f"Job timed out after {job.timeout_seconds}s"
            else:
                job.status = JobStatus.PENDING
                job.error = f"Retry {job.retries}/{job.max_retries}: timeout"
            job.completed_at = datetime.utcnow().isoformat() + "Z"
            
        except Exception as e:
            job.retries += 1
            if job.retries >= job.max_retries:
                job.status = JobStatus.FAILED
                job.error = str(e)
            else:
                job.status = JobStatus.PENDING
                job.error = f"Retry {job.retries}/{job.max_retries}: {str(e)}"
            job.completed_at = datetime.utcnow().isoformat() + "Z"
        
        await self.queue.update_job(job)
    
    async def _worker(self, worker_id: int):
        """Worker coroutine that processes jobs."""
        while self._running:
            job = await self.queue.dequeue()
            if job:
                await self._process_job(job)
            else:
                await asyncio.sleep(0.5)
    
    async def start(self):
        """Start the job processor."""
        self._running = True
        self._workers = [
            asyncio.create_task(self._worker(i))
            for i in range(self.concurrency)
        ]
    
    async def stop(self):
        """Stop the job processor."""
        self._running = False
        for worker in self._workers:
            worker.cancel()
        self._workers = []


def create_job(
    job_type: str,
    payload: Dict[str, Any],
    priority: JobPriority = JobPriority.NORMAL,
    timeout_seconds: int = 300,
    max_retries: int = 3
) -> Job:
    """Factory function to create a new job."""
    return Job(
        job_id=str(uuid.uuid4()),
        job_type=job_type,
        payload=payload,
        priority=priority,
        timeout_seconds=timeout_seconds,
        max_retries=max_retries
    )
