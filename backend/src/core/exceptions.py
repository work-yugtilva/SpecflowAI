class JSONParsingError(Exception):
    """Raised by BaseAgent.parse_json() when json_repair cannot recover valid JSON."""

    def __init__(self, message: str, raw_snippet: str = ""):
        super().__init__(message)
        self.raw_snippet = raw_snippet
