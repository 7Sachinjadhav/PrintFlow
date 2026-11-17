import requests
import logging
from typing import Optional, Dict, Any, List
from config import Config

logger = logging.getLogger("ApiClient")

class ApiClient:
    def __init__(self):
        self.base_url = Config.BACKEND_URL
        self.api_key = Config.AGENT_API_KEY
        self.session = requests.Session()
        self.session.headers.update({
            "x-agent-api-key": self.api_key,
            "User-Agent": f"PrintFlow-Agent/{Config.AGENT_VERSION}",
        })

    def register(self) -> bool:
        try:
            url = f"{self.base_url}/api/agent/register"
            payload = {
                "agentName": Config.AGENT_NAME,
                "operatingSystem": Config.OPERATING_SYSTEM,
                "agentVersion": Config.AGENT_VERSION,
                "simulationMode": Config.SIMULATION_MODE,
            }
            resp = self.session.post(url, json=payload, timeout=5)
            if resp.status_code == 200:
                logger.info("Agent successfully registered with backend.")
                return True
            else:
                logger.error(f"Registration failed: {resp.status_code} - {resp.text}")
                return False
        except Exception as e:
            logger.error(f"Failed to connect to backend: {e}")
            return False

    def sync_printers(self, printers: List[str]) -> bool:
        try:
            url = f"{self.base_url}/api/agent/printers/discovery"
            resp = self.session.post(url, json={"printers": printers}, timeout=5)
            return resp.status_code == 200
        except Exception as e:
            logger.warning(f"Printer sync warning: {e}")
            return False

    def send_heartbeat(self, discovered_printers: List[str] = None, active_job_id: str = None) -> bool:
        try:
            url = f"{self.base_url}/api/agent/heartbeat"
            payload = {
                "agentId": "agent-shop-win11",
                "discoveredQueues": discovered_printers or [],
                "activeJobId": active_job_id,
            }
            resp = self.session.post(url, json=payload, timeout=5)
            return resp.status_code == 200
        except Exception as e:
            logger.warning(f"Heartbeat failed: {e}")
            return False

    def claim_next_job(self) -> Optional[Dict[str, Any]]:
        try:
            url = f"{self.base_url}/api/agent/jobs/next"
            resp = self.session.get(url, timeout=5)
            if resp.status_code == 200:
                data = resp.json().get("data")
                return data
            return None
        except Exception as e:
            logger.error(f"Job claim error: {e}")
            return None

    def download_document(self, document_id: str, lease_token: str, save_path: str) -> bool:
        try:
            url = f"{self.base_url}/api/agent/documents/{document_id}/download?leaseToken={lease_token}"
            resp = self.session.get(url, stream=True, timeout=30)
            if resp.status_code == 200:
                with open(save_path, "wb") as f:
                    for chunk in resp.iter_content(chunk_size=8192):
                        f.write(chunk)
                return True
            logger.error(f"Document download failed with HTTP {resp.status_code}")
            return False
        except Exception as e:
            logger.error(f"Error downloading document: {e}")
            return False

    def update_job_status(self, job_id: str, status: str, lease_token: str = None, spooler_job_id: int = None, error_msg: str = None) -> bool:
        try:
            url = f"{self.base_url}/api/agent/jobs/{job_id}/status"
            payload = {
                "status": status,
                "leaseToken": lease_token,
                "spoolerJobId": spooler_job_id,
                "errorMessage": error_msg,
            }
            resp = self.session.post(url, json=payload, timeout=5)
            return resp.status_code == 200
        except Exception as e:
            logger.error(f"Status update error: {e}")
            return False
