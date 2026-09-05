"""Storage errors safe for services to handle without exposing provider details."""


class RepositoryError(RuntimeError):
    """A database operation failed; a failed write may have an unknown outcome."""


class RecordNotFoundError(RepositoryError):
    """No matching record is visible within the requested company."""


class RepositoryConflictError(RepositoryError):
    """A unique constraint failed or a lookup matched multiple records."""


class RepositoryIntegrityError(RepositoryError):
    """A foreign key or database check constraint rejected the operation."""
