"""Controlled image intake for the Analyzer (the `fetch_image` tool).

Image URLs come from the public submission, so they are UNTRUSTED. Without controls, an attacker
could make this service fetch internal URLs (SSRF) or huge files. Enforced here:
  * http/https only, no embedded credentials
  * host must be the backend's own host or in IMAGE_HOST_ALLOWLIST
  * relative paths ("/uploads/x.jpg") are resolved against the backend URL
  * redirects are NOT followed (a redirect could leave the allow-list)
  * hard timeout and hard size cap (streamed, aborted early)
  * content must really be JPEG/PNG/WEBP (magic bytes), whatever the headers claim
  * the audit record keeps the host only (URLs may carry signed tokens)
"""
from __future__ import annotations

import time
from urllib.parse import urljoin, urlparse

import httpx

from shared.config import Settings
from shared.contracts import ToolCallRecord
from shared.llm import ImagePart

TOOL_NAME = "fetch_image"


class ImageFetchError(RuntimeError):
    pass


def _sniff_mime(data: bytes) -> str | None:
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


class ImageFetcher:
    def __init__(self, settings: Settings, *, client: httpx.AsyncClient | None = None) -> None:
        self._settings = settings
        self._client = client
        self._api_host = (urlparse(settings.api_base_url).hostname or "").lower()
        self.calls: list[ToolCallRecord] = []

    def resolve(self, url: str) -> str:
        """Validate and return an absolute URL, or raise ImageFetchError."""
        raw = (url or "").strip()
        if raw.startswith("/") and not raw.startswith("//"):
            raw = urljoin(self._settings.api_base_url.rstrip("/") + "/", raw.lstrip("/"))
        parsed = urlparse(raw)
        if parsed.scheme not in ("http", "https") or not parsed.hostname:
            raise ImageFetchError("only http(s) image URLs are accepted")
        if parsed.username or parsed.password:
            raise ImageFetchError("URLs with embedded credentials are not accepted")
        host = parsed.hostname.lower()
        if host != self._api_host and host not in self._settings.allowed_image_hosts:
            raise ImageFetchError("image host is not allow-listed")
        return raw

    async def fetch(self, url: str) -> ImagePart:
        record = ToolCallRecord(tool=TOOL_NAME, agent="analyzer", attempts=1)
        started = time.perf_counter()
        try:
            absolute = self.resolve(url)
            record.input_summary["host"] = urlparse(absolute).hostname
            data = await self._download(absolute, record)
            mime = _sniff_mime(data)
            if mime is None:
                raise ImageFetchError("file is not a JPEG, PNG or WEBP image")
            record.ok = True
            return ImagePart(mime_type=mime, data=data)
        except ImageFetchError as exc:
            record.error = str(exc)
            raise
        finally:
            record.duration_ms = int((time.perf_counter() - started) * 1000)
            self.calls.append(record)

    async def _download(self, url: str, record: ToolCallRecord) -> bytes:
        limit = self._settings.max_image_bytes
        timeout = httpx.Timeout(self._settings.image_timeout_seconds)
        owns_client = self._client is None
        client = self._client or httpx.AsyncClient(timeout=timeout, follow_redirects=False)
        try:
            async with client.stream("GET", url, follow_redirects=False) as response:
                record.status_code = response.status_code
                if response.status_code != 200:
                    raise ImageFetchError(f"image server returned HTTP {response.status_code}")
                declared = response.headers.get("content-length")
                if declared and declared.isdigit() and int(declared) > limit:
                    raise ImageFetchError("image is larger than the size limit")
                chunks: list[bytes] = []
                total = 0
                async for chunk in response.aiter_bytes():
                    total += len(chunk)
                    if total > limit:
                        raise ImageFetchError("image is larger than the size limit")
                    chunks.append(chunk)
                return b"".join(chunks)
        except httpx.HTTPError as exc:
            raise ImageFetchError(f"image download failed ({type(exc).__name__})") from None
        finally:
            if owns_client:
                await client.aclose()

    def drain(self) -> list[ToolCallRecord]:
        calls, self.calls = self.calls, []
        return calls
