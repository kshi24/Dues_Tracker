"""
Add test members to the database
"""
from database import SessionLocal, Member
from datetime import datetime

def add_test_members():
    """Add sample members to database for testing"""
    db = SessionLocal()
    
    # Check if members already exist
    existing_count = db.query(Member).count()
    if existing_count > 0:
        print(f"Database already has {existing_count} members.")
        response = input("Do you want to add more test members? (y/n): ")
        if response.lower() != 'y':
            db.close()
            return
    
    test_members = [
        {
            "name": "Alex Johnson",
            "email": "alex.johnson@northeastern.edu",
            "phone": "617-555-0100",
            "dues_amount": 180.0,
            "amount_paid": 180.0,
            "payment_status": "Paid",
            "role": "Tav"
        },
        {
            "name": "Sarah Chen",
            "email": "sarah.chen@northeastern.edu",
            "phone": "617-555-0101",
            "dues_amount": 180.0,
            "amount_paid": 0.0,
            "payment_status": "Pending",
            "role": "Shin"
        },
        {
            "name": "Michael Brown",
            "email": "michael.brown@northeastern.edu",
            "phone": "617-555-0102",
            "dues_amount": 180.0,
            "amount_paid": 0.0,
            "payment_status": "Overdue",
            "role": "Tav"
        },
        {
            "name": "Emily Davis",
            "email": "emily.davis@northeastern.edu",
            "phone": "617-555-0103",
            "dues_amount": 150.0,
            "amount_paid": 150.0,
            "payment_status": "Paid",
            "role": "Shin"
        },
        {
            "name": "James Wilson",
            "email": "james.wilson@northeastern.edu",
            "phone": "617-555-0104",
            "dues_amount": 180.0,
            "amount_paid": 0.0,
            "payment_status": "Overdue",
            "role": "Kuf"
        },
        {
            "name": "Lisa Anderson",
            "email": "lisa.anderson@northeastern.edu",
            "phone": "617-555-0105",
            "dues_amount": 180.0,
            "amount_paid": 0.0,
            "payment_status": "Pending",
            "role": "Tav"
        },
        {
            "name": "David Martinez",
            "email": "david.martinez@northeastern.edu",
            "phone": "617-555-0106",
            "dues_amount": 180.0,
            "amount_paid": 90.0,
            "payment_status": "Pending",
            "role": "Shin"
        },
        {
            "name": "Jessica Taylor",
            "email": "jessica.taylor@northeastern.edu",
            "phone": "617-555-0107",
            "dues_amount": 180.0,
            "amount_paid": 180.0,
            "payment_status": "Paid",
            "role": "Kuf"
        }
    ]
    
    print("\nAdding test members to database...")
    print("=" * 50)
    
    added_count = 0
    for member_data in test_members:
        # Check if email already exists
        existing = db.query(Member).filter(Member.email == member_data["email"]).first()
        if existing:
            print(f"⚠️  Skipping {member_data['name']} - already exists")
            continue
        
        member = Member(**member_data)
        db.add(member)
        added_count += 1
        print(f"✅ Added: {member_data['name']} - Status: {member_data['payment_status']}")
    
    db.commit()
    db.close()
    
    print("=" * 50)
    print(f"\n✅ Successfully added {added_count} members!")
    print(f"📊 Total members in database: {existing_count + added_count}")
    print("\nMember Summary:")
    print(f"  - Paid: {sum(1 for m in test_members if m['payment_status'] == 'Paid')}")
    print(f"  - Pending: {sum(1 for m in test_members if m['payment_status'] == 'Pending')}")
    print(f"  - Overdue: {sum(1 for m in test_members if m['payment_status'] == 'Overdue')}")
    print("\n🎉 Your admin dashboard should now show these members!")
    print("   Refresh the page to see them.")

if __name__ == "__main__":
    print("\n🚀 TAMID Dues Tracker - Add Test Members")
    print("=" * 50)
    add_test_members()
    print("\nNext steps:")
    print("1. Refresh your admin dashboard")
    print("2. Try clicking 'Send Bulk Reminders'")
    print("3. Check Slack for notifications!")
    print()