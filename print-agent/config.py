import os

class Config:
    BACKEND_URL = os.environ.get("PRINTFLOW_BACKEND_URL", "https://printflow-production-c9e53090.up.railway.app")
    AGENT_API_KEY = os.environ.get("PRINTFLOW_AGENT_KEY", "pf_agent_secret_win11_2026_key")
    AGENT_NAME = os.environ.get("PRINTFLOW_AGENT_NAME", "Shop-Win11-Host")
    OPERATING_SYSTEM = "Windows 11"
    AGENT_VERSION = "1.0.0"

    # SAFE SIMULATION MODE:
    # Set to True to safely simulate job processing without physical paper waste.
    # Set to False to dispatch physical jobs to Windows Print Spooler.
    SIMULATION_MODE = os.environ.get("PRINTFLOW_SIMULATION_MODE", "true").lower() in ("true", "1", "yes")

    POLL_INTERVAL_SECONDS = 3
    HEARTBEAT_INTERVAL_SECONDS = 15

    TEMP_DOWNLOAD_DIR = os.path.join(os.path.dirname(__file__), "downloads")
