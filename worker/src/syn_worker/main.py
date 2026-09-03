from __future__ import annotations

import uvicorn

from .api import create_app
from .config import Settings


def run_api() -> None:
	uvicorn.run(create_app(Settings.from_environment()), host='0.0.0.0', port=8080, proxy_headers=True)
