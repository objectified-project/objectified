"""Polyglot toolchain runner service — MFI-5.1 (#3750).

Many of the authoritative parsers/linters/diff tools the multi-format import roadmap
needs are **not Python** — ``buf`` (protobuf), ``tsp`` (TypeSpec), ``smithy``, ``drafter``
(API Blueprint), AMF (RAML, JVM), the AsyncAPI CLI, graphql-inspector. Each format
adapter must be able to shell out to one and get **structured output back**, the same
way every time. This module is that seam: a small service that runs a *registered* tool
(by key + args) in a **constrained subprocess**, captures stdout/stderr/exit, parses the
tool's JSON, enforces a per-call timeout, raises typed errors, and caps how many tool
processes run at once.

Scope (MFI-5.1 only):

* **tool registry** — :class:`ToolSpec` describes a tool (key, executable, default
  leading args, default timeout, env overrides); :func:`register_tool` /
  :func:`get_tool` / :func:`available_tools` / :func:`describe_tools` mirror the
  ImportSource registry (MFI-1.1) so UI/CLI/REST can enumerate what is wired up.
* **runner** — :class:`ToolchainRunner` runs a spec in an ``asyncio`` subprocess with a
  sanitized environment (no inherited DB URL / secrets), an explicit argv (never a
  shell), a per-call timeout that *kills* the process, JSON parsing of stdout, and a
  global concurrency cap (an :class:`asyncio.Semaphore`).
* **structured errors** — :class:`ToolchainError` subclasses for every failure mode
  (unknown tool, missing executable, timeout, non-zero exit, non-JSON output), each
  carrying the tool key so a caller can surface a clean message.

Deliberately **out of scope** here (later tickets in MFI-EPIC-5):

* bundling/pinning the actual tool binaries into the runtime image — **MFI-5.2**;
* OS-level sandboxing — no-network default, read-only FS, CPU/memory/output-size caps —
  **MFI-5.3**. This runner already drops ambient secrets from the child environment and
  never uses a shell, but it does **not** yet enforce kernel-level isolation; the
  ``extra_env`` / ``cwd`` hooks are where 5.3 will clamp down.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import shutil
import sys
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Sequence, Tuple

from pydantic import BaseModel, ConfigDict, Field

from .config import settings

logger = logging.getLogger(__name__)

__all__ = [
    "ToolSpec",
    "ToolDescriptor",
    "ToolRunResult",
    "ToolchainError",
    "ToolNotRegisteredError",
    "ToolNotAvailableError",
    "ToolTimeoutError",
    "ToolExecutionError",
    "ToolOutputError",
    "ToolchainRunner",
    "register_tool",
    "get_tool",
    "available_tools",
    "describe_tools",
    "default_runner",
    "run_tool",
    "SAMPLE_ECHO_TOOL_KEY",
]


# ===========================================================================
# Structured errors
# ===========================================================================


class ToolchainError(Exception):
    """Base class for every toolchain-runner failure.

    Carries the offending tool ``key`` so a caller (an import adapter) can surface a
    clean, tool-attributed message instead of a raw traceback.
    """

    def __init__(self, key: str, message: str) -> None:
        self.key = key
        super().__init__(message)


class ToolNotRegisteredError(ToolchainError):
    """Raised when a run targets a tool key that is not in the registry."""

    def __init__(self, key: str) -> None:
        super().__init__(key, f"No toolchain tool registered under key {key!r}")


class ToolNotAvailableError(ToolchainError):
    """Raised when a registered tool's executable is not present on the host.

    This is the "format unavailable" path the runtime-packaging ticket (MFI-5.2) keys
    off: the tool is *known* but its binary was not installed/bundled.
    """

    def __init__(self, key: str, executable: str) -> None:
        self.executable = executable
        super().__init__(
            key,
            f"Executable {executable!r} for tool {key!r} was not found on PATH; "
            "the tool is not installed in this runtime (see MFI-5.2 tool packaging).",
        )


class ToolTimeoutError(ToolchainError):
    """Raised when a tool exceeds its per-call timeout (the process is killed)."""

    def __init__(self, key: str, timeout_seconds: float) -> None:
        self.timeout_seconds = timeout_seconds
        super().__init__(
            key, f"Tool {key!r} exceeded its {timeout_seconds:g}s timeout and was killed"
        )


class ToolExecutionError(ToolchainError):
    """Raised when a tool exits non-zero. Carries exit code + captured streams."""

    def __init__(self, key: str, exit_code: int, stdout: str, stderr: str) -> None:
        self.exit_code = exit_code
        self.stdout = stdout
        self.stderr = stderr
        detail = stderr.strip() or stdout.strip() or "(no output)"
        super().__init__(key, f"Tool {key!r} exited {exit_code}: {detail[:500]}")


class ToolOutputError(ToolchainError):
    """Raised when a tool's stdout was expected to be JSON but could not be parsed."""

    def __init__(self, key: str, stdout: str, reason: str) -> None:
        self.stdout = stdout
        self.reason = reason
        super().__init__(key, f"Tool {key!r} did not return valid JSON: {reason}")


# ===========================================================================
# Tool specification, descriptor & result
# ===========================================================================

# Environment variables passed through to a tool subprocess. Everything else (notably
# DATABASE_URL, JWT secrets, cloud credentials) is dropped so a third-party CLI run over
# user-supplied input never sees the service's ambient secrets. A tool may widen this with
# its own ``env_passthrough`` for vars it genuinely needs (e.g. a tool cache dir).
_BASE_ENV_PASSTHROUGH: Tuple[str, ...] = (
    "PATH",
    "HOME",
    "LANG",
    "LC_ALL",
    "LC_CTYPE",
    "TMPDIR",
    "TEMP",
    "TMP",
    "SYSTEMROOT",  # Windows: many runtimes fail to start without it
)


@dataclass(frozen=True)
class ToolSpec:
    """How to invoke one external tool.

    Attributes:
        key: Stable registry key, e.g. ``"buf"`` / ``"tsp"`` / ``"smithy"``.
        executable: Program to run — a bare name resolved on ``PATH`` (e.g. ``"buf"``)
            or an absolute path. Resolution can be overridden at run time via any of
            ``env_override_keys``.
        description: One-line human description for the source/tool listing.
        base_args: Leading arguments always prepended before a caller's per-call args
            (e.g. ``("build", "--output", "-")``).
        default_timeout_seconds: Per-call wall-clock ceiling used when a caller passes no
            explicit timeout; ``None`` falls back to the service default.
        env_override_keys: Environment variables that, when set, override ``executable``
            with an absolute path (so a deployment can point at a bundled binary).
        env_passthrough: Extra environment variable names to forward into the subprocess
            on top of :data:`_BASE_ENV_PASSTHROUGH`.
        parses_json: Whether the tool's stdout is JSON the runner should parse. ``False``
            for tools whose useful output is non-JSON (the raw stdout is still returned).
    """

    key: str
    executable: str
    description: str = ""
    base_args: Tuple[str, ...] = ()
    default_timeout_seconds: Optional[float] = None
    env_override_keys: Tuple[str, ...] = ()
    env_passthrough: Tuple[str, ...] = ()
    parses_json: bool = True


class ToolDescriptor(BaseModel):
    """Serializable, public view of a registered tool for enumeration."""

    model_config = ConfigDict(frozen=True)

    key: str = Field(description="Stable registry key, e.g. ``buf``.")
    executable: str = Field(description="Program name or path the runner invokes.")
    description: str = Field(description="One-line description of the tool.")
    base_args: List[str] = Field(
        default_factory=list, description="Leading args always prepended to a call."
    )
    default_timeout_seconds: Optional[float] = Field(
        default=None, description="Per-call timeout default, when the tool pins one."
    )
    parses_json: bool = Field(description="Whether the runner parses stdout as JSON.")


class ToolRunResult(BaseModel):
    """The structured outcome of one successful (exit 0) tool invocation."""

    model_config = ConfigDict(frozen=True)

    key: str = Field(description="The tool key that ran.")
    argv: List[str] = Field(description="The full argv the subprocess was spawned with.")
    exit_code: int = Field(description="Process exit code (always 0 for a success).")
    stdout: str = Field(description="Captured standard output (decoded UTF-8).")
    stderr: str = Field(description="Captured standard error (decoded UTF-8).")
    parsed_json: Optional[Any] = Field(
        default=None,
        description="Parsed JSON from stdout when the tool ``parses_json`` (else ``None``).",
    )
    duration_ms: int = Field(description="Wall-clock duration of the call in milliseconds.")


# ===========================================================================
# Registry
# ===========================================================================

# Key → spec registry. A format epic registers the tool(s) it shells out to so the runner
# (and UI/CLI/REST enumeration) can resolve them by key without importing each adapter.
_REGISTRY: Dict[str, ToolSpec] = {}


def register_tool(spec: ToolSpec) -> ToolSpec:
    """Register a :class:`ToolSpec` under its :attr:`ToolSpec.key`.

    Args:
        spec: The tool specification to register.

    Returns:
        ``spec`` unchanged, so this can be used inline.

    Raises:
        ValueError: If ``spec.key`` is empty, or a *different* spec is already
            registered under the same key (re-registering an equal spec is a no-op so
            module re-import is safe).
    """
    if not spec.key:
        raise ValueError("ToolSpec.key must be a non-empty string to register")
    if not spec.executable:
        raise ValueError(f"ToolSpec {spec.key!r} must set a non-empty executable")
    existing = _REGISTRY.get(spec.key)
    if existing is not None and existing != spec:
        raise ValueError(
            f"tool {spec.key!r} already registered with a different spec; "
            "cannot re-register"
        )
    _REGISTRY[spec.key] = spec
    return spec


def get_tool(key: str) -> Optional[ToolSpec]:
    """Return the :class:`ToolSpec` registered under ``key``, or ``None``."""
    _load_builtin_tools()
    return _REGISTRY.get(key)


def available_tools() -> List[str]:
    """Return the sorted list of registered tool keys."""
    _load_builtin_tools()
    return sorted(_REGISTRY)


def describe_tools() -> List[ToolDescriptor]:
    """Return every registered tool's descriptor, sorted by key."""
    _load_builtin_tools()
    return [_descriptor_for(_REGISTRY[key]) for key in sorted(_REGISTRY)]


def _descriptor_for(spec: ToolSpec) -> ToolDescriptor:
    return ToolDescriptor(
        key=spec.key,
        executable=spec.executable,
        description=spec.description,
        base_args=list(spec.base_args),
        default_timeout_seconds=spec.default_timeout_seconds,
        parses_json=spec.parses_json,
    )


# ===========================================================================
# Runner
# ===========================================================================


def _resolve_executable(spec: ToolSpec) -> str:
    """Resolve a tool's executable to a runnable path.

    An ``env_override_keys`` value wins (a deployment can point at a bundled binary);
    otherwise an absolute/existing path is used as-is, else the name is resolved on
    ``PATH``.

    Raises:
        ToolNotAvailableError: If nothing resolves to an executable on this host.
    """
    for env_key in spec.env_override_keys:
        override = (os.environ.get(env_key) or "").strip()
        if override:
            return override

    candidate = spec.executable
    if os.path.isabs(candidate) and os.path.isfile(candidate):
        return candidate

    resolved = shutil.which(candidate)
    if resolved:
        return resolved

    raise ToolNotAvailableError(spec.key, spec.executable)


def _build_subprocess_env(spec: ToolSpec, extra_env: Optional[Dict[str, str]]) -> Dict[str, str]:
    """Build the sanitized environment for a tool subprocess.

    Only an allow-list of host variables is forwarded (plus the tool's declared
    ``env_passthrough`` and any caller ``extra_env``), so ambient secrets never reach a
    third-party CLI.
    """
    allowed = (*_BASE_ENV_PASSTHROUGH, *spec.env_passthrough)
    env: Dict[str, str] = {
        name: os.environ[name] for name in allowed if name in os.environ
    }
    if extra_env:
        env.update(extra_env)
    return env


class ToolchainRunner:
    """Runs registered tools in constrained subprocesses, capped at N concurrent.

    One shared instance (:data:`default_runner`) backs the whole service; the concurrency
    cap is process-wide so a burst of imports cannot fork-bomb the host. The cap is
    enforced with an :class:`asyncio.Semaphore`; excess calls queue and run as slots free.
    """

    def __init__(self, max_concurrency: int, default_timeout_seconds: float) -> None:
        """Create a runner.

        Args:
            max_concurrency: Maximum tool subprocesses allowed to run simultaneously
                (clamped to at least 1).
            default_timeout_seconds: Per-call timeout used when neither the call nor the
                tool spec pins one.
        """
        self.max_concurrency = max(1, int(max_concurrency))
        self.default_timeout_seconds = float(default_timeout_seconds)
        self._semaphore = asyncio.Semaphore(self.max_concurrency)
        # Live/peak in-flight counters, for observability and the concurrency-cap tests.
        self._active = 0
        self._peak_active = 0

    @property
    def active(self) -> int:
        """How many tool subprocesses are running right now."""
        return self._active

    @property
    def peak_active(self) -> int:
        """The high-water mark of simultaneously-running tool subprocesses."""
        return self._peak_active

    async def run(
        self,
        key: str,
        args: Sequence[str] = (),
        *,
        stdin: Optional[str] = None,
        timeout: Optional[float] = None,
        cwd: Optional[str] = None,
        extra_env: Optional[Dict[str, str]] = None,
    ) -> ToolRunResult:
        """Run a registered tool by ``key`` with ``args`` and return its result.

        Raises:
            ToolNotRegisteredError: If ``key`` is not registered.
            ToolNotAvailableError / ToolTimeoutError / ToolExecutionError /
            ToolOutputError: See :meth:`run_spec`.
        """
        spec = get_tool(key)
        if spec is None:
            raise ToolNotRegisteredError(key)
        return await self.run_spec(
            spec, args, stdin=stdin, timeout=timeout, cwd=cwd, extra_env=extra_env
        )

    async def run_spec(
        self,
        spec: ToolSpec,
        args: Sequence[str] = (),
        *,
        stdin: Optional[str] = None,
        timeout: Optional[float] = None,
        cwd: Optional[str] = None,
        extra_env: Optional[Dict[str, str]] = None,
    ) -> ToolRunResult:
        """Run a tool described by ``spec`` (no registry lookup) and return its result.

        The subprocess is spawned with an explicit argv (never a shell), a sanitized
        environment, and an optional working directory. Its stdout/stderr are captured
        with a per-call timeout; on timeout the process is killed.

        Args:
            spec: The tool specification to run.
            args: Per-call arguments appended after ``spec.base_args``.
            stdin: Optional text written to the process's standard input.
            timeout: Per-call timeout in seconds; falls back to the spec default, then
                the runner default.
            cwd: Optional working directory for the subprocess.
            extra_env: Optional environment overrides merged onto the sanitized env.

        Returns:
            A :class:`ToolRunResult` with exit code, captured streams, parsed JSON (when
            ``spec.parses_json``), and the call duration.

        Raises:
            ToolNotAvailableError: The executable was not found on the host.
            ToolTimeoutError: The call exceeded its timeout (process killed).
            ToolExecutionError: The tool exited non-zero.
            ToolOutputError: ``spec.parses_json`` but stdout was not valid JSON.
        """
        executable = _resolve_executable(spec)
        argv: List[str] = [executable, *spec.base_args, *args]
        env = _build_subprocess_env(spec, extra_env)
        effective_timeout = float(
            timeout
            if timeout is not None
            else (
                spec.default_timeout_seconds
                if spec.default_timeout_seconds is not None
                else self.default_timeout_seconds
            )
        )
        stdin_bytes = stdin.encode("utf-8") if stdin is not None else None

        async with self._semaphore:
            self._active += 1
            self._peak_active = max(self._peak_active, self._active)
            started = time.monotonic()
            try:
                return await self._spawn_and_capture(
                    spec, argv, env, cwd, stdin_bytes, effective_timeout, started
                )
            finally:
                self._active -= 1

    async def _spawn_and_capture(
        self,
        spec: ToolSpec,
        argv: List[str],
        env: Dict[str, str],
        cwd: Optional[str],
        stdin_bytes: Optional[bytes],
        timeout_seconds: float,
        started: float,
    ) -> ToolRunResult:
        """Spawn the subprocess, capture its output under a timeout, build the result."""
        logger.info("toolchain run key=%s argv=%s timeout=%.1fs", spec.key, argv, timeout_seconds)
        try:
            proc = await asyncio.create_subprocess_exec(
                *argv,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=cwd,
                env=env,
            )
        except (FileNotFoundError, NotADirectoryError) as exc:
            # The executable resolved but vanished between resolution and spawn, or cwd is
            # bad — treat as "tool not available" with the underlying reason.
            raise ToolNotAvailableError(spec.key, spec.executable) from exc

        try:
            stdout_b, stderr_b = await asyncio.wait_for(
                proc.communicate(input=stdin_bytes), timeout=timeout_seconds
            )
        except asyncio.TimeoutError as exc:
            proc.kill()
            # Reap the killed process so it does not linger as a zombie.
            try:
                await proc.wait()
            except Exception:  # noqa: BLE001 - best-effort reap; the kill already happened
                logger.debug("toolchain reap-after-timeout failed key=%s", spec.key, exc_info=True)
            raise ToolTimeoutError(spec.key, timeout_seconds) from exc

        duration_ms = int((time.monotonic() - started) * 1000)
        stdout = stdout_b.decode("utf-8", errors="replace")
        stderr = stderr_b.decode("utf-8", errors="replace")
        exit_code = proc.returncode if proc.returncode is not None else -1

        if exit_code != 0:
            raise ToolExecutionError(spec.key, exit_code, stdout, stderr)

        parsed: Optional[Any] = None
        if spec.parses_json:
            try:
                parsed = json.loads(stdout)
            except json.JSONDecodeError as exc:
                raise ToolOutputError(spec.key, stdout, str(exc)) from exc

        return ToolRunResult(
            key=spec.key,
            argv=argv,
            exit_code=exit_code,
            stdout=stdout,
            stderr=stderr,
            parsed_json=parsed,
            duration_ms=duration_ms,
        )


# ===========================================================================
# Built-in sample tool + default runner
# ===========================================================================

#: Registry key of the built-in sample tool — a portable JSON echo used as the
#: acceptance vehicle (and the smallest worked example) so the runner can be exercised
#: end-to-end without bundling a real external CLI (that is MFI-5.2).
SAMPLE_ECHO_TOOL_KEY = "sample-echo"

# A tiny, dependency-free script run via the current Python interpreter: it echoes a JSON
# object describing the args it received and any stdin, so a caller gets parsed JSON back.
_SAMPLE_ECHO_SCRIPT = (
    "import json,sys;"
    "sys.stdout.write(json.dumps({"
    "'tool':'sample-echo','args':sys.argv[1:],'stdin':sys.stdin.read()}))"
)

_builtins_loaded = False


def _load_builtin_tools() -> None:
    """Register the built-in sample tool once (idempotent and cheap)."""
    global _builtins_loaded
    if _builtins_loaded:
        return
    _builtins_loaded = True
    register_tool(
        ToolSpec(
            key=SAMPLE_ECHO_TOOL_KEY,
            executable=sys.executable,
            description="Portable JSON echo (reference tool for the toolchain runner).",
            base_args=("-c", _SAMPLE_ECHO_SCRIPT),
            default_timeout_seconds=15.0,
            parses_json=True,
        )
    )


#: The process-wide runner. Its concurrency cap and default timeout come from settings so
#: a deployment can tune them without code changes.
default_runner = ToolchainRunner(
    max_concurrency=settings.toolchain_max_concurrency,
    default_timeout_seconds=settings.toolchain_default_timeout_seconds,
)


async def run_tool(
    key: str,
    args: Sequence[str] = (),
    *,
    stdin: Optional[str] = None,
    timeout: Optional[float] = None,
    cwd: Optional[str] = None,
    extra_env: Optional[Dict[str, str]] = None,
) -> ToolRunResult:
    """Run a registered tool on the shared :data:`default_runner` (module convenience)."""
    return await default_runner.run(
        key, args, stdin=stdin, timeout=timeout, cwd=cwd, extra_env=extra_env
    )
