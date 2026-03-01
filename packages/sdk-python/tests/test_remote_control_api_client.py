import json

from papert_code_sdk.generated import RemoteControlApiClient, RemoteControlApiError


def test_create_remote_session_uses_bearer_token_header():
    calls = []

    def fake_request(method, url, headers, body):
        calls.append((method, url, headers, body))
        return (
            201,
            {"content-type": "application/json"},
            json.dumps(
                {
                    "sessionId": "sid-1",
                    "token": "session-token",
                    "expiresAtMs": 123,
                    "workspaceRoot": "/workspace",
                }
            ).encode("utf-8"),
        )

    client = RemoteControlApiClient("http://localhost:41242", request_impl=fake_request)
    session = client.create_remote_session("server-token")

    assert session["sessionId"] == "sid-1"
    assert calls[0][0] == "POST"
    assert calls[0][1] == "http://localhost:41242/api/v1/sessions"
    assert calls[0][2]["authorization"] == "Bearer server-token"


def test_get_catalog_raises_typed_error_for_non_2xx():
    def fake_request(method, url, headers, body):
        _ = (method, url, headers, body)
        return (
            401,
            {"content-type": "application/json"},
            json.dumps({"error": "Unauthorized"}).encode("utf-8"),
        )

    client = RemoteControlApiClient("http://localhost:41242", request_impl=fake_request)

    try:
        client.get_webui_catalog("sid-1", "session-token")
        assert False, "expected RemoteControlApiError"
    except RemoteControlApiError as error:
        assert error.status == 401
        assert error.body["error"] == "Unauthorized"


def test_update_release_channel_sends_session_headers_and_json_body():
    calls = []

    def fake_request(method, url, headers, body):
        calls.append((method, url, headers, body))
        return (204, {}, b"")

    client = RemoteControlApiClient("http://localhost:41242", request_impl=fake_request)
    client.update_webui_release_channel("sid-1", "session-token", "preview")

    assert calls[0][0] == "PUT"
    assert calls[0][1] == "http://localhost:41242/api/v1/webui/release-channel"
    assert calls[0][2]["authorization"] == "Bearer session-token"
    assert calls[0][2]["x-papert-session-id"] == "sid-1"
    assert json.loads(calls[0][3].decode("utf-8")) == {"releaseChannel": "preview"}


def test_get_and_update_webui_state_use_session_headers():
    calls = []

    def fake_request(method, url, headers, body):
        calls.append((method, url, headers, body))
        if method == "GET":
            return (
                200,
                {"content-type": "application/json"},
                json.dumps({"state": {"panel": "catalog"}}).encode("utf-8"),
            )
        return (204, {}, b"")

    client = RemoteControlApiClient("http://localhost:41242", request_impl=fake_request)
    state = client.get_webui_state("sid-1", "session-token")
    client.update_webui_state("sid-1", "session-token", {"panel": "activity"})

    assert state == {"state": {"panel": "catalog"}}
    assert calls[0][0] == "GET"
    assert calls[0][1] == "http://localhost:41242/api/v1/webui/state"
    assert calls[0][2]["authorization"] == "Bearer session-token"
    assert calls[0][2]["x-papert-session-id"] == "sid-1"

    assert calls[1][0] == "PUT"
    assert calls[1][1] == "http://localhost:41242/api/v1/webui/state"
    assert calls[1][2]["authorization"] == "Bearer session-token"
    assert calls[1][2]["x-papert-session-id"] == "sid-1"
    assert calls[1][2]["content-type"] == "application/json"
    assert json.loads(calls[1][3].decode("utf-8")) == {"panel": "activity"}


def test_create_get_delete_share_calls_expected_routes():
    calls = []

    def fake_request(method, url, headers, body):
        calls.append((method, url, headers, body))
        if method == "POST":
            return (
                201,
                {"content-type": "application/json"},
                json.dumps(
                    {
                        "id": "share1",
                        "url": "http://localhost:41242/s/share1",
                        "secret": "top-secret",
                    }
                ).encode("utf-8"),
            )
        if method == "GET":
            return (
                200,
                {"content-type": "application/json"},
                json.dumps(
                    {
                        "id": "share1",
                        "createdAt": "2026-03-01T00:00:00.000Z",
                        "payload": {"hello": "world"},
                    }
                ).encode("utf-8"),
            )
        return (204, {}, b"")

    client = RemoteControlApiClient("http://localhost:41242", request_impl=fake_request)
    created = client.create_share({"hello": "world"}, "sid-1", "server-token")
    loaded = client.get_share("share1")
    client.delete_share("share1", "top-secret")

    assert created["id"] == "share1"
    assert loaded["payload"] == {"hello": "world"}
    assert calls[0][0] == "POST"
    assert calls[0][1] == "http://localhost:41242/api/v1/share"
    assert calls[0][2]["authorization"] == "Bearer server-token"
    assert calls[1][0] == "GET"
    assert calls[1][1] == "http://localhost:41242/api/v1/share/share1"
    assert calls[2][0] == "DELETE"
    assert calls[2][1] == "http://localhost:41242/api/v1/share/share1"
