from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import User, Visitor
from app.schemas import ReportResponse, ReportSummary
from app.services import date_range_bounds_utc

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("", response_model=ReportResponse)
def reports(
    date_from: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
    date_to: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if date_from > date_to:
        raise HTTPException(status_code=400, detail="From date cannot be after to date")
    start, end = date_range_bounds_utc(date_from, date_to)
    visitors = (
        db.query(Visitor)
        .filter(Visitor.check_in_time >= start, Visitor.check_in_time <= end)
        .order_by(Visitor.check_in_time.desc())
        .all()
    )
    inside = sum(1 for v in visitors if v.status == "checked_in")
    return ReportResponse(
        date_from=date_from,
        date_to=date_to,
        summary=ReportSummary(
            total=len(visitors),
            currently_inside=inside,
            checked_out=len(visitors) - inside,
        ),
        visitors=visitors,
    )
