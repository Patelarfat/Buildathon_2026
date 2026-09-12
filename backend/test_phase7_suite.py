"""
Phase 7 Automated Test Suite: GenAI Construction Project Assistant
Tests endpoint validation, project isolation, grounded context retrieval,
authoritative risk alignment, PPE semantics, negative event honesty, and fallback behavior.
"""

import os
import sys
import unittest
from datetime import datetime, date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from main import app
from database import Base, engine, SessionLocal
import models
from services.risk_engine import RiskEngine
from services.assistant_context import retrieve_assistant_context
from services.llm.client import LLMClient

client = TestClient(app)

class TestPhase7Assistant(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        cls.db = SessionLocal()

        ts = int(datetime.utcnow().timestamp())

        # Test User
        user = models.User(
            name=f"Manager {ts}",
            email=f"p7_user_{ts}@example.com",
            role="PROJECT_MANAGER",
            password_hash="hashedpass"
        )
        cls.db.add(user)
        cls.db.commit()
        cls.db.refresh(user)
        cls.user = user

        # Create Project Alpha (Rich data)
        cls.project_a = models.Project(
            name=f"P7 Alpha Complex {ts}",
            description="Alpha Commercial Tower",
            status="ACTIVE"
        )
        cls.db.add(cls.project_a)
        cls.db.commit()
        cls.db.refresh(cls.project_a)

        # Create Project Beta (Clean / Isolated)
        cls.project_b = models.Project(
            name=f"P7 Beta Park {ts}",
            description="Beta Lowrise Green Park",
            status="ACTIVE"
        )
        cls.db.add(cls.project_b)
        cls.db.commit()
        cls.db.refresh(cls.project_b)

        # Sites & Areas for Project Alpha
        site_a = models.Site(name="Alpha Tower Site", project_id=cls.project_a.id)
        cls.db.add(site_a)
        cls.db.commit()
        cls.db.refresh(site_a)

        area_a1 = models.Area(name="Excavation Pit A", site_id=site_a.id)
        area_a2 = models.Area(name="North Façade", site_id=site_a.id)
        cls.db.add_all([area_a1, area_a2])
        cls.db.commit()
        cls.db.refresh(area_a1)
        cls.db.refresh(area_a2)

        cls.site_a = site_a
        cls.area_a1 = area_a1
        cls.area_a2 = area_a2

        # 1. Unresolved Safety Incident in Alpha
        incident = models.SafetyIncident(
            project_id=cls.project_a.id,
            site_id=site_a.id,
            area_id=area_a1.id,
            reported_by=user.id,
            incident_date=str(date.today()),
            incident_type="NEAR_MISS",
            severity="HIGH",
            status="OPEN",
            description="Scaffolding plank slipped near Excavation Pit A without tether.",
            created_at=datetime.utcnow()
        )
        cls.db.add(incident)

        # 2. Failed Inspection in Alpha
        inspection = models.InspectionReport(
            project_id=cls.project_a.id,
            site_id=site_a.id,
            area_id=area_a2.id,
            inspector_id=user.id,
            inspection_date=str(date.today()),
            inspection_type="Structural Safety",
            status="FAILED",
            findings="Perimeter safety netting missing on North Façade.",
            created_at=datetime.utcnow()
        )
        cls.db.add(inspection)

        # 3. Delayed Material in Alpha
        material = models.Material(
            project_id=cls.project_a.id,
            site_id=site_a.id,
            area_id=area_a1.id,
            recorded_by=user.id,
            material_name="Grade 60 Rebar",
            status="DELAYED",
            quantity=500.0,
            unit="Tons",
            notes="Delivery stuck at rail yard, critical path blocker"
        )
        cls.db.add(material)

        # 4. Daily Report in Alpha
        daily_report = models.DailyReport(
            project_id=cls.project_a.id,
            site_id=site_a.id,
            area_id=area_a1.id,
            reported_by=user.id,
            report_date=str(date.today()),
            work_completed="Excavation foundation 75% complete. Concrete pouring delayed.",
            weather="Rainy",
            workers_count=45,
            notes="Safety briefing conducted at 07:00."
        )
        cls.db.add(daily_report)

        # 5. Site Photo & AI Analysis Run & Safety Findings in Alpha
        photo = models.SitePhoto(
            project_id=cls.project_a.id,
            site_id=site_a.id,
            area_id=area_a1.id,
            uploaded_by=user.id,
            file_name="test_p7_alpha.jpg",
            file_path="/uploads/test_p7_alpha.jpg",
            caption="Morning pit scan",
            created_at=datetime.utcnow()
        )
        cls.db.add(photo)
        cls.db.commit()
        cls.db.refresh(photo)

        analysis_run = models.AIAnalysisRun(
            photo_id=photo.id,
            model_name="yolo11n-ppe",
            model_version="v1.0",
            status="COMPLETED"
        )
        cls.db.add(analysis_run)
        cls.db.commit()
        cls.db.refresh(analysis_run)

        # PPE Compliance vs Violation findings
        finding_comp = models.AISafetyFinding(
            photo_id=photo.id,
            analysis_run_id=analysis_run.id,
            project_id=cls.project_a.id,
            site_id=site_a.id,
            area_id=area_a1.id,
            finding_type="HELMET_DETECTED",
            severity="LOW",
            title="Helmet detected on worker",
            confidence=0.96,
            description="Worker wearing hardhat in Excavation Pit A",
            status="OPEN",
            created_at=datetime.utcnow()
        )
        finding_viol = models.AISafetyFinding(
            photo_id=photo.id,
            analysis_run_id=analysis_run.id,
            project_id=cls.project_a.id,
            site_id=site_a.id,
            area_id=area_a1.id,
            finding_type="PERSON_WITHOUT_HELMET",
            severity="HIGH",
            title="Person without helmet detected",
            confidence=0.88,
            description="Worker without hardhat near heavy machinery",
            status="OPEN",
            created_at=datetime.utcnow()
        )
        cls.db.add_all([finding_comp, finding_viol])
        cls.db.commit()

        # Recalculate RiskEngine for Project Alpha
        cls.risk_eval_a = RiskEngine.evaluate_risk(cls.db, cls.project_a.id)

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def test_01_empty_query_rejection(self):
        """Empty query should return HTTP 400 Bad Request."""
        res = client.post(f"/api/projects/{self.project_a.id}/assistant/chat", json={"message": ""})
        self.assertEqual(res.status_code, 400)
        self.assertIn("cannot be empty", res.json()["detail"])

        res_spaces = client.post(f"/api/projects/{self.project_a.id}/assistant/chat", json={"message": "   "})
        self.assertEqual(res_spaces.status_code, 400)

    def test_02_nonexistent_project_rejection(self):
        """Nonexistent project should return HTTP 404 Not Found."""
        res = client.post("/api/projects/99999999/assistant/chat", json={"message": "What is the risk?"})
        self.assertEqual(res.status_code, 404)
        self.assertIn("not found", res.json()["detail"].lower())

    def test_03_project_isolation(self):
        """Data from Project Alpha must NEVER appear in Project Beta's assistant responses."""
        res_b = client.post(f"/api/projects/{self.project_b.id}/assistant/chat", json={"message": "What are the safety incidents?"})
        self.assertEqual(res_b.status_code, 200)
        data_b = res_b.json()
        
        answer_b = data_b["answer"]
        self.assertNotIn("Scaffolding plank", answer_b)
        self.assertNotIn("Excavation Pit A", answer_b)
        self.assertNotIn("Grade 60 Rebar", answer_b)

        for src in data_b.get("sources", []):
            self.assertNotEqual(src.get("title"), "Scaffolding plank slipped near Excavation Pit A")

    def test_04_risk_score_and_reasons_grounding(self):
        """Queries about risk must ground strictly in RiskEngine components and reasons."""
        res = client.post(f"/api/projects/{self.project_a.id}/assistant/chat", json={"message": "Why is the project risk high?"})
        self.assertEqual(res.status_code, 200)
        data = res.json()

        answer = data["answer"]
        self.assertTrue(any(k in answer.lower() for k in ["risk", "incident", "inspection", "score", "finding"]))
        
        source_types = [s["type"] for s in data["sources"]]
        self.assertTrue(any(t in ["RISK", "INCIDENT", "INSPECTION", "AI_PPE"] for t in source_types))

    def test_05_unresolved_incidents_query(self):
        """Queries about safety incidents must return real unresolved incidents."""
        res = client.post(f"/api/projects/{self.project_a.id}/assistant/chat", json={"message": "List any unresolved safety incidents."})
        self.assertEqual(res.status_code, 200)
        data = res.json()

        answer = data["answer"]
        self.assertTrue("Scaffolding plank" in answer or "slipped" in answer or "OPEN" in answer or "HIGH" in answer)
        
        incident_sources = [s for s in data["sources"] if s["type"] == "INCIDENT"]
        self.assertTrue(len(incident_sources) >= 1)

    def test_06_failed_inspections_query(self):
        """Queries about failed inspections must list the Structural Safety inspection on North Façade."""
        res = client.post(f"/api/projects/{self.project_a.id}/assistant/chat", json={"message": "Show all failed inspections."})
        self.assertEqual(res.status_code, 200)
        data = res.json()

        answer = data["answer"]
        self.assertTrue("Structural Safety" in answer or "North Façade" in answer or "Perimeter safety netting" in answer)

        inspection_sources = [s for s in data["sources"] if s["type"] == "INSPECTION"]
        self.assertTrue(len(inspection_sources) >= 1)

    def test_07_material_blockers_query(self):
        """Queries about delayed materials must identify Grade 60 Rebar."""
        res = client.post(f"/api/projects/{self.project_a.id}/assistant/chat", json={"message": "Are any materials delayed or blocking work?"})
        self.assertEqual(res.status_code, 200)
        data = res.json()

        answer = data["answer"]
        self.assertTrue("Grade 60 Rebar" in answer or "DELAYED" in answer)

        material_sources = [s for s in data["sources"] if s["type"] == "MATERIAL"]
        self.assertTrue(len(material_sources) >= 1)

    def test_08_daily_report_query(self):
        """Queries about site activities must reference today's daily log."""
        res = client.post(f"/api/projects/{self.project_a.id}/assistant/chat", json={"message": "What happened on site today?"})
        self.assertEqual(res.status_code, 200)
        data = res.json()

        answer = data["answer"]
        self.assertTrue("Excavation foundation 75% complete" in answer or "45" in answer or "Rainy" in answer or "briefing" in answer)

    def test_09_ppe_compliance_vs_violation_semantics(self):
        """PPE compliance (HELMET_DETECTED) and violation (PERSON_WITHOUT_HELMET) must be clearly segregated."""
        res = client.post(f"/api/projects/{self.project_a.id}/assistant/chat", json={"message": "Show PPE compliance and safety violations from site scans."})
        self.assertEqual(res.status_code, 200)
        data = res.json()

        answer = data["answer"]
        self.assertTrue("Compliance" in answer or "HELMET_DETECTED" in answer or "hard hat" in answer.lower() or "PPE" in answer)

    def test_10_negative_event_honesty_check(self):
        """When queried about non-existent events (e.g., crane collapse), the model must state there are no records."""
        res = client.post(f"/api/projects/{self.project_a.id}/assistant/chat", json={"message": "Tell me about the crane collapse on site."})
        self.assertEqual(res.status_code, 200)
        data = res.json()

        answer = data["answer"].lower()
        self.assertTrue(
            "no " in answer or "not found" in answer or "no records" in answer or "no incidents" in answer or "0" in answer or "do not have" in answer,
            f"Expected honesty statement about non-existent crane collapse, got: {data['answer']}"
        )

    def test_11_fallback_synthesizer_consistency(self):
        """Direct call to LLMClient.generate_response produces structured Markdown with facts."""
        context_text, sources, data_used, project_name = retrieve_assistant_context(
            self.db, self.project_a.id, "What are the major risks?"
        )
        answer = LLMClient.generate_response(
            query="What are the major risks?",
            grounded_context=context_text,
            project_name=project_name
        )
        self.assertTrue(len(answer) > 20)
        self.assertTrue(len(sources) >= 1)
        self.assertIn("Project", answer)


if __name__ == "__main__":
    unittest.main()
