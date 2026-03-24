import os
from pathlib import Path


ROOT_ENV_PATH = Path(__file__).resolve().parents[3] / ".env"


def load_root_env() -> Path:
    if not ROOT_ENV_PATH.is_file():
        return ROOT_ENV_PATH

    for line in ROOT_ENV_PATH.read_text().splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue

        if stripped.startswith("export "):
            stripped = stripped[len("export ") :].strip()

        if "=" not in stripped:
            continue

        key, value = stripped.split("=", 1)
        key = key.strip()
        value = value.strip()

        if value[:1] == value[-1:] and value[:1] in {"'", '"'}:
            value = value[1:-1]

        os.environ.setdefault(key, value)

    return ROOT_ENV_PATH
