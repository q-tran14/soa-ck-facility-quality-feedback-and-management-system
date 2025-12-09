from fastapi import APIRouter, HTTPException, Header, Depends
from model.Complaint import Complaint, ComplaintCreate
# Import reports_collection để check trạng thái báo cáo gốc
from database import complaints_collection, reports_collection
from datetime import datetime
from reporting_service_route import verify_user_from_general_service

router = APIRouter()

# ! CALL USER SERVICE TO VERIFY USER (UserID)
# Hàm lấy UserID từ Header
def get_user_id_from_header(user_id: str = Header(..., alias="user-id")): # Tên biến 'user_id'
    return user_id
## ---- ##

def complaint_serializer(complaint) -> dict:
    return {
        "id": str(complaint["_id"]),
        "ComplaintId": complaint["ComplaintId"],
        "ReportId": complaint["ReportId"],
        "Content": complaint["Content"],
        "Status": complaint["Status"],
        "Created_at": complaint["Created_at"],
        "UserID": complaint["UserID"]
    }

# TẠO KHIẾU NẠI DỰA TRÊN REPORT ID TRÊN URL
# URL sẽ có dạng: /api/complaint/report/R-123456
@router.post("/report/{report_id}", response_model=dict)
async def create_complaint(
    report_id: str, 
    complaint_input: ComplaintCreate,
    user_info: dict = Depends(verify_user_from_general_service)
):
    user_id = user_info["UserID"]
    # 1. Kiểm tra Report tồn tại
    report = reports_collection.find_one({"ReportId": report_id})
    if not report:
        raise HTTPException(status_code=404, detail="Report ID not found")

    if report["Status"] != "COMPLETED":
        raise HTTPException(
            status_code=400, 
            detail="You can only file a complaint for COMPLETED reports."
        )

    complaint_data = complaint_input.dict()
    
    # 2. LOGIC TẠO ID MỚI: CP + ReportID
    # Ví dụ ReportID là RPUS00101 -> ComplaintID là CPRPUS00101
    complaint_data["ComplaintId"] = f"CP{report_id}"
    
    complaint_data["ReportId"] = report_id
    complaint_data["UserID"] = user_id
    complaint_data["Created_at"] = datetime.utcnow()
    complaint_data["Status"] = "PENDING"

    # Lưu và cập nhật trạng thái Report gốc
    complaints_collection.insert_one(complaint_data)

    reports_collection.update_one(
        {"ReportId": report_id},
        {
            "$set": {
                "Status": "IN_PROGRESS",
                "Updated_at": datetime.utcnow(),
                "Note": f"Re-opened due to complaint: {complaint_input.Content}"
            }
        }
    )

    return {"message": "Complaint submitted successfully", "data": complaint_data}

# Lấy danh sách khiếu nại của 1 report
@router.get("/report/{report_id}", response_model=list)
def get_complaints_by_report(report_id: str):
    complaints = []
    for c in complaints_collection.find({"ReportId": report_id}):
        complaints.append(complaint_serializer(c))
    return complaints