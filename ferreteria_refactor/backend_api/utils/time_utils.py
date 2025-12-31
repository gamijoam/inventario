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

def get_venezuela_now():
    """
    Returns the current time in Venezuela (UTC-4) as a naive datetime object.
    This ensures that when saved to the DB (timestamp without timezone),
    it reflects the wall-clock time in Venezuela.
    """
    tz_name = 'America/Caracas'
    
    if ZoneInfo:
        try:
            # Get current time in Venezuela
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
            
    # Fallback: Manual offset (UTC-4)
    # This is rough but works if timezone libs are missing
    utc_now = datetime.utcnow()
    venezuela_time = utc_now - timedelta(hours=4)
    return venezuela_time
