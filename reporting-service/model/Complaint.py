from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from enum import Enum

class ComplaintStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"

class ComplaintBase(BaseModel):
    Content: Optional[str] = None
    Status: Optional[str] = None

class ComplaintCreate(BaseModel):
    Content: str  

# 3. Complaint
class Complaint(ComplaintCreate):
    ComplaintId: str
    ReportId: str   # Backend tự điền từ URL
    UserID: str     # Backend tự điền từ Header
    Created_at: datetime
    Status: str     # Backend tự điền