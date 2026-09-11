from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import User, Visitor
from app.schemas import DashboardStats
from app.services import count_today, search_visitors

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardStats)
def dashboard(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    total = int(db.query(func.count(Visitor.id)).scalar() or 0)
    currently_inside = int(
        db.query(func.count(Visitor.id)).filter(Visitor.status == "checked_in").scalar() or 0
    )
    recent = search_visitors(db, None, None)[:10]
    return DashboardStats(
        total_visitors=total,
        checked_in_today=count_today(db, Visitor.check_in_time),
        currently_inside=currently_inside,
        checked_out_today=count_today(db, Visitor.check_out_time),
        recent=recent,
    )
