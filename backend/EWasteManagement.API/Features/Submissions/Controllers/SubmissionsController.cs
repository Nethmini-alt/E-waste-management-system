using Microsoft.AspNetCore.Mvc;
using EWasteManagement.Api.Dtos;
using EWasteManagement.Api.Services;

namespace EWasteManagement.Api.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    public class SubmissionsController : ControllerBase
    {
        private readonly ISubmissionService _submissionService;

        public SubmissionsController(ISubmissionService submissionService)
        {
            _submissionService = submissionService;
        }

        [HttpPost]
        public async Task<IActionResult> CreateSubmission([FromBody] CreateSubmissionDto dto)
        {
            var submission = await _submissionService.CreateSubmissionAsync(dto);
            return CreatedAtAction(nameof(GetSubmissionById), new { id = submission.Id }, submission);
        }

        [HttpGet]
        public async Task<IActionResult> GetAllSubmissions()
        {
            var submissions = await _submissionService.GetAllSubmissionsAsync();
            return Ok(submissions);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetSubmissionById(Guid id)
        {
            var submission = await _submissionService.GetSubmissionByIdAsync(id);
            if (submission == null) return NotFound();
            return Ok(submission);
        }

        [HttpPost("{id}/ai-callback")]
        public async Task<IActionResult> AICallback(Guid id, [FromBody] AIAnalysisDto aiDto)
        {
            await _submissionService.ProcessAICallbackAsync(id, aiDto);
            return Ok(new { message = "AI analysis saved successfully." });
        }

        [HttpPatch("{id}/status")]
        public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateStatusDto dto)
        {
            var updatedSubmission = await _submissionService.UpdateStatusAsync(id, dto.Status);
            if (updatedSubmission == null) return NotFound();
            return Ok(updatedSubmission);
        }
    }

    public class UpdateStatusDto
    {
        public string Status { get; set; } = string.Empty;
    }
}