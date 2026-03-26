from pydantic import BaseModel, Field

class SDPOffer(BaseModel):
    sdp: str
    type: str

class SDPAnswer(BaseModel):
    sdp: str
    type: str
    session_url: str | None = Field(None, description="WHEP session URL from MediaMTX")

class ICECandidate(BaseModel):
    candidate: str
    sdpMid: str | None = None
    sdpMLineIndex: int | None = None
    session_url: str | None = Field(None, description="WHEP session URL to send the candidate to")
