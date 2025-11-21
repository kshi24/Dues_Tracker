"""Add test members using the API"""
import requests

API_URL = "http://localhost:8000"

# Test members to add
test_members = [
    {
        "name": "Alex Johnson",
        "email": "alex.johnson@northeastern.edu",
        "phone": "617-555-0100",
        "dues_amount": 180.0,
        "role": "Tav"
    },
    {
        "name": "Sarah Chen",
        "email": "sarah.chen@northeastern.edu",
        "phone": "617-555-0101",
        "dues_amount": 180.0,
        "role": "Shin"
    },
    {
        "name": "Michael Brown",
        "email": "michael.brown@northeastern.edu",
        "phone": "617-555-0102",
        "dues_amount": 180.0,
        "role": "Tav"
    },
    {
        "name": "Emily Davis",
        "email": "emily.davis@northeastern.edu",
        "phone": "617-555-0103",
        "dues_amount": 150.0,
        "role": "Shin"
    },
]

print("Adding test members via API...")
print("=" * 50)

for member in test_members:
    try:
        response = requests.post(f"{API_URL}/api/members", json=member)
        if response.status_code == 200:
            print(f"✅ Added: {member['name']}")
        else:
            print(f"❌ Failed to add {member['name']}: {response.text}")
    except Exception as e:
        print(f"❌ Error adding {member['name']}: {e}")

print("=" * 50)
print("\n✅ Done! Refresh your admin dashboard to see members.")