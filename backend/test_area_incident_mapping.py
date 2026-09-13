import os
import sys
import unittest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import app
from database import SessionLocal
import models

client = TestClient(app)

class TestAreaSafetyIncidentMapping(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db = SessionLocal()
        cls.created_project_ids = []
        cls.created_user_ids = []
        
        user = models.User(
            name='Safety Officer',
            email=f'safety_officer_test_{int(datetime.now().timestamp())}@example.com',
            role='SAFETY_OFFICER',
            password_hash='dummy_hash'
        )
        cls.db.add(user)
        cls.db.commit()
        cls.db.refresh(user)
        cls.user_id = user.id
        cls.created_user_ids.append(user.id)

    @classmethod
    def tearDownClass(cls):
        for pid in cls.created_project_ids:
            try:
                p = cls.db.query(models.Project).filter(models.Project.id == pid).first()
                if p:
                    cls.db.delete(p)
                    cls.db.commit()
            except Exception as e:
                cls.db.rollback()
                print(f'Error cleaning up project {pid}: {e}')
        
        for uid in cls.created_user_ids:
            try:
                u = cls.db.query(models.User).filter(models.User.id == uid).first()
                if u:
                    cls.db.delete(u)
                    cls.db.commit()
            except Exception as e:
                cls.db.rollback()
                print(f'Error cleaning up user {uid}: {e}')

        cls.db.close()

    def test_full_area_incident_lifecycle_and_isolation(self):
        # 1. Setup Project Alpha
        res_p1 = client.post('/api/projects', json={
            'name': 'Project Alpha Test',
            'description': 'Area Incident Test Alpha',
            'status': 'ACTIVE'
        })
        self.assertIn(res_p1.status_code, [200, 201])
        p1 = res_p1.json()
        p1_id = p1['id']
        self.created_project_ids.append(p1_id)

        # Create Site A under Project Alpha
        res_s1 = client.post(f'/api/projects/{p1_id}/sites', json={
            'name': 'Site A',
            'code': 'SITE-A',
            'description': 'Site A Description'
        })
        self.assertIn(res_s1.status_code, [200, 201])
        s1_id = res_s1.json()['id']

        # Create Area A1 and Area A2 under Site A
        res_a1 = client.post(f'/api/sites/{s1_id}/areas', json={
            'name': 'Area A1',
            'code': 'A1',
            'description': 'Building Block A1'
        })
        self.assertIn(res_a1.status_code, [200, 201])
        a1_id = res_a1.json()['id']

        res_a2 = client.post(f'/api/sites/{s1_id}/areas', json={
            'name': 'Area A2',
            'code': 'A2',
            'description': 'Building Block A2'
        })
        self.assertIn(res_a2.status_code, [200, 201])
        a2_id = res_a2.json()['id']

        # TEST 1: Incident in Area A1
        res_inc1 = client.post('/api/incidents', json={
            'project_id': p1_id,
            'site_id': s1_id,
            'area_id': a1_id,
            'reported_by': self.user_id,
            'incident_type': 'FALL',
            'severity': 'HIGH',
            'status': 'OPEN',
            'description': 'Worker slipped from ladder in Area A1',
            'incident_date': datetime.now(timezone.utc).strftime('%Y-%m-%d')
        })
        self.assertIn(res_inc1.status_code, [200, 201])
        self.assertEqual(res_inc1.json()['area_id'], a1_id)

        res_rank1 = client.get(f'/api/projects/{p1_id}/risk/areas?days=30')
        self.assertEqual(res_rank1.status_code, 200)
        rankings1 = res_rank1.json()
        area_a1 = next((r for r in rankings1 if r['area_id'] == a1_id), None)
        area_a2 = next((r for r in rankings1 if r['area_id'] == a2_id), None)

        self.assertIsNotNone(area_a1)
        self.assertEqual(area_a1['incidents_count'], 1)
        self.assertGreater(area_a1['risk_score'], 0)

        self.assertIsNotNone(area_a2)
        self.assertEqual(area_a2['incidents_count'], 0)
        self.assertEqual(area_a2['risk_score'], 0)

        # TEST 2: Incident in Area A2
        res_inc2 = client.post('/api/incidents', json={
            'project_id': p1_id,
            'site_id': s1_id,
            'area_id': a2_id,
            'reported_by': self.user_id,
            'incident_type': 'PPE_VIOLATION',
            'severity': 'MEDIUM',
            'status': 'OPEN',
            'description': 'Worker missing helmet in Area A2',
            'incident_date': datetime.now(timezone.utc).strftime('%Y-%m-%d')
        })
        self.assertIn(res_inc2.status_code, [200, 201])
        self.assertEqual(res_inc2.json()['area_id'], a2_id)

        res_rank2 = client.get(f'/api/projects/{p1_id}/risk/areas?days=30')
        self.assertEqual(res_rank2.status_code, 200)
        rankings2 = res_rank2.json()
        area_a1 = next((r for r in rankings2 if r['area_id'] == a1_id), None)
        area_a2 = next((r for r in rankings2 if r['area_id'] == a2_id), None)

        self.assertEqual(area_a1['incidents_count'], 1)
        self.assertGreater(area_a1['risk_score'], 0)
        self.assertEqual(area_a2['incidents_count'], 1)
        self.assertGreater(area_a2['risk_score'], 0)

        # TEST 3: Incident with Overall Site (area_id = None)
        res_inc3 = client.post('/api/incidents', json={
            'project_id': p1_id,
            'site_id': s1_id,
            'area_id': None,
            'reported_by': self.user_id,
            'incident_type': 'UNSAFE_CONDITION',
            'severity': 'LOW',
            'status': 'OPEN',
            'description': 'Debris on main site access road',
            'incident_date': datetime.now(timezone.utc).strftime('%Y-%m-%d')
        })
        self.assertIn(res_inc3.status_code, [200, 201])
        self.assertIsNone(res_inc3.json()['area_id'])

        res_rank3 = client.get(f'/api/projects/{p1_id}/risk/areas?days=30')
        self.assertEqual(res_rank3.status_code, 200)
        rankings3 = res_rank3.json()
        area_a1 = next((r for r in rankings3 if r['area_id'] == a1_id), None)
        area_a2 = next((r for r in rankings3 if r['area_id'] == a2_id), None)

        self.assertEqual(area_a1['incidents_count'], 1)
        self.assertEqual(area_a2['incidents_count'], 1)

        res_intel = client.get(f'/api/projects/{p1_id}/intelligence?days=30')
        self.assertEqual(res_intel.status_code, 200)
        intel_data = res_intel.json()
        self.assertEqual(intel_data['safety_summary']['human_incidents_total'], 3)

        # TEST 4 & 5: Second Project (Beta) and its Areas
        res_p2 = client.post('/api/projects', json={
            'name': 'Project Beta Test',
            'description': 'Area Incident Test Beta',
            'status': 'ACTIVE'
        })
        self.assertIn(res_p2.status_code, [200, 201])
        p2 = res_p2.json()
        p2_id = p2['id']
        self.created_project_ids.append(p2_id)

        res_s2 = client.post(f'/api/projects/{p2_id}/sites', json={
            'name': 'Site B',
            'code': 'SITE-B',
            'description': 'Site B Description'
        })
        self.assertIn(res_s2.status_code, [200, 201])
        s2_id = res_s2.json()['id']

        res_b1 = client.post(f'/api/sites/{s2_id}/areas', json={
            'name': 'Area B1',
            'code': 'B1',
            'description': 'Sector B1'
        })
        self.assertIn(res_b1.status_code, [200, 201])
        b1_id = res_b1.json()['id']

        res_b2 = client.post(f'/api/sites/{s2_id}/areas', json={
            'name': 'Area B2',
            'code': 'B2',
            'description': 'Sector B2'
        })
        self.assertIn(res_b2.status_code, [200, 201])
        b2_id = res_b2.json()['id']

        res_inc_b1 = client.post('/api/incidents', json={
            'project_id': p2_id,
            'site_id': s2_id,
            'area_id': b1_id,
            'reported_by': self.user_id,
            'incident_type': 'INJURY',
            'severity': 'CRITICAL',
            'status': 'OPEN',
            'description': 'Worker hand injury in Project Beta Area B1',
            'incident_date': datetime.now(timezone.utc).strftime('%Y-%m-%d')
        })
        self.assertIn(res_inc_b1.status_code, [200, 201])

        res_rank_b = client.get(f'/api/projects/{p2_id}/risk/areas?days=30')
        self.assertEqual(res_rank_b.status_code, 200)
        rankings_b = res_rank_b.json()
        area_b1 = next((r for r in rankings_b if r['area_id'] == b1_id), None)
        area_b2 = next((r for r in rankings_b if r['area_id'] == b2_id), None)

        self.assertEqual(area_b1['incidents_count'], 1)
        self.assertGreater(area_b1['risk_score'], 0)
        self.assertEqual(area_b2['incidents_count'], 0)
        self.assertEqual(area_b2['risk_score'], 0)

        # Cross-project isolation check
        res_rank_a_again = client.get(f'/api/projects/{p1_id}/risk/areas?days=30')
        self.assertEqual(res_rank_a_again.status_code, 200)
        rankings_a_again = res_rank_a_again.json()
        area_a1_again = next((r for r in rankings_a_again if r['area_id'] == a1_id), None)
        self.assertEqual(area_a1_again['incidents_count'], 1)

        # TEST 6: Time Windows (24h, 7d, 30d)
        fifteen_days_ago = datetime.now(timezone.utc) - timedelta(days=15)
        res_old_inc = client.post('/api/incidents', json={
            'project_id': p1_id,
            'site_id': s1_id,
            'area_id': a1_id,
            'reported_by': self.user_id,
            'incident_type': 'EQUIPMENT_ACCIDENT',
            'severity': 'HIGH',
            'status': 'OPEN',
            'description': 'Forklift scrape 15 days ago',
            'incident_date': fifteen_days_ago.strftime('%Y-%m-%d')
        })
        self.assertIn(res_old_inc.status_code, [200, 201])
        old_inc_id = res_old_inc.json()['id']
        old_inc_obj = self.db.query(models.SafetyIncident).filter(models.SafetyIncident.id == old_inc_id).first()
        old_inc_obj.created_at = fifteen_days_ago.replace(tzinfo=None)
        self.db.commit()

        rank_24h = client.get(f'/api/projects/{p1_id}/risk/areas?days=1').json()
        a1_24h = next((r for r in rank_24h if r['area_id'] == a1_id), None)
        self.assertEqual(a1_24h['incidents_count'], 1)

        rank_7d = client.get(f'/api/projects/{p1_id}/risk/areas?days=7').json()
        a1_7d = next((r for r in rank_7d if r['area_id'] == a1_id), None)
        self.assertEqual(a1_7d['incidents_count'], 1)

        rank_30d = client.get(f'/api/projects/{p1_id}/risk/areas?days=30').json()
        a1_30d = next((r for r in rank_30d if r['area_id'] == a1_id), None)
        self.assertEqual(a1_30d['incidents_count'], 2)

if __name__ == '__main__':
    unittest.main()