class ChannelSendError(Exception):
    """Raised when a channel provider fails to send an outbound message."""

    def __init__(
        self,
        message: str,
        *,
        status_code: int | None = None,
        raw_response: dict | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.raw_response = raw_response or {}
