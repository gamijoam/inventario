from datetime import datetime, timedelta
import os

# Try to use zoneinfo (Python 3.9+)
try:
    from zoneinfo import ZoneInfo
except ImportError:
    # Fallback for older python or if backports.zoneinfo is needed
    try:
        from backports.zoneinfo import ZoneInfo
    except ImportError:
        ZoneInfo = None

# Try pytz as alternative
try:
    import pytz
except ImportError:
    pytz = None

from ..config import settings

def get_venezuela_now():
    """
    Returns the current time in the configured timezone (default America/Caracas) 
    as a naive datetime object.
    
    This ensures that when saved to the DB (timestamp without timezone),
    it reflects the wall-clock time in the specific region.
    """
    tz_name = settings.TIMEZONE
    
    if ZoneInfo:
        try:
            # Get current time in Configured Timezone
            tz = ZoneInfo(tz_name)
            now_aware = datetime.now(tz)
            # Return naive datetime (for compatibility with existing DB columns)
            return now_aware.replace(tzinfo=None)
        except Exception as e:
            print(f"Error using ZoneInfo: {e}")

    if pytz:
        try:
            tz = pytz.timezone(tz_name)
            now_aware = datetime.now(tz)
            return now_aware.replace(tzinfo=None)
        except Exception as e:
            print(f"Error using pytz: {e}")
            
    # Fallback: Manual offset (UTC-4 for VET) if libraries fail
    # Note: Ideally we should calculate offset from timezone name, but fallback is fallback.
    utc_now = datetime.utcnow()
    venezuela_time = utc_now - timedelta(hours=4)
    return venezuela_time
