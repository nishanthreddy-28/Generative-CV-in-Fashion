"""Filtered pagination using real PostgreSQL grants/RLS and deterministic ties."""
import json
from uuid import uuid4
import pytest
from test_foundation_database import SOCKET,as_user,sql,success,users  # noqa: F401
from test_wardrobe_database import j,rows
from test_outfits_database import garments,MIXED,OWN

pytestmark=pytest.mark.skipif(not SOCKET,reason='Use disposable tests/database/run_local.py')


def setup(a):
    return garments(a)+f"SELECT api.create_outfit('Alpha',{MIXED});SELECT api.create_outfit('Alpha',{OWN});SELECT api.create_outfit('Beta',{MIXED});SELECT api.create_outfit('100% match',{OWN});"


@pytest.mark.parametrize('sort',['newest','name'])
def test_every_tied_row_once_across_pages_and_owner_isolation(users,sort):
    a,b,seed=users
    prefix=seed+setup(a)
    call=f"api.query_outfits(1,NULL,'','','','{sort}')"
    # Keep pages in one transaction: all fixtures have identical creation timestamps.
    statement=f"DO $$DECLARE p jsonb;cur jsonb;seen uuid[]:='{{}}';ident uuid;BEGIN LOOP p:=api.query_outfits(1,cur,'','','','{sort}');EXIT WHEN jsonb_array_length(p->'items')=0;ident:=(p->'items'->0->>'id')::uuid;IF ident=ANY(seen) THEN RAISE EXCEPTION 'Duplicate row';END IF;seen:=array_append(seen,ident);cur:=p->'nextCursor';EXIT WHEN cur='null'::jsonb;END LOOP;IF cardinality(seen)<>4 THEN RAISE EXCEPTION 'Skipped row';END IF;END;$$;"
    success(prefix+statement+'ROLLBACK;')
    result=rows(success(prefix+f"SELECT {call};"+as_user(b)+'SELECT api.query_outfits();ROLLBACK;'))
    assert result[-2]['nextCursor'] is not None
    assert result[-1]=={'items':[],'nextCursor':None}


@pytest.mark.parametrize('search,source,category,names',[
 ('alpha','','',['Alpha','Alpha']),('ALPHA','catalog','Outerwear',['Alpha']),
 ('','wardrobe','Outerwear',[]),('','wardrobe','Bottoms',['100% match','Alpha']),
 ('','catalog','Tops',[]),('%','','',['100% match']),('missing','','',[])])
def test_literal_search_source_category_combination(users,search,source,category,names):
    a,_,seed=users
    result=rows(success(seed+setup(a)+f"SELECT api.query_outfits(p_search=>'{search}',p_source=>'{source}',p_category=>'{category}',p_sort=>'name');ROLLBACK;"))[-1]
    assert [o['name'] for o in result['items']]==names
    assert result['nextCursor'] is None


def test_inclusive_start_exclusive_end_and_existing_metadata_and_items_unchanged(users):
    a,_,seed=users
    prefix=seed+setup(a)+"RESET ROLE;UPDATE app_private.saved_outfits SET created_at='2026-11-01T00:00:00Z' WHERE name='Alpha';UPDATE app_private.saved_outfits SET created_at='2026-11-02T00:00:00Z' WHERE name<>'Alpha';"+as_user(a)
    values=rows(success(prefix+"SELECT api.query_outfits(p_created_from=>'2026-11-01T00:00:00Z',p_created_before=>'2026-11-02T00:00:00Z');SELECT api.query_outfits(p_created_from=>'2026-11-02T00:00:00Z');ROLLBACK;"))
    assert [v['name'] for v in values[-2]['items']]==['Alpha','Alpha']
    assert {v['name'] for v in values[-1]['items']}=={'Beta','100% match'}
    assert all(len(v['items'])==2 for page in values[-2:] for v in page['items'])


@pytest.mark.parametrize('args',["p_limit=>0","p_limit=>101","p_search=>NULL","p_source=>'other'","p_category=>'Invalid'","p_sort=>'bad'",
 "p_created_from=>'2026-11-02Z',p_created_before=>'2026-11-01Z'","p_created_from=>'infinity'", "p_cursor=>'{}'",
 "p_cursor=>'{\"id\":\"bad\",\"createdAt\":\"not a date\"}'", "p_cursor=>'{\"id\":null,\"createdAt\":null}'"])
def test_direct_query_validation(users,args):
    a,_,seed=users
    result=sql(seed+as_user(a)+f'SELECT api.query_outfits({args});ROLLBACK;')
    assert result.returncode!=0 and ('Invalid outfit' in result.stderr or 'invalid input' in result.stderr)


@pytest.mark.parametrize('state',['disabled','deleting'])
def test_disabled_deleting_cannot_query(users,state):
    a,_,seed=users
    transition=f"SELECT app_private.set_account_state('{a}','disabled');" if state=='disabled' else f"SELECT app_private.begin_account_deletion('{a}');"
    result=sql(seed+'SET LOCAL ROLE dd_lifecycle_operator;'+transition+as_user(a)+'SELECT api.query_outfits();ROLLBACK;')
    assert result.returncode!=0 and 'Account access denied' in result.stderr


def test_anonymous_no_private_projection_or_mutation_grants(users):
    assert 'permission denied' in sql('BEGIN;SET LOCAL ROLE anon;SELECT api.query_outfits();ROLLBACK;').stderr
    assert success("SELECT count(*) FROM pg_indexes WHERE schemaname='app_private' AND indexname IN ('outfit_owner_name','outfit_owner_newest');")=='2'
    assert success("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app_private' AND c.relname IN ('saved_outfits','outfit_items') AND c.relrowsecurity AND c.relforcerowsecurity;")=='2'


def test_source_filter_retains_deactivated_catalog_reference_without_exposing_category(users):
    a,b,seed=users
    prefix=seed+setup(a)+"SELECT api.delete_catalog(current_setting('test.catalog')::uuid);SET LOCAL ROLE dd_lifecycle_operator;SELECT app_private.set_catalog_membership('"+a+"',false);"+as_user(a)
    values=rows(success(prefix+"SELECT api.query_outfits(p_source=>'catalog');SELECT api.query_outfits(p_source=>'catalog',p_category=>'Outerwear');ROLLBACK;"))
    assert len(values[-2]['items'])==2 and values[-1]['items']==[]


@pytest.mark.parametrize('sort',['newest','name'])
def test_cursor_does_not_require_anchor_record_to_still_exist(users,sort):
    a,_,seed=users
    prefix=seed+setup(a)+f"SELECT set_config('test.cursor',(api.query_outfits(1,NULL,'','','','{sort}')->'nextCursor')::text,true);RESET ROLE;DELETE FROM app_private.saved_outfits WHERE id=(current_setting('test.cursor')::jsonb->>'id')::uuid;"+as_user(a)
    result=rows(success(prefix+f"SELECT api.query_outfits(100,current_setting('test.cursor')::jsonb,'','','','{sort}');ROLLBACK;"))[-1]
    assert len(result['items'])==3 and result['nextCursor'] is None
