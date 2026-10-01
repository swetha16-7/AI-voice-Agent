import logging
import os
import re
from datetime import datetime
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, Field, field_validator
import httpx

# Load environment variables from .env
load_dotenv()

# Configuration Constants and Defaults
CAL_API_BASE_URL = os.getenv("CAL_API_BASE_URL", "https://api.cal.com").rstrip("/")
CAL_API_VERSION = "2024-08-13"

# Default event type IDs for Boomi Real Estate
DEFAULT_EVENT_TYPES = {
    "viewing": 7283034,
    "consultation": 7282991,
}

# Initialize FastAPI application
app = FastAPI(
    title="Boomi Calendar API",
    description="Cal.com API v2 integration for Boomi AI Receptionist",
    version="1.0.0",
)


# ---------------------------------------------------------------------------
# Pydantic Request Models
# ---------------------------------------------------------------------------

class AvailabilityRequest(BaseModel):
    appointment_type: str = Field(
        ...,
        description="Type of appointment, e.g. 'viewing' or 'consultation'",
        example="viewing",
    )
    preferred_date: str = Field(
        ...,
        description="The date the caller wants to book the appointment, in DD-MM-YYYY format.",
        example="01-10-2026",
    )
    location: str = Field(
        ...,
        description="Location or city",
        example="Hyderabad",
    )
    property_type: str = Field(
        ...,
        description="Type of property (e.g., 'apartment', 'villa', 'commercial', 'land')",
        example="land",
    )
    timezone: Optional[str] = Field(
        default=None,
        description="Optional timezone identifier. If omitted, derived server-side from location.",
        example="Asia/Kolkata",
    )

    @field_validator("preferred_date")
    @classmethod
    def validate_date_format(cls, v: str) -> str:
        trimmed = v.strip() if v else ""
        if not re.match(r"^\d{2}-\d{2}-\d{4}$", trimmed):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid preferred_date format. Expected DD-MM-YYYY (e.g. '01-10-2026').",
            )
        try:
            datetime.strptime(trimmed, "%d-%m-%Y")
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid calendar date in preferred_date. Please provide a valid date in DD-MM-YYYY format.",
            )
        return trimmed


class BookAppointmentRequest(BaseModel):
    name: str = Field(
        ...,
        description="Client's full name",
        example="John Doe",
    )
    phone_number: str = Field(
        ...,
        description="Client's phone number with country code",
        example="+919876543210",
    )
    email: str = Field(
        ...,
        description="Client's valid email address",
        example="john@example.com",
    )
    appointment_type: str = Field(
        ...,
        description="Type of appointment, e.g. 'viewing' or 'consultation'",
        example="viewing",
    )
    property_type: str = Field(
        ...,
        description="Type of property (e.g., 'apartment', 'villa', 'commercial', 'land')",
        example="apartment",
    )
    location: str = Field(
        ...,
        description="Property location or locality (e.g., 'Hyderabad')",
        example="Hyderabad",
    )
    slot_date: str = Field(
        ...,
        description="The appointment date in DD-MM-YYYY format",
        example="02-10-2026",
    )
    slot_time: str = Field(
        ...,
        description="The selected appointment time in 12-hour AM/PM format, e.g. 10:00 AM or 4:00 PM.",
        example="10:00 AM",
    )

    @field_validator("email")
    @classmethod
    def validate_email_format(cls, v: str) -> str:
        trimmed = v.strip()
        if "@" not in trimmed or "." not in trimmed.split("@")[-1]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid email format. Please provide a valid email address.",
            )
        return trimmed

    @field_validator("slot_date")
    @classmethod
    def validate_slot_date(cls, v: str) -> str:
        trimmed = v.strip() if v else ""
        if not re.match(r"^\d{2}-\d{2}-\d{4}$", trimmed):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid slot_date format. Expected DD-MM-YYYY (e.g. '02-10-2026').",
            )
        try:
            datetime.strptime(trimmed, "%d-%m-%Y")
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid calendar date in slot_date. Please provide a valid date in DD-MM-YYYY format.",
            )
        return trimmed

    @field_validator("slot_time")
    @classmethod
    def validate_slot_time(cls, v: str) -> str:
        trimmed = v.strip() if v else ""
        if not re.match(r"^(0[1-9]|1[0-2]):[0-5]\d (AM|PM)$", trimmed):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid slot_time format. Expected HH:MM AM/PM in 12-hour format (e.g. '10:00 AM' or '04:00 PM').",
            )
        try:
            datetime.strptime(trimmed, "%I:%M %p")
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid time value in slot_time. Please provide a valid 12-hour time in HH:MM AM/PM format.",
            )
        return trimmed


class TakeMessageRequest(BaseModel):
    name: str = Field(
        ...,
        description="Caller's full name",
        example="Swetha Modala",
    )
    phone_number: str = Field(
        ...,
        description="Caller's phone number",
        example="9121998166",
    )
    message: str = Field(
        ...,
        description="The message left by the caller",
        example="I'm interested in buying another property and would like to discuss some options.",
    )
    email: Optional[str] = Field(
        default=None,
        description="Caller's email address (optional)",
        example="swetamodala@gmail.com",
    )

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        trimmed = v.strip() if v else ""
        if not trimmed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="name must not be empty.",
            )
        return trimmed

    @field_validator("phone_number")
    @classmethod
    def validate_phone_number(cls, v: str) -> str:
        trimmed = v.strip() if v else ""
        if not trimmed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="phone_number must not be empty.",
            )
        return trimmed

    @field_validator("message")
    @classmethod
    def validate_message(cls, v: str) -> str:
        trimmed = v.strip() if v else ""
        if not trimmed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="message must not be empty.",
            )
        return trimmed


# ---------------------------------------------------------------------------
# Cal.com API Helpers & Timezone Utilities
# ---------------------------------------------------------------------------

def derive_timezone_from_location(location: Optional[str]) -> str:
    """
    Derives standard IANA timezone based on location string.
    Supports locations across India, the United States, and international hubs.
    Raises HTTPException(400) if location is missing, ambiguous, or unknown.
    """
    if not location or not location.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to determine timezone from location. Please provide a more specific city and country.",
        )

    loc = location.strip().lower()

    # Predefined mapping of keywords/cities/regions to IANA timezones
    # Ordered with specific cities and localities first, followed by states and countries
    LOCATION_TIMEZONE_MAPPINGS = [
        # India (Asia/Kolkata)
        (
            [
                "hyderabad", "mumbai", "delhi", "new delhi", "bangalore", "bengaluru",
                "chennai", "pune", "kolkata", "ahmedabad", "gurgaon", "gurugram", "noida",
                "secunderabad", "hitec", "gachibowli", "jubilee hills", "banjara hills",
                "kondapur", "madhapur", "kukatpally", "shamshabad", "manikonda", "kokapet",
                "vizag", "visakhapatnam", "jaipur", "lucknow", "kochi", "cochin", "chandigarh",
                "indore", "bhopal", "nagpur", "patna", "vadodara", "ghaziabad", "ludhiana",
                "agra", "nashik", "varanasi", "surat", "mysore", "mysuru", "coimbatore",
                "vijayawada", "kanpur", "thane", "navi mumbai", "india", "telangana",
                "karnataka", "maharashtra", "tamil nadu", "andhra pradesh", "andhra",
                "kerala", "gujarat", "rajasthan", "uttar pradesh", "west bengal", "punjab", "haryana"
            ],
            "Asia/Kolkata",
        ),
        # US - Pacific (America/Los_Angeles)
        (
            [
                "los angeles", "san francisco", "san jose", "san diego", "oakland",
                "sacramento", "palo alto", "mountain view", "sunnyvale", "cupertino",
                "santa clara", "berkeley", "fremont", "irvine", "long beach", "fresno",
                "seattle", "bellevue", "redmond", "tacoma", "spokane", "portland",
                "eugene", "las vegas", "reno", "california", "oregon", "nevada"
            ],
            "America/Los_Angeles",
        ),
        # US - Mountain (America/Denver)
        (
            [
                "denver", "colorado springs", "boulder", "aurora", "salt lake city",
                "albuquerque", "santa fe", "boise", "cheyenne", "casper", "billings",
                "colorado", "utah", "new mexico", "idaho", "wyoming", "montana"
            ],
            "America/Denver",
        ),
        # US - Arizona (America/Phoenix)
        (
            [
                "phoenix", "scottsdale", "tucson", "mesa", "chandler", "gilbert",
                "tempe", "peoria", "flagstaff", "yuma", "arizona"
            ],
            "America/Phoenix",
        ),
        # US - Central (America/Chicago)
        (
            [
                "chicago", "dallas", "fort worth", "dfw", "houston", "austin", "san antonio",
                "minneapolis", "st louis", "saint louis", "milwaukee", "kansas city",
                "memphis", "nashville", "new orleans", "oklahoma city", "tulsa", "omaha",
                "des moines", "little rock", "birmingham, al", "texas", "illinois",
                "wisconsin", "minnesota", "missouri", "louisiana", "iowa", "kansas",
                "nebraska", "oklahoma", "arkansas", "mississippi", "alabama"
            ],
            "America/Chicago",
        ),
        # US - Eastern (America/New_York)
        (
            [
                "new york", "new york city", "nyc", "manhattan", "brooklyn", "queens",
                "bronx", "staten island", "boston", "cambridge", "washington dc",
                "washington d.c.", "washington", "district of columbia", "miami",
                "orlando", "tampa", "jacksonville", "atlanta", "philadelphia", "philly",
                "pittsburgh", "charlotte", "raleigh", "durham", "greensboro", "baltimore",
                "detroit", "cleveland", "cincinnati", "columbus", "indianapolis", "richmond",
                "virginia beach", "newark", "jersey city", "buffalo", "hartford", "providence",
                "new york, ny", "new jersey", "connecticut", "massachusetts", "florida",
                "georgia", "pennsylvania", "north carolina", "south carolina", "virginia",
                "maryland", "delaware", "rhode island", "ohio", "michigan"
            ],
            "America/New_York",
        ),
        # United Kingdom (Europe/London)
        (
            [
                "london", "manchester", "birmingham, uk", "birmingham, england", "liverpool",
                "leeds", "glasgow", "edinburgh", "bristol", "cardiff", "belfast",
                "united kingdom", "uk", "england", "scotland", "wales", "great britain", "gb"
            ],
            "Europe/London",
        ),
        # UAE (Asia/Dubai)
        (
            [
                "dubai", "abu dhabi", "sharjah", "ajman", "ras al khaimah", "fujairah",
                "umm al quwain", "united arab emirates", "uae", "u.a.e."
            ],
            "Asia/Dubai",
        ),
        # Singapore (Asia/Singapore)
        (
            ["singapore"],
            "Asia/Singapore",
        ),
        # Australia - Sydney (Australia/Sydney)
        (
            ["sydney", "new south wales", "nsw", "canberra", "act"],
            "Australia/Sydney",
        ),
        # Australia - Melbourne (Australia/Melbourne)
        (
            ["melbourne", "victoria, australia"],
            "Australia/Melbourne",
        ),
        # Canada - Toronto / Eastern (America/Toronto)
        (
            ["toronto", "ottawa", "montreal", "quebec", "mississauga", "brampton", "hamilton", "ontario"],
            "America/Toronto",
        ),
        # Canada - Vancouver / Pacific (America/Vancouver)
        (
            ["vancouver", "british columbia", "victoria, bc", "victoria, canada"],
            "America/Vancouver",
        ),
        # Japan (Asia/Tokyo)
        (
            ["tokyo", "osaka", "kyoto", "yokohama", "nagoya", "sapporo", "kobe", "fukuoka", "japan"],
            "Asia/Tokyo",
        ),
        # France (Europe/Paris)
        (
            ["paris", "marseille", "lyon", "toulouse", "nice", "nantes", "strasbourg", "bordeaux", "france"],
            "Europe/Paris",
        ),
        # Germany (Europe/Berlin)
        (
            ["berlin", "munich", "münchen", "frankfurt", "hamburg", "cologne", "köln", "stuttgart", "düsseldorf", "germany", "deutschland"],
            "Europe/Berlin",
        ),
    ]

    for keywords, timezone_name in LOCATION_TIMEZONE_MAPPINGS:
        for kw in keywords:
            pattern = r"\b" + re.escape(kw) + r"\b"
            if re.search(pattern, loc):
                return timezone_name

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Unable to determine timezone from location. Please provide a more specific city and country.",
    )


def get_cal_api_key() -> str:
    """
    Safely retrieves the Cal.com API key from environment variables.
    Raises HTTPException if missing or placeholder.
    Never exposes the key in logs or error messages.
    """
    key = os.getenv("CAL_API_KEY")
    if not key or key.strip() == "" or key.strip() == "PASTE_MY_CAL_COM_API_KEY_HERE":
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Cal.com API key is not configured. Please set CAL_API_KEY in the .env file.",
        )
    return key.strip()


def get_cal_headers(api_version: Optional[str] = CAL_API_VERSION) -> Dict[str, str]:
    """
    Builds the required standard headers for Cal.com API v2 requests.
    Includes custom User-Agent to ensure seamless gateway connectivity.
    """
    api_key = get_cal_api_key()
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "User-Agent": "BoomiCalendarAPI/1.0",
    }
    if api_version:
        headers["cal-api-version"] = api_version
    return headers


async def cal_api_request(
    method: str,
    endpoint: str,
    params: Optional[Dict[str, Any]] = None,
    json_data: Optional[Dict[str, Any]] = None,
    api_version: Optional[str] = CAL_API_VERSION,
) -> httpx.Response:
    """
    Helper function to make authenticated HTTP requests to Cal.com API v2.
    """
    url = f"{CAL_API_BASE_URL.rstrip('/')}/{endpoint.lstrip('/')}"
    headers = get_cal_headers(api_version=api_version)

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.request(
                method=method,
                url=url,
                headers=headers,
                params=params,
                json=json_data,
            )
            return response
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to communicate with Cal.com service: {str(exc)}",
        )


async def resolve_event_type_id(appointment_type: str) -> int:
    """
    Resolves the Cal.com eventTypeId from the given appointment_type string.
    Checks environment variables first, then default mappings, then fallback dynamic API discovery.
    """
    clean_type = appointment_type.strip().lower().replace("_", " ").replace("-", " ")

    if clean_type.isdigit():
        return int(clean_type)

    if "view" in clean_type:
        env_id = os.getenv("CAL_VIEWING_EVENT_TYPE_ID") or os.getenv("CAL_PROPERTY_VIEWING_EVENT_TYPE_ID")
        if env_id and env_id.strip().isdigit():
            return int(env_id.strip())
        return DEFAULT_EVENT_TYPES["viewing"]
    elif "consult" in clean_type:
        env_id = os.getenv("CAL_CONSULTATION_EVENT_TYPE_ID") or os.getenv("CAL_PROPERTY_CONSULTATION_EVENT_TYPE_ID")
        if env_id and env_id.strip().isdigit():
            return int(env_id.strip())
        return DEFAULT_EVENT_TYPES["consultation"]

    # Check generic CAL_EVENT_TYPE_ID
    generic_env_id = os.getenv("CAL_EVENT_TYPE_ID")
    if generic_env_id and generic_env_id.strip().isdigit():
        return int(generic_env_id.strip())

    # Dynamic lookup fallback from Cal.com event-types list
    try:
        resp = await cal_api_request("GET", "/v2/event-types", api_version="2024-06-11")
        if resp.status_code == 200:
            data = resp.json()
            for group in data.get("data", {}).get("eventTypeGroups", []):
                for et in group.get("eventTypes", []):
                    title = et.get("title", "").lower()
                    slug = et.get("slug", "").lower()
                    if clean_type in title or clean_type in slug:
                        return et["id"]
    except Exception:
        pass

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Unsupported appointment_type '{appointment_type}'. Expected 'viewing' or 'consultation'.",
    )


# ---------------------------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------------------------

@app.get("/health", summary="Health Check")
async def health_check() -> Dict[str, str]:
    """
    Health check endpoint to verify that the service is running.
    """
    return {"status": "ok"}


@app.post("/availability", summary="Get Available Slots")
async def get_availability(request: AvailabilityRequest) -> Dict[str, Any]:
    """
    Retrieves real available booking slots from Cal.com API v2 for the requested date and appointment type.
    Accepts preferred_date in DD-MM-YYYY format and converts it internally to YYYY-MM-DD for Cal.com.
    """
    # Convert DD-MM-YYYY caller date to YYYY-MM-DD for Cal.com API
    parsed_date = datetime.strptime(request.preferred_date.strip(), "%d-%m-%Y")
    cal_date_str = parsed_date.strftime("%Y-%m-%d")

    derived_tz = (
        request.timezone.strip()
        if request.timezone and request.timezone.strip()
        else derive_timezone_from_location(request.location)
    )
    event_type_id = await resolve_event_type_id(request.appointment_type)

    start_time = f"{cal_date_str}T00:00:00Z"
    end_time = f"{cal_date_str}T23:59:59Z"

    params = {
        "eventTypeId": event_type_id,
        "startTime": start_time,
        "endTime": end_time,
        "timeZone": derived_tz,
    }

    # Cal.com API v2 endpoint for available slots: GET /v2/slots/available
    response = await cal_api_request("GET", "/v2/slots/available", params=params)

    if response.status_code != 200:
        error_detail = "Failed to fetch availability from Cal.com"
        try:
            err_json = response.json()
            error_detail = (
                err_json.get("error", {}).get("message")
                or err_json.get("message")
                or error_detail
            )
        except Exception:
            pass
        raise HTTPException(
            status_code=response.status_code,
            detail=f"Cal.com Error: {error_detail}",
        )

    cal_data = response.json()
    slots_by_date = cal_data.get("data", {}).get("slots", {})

    available_slots: List[str] = []
    if cal_date_str in slots_by_date:
        available_slots = [
            slot.get("time")
            for slot in slots_by_date[cal_date_str]
            if isinstance(slot, dict) and "time" in slot
        ]
    else:
        for _, day_slots in slots_by_date.items():
            for slot in day_slots:
                if isinstance(slot, dict) and "time" in slot:
                    available_slots.append(slot["time"])

    return {
        "status": "success",
        "appointment_type": request.appointment_type,
        "event_type_id": event_type_id,
        "preferred_date": request.preferred_date,
        "timezone": derived_tz,
        "property_type": request.property_type,
        "location": request.location,
        "available_slots": available_slots,
        "total_slots": len(available_slots),
        "raw_slots": slots_by_date,
    }


@app.post("/book-appointment", summary="Book Appointment")
async def book_appointment(request: BookAppointmentRequest) -> Dict[str, Any]:
    """
    Creates a real booking in Cal.com via Cal.com API v2 POST /v2/bookings.
    Timezone is server-derived from location.
    Combines slot_date (DD-MM-YYYY) and slot_time (HH:MM AM/PM) into an ISO-8601 datetime string with timezone.
    """
    derived_tz = derive_timezone_from_location(request.location)
    event_type_id = await resolve_event_type_id(request.appointment_type)

    # Combine slot_date and slot_time with server-derived timezone into ISO-8601
    naive_dt = datetime.strptime(f"{request.slot_date.strip()} {request.slot_time.strip()}", "%d-%m-%Y %I:%M %p")
    aware_dt = naive_dt.replace(tzinfo=ZoneInfo(derived_tz))
    slot_iso_datetime = aware_dt.isoformat()

    location_val = request.location or "Site location / Online"

    payload: Dict[str, Any] = {
        "eventTypeId": event_type_id,
        "start": slot_iso_datetime,
        "attendee": {
            "name": request.name,
            "email": request.email,
            "timeZone": derived_tz,
            "phoneNumber": request.phone_number,
        },
        "location": location_val,
        "metadata": {
            "property_type": request.property_type or "",
            "location": request.location or "",
            "appointment_type": request.appointment_type,
            "timezone": derived_tz,
            "slot_date": request.slot_date,
            "slot_time": request.slot_time,
        },
    }

    # Cal.com API v2 endpoint for booking creation: POST /v2/bookings
    response = await cal_api_request("POST", "/v2/bookings", json_data=payload)

    if response.status_code not in (200, 201):
        error_detail = "Failed to create booking in Cal.com"
        try:
            err_json = response.json()
            error_detail = (
                err_json.get("error", {}).get("message")
                or err_json.get("message")
                or err_json.get("error", {}).get("details", {}).get("message")
                or error_detail
            )
        except Exception:
            pass

        # Handle specific error status codes
        if response.status_code in (401, 403):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Cal.com authentication or authorization error. Please check your CAL_API_KEY configuration.",
            )
        elif response.status_code == 409 or "no longer available" in str(error_detail).lower() or "already booked" in str(error_detail).lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"The selected slot '{request.slot_date} {request.slot_time}' is no longer available. Please choose another slot.",
            )
        else:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Cal.com Booking Error: {error_detail}",
            )

    booking_json = response.json()
    booking_data = booking_json.get("data", {})

    return {
        "status": "success",
        "message": "Appointment successfully booked in Cal.com",
        "booking_status": booking_data.get("status"),
        "booking_id": booking_data.get("id"),
        "booking_uid": booking_data.get("uid"),
        "title": booking_data.get("title"),
        "start_time": booking_data.get("start"),
        "end_time": booking_data.get("end"),
        "duration_minutes": booking_data.get("duration"),
        "event_type_id": event_type_id,
        "attendees": booking_data.get("attendees"),
        "meeting_url": booking_data.get("meetingUrl") or booking_data.get("location"),
        "location": booking_data.get("location"),
        "metadata": booking_data.get("metadata"),
    }


@app.post("/take-message", summary="Take a Message")
async def take_message(request: TakeMessageRequest) -> Dict[str, Any]:
    """
    Receives and logs a message from a caller.
    Stores contact details and the message content for follow-up.
    """
    logger = logging.getLogger("boomi_calendar_api")
    logger.info(
        "Message received from caller: name=%s, phone=%s, email=%s",
        request.name,
        request.phone_number,
        request.email or "(not provided)",
    )
    logger.info("Caller message: %s", request.message)

    return {
        "success": True,
        "message": "Message received successfully.",
        "data": {
            "name": request.name,
            "phone_number": request.phone_number,
            "email": request.email,
            "message": request.message,
        },
    }
