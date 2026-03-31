from pydantic import BaseModel

class Location(BaseModel):
    lat: float
    lng: float

class Place(BaseModel):
    place_id: str
    name: str
    formatted_address: str
    location: Location
    types: list[str]
    rating: float | None = None
    photoUrl: str

class SortRequest(BaseModel):
    places: list[Place]
    date: str

class SortResponse(BaseModel):
    places: list[Place]