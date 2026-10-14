#!/usr/bin/env python3
"""
CLI Utility for linking Google OAuth accounts to Enterprise application users.
Usage:
    python utils/link_user_oauth.py --user-id 2 --oauth-email user@example.com
    python utils/link_user_oauth.py --username manager --oauth-email user@example.com
    python utils/link_user_oauth.py --username manager --unlink
"""
import sys
import os
import argparse

# Ensure parent directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import create_app
from extensions import db
from models.user import User

def main():
    parser = argparse.ArgumentParser(description="Link or unlink an OAuth Google email to an application user.")
    parser.add_argument("--user-id", type=int, help="Database ID of the target user")
    parser.add_argument("--username", type=str, help="Username of the target user (e.g. 'hr', 'manager', 'arun.kumar')")
    parser.add_argument("--oauth-email", type=str, help="Google OAuth email to link (e.g. user@gmail.com)")
    parser.add_argument("--unlink", action="store_true", help="Remove the linked OAuth email from the user")

    args = parser.parse_args()

    if not args.user_id and not args.username:
        print("[ERROR] Please specify either --user-id or --username.")
        sys.exit(1)

    if not args.unlink and not args.oauth_email:
        print("[ERROR] Please provide --oauth-email to link, or specify --unlink to remove existing link.")
        sys.exit(1)

    app = create_app()
    with app.app_context():
        # Find user
        if args.user_id:
            user = User.query.get(args.user_id)
        else:
            username_clean = args.username.strip().lower()
            user = User.query.filter(db.func.lower(User.username) == username_clean).first()

        if not user:
            print(f"[ERROR] User not found (user_id={args.user_id}, username='{args.username}').")
            sys.exit(1)

        if args.unlink:
            prev_link = user.oauth_email
            user.oauth_email = None
            db.session.commit()
            print(f"[SUCCESS] Unlinked OAuth email '{prev_link}' from user '{user.username}' (ID: {user.id}, Role: {user.role}).")
            return

        # Normalization
        target_email = args.oauth_email.strip().lower()
        if not target_email or '@' not in target_email or '.' not in target_email:
            print(f"[ERROR] Invalid email format: '{args.oauth_email}'.")
            sys.exit(1)

        # Conflict check
        conflict = User.query.filter(
            User.id != user.id,
            (db.func.lower(db.func.trim(User.email)) == target_email) |
            (db.func.lower(db.func.trim(User.oauth_email)) == target_email)
        ).first()

        if conflict:
            print(f"[ERROR] Email '{target_email}' is already associated with user '{conflict.username}' (ID: {conflict.id}).")
            sys.exit(1)

        user.oauth_email = target_email
        db.session.commit()

        print("=" * 60)
        print("[SUCCESS] Google OAuth Account Successfully Linked!")
        print(f"  User ID:       {user.id}")
        print(f"  Username:      {user.username}")
        print(f"  Role:          {user.role}")
        print(f"  Account Status:{user.status}")
        print(f"  Primary Email: {user.email}")
        print(f"  OAuth Email:   {user.oauth_email}")
        print("=" * 60)

if __name__ == "__main__":
    main()
