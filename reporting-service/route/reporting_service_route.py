from fastapi import APIRouter, HTTPException, Header, Depends, Query
from model.Report import Report, ReportBase, ReportCreate, ReportStatus, IncidentTypeEnum
from database import reports_collection
from datetime import datetime
from typing import Optional
import httpx

router = APIRouter()

GENERAL_SERVICE_URL = "https://general-service-u75j.onrender.com/api/users"

# --- AUTH HELPERS (CŨ - GIỮ LẠI ĐỂ CÁC ENDPOINT KHÁC KHÔNG BỊ LỖI) ---
def get_user_role(x_role: str = Header("USER", alias="X-Role")):
    return x_role

def get_user_id_from_header(x_user_id: str = Header(..., alias="user-id")):
    return x_user_id

# --- AUTH HELPERS (MỚI - DÙNG CHO CREATE REPORT) ---
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

# --- SERIALIZER ---
def report_serializer(report) -> dict:
    return {
        "id": str(report["_id"]),
        "ReportId": report["ReportId"],
        "Title": report["Title"],
        "IncidentType": report.get("IncidentType"), 
        "Content": report.get("Content"),
        "MediaURL": report["MediaURL"],
        "Address": report["Address"],
        "Created_at": report["Created_at"],
        "Updated_at": report.get("Updated_at"),
        "Status": report["Status"],
        "Note": report.get("Note"),
        "ReporterID": report["UserID"]
    }

# --- CREATE REPORT ---
@router.post("/reports", response_model=dict)
async def create_report(
    report_input: ReportCreate,
    user_info: dict = Depends(verify_user_from_general_service) # Dùng hàm verify mới
):
    user_id = user_info["UserID"]
    
    report_data = report_input.dict()
    auto_title = f"Sự cố hạ tầng - {report_input.IncidentType.value}"
    report_data["Title"] = auto_title
    
    current_count = reports_collection.count_documents({"UserID": user_id})
    next_seq = current_count + 1
    report_id = f"RP{user_id}{next_seq:02d}"
    
    report_data["ReportId"] = report_id
    report_data["UserID"] = user_id
    report_data["Status"] = "WAITING"
    report_data["Created_at"] = datetime.utcnow()
    report_data["Updated_at"] = None
    
    result = reports_collection.insert_one(report_data)
    new_report = reports_collection.find_one({"_id": result.inserted_id})
    return {"message": "Report created", "data": report_serializer(new_report)}

# --- UPDATE REPORT DETAILS (PUT) ---
@router.put("/reports/{report_id}", response_model=dict)
def update_report(
    report_id: str, 
    updated_data: ReportBase,
    role: str = Depends(get_user_role) # Vẫn dùng hàm cũ
):
    if role == "TECHNICIAN":
        raise HTTPException(
            status_code=403, 
            detail="Permission denied: Technicians cannot modify report details. Please contact Manager."
        )

    update_data_dict = {k: v for k, v in updated_data.dict().items() if v is not None}
    if not update_data_dict:
         raise HTTPException(status_code=400, detail="No data provided to update")

    if "Status" in update_data_dict and role != "MANAGER":
         raise HTTPException(status_code=403, detail="Permission denied: Only MANAGER can update status via this endpoint.")

    if "IncidentType" in update_data_dict:
        new_type_enum = updated_data.IncidentType 
        new_title = f"Sự cố hạ tầng - {new_type_enum.value}"
        update_data_dict["Title"] = new_title

    update_data_dict["Updated_at"] = datetime.utcnow()

    result = reports_collection.update_one(
        {"ReportId": report_id},
        {"$set": update_data_dict}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Report not found")

    report = reports_collection.find_one({"ReportId": report_id})
    return {"message": "Report updated", "data": report_serializer(report)}

# --- UPDATE STATUS & NOTE (PATCH) ---
@router.patch("/reports/{report_id}/status", response_model=dict)
def update_report_status(
    report_id: str, 
    status: ReportStatus, 
    note: Optional[str] = Query(None, description="Ghi chú lý do"), 
    role: str = Depends(get_user_role) # Vẫn dùng hàm cũ
):
    if role not in ["MANAGER", "TECHNICIAN"]:
        raise HTTPException(status_code=403, detail="Permission denied.")

    if role == "MANAGER":
        if status == ReportStatus.REJECTED and not note:
            raise HTTPException(
                status_code=400, 
                detail="Manager must provide a reason (Note) when rejecting a report."
            )

    update_fields = {
        "Status": status,
        "Updated_at": datetime.utcnow()
    }
    
    if note:
        update_fields["Note"] = note

    result = reports_collection.update_one(
        {"ReportId": report_id},
        {"$set": update_fields}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Report not found")

    report = reports_collection.find_one({"ReportId": report_id})
    return {"message": "Status updated successfully", "data": report_serializer(report)}

# --- GET ALL & FILTER ---
@router.get("/reports", response_model=list)
def get_reports(
    caller_id: str = Depends(get_user_id_from_header), 
    caller_role: str = Depends(get_user_role),       
    
    reporter_id: Optional[str] = Query(None),
    status: Optional[ReportStatus] = Query(None),
    incident_type: Optional[IncidentTypeEnum] = Query(None),
    city: Optional[str] = Query(None),
    district: Optional[str] = Query(None),
    ward: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None)
):
    query = {}

    if caller_role in ["MANAGER", "TECHNICIAN"]:
        if reporter_id: query["UserID"] = reporter_id
    else:
        query["UserID"] = caller_id 

    if status: query["Status"] = status
    if incident_type: query["IncidentType"] = incident_type
    if city: query["Address.City"] = city
    if district: query["Address.District"] = district
    if ward: query["Address.Ward"] = ward

    if start_date or end_date:
        date_filter = {}
        if start_date: date_filter["$gte"] = start_date
        if end_date: date_filter["$lte"] = end_date
        if date_filter: query["Created_at"] = date_filter

    reports = []
    cursor = reports_collection.find(query).sort("Created_at", -1)
    for report in cursor:
        reports.append(report_serializer(report))
    return reports

# --- GET DETAIL ---
@router.get("/reports/{report_id}", response_model=dict)
def get_report_by_id(report_id: str):
    report = reports_collection.find_one({"ReportId": report_id})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report_serializer(report)

# --- DELETE ---
@router.delete("/reports/{report_id}", response_model=dict)
def delete_report(report_id: str):
    result = reports_collection.delete_one({"ReportId": report_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"message": "Report deleted"}

# --- DELETE ALL (DANGER ZONE) ---
# Endpoint này dùng để XÓA SẠCH database báo cáo. Chỉ dành cho Dev/Manager.
@router.delete("/reports/reset-database", response_model=dict)
def delete_all_reports(
    role: str = Depends(get_user_role)
):
    # 1. Chỉ cho phép MANAGER thực hiện
    if role != "MANAGER":
        raise HTTPException(
            status_code=403, 
            detail="Permission denied: Only MANAGER can perform a database reset."
        )

    # 2. Thực hiện xóa toàn bộ
    result = reports_collection.delete_many({})

    return {
        "message": "All reports have been deleted successfully", 
        "deleted_count": result.deleted_count
    }