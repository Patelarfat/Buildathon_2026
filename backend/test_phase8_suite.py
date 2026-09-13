import os
import sys
import unittest
from datetime import datetime, date
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from main import app
from database import engine, Base, SessionLocal
import models
from services.embeddings.local_embedder import LocalSemanticEmbedder
from services.embeddings.service import EmbeddingService
from services.rag.document_builder import DocumentBuilder
from services.rag.indexer import RAGIndexer
from services.rag.retriever import SemanticRetriever
from services.assistant_context import retrieve_assistant_context
from services.llm.client import LLMClient

client = TestClient(app)

class TestPhase8HybridRAG(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        cls.db = SessionLocal()
        
        ts = int(datetime.utcnow().timestamp())

        # Test User
        cls.user = models.User(
            name=f'P8 Engineer {ts}',
            email=f'p8_eng_{ts}@example.com',
            role='SAFETY_OFFICER',
            password_hash='hashedpass'
        )
        cls.db.add(cls.user)
        cls.db.commit()
        cls.db.refresh(cls.user)

        # Create Project Alpha
        cls.proj_alpha = models.Project(
            name=f'Phase8 Alpha Complex {ts}',
            description='Alpha High-Rise Commercial Facility',
            location='Zone Alpha North',
            status='ACTIVE'
        )
        cls.db.add(cls.proj_alpha)
        cls.db.commit()
        cls.db.refresh(cls.proj_alpha)

        # Create Site & Area for Alpha
        cls.site_alpha = models.Site(
            project_id=cls.proj_alpha.id,
            name='Alpha Foundation Site',
            description='Primary excavation site'
        )
        cls.db.add(cls.site_alpha)
        cls.db.commit()
        cls.db.refresh(cls.site_alpha)

        cls.area_alpha = models.Area(
            site_id=cls.site_alpha.id,
            name='Basement Level B2',
            description='Subterranean pump room'
        )
        cls.db.add(cls.area_alpha)
        cls.db.commit()
        cls.db.refresh(cls.area_alpha)

        # Create Safety Incidents in Alpha
        cls.inc_alpha_1 = models.SafetyIncident(
            project_id=cls.proj_alpha.id,
            site_id=cls.site_alpha.id,
            area_id=cls.area_alpha.id,
            reported_by=cls.user.id,
            incident_date=str(date.today()),
            incident_type='ENVIRONMENTAL',
            severity='HIGH',
            status='OPEN',
            description='Excavator hydraulic fluid leak spilled 20L near pump sump drainage.'
        )
        cls.inc_alpha_2 = models.SafetyIncident(
            project_id=cls.proj_alpha.id,
            site_id=cls.site_alpha.id,
            area_id=cls.area_alpha.id,
            reported_by=cls.user.id,
            incident_date=str(date.today()),
            incident_type='PPE_VIOLATION',
            severity='MEDIUM',
            status='RESOLVED',
            description='Worker missing hard hat near crane swing radius.'
        )
        cls.db.add_all([cls.inc_alpha_1, cls.inc_alpha_2])
        cls.db.commit()
        cls.db.refresh(cls.inc_alpha_1)
        cls.db.refresh(cls.inc_alpha_2)

        # Create Project Beta (for isolation testing)
        cls.proj_beta = models.Project(
            name=f'Phase8 Beta Logistics {ts}',
            description='Beta Automated Warehouse',
            location='Zone Beta South',
            status='ACTIVE'
        )
        cls.db.add(cls.proj_beta)
        cls.db.commit()
        cls.db.refresh(cls.proj_beta)

        cls.inc_beta_1 = models.SafetyIncident(
            project_id=cls.proj_beta.id,
            site_id=cls.site_alpha.id,
            reported_by=cls.user.id,
            incident_date=str(date.today()),
            incident_type='EQUIPMENT',
            severity='CRITICAL',
            status='OPEN',
            description='Confined space ventilation duct disconnected in Beta shaft.'
        )
        cls.db.add(cls.inc_beta_1)
        cls.db.commit()
        cls.db.refresh(cls.inc_beta_1)

    @classmethod
    def tearDownClass(cls):
        for p in [cls.proj_alpha, cls.proj_beta]:
            if p and p.id:
                cls.db.query(models.RAGDocument).filter(models.RAGDocument.project_id == p.id).delete()
                cls.db.query(models.SafetyIncident).filter(models.SafetyIncident.project_id == p.id).delete()
                site_ids = [s.id for s in p.sites] if p.sites else []
                if site_ids:
                    cls.db.query(models.Area).filter(models.Area.site_id.in_(site_ids)).delete()
                cls.db.query(models.Site).filter(models.Site.project_id == p.id).delete()
                cls.db.query(models.Project).filter(models.Project.id == p.id).delete()
        if cls.user and cls.user.id:
            cls.db.query(models.User).filter(models.User.id == cls.user.id).delete()
        cls.db.commit()
        cls.db.close()

    def test_01_embedding_service_and_normalization(self):
        embedder = LocalSemanticEmbedder()
        self.assertEqual(embedder.dimension, 768)

        vec1 = embedder.embed_text('High risk excavation hydraulic fluid leak')
        vec2 = embedder.embed_text('Hydraulic oil spill at construction site')
        vec3 = embedder.embed_text('Office lunch menu sandwiches and salads')

        self.assertEqual(len(vec1), 768)
        norm = np.linalg.norm(vec1)
        self.assertAlmostEqual(norm, 1.0, places=4)

        sim_related = float(np.dot(vec1, vec2))
        sim_unrelated = float(np.dot(vec1, vec3))
        self.assertGreater(sim_related, sim_unrelated)

    def test_02_embedding_service_multi_provider_fallback(self):
        info = EmbeddingService.get_active_provider_info()
        self.assertIn('provider', info)
        self.assertEqual(info['dimension'], 768)
        self.assertIn('fallback_available', info)

        vectors = EmbeddingService.get_embeddings(['Test sentence one', 'Test sentence two'])
        self.assertEqual(len(vectors), 2)
        self.assertEqual(len(vectors[0]), 768)

    def test_03_semantic_document_builder(self):
        title, content, meta = DocumentBuilder.build_safety_incident(self.inc_alpha_1)
        self.assertIn('hydraulic', content.lower())
        self.assertIn('high', content.lower())
        self.assertEqual(meta['source_type'], 'INCIDENT')

    def test_04_rag_indexer_backfill(self):
        res = RAGIndexer.index_project_backfill(self.db, self.proj_alpha.id)
        self.assertEqual(res['status'], 'success')
        self.assertGreater(res['total_indexed'], 0)

        docs = self.db.query(models.RAGDocument).filter(models.RAGDocument.project_id == self.proj_alpha.id).all()
        self.assertGreaterEqual(len(docs), 3)

        inc_doc = self.db.query(models.RAGDocument).filter(
            models.RAGDocument.project_id == self.proj_alpha.id,
            models.RAGDocument.source_type == 'INCIDENT',
            models.RAGDocument.source_id == self.inc_alpha_1.id
        ).first()
        self.assertIsNotNone(inc_doc)
        self.assertIsNotNone(inc_doc.embedding)
        self.assertEqual(inc_doc.site_id, self.site_alpha.id)
        self.assertEqual(inc_doc.area_id, self.area_alpha.id)

    def test_05_rag_semantic_retrieval_and_ranking(self):
        results = SemanticRetriever.search(
            db=self.db,
            project_id=self.proj_alpha.id,
            query='hydraulic oil leak near pump drainage',
            top_k=3
        )
        self.assertGreater(len(results), 0)
        top_match = results[0]
        self.assertEqual(top_match['source_type'], 'INCIDENT')
        self.assertEqual(top_match['source_id'], self.inc_alpha_1.id)
        self.assertIn('similarity', top_match)

    def test_06_strict_project_isolation(self):
        RAGIndexer.index_project_backfill(self.db, self.proj_beta.id)

        alpha_results = SemanticRetriever.search(
            db=self.db,
            project_id=self.proj_alpha.id,
            query='Confined space ventilation duct disconnected in Beta',
            top_k=5
        )
        for r in alpha_results:
            self.assertEqual(r['project_id'], self.proj_alpha.id)
            self.assertNotEqual(r['source_id'], self.inc_beta_1.id)

    def test_07_hybrid_assistant_context_assembly(self):
        prompt_text, sources, data_used, risk_status = retrieve_assistant_context(
            db=self.db,
            project_id=self.proj_alpha.id,
            query='What are the main safety issues?'
        )
        
        self.assertIsInstance(prompt_text, str)
        self.assertGreater(len(sources), 0)
        self.assertIn('EXACT FACTS', prompt_text)
        self.assertIn('SEMANTIC EVIDENCE', prompt_text)
        self.assertIn('AUTHORITATIVE RISK ENGINE', prompt_text)

    def test_08_llm_clean_formatting_and_header_stripping(self):
        prompt_text, sources, data_used, risk_status = retrieve_assistant_context(
            db=self.db,
            project_id=self.proj_alpha.id,
            query='What are the main safety risks?'
        )
        response = LLMClient.generate_response(
            query='What are the main safety risks?',
            grounded_context=prompt_text,
            project_name=self.proj_alpha.name
        )

        self.assertNotIn('INTERNAL SYSTEM CONTEXT', response)
        self.assertNotIn('<PROJECT_DATA>', response)
        self.assertIn('###', response)

    def test_09_fastapi_rag_endpoints(self):
        # 1. Status endpoint
        resp_status = client.get(f'/api/projects/{self.proj_alpha.id}/rag/status')
        self.assertEqual(resp_status.status_code, 200)
        data_status = resp_status.json()
        self.assertIn('total_documents', data_status)
        self.assertGreater(data_status['total_documents'], 0)
        self.assertIn('embedding_provider', data_status)

        # 2. Search endpoint
        resp_search = client.get(f'/api/projects/{self.proj_alpha.id}/rag/search?q=hydraulic+oil+leak')
        self.assertEqual(resp_search.status_code, 200)
        data_search = resp_search.json()
        self.assertIsInstance(data_search, list)
        self.assertGreater(len(data_search), 0)
        self.assertEqual(data_search[0]['source_type'], 'INCIDENT')

        # 3. Index endpoint
        resp_idx = client.post(f'/api/projects/{self.proj_alpha.id}/rag/index')
        self.assertEqual(resp_idx.status_code, 200)
        data_idx = resp_idx.json()
        self.assertEqual(data_idx['status'], 'success')
        self.assertGreater(data_idx['total_indexed'], 0)


    def test_10_risk_consistency_snapshot_vs_assistant(self):
        # 1. Query dashboard snapshot
        resp_dash = client.get(f'/api/projects/{self.proj_alpha.id}/dashboard')
        self.assertEqual(resp_dash.status_code, 200)
        dash_data = resp_dash.json()
        snapshot_risk_score = dash_data['executive_health']['risk_score']
        snapshot_risk_level = dash_data['executive_health']['risk_level']

        # 2. Query assistant context
        prompt_text, sources, data_used, _ = retrieve_assistant_context(
            db=self.db,
            project_id=self.proj_alpha.id,
            query='Why is the project risk high?'
        )

        # 3. Verify risk score in assistant context matches snapshot exactly
        self.assertIn(f'Authoritative Risk Score: {snapshot_risk_score}/100 ({snapshot_risk_level})', prompt_text)
        self.assertGreater(snapshot_risk_score, 0)

    def test_11_exact_sql_incident_count(self):
        # Count open incidents directly in DB
        open_count = self.db.query(models.SafetyIncident).filter(
            models.SafetyIncident.project_id == self.proj_alpha.id,
            models.SafetyIncident.status.in_(['OPEN', 'UNDER_REVIEW'])
        ).count()

        prompt_text, sources, _, _ = retrieve_assistant_context(
            db=self.db,
            project_id=self.proj_alpha.id,
            query='How many open safety incidents are there?'
        )

        self.assertIn(f'Unresolved Safety Incidents: {open_count}', prompt_text)


if __name__ == '__main__':
    unittest.main()
