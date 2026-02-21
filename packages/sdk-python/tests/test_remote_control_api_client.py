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
