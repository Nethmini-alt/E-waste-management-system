import unittest
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import httpx

import main
from schemas import SnapshotItem, SubmissionSnapshot


class AnalyzerRunApiTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=main.app),
            base_url="http://test",
        )
        self.workflow_id = uuid4()
        self.submission_id = uuid4()
        self.payload = {
            "workflowId": str(self.workflow_id),
            "submissionId": str(self.submission_id),
        }
        self.submission = SubmissionSnapshot(
            submissionId=self.submission_id,
            items=[SnapshotItem(itemName="Laptop", quantity=2)],
        )
        self.analysis = {
            "waste_category": "IT Equipment",
            "hazard_level": "High",
            "estimated_volume_kg": 4.0,
            "estimated_value_lkr": 200.0,
            "confidence_score": 0.85,
            "items": [
                {
                    "item_name": "Laptop",
                    "quantity": 2,
                    "waste_category": "IT Equipment",
                    "hazard_level": "High",
                    "estimated_volume_kg": 4.0,
                    "estimated_value_lkr": 200.0,
                    "confidence_score": 0.85,
                }
            ],
        }

    async def asyncTearDown(self):
        await self.client.aclose()

    async def test_run_generates_response_and_submits_analysis(self):
        state = {
            "workflow_id": str(self.workflow_id),
            "submission": self.submission,
            **self.analysis,
        }
        with (
            patch.object(main.tools, "get_submission", new=AsyncMock(return_value=self.submission)),
            patch.object(main, "classify_node", new=AsyncMock(return_value=state)),
            patch.object(main.tools, "submit_analysis", new=AsyncMock()) as submit_analysis,
            patch.object(main.tools, "log_execution", new=AsyncMock()) as log_execution,
        ):
            response = await self.client.post("/run", json=self.payload)

        self.assertEqual(200, response.status_code)
        self.assertEqual(
            {
                "workflowId": str(self.workflow_id),
                "wasteCategory": "IT Equipment",
                "hazardLevel": "High",
                "estimatedVolumeKg": 4.0,
                "estimatedValueLkr": 200.0,
                "confidenceScore": 0.85,
                "items": [
                    {
                        "itemName": "Laptop",
                        "quantity": 2,
                        "wasteCategory": "IT Equipment",
                        "hazardLevel": "High",
                        "estimatedVolumeKg": 4.0,
                        "estimatedValueLkr": 200.0,
                        "confidenceScore": 0.85,
                    }
                ],
            },
            response.json(),
        )
        submit_analysis.assert_awaited_once_with(self.workflow_id, self.analysis)
        log_execution.assert_awaited_once()
        self.assertEqual(self.workflow_id, log_execution.await_args.args[0])
        self.assertTrue(log_execution.await_args.kwargs["succeeded"])
        self.assertIsNone(log_execution.await_args.kwargs["error_message"])

    async def test_run_logs_classification_failure_and_does_not_submit_analysis(self):
        with (
            patch.object(main.tools, "get_submission", new=AsyncMock(return_value=self.submission)),
            patch.object(main, "classify_node", new=AsyncMock(side_effect=RuntimeError("model unavailable"))),
            patch.object(main.tools, "submit_analysis", new=AsyncMock()) as submit_analysis,
            patch.object(main.tools, "log_execution", new=AsyncMock()) as log_execution,
        ):
            response = await self.client.post("/run", json=self.payload)

        self.assertEqual(500, response.status_code)
        self.assertEqual({"detail": "model unavailable"}, response.json())
        submit_analysis.assert_not_awaited()
        log_execution.assert_awaited_once()
        self.assertFalse(log_execution.await_args.args[4])
        self.assertEqual("model unavailable", log_execution.await_args.args[5])

    async def test_run_rejects_invalid_ids_before_calling_submission_tools(self):
        with (
            patch.object(main.tools, "get_submission", new=AsyncMock()) as get_submission,
            patch.object(main.tools, "submit_analysis", new=AsyncMock()) as submit_analysis,
        ):
            response = await self.client.post(
                "/run",
                json={"workflowId": "not-a-uuid", "submissionId": str(self.submission_id)},
            )

        self.assertEqual(422, response.status_code)
        get_submission.assert_not_awaited()
        submit_analysis.assert_not_awaited()


if __name__ == "__main__":
    unittest.main()
