NO_PROBLEMS_DETECTED_STATUS = {
    "status": "STOPPED",
    "reason": "NO_PROBLEMS_DETECTED",
    "message": "No problems were detected from your sources. Add more detailed source documents and re-run.",
}


def stopped_after_no_problems() -> dict:
    return dict(NO_PROBLEMS_DETECTED_STATUS)
