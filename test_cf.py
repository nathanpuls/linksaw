import os
import requests

token = os.environ.get('CLOUDFLARE_API_TOKEN')
zone_id = 'ecfdc5aba269d003c611bb795dcb81b6'

headers = {
    'Authorization': f'Bearer {token}',
    'Content-Type': 'application/json',
}

url = f'https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records'

try:
    response = requests.get(url, headers=headers)
    print(response.json())
except Exception as e:
    print(f"Error: {e}")
