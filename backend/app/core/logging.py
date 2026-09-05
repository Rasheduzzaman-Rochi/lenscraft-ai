"""JSON logs to stdout for application and Uvicorn loggers."""

import json
import logging
from datetime import datetime, timezone
from logging.config import dictConfig


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": datetime.fromtimestamp(record.created, timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "service": "lenscraft-backend",
            "message": record.getMessage(),
        }
        if hasattr(record, "environment"):
            payload["environment"] = record.environment
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False)


def configure_logging(level: str = "INFO") -> None:
    dictConfig({
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {"json": {"()": JsonFormatter}},
        "handlers": {"stdout": {
            "class": "logging.StreamHandler",
            "stream": "ext://sys.stdout",
            "formatter": "json",
        }},
        "root": {"handlers": ["stdout"], "level": level},
        "loggers": {
            name: {"handlers": [], "level": level, "propagate": True}
            for name in ("uvicorn", "uvicorn.error", "uvicorn.access")
        },
    })
