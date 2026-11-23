"""Owner-scoped duplicate warning checks on disposable PostgreSQL."""
import pytest
from test_foundation_database import SOCKET, as_user, sql, success, users  # noqa: F401
from test_wardrobe_database import create, upload, rows, j
from test_personalization_database import verified
pytestmark = pytest.mark.skipif(not SOCKET, reason='Use run_local.py --registration')


def test_duplicate_warns_and_override_keeps_both(users):
    a, _, seed = users
    _, first = create(a)
    image, second = upload(a)
    prefix = seed + verified(a) + as_user(a) + first + second
    call = f"SELECT api.create_wardrobe_checked({j({'name':'Another shirt','category':'Tops'})},'{image}'"
    failed = sql(prefix + call + ',false);ROLLBACK;')
    assert failed.returncode and 'Matching wardrobe photo' in failed.stderr
    result = rows(success(prefix + call + ',true);SELECT api.list_wardrobe();ROLLBACK;'))[-1]
    assert len(result['items']) == 2


def test_other_user_match_does_not_disclose_or_block(users):
    a, b, seed = users
    _, first = create(a)
    image, second = upload(b)
    result = rows(success(seed + verified(a) + verified(b) + as_user(a) + first + as_user(b) + second
        + f"SELECT api.create_wardrobe_checked({j({'name':'My shirt','category':'Tops'})},'{image}',false);"
        + 'SELECT api.list_wardrobe();ROLLBACK;'))[-1]
    assert len(result['items']) == 1


def test_foreign_upload_rejected(users):
    a, b, seed = users
    image, statement = upload(a)
    result = sql(seed + verified(a) + verified(b) + as_user(a) + statement + as_user(b)
        + f"SELECT api.create_wardrobe_checked({j({'name':'Stolen','category':'Tops'})},'{image}',true);ROLLBACK;")
    assert result.returncode and 'Image not found' in result.stderr
