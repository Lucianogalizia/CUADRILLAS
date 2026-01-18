from pydantic import BaseModel
from typing import Optional, Literal

EventType = Literal["LLEGADA", "INICIO", "PAUSA", "REANUDADO", "FIN"]

class CreateEvent(BaseModel):
    task_id: str
    ot: str
    cuadrilla: str
    id_cuadrilla: Optional[str] = None
    event_type: EventType
    event_time: Optional[str] = None  # ISO; si no viene usamos server time
    lat: float
    lon: float
    accuracy_m: Optional[float] = None
    pause_reason: Optional[str] = None
    comment: Optional[str] = None
