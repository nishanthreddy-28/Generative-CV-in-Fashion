import pytest
from test_foundation_database import SOCKET, as_user, sql, success, users  # noqa: F401
from test_outfits_database import garments, CREATE, CAPTURE, TARGET
from test_wardrobe_database import rows
from test_personalization_database import verified
pytestmark=pytest.mark.skipif(not SOCKET,reason='Use run_local.py --registration')


def test_duplicate_preserves_original_and_uses_new_item_ids(users):
    a,_,seed=users
    output=rows(success(seed+verified(a)+as_user(a)+garments(a)+CREATE+CAPTURE+f'SELECT api.duplicate_outfit({TARGET});SELECT api.read_outfit({TARGET});ROLLBACK;'))
    copy,original=output[-2:]
    assert copy['id']!=original['id'] and copy['name']=='My look (copy)'
    assert copy['garmentIds']==original['garmentIds']
    assert [i['garmentId'] for i in copy['items']]==[i['garmentId'] for i in original['items']]
    assert not set(i['id'] for i in copy['items']) & set(i['id'] for i in original['items'])


def test_duplicate_foreign_outfit_rejected(users):
    a,b,seed=users
    result=sql(seed+verified(a)+verified(b)+as_user(a)+garments(a)+CREATE+CAPTURE+as_user(b)+f'SELECT api.duplicate_outfit({TARGET});ROLLBACK;')
    assert result.returncode and 'Outfit not found' in result.stderr
