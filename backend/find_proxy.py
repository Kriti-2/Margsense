import sys
import httpx

def test_proxy(proxy_url: str) -> bool:
    try:
        # We test by calling Gemini's list models endpoint.
        # Since we use an invalid key, if the location is supported, Google returns 400 "API key not valid".
        # If the location is NOT supported, Google returns 400 "User location is not supported".
        # If the proxy is dead, it raises a ConnectionError / Timeout.
        with httpx.Client(proxy=proxy_url) as client:
            r = client.get(
                "https://generativelanguage.googleapis.com/v1beta/models",
                params={"key": "INVALID_KEY_TEST"},
                timeout=4.0
            )
        text = r.text.lower()
        if "location is not supported" not in text and "api key not valid" in text:
            print(f"Success! Working proxy found: {proxy_url}")
            return True
        else:
            print(f"Failed location check or other error with {proxy_url}: {r.status_code} - {r.text[:100]}")
    except Exception as e:
        print(f"Failed connection to {proxy_url}: {e}")
    return False

def main():
    print("Fetching free proxy list from ProxyScrape...")
    protocols = ["socks5", "http"]
    countries = "us,in,sg,de,uk"
    
    proxies_to_test = []
    
    for proto in protocols:
        url = f"https://api.proxyscrape.com/v2/?request=displayproxies&protocol={proto}&timeout=2000&country={countries}&ssl=all&anonymity=all"
        try:
            r = httpx.get(url, timeout=10.0)
            if r.status_code == 200:
                lines = [line.strip() for line in r.text.split("\n") if line.strip()]
                for line in lines:
                    proxies_to_test.append(f"{proto}://{line}")
        except Exception as e:
            print(f"Error fetching {proto} list: {e}")
            
    print(f"Found {len(proxies_to_test)} candidate proxies. Testing them...")
    
    working_proxy = None
    for p in proxies_to_test:
        if test_proxy(p):
            working_proxy = p
            break
            
    if working_proxy:
        print(f"\nFound working proxy: {working_proxy}")
        
        # Save it to .env.docker
        try:
            # Check container-specific mount path first
            env_path = "/app/root/backend/.env.docker"
            import os
            if not os.path.exists(env_path):
                env_path = ".env.docker"
                if not os.path.exists(env_path):
                    env_path = "backend/.env.docker"
            
            print(f"Writing to: {env_path}")
            with open(env_path, "r") as f:
                content = f.read()
            
            # Remove any existing GEMINI_PROXY line
            lines = [line for line in content.split("\n") if not line.startswith("GEMINI_PROXY=")]
            lines.append(f"GEMINI_PROXY={working_proxy}")
            
            with open(env_path, "w") as f:
                f.write("\n".join(lines))
            print("Successfully updated .env.docker with the working GEMINI_PROXY!")
            sys.exit(0)
        except Exception as e:
            print(f"Error writing to .env.docker: {e}")
            sys.exit(1)
    else:
        print("\nNo working proxies found. You may need to try again later.")
        sys.exit(1)

if __name__ == "__main__":
    main()
