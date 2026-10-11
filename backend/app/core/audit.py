"""Request-scoped "current user" used to auto-stamp audit columns."""
import contextvars

current_actor: contextvars.ContextVar = contextvars.ContextVar(
    "current_actor", default=None
)
