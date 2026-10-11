from pydantic import BaseModel
from typing import TypeVar, Generic, Optional
from datetime import datetime, date
from uuid import UUID
import json

T = TypeVar("T")


class AppResponse(BaseModel, Generic[T]):
    status: str
    message: str
    result: Optional[T] = None

    class Config:
        json_schema_extra = {
            "example": {
                "status": "SUCCESS",
                "message": "Operation completed successfully",
                "result": {},
            }
        }

    def model_dump(self, **kwargs):
        data = super().model_dump(**kwargs)
        
        return json.loads(
            json.dumps(data, default=self._json_serializer)
        )

    @staticmethod
    def _json_serializer(obj):
        if isinstance(obj, UUID):
            return str(obj)
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")


class Status:
    SUCCESS = "SUCCESS"
    SAVED = "SAVED"
    DELETED = "DELETED"
    ERROR = "ERROR"


class Message:
    FETCHED = "Records fetched successfully"
    CREATED = "Record created successfully"
    UPDATED = "Record updated successfully"
    DELETED = "Record deleted successfully"
    NOT_FOUND = "Record not found"
    ERROR = "An error occurred"
