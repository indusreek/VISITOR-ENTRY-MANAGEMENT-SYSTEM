import re
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

ID_PROOF_TYPES = ("Aadhaar", "Driving License", "PAN", "Passport", "Other")
StatusFilter = Literal["checked_in", "checked_out"]


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=1, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    full_name: str


class VisitorBase(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    phone: str
    email: Optional[EmailStr] = None
    organization: Optional[str] = Field(default=None, max_length=100)
    purpose: str = Field(min_length=2, max_length=200)
    host_name: str = Field(min_length=2, max_length=100)
    id_proof_type: str
    id_proof_number: str = Field(min_length=3, max_length=50)
    notes: Optional[str] = Field(default=None, max_length=500)

    @field_validator("email", mode="before")
    @classmethod
    def empty_email(cls, value):
        if value is None or (isinstance(value, str) and not value.strip()):
            return None
        return value

    @field_validator("full_name", "purpose", "host_name", "id_proof_number")
    @classmethod
    def strip_required(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field cannot be empty")
        return value

    @field_validator("organization", "notes")
    @classmethod
    def strip_optional(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        return value or None

    @field_validator("phone")
    @classmethod
    def ten_digits(cls, value: str) -> str:
        digits = value.strip()
        if not re.fullmatch(r"^\d{10}$", digits):
            raise ValueError("Phone must be exactly 10 digits")
        return digits

    @field_validator("id_proof_type")
    @classmethod
    def allowed_id_type(cls, value: str) -> str:
        if value not in ID_PROOF_TYPES:
            raise ValueError(f"Invalid ID proof type. Must be one of: {', '.join(ID_PROOF_TYPES)}")
        return value


class VisitorCreate(VisitorBase):
    pass


class VisitorUpdate(VisitorBase):
    pass


class VisitorOut(VisitorBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: str
    check_in_time: datetime
    check_out_time: Optional[datetime]
    created_at: datetime
    updated_at: datetime


class DashboardStats(BaseModel):
    total_visitors: int
    checked_in_today: int
    currently_inside: int
    checked_out_today: int
    recent: list[VisitorOut]


class ReportSummary(BaseModel):
    total: int
    currently_inside: int
    checked_out: int


class ReportResponse(BaseModel):
    date_from: str
    date_to: str
    summary: ReportSummary
    visitors: list[VisitorOut]
