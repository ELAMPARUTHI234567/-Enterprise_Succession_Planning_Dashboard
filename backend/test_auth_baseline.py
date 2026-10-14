import unittest
import json
import jwt
from unittest.mock import patch, MagicMock
from app import create_app
from extensions import db
from models.user import User
from config import Config

class TestSupabaseAuthFlow(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.config['TESTING'] = True
        self.client = self.app.test_client()

    def test_missing_access_token(self):
        """Test that missing access token returns 400"""
        res = self.client.post('/api/supabase', json={})
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertFalse(data['success'])
        self.assertIn("Supabase access token required", data['message'])

    def test_invalid_issuer(self):
        """Test that invalid token issuer returns 401"""
        fake_token = jwt.encode({"iss": "https://malicious-site.com", "sub": "123"}, "secret", algorithm="HS256")
        res = self.client.post('/api/supabase', json={"access_token": fake_token})
        self.assertEqual(res.status_code, 401)
        data = res.get_json()
        self.assertFalse(data['success'])
        self.assertIn("Invalid token issuer", data['message'])

    def test_legacy_login_hr(self):
        """Test legacy login remains fully functional for HR"""
        res = self.client.post('/api/login', json={"username": "hr", "password": "hr123"})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertEqual(data['data']['user']['role'], 'HR')
        self.assertTrue(bool(data['data']['token']))

    def test_legacy_login_manager(self):
        """Test legacy login remains fully functional for Manager"""
        res = self.client.post('/api/login', json={"username": "manager", "password": "manager123"})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertEqual(data['data']['user']['role'], 'Manager')
        self.assertTrue(bool(data['data']['token']))

    def test_legacy_login_employee(self):
        """Test legacy login remains fully functional for Employee"""
        res = self.client.post('/api/login', json={"username": "arun.kumar", "password": "employee123"})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertEqual(data['data']['user']['role'], 'Employee')
        self.assertTrue(bool(data['data']['token']))

if __name__ == '__main__':
    unittest.main()
