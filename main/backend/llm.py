import httpx
from config import PROVIDER_ENDPOINTS, PROVIDER_MODEL_ENDPOINTS, GEMINI_BASE, PROVIDERS

TIMEOUT = httpx.Timeout(60.0, connect=30.0)

def _anthropic_headers(api_key):
    return {"x-api-key": api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"}

def _openai_headers(api_key):
    return {"Authorization": f"Bearer {api_key}", "content-type": "application/json"}

async def fetch_models(provider, api_key):
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            if provider == "gemini":
                r = await client.get(f"{PROVIDER_MODEL_ENDPOINTS['gemini']}?key={api_key}")
                if r.status_code != 200:
                    return None, r.json().get("error", {}).get("message", "failed")
                models = [
                    m["name"].replace("models/", "")
                    for m in r.json().get("models", [])
                    if "generateContent" in m.get("supportedGenerationMethods", [])
                ]
                return models, None

            headers = _anthropic_headers(api_key) if provider == "anthropic" else _openai_headers(api_key)
            r = await client.get(PROVIDER_MODEL_ENDPOINTS[provider], headers=headers)
            if r.status_code != 200:
                return None, r.json().get("error", {}).get("message", "failed")
            data = r.json()

            if provider == "anthropic":
                models = [m["id"] for m in data.get("data", [])]
            elif provider == "openai":
                models = sorted([m["id"] for m in data.get("data", []) if "gpt" in m["id"]])
            else:
                models = [m["id"] for m in data.get("data", [])]
            return models, None
    except httpx.TimeoutException:
        return None, "connection timeout - check your network"
    except Exception as e:
        return None, str(e)

async def call(provider, api_key, model, messages, system_prompt="", max_tokens=512):
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            if provider == "anthropic":
                payload = {"model": model, "max_tokens": max_tokens, "messages": messages}
                if system_prompt:
                    payload["system"] = system_prompt
                r = await client.post(PROVIDER_ENDPOINTS["anthropic"], headers=_anthropic_headers(api_key), json=payload)
                data = r.json()
                if r.status_code != 200:
                    return None, data.get("error", {}).get("message", "api error")
                return data["content"][0]["text"], None

            if provider == "gemini":
                contents = []
                if system_prompt:
                    contents.append({"role": "user", "parts": [{"text": f"[system]: {system_prompt}"}]})
                    contents.append({"role": "model", "parts": [{"text": "understood"}]})
                for msg in messages:
                    role = "model" if msg["role"] == "assistant" else "user"
                    contents.append({"role": role, "parts": [{"text": msg["content"]}]})
                payload = {"contents": contents, "generationConfig": {"maxOutputTokens": max_tokens}}
                r = await client.post(
                    f"{GEMINI_BASE}/{model}:generateContent?key={api_key}",
                    headers={"content-type": "application/json"},
                    json=payload
                )
                data = r.json()
                if r.status_code != 200:
                    return None, data.get("error", {}).get("message", "api error")
                try:
                    return data["candidates"][0]["content"]["parts"][0]["text"], None
                except (KeyError, IndexError):
                    return None, "empty response"

            formatted = []
            if system_prompt:
                formatted.append({"role": "system", "content": system_prompt})
            formatted.extend(messages)
            payload = {"model": model, "max_tokens": max_tokens, "messages": formatted}
            r = await client.post(PROVIDER_ENDPOINTS[provider], headers=_openai_headers(api_key), json=payload)
            data = r.json()
            if r.status_code != 200:
                return None, data.get("error", {}).get("message", "api error")
            return data["choices"][0]["message"]["content"], None
    except httpx.TimeoutException:
        return None, "connection timeout - check your network"
    except Exception as e:
        return None, str(e)
