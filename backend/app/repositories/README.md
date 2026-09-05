# Repository layer

Repositories own persistence queries. Services decide what should happen; these
adapters validate write shapes, scope queries, and communicate with Supabase.
They do not implement pricing, conversation analysis, or workflow transitions.
Existing services and API routes have not been wired to these adapters yet.

## Interfaces

Every repository takes a trusted `company_id: UUID` and optionally an injected
`supabase.Client`. Without an injected client, it obtains the existing reusable
client from `app.database.supabase.get_supabase_client()` on first operation.

| Repository | Async methods |
| --- | --- |
| `CustomerRepository` | `create_customer(data)`, `get_customer_by_email(email)`, `update_customer(customer_id, data)` |
| `LeadRepository` | `create_lead(data)`, `update_lead_status(lead_id, status)`, `get_lead_by_id(lead_id)` |
| `CallRepository` | `save_call_record(data)`, `get_call_history(customer_id=None, limit=50, offset=0)` |
| `ProjectRepository` | `create_project(data)`, `update_project_status(project_id, status)` |
| `QuoteRepository` | `create_quote(project_id, data)`, `update_quote_status(project_id, quote_id, status)`, `get_quotes_by_project(project_id, limit=50, offset=0)` |

Write methods accept their corresponding Pydantic models from `schemas.py` or
mappings. Unknown fields are rejected, including caller-supplied company IDs.
Status methods accept nonblank strings; allowed transitions belong in services.
Records are returned as dictionaries in the SDK's JSON representation. Create
and update methods return the saved row. Single-record reads return `None` when
absent. Updates of absent records raise `RecordNotFoundError`.

```python
from uuid import UUID
from app.repositories.customer_repository import CustomerRepository
from app.repositories.schemas import CustomerCreate

async def save_customer(company_id: UUID):
    # company_id must come from trusted, verified context.
    repository = CustomerRepository(company_id)
    return await repository.create_customer(CustomerCreate(
        name="Example customer", email="customer@example.com",
    ))
```

The existing client is synchronous. Each async repository operation offloads
client initialization and the complete query to AnyIO's bounded worker thread
pool. The application owns client cleanup. No new dependency or client instance
per repository is required.

## Tenant and data contracts

- Every direct read/update filters by company. Inserts assign company from the
  repository. Related customer ownership is enforced by the migrations' composite
  foreign keys, including when the server key bypasses RLS.
- Quotes inherit tenancy through projects. Every operation first reads the
  company-scoped project; quote reads/updates also filter by that project ID.
  Missing and foreign-company projects produce the same not-found error. These
  checks are separate HTTP operations, not a transaction. Project company
  transfers must not run concurrently; an atomic database RPC is needed before
  implementing that workflow. This layer does not expose tenant transfers.
- Customer emails are trimmed and lowercased on writes and lookup. Existing rows
  written outside this layer must use the same convention. Email is not unique
  in the schema: a lookup matching multiple customers raises a conflict instead
  of choosing an arbitrary customer. It uses equality, not wildcard matching.
- Customer updates preserve omitted fields. Explicit null clears nullable contact
  fields; name cannot be cleared. Empty patches are rejected.
- Call history and project quote history are paginated with a maximum of 100 rows,
  ordered by creation time then UUID. Offset pages are not a snapshot and can
  shift during concurrent inserts; use cursor pagination for future busy feeds.
- Saving a call is an insert. A duplicate `retell_call_id` raises a conflict.
  No upsert or webhook deduplication workflow is introduced here.
- Monetary inputs use Decimal and serialize as decimal strings. Quotes require
  an explicit total from the pricing layer. Datetime deadlines must include a
  time zone. The database maintains creation and modification timestamps.
- To persist a future `LeadDraft`, use its ID and editable fields in `LeadCreate`;
  supply the verified company through the constructor, not in the payload.
  The current service layer is deliberately unchanged.

## Errors and operations

`errors.py` exports `RepositoryError`, `RecordNotFoundError`,
`RepositoryConflictError`, and `RepositoryIntegrityError`. Provider bodies and
credentials are omitted from translated errors and repository logs. Input errors
are Pydantic `ValidationError` or `ValueError`; future API adapters can map these
and repository errors to appropriate HTTP responses.

No repository automatically retries writes: a transport failure may occur after
an insert commits. Use caller IDs/idempotency workflows before retrying such
operations. Multi-record transactions should be implemented as explicit database
RPCs in a later integration, not assumed across separate REST calls.

Apply `backend/database/migrations/` and configure the server Supabase environment
before live use. Tests use the real SDK with mock HTTP transport and do not access
customer data or the live database:

```sh
# From backend/ with its virtual environment activated:
python -m unittest discover -s tests -v
```

Shared files: `base.py` supplies tenant binding, execution, result checks, and
pagination; `schemas.py` defines validated write inputs; `errors.py` defines
storage exceptions; `__init__.py` marks the package.
