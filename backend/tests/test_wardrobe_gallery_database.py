import pytest
from test_foundation_database import SOCKET, as_user, sql, success, users  # noqa: F401
from test_wardrobe_database import create, upload, rows
from test_personalization_database import verified
pytestmark=pytest.mark.skipif(not SOCKET,reason='Use run_local.py --registration')


def test_gallery_attach_primary_remove_and_replay(users):
    a,_,seed=users
    original,first=create(a)
    extra,second=upload(a)
    capture="SELECT set_config('test.g',api.list_wardrobe()->'items'->0->>'id',true);"
    g="current_setting('test.g')::uuid"
    prefix=seed+verified(a)+as_user(a)+first+capture+second
    attach=f"SELECT api.wardrobe_gallery({g},'attach','{extra}');"
    output=rows(success(prefix+attach+attach+f"SELECT api.wardrobe_gallery({g},'primary','{extra}');SELECT api.wardrobe_gallery({g},'remove','{original}');ROLLBACK;"))
    assert len(output[-3])==2 and len(output[-1])==1
    assert output[-1][0]['id']==extra and output[-1][0]['primary']
    failure=sql(prefix+f"SELECT api.wardrobe_gallery({g},'remove','{original}');ROLLBACK;")
    assert failure.returncode and 'Choose another primary' in failure.stderr


def test_gallery_owner_isolation(users):
    a,b,seed=users
    _,first=create(a)
    prefix=seed+verified(a)+verified(b)+as_user(a)+first+"SELECT set_config('test.g',api.list_wardrobe()->'items'->0->>'id',true);"+as_user(b)
    result=sql(prefix+"SELECT api.wardrobe_gallery(current_setting('test.g')::uuid);ROLLBACK;")
    assert result.returncode and 'Garment not found' in result.stderr


def test_gallery_delete_retires_all(users):
    a,_,seed=users
    _,first=create(a)
    extra,second=upload(a)
    g="current_setting('test.g')::uuid"
    result=rows(success(seed+verified(a)+as_user(a)+first+"SELECT set_config('test.g',api.list_wardrobe()->'items'->0->>'id',true);"+second+f"SELECT api.wardrobe_gallery({g},'attach','{extra}');SELECT api.delete_wardrobe({g});SELECT api.wardrobe_image_cleanup();ROLLBACK;"))[-1]
    assert len(result)==2
