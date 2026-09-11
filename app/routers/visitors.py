from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import User, Visitor
from app.schemas import VisitorCreate, VisitorOut, VisitorUpdate
from app.services import open_visit_for_phone, search_visitors

router = APIRouter(prefix="/visitors", tags=["visitors"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


@router.get("", response_model=list[VisitorOut])
def list_visitors(
    q: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if status_filter and status_filter not in {"checked_in", "checked_out"}:
        raise HTTPException(status_code=400, detail="Status must be checked_in or checked_out")
    return search_visitors(db, q, status_filter)


@router.post("", response_model=VisitorOut, status_code=status.HTTP_201_CREATED)
def create_visitor(
    payload: VisitorCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if open_visit_for_phone(db, payload.phone):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This phone already has a visitor currently checked in",
        )
    visitor = Visitor(**payload.model_dump(), status="checked_in", check_in_time=_now())
    db.add(visitor)
    db.commit()
    db.refresh(visitor)
    return visitor


@router.get("/{visitor_id}", response_model=VisitorOut)
def get_visitor(
    visitor_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    visitor = db.query(Visitor).filter(Visitor.id == visitor_id).first()
    if visitor is None:
        raise HTTPException(status_code=404, detail="Visitor not found")
    return visitor


@router.put("/{visitor_id}", response_model=VisitorOut)
def update_visitor(
    visitor_id: int,
    payload: VisitorUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    visitor = db.query(Visitor).filter(Visitor.id == visitor_id).first()
    if visitor is None:
        raise HTTPException(status_code=404, detail="Visitor not found")
    if visitor.status == "checked_in" and open_visit_for_phone(db, payload.phone, exclude_id=visitor.id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This phone already has a visitor currently checked in",
        )
    for key, value in payload.model_dump().items():
        setattr(visitor, key, value)
    visitor.updated_at = _now()
    db.commit()
    db.refresh(visitor)
    return visitor


@router.delete("/{visitor_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_visitor(
    visitor_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    visitor = db.query(Visitor).filter(Visitor.id == visitor_id).first()
    if visitor is None:
        raise HTTPException(status_code=404, detail="Visitor not found")
    db.delete(visitor)
    db.commit()
    return None


@router.post("/{visitor_id}/checkout", response_model=VisitorOut)
def checkout_visitor(
    visitor_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    visitor = db.query(Visitor).filter(Visitor.id == visitor_id).first()
    if visitor is None:
        raise HTTPException(status_code=404, detail="Visitor not found")
    if visitor.status != "checked_in":
        raise HTTPException(status_code=400, detail="Visitor is already checked out")
    visitor.status = "checked_out"
    visitor.check_out_time = _now()
    visitor.updated_at = _now()
    db.commit()
    db.refresh(visitor)
    return visitor
