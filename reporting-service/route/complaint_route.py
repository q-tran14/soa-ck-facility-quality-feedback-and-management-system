from fastapi import APIRouter, HTTPException, Header, Depends
from model.Complaint import Complaint, ComplaintCreate
# Import reports_collection để check trạng thái báo cáo gốc
from database import complaints_collection, reports_collection
from datetime import datetime
import httpx

router = APIRouter()

GENERAL_SERVICE_URL = "https://general-service-u75j.onrender.com/api/users"

async def verify_user_from_general_service(user_id: str = Header(..., alias="user-id")):
    """
    Hàm này sẽ:
    1. Lấy user-id từ Header gửi lên.
    2. Gọi sang General Service để tìm user đó.
    3. Nếu thấy -> Trả về dict chứa UserID và Role chuẩn từ DB.
    4. Nếu không thấy hoặc lỗi mạng -> Báo lỗi 401/500.
    """
    try:
        async with httpx.AsyncClient() as client:
            # Gọi API GET danh sách user
            response = await client.get(GENERAL_SERVICE_URL)
            
            if response.status_code != 200:
                raise HTTPException(status_code=500, detail="Failed to connect to User Service")
            
            users_list = response.json()
            
            # Tìm user có UserID khớp với header gửi lên
            target_user = next((u for u in users_list if u.get("UserID") == user_id), None)
            
            if not target_user:
                raise HTTPException(status_code=401, detail="User ID not found in General Service")
            
            # Trả về thông tin user đã xác thực
            return {
                "UserID": target_user["UserID"],
                "Role": target_user["Role"], 
                "Email": target_user.get("Email")
            }

    except httpx.RequestError:
        raise HTTPException(status_code=503, detail="General Service unavailable")
    
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