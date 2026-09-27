using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using EWasteManagement.Api.Dtos;
using EWasteManagement.Api.Services;

namespace EWasteManagement.Api.Controllers
{
    // Approve/reject is not done here — it goes through the workflow
    // endpoints (POST /api/workflows/{id}/approve|reject), which resume or
    // stop the agent chain. Submission status is derived, never set directly.
    [ApiController]
    [Route("api/v1/[controller]")]
    [Authorize]
    public class SubmissionsController : ControllerBase
    {
        private readonly ISubmissionService _submissionService;

        public SubmissionsController(ISubmissionService submissionService)
        {
            _submissionService = submissionService;
        }

        // POST /api/v1/submissions — the owner and user type come from the
        // caller's token, never from the request body.
        [HttpPost]
        [Authorize(Roles = "Household,Corporate")]
        public async Task<ActionResult<SubmissionResponseDto>> CreateSubmission(
            [FromBody] CreateSubmissionDto dto, CancellationToken ct)
        {
            var userType = User.FindFirstValue(ClaimTypes.Role)
                ?? throw new UnauthorizedAccessException("Token is missing a role claim.");

            var submission = await _submissionService.CreateSubmissionAsync(dto, CurrentUserId, userType, ct);
            return CreatedAtAction(nameof(GetSubmissionById), new { id = submission.Id }, submission);
        }

        // GET /api/v1/submissions — every submission, for staff review.
        [HttpGet]
        [Authorize(Roles = "Staff,Admin")]
        public async Task<ActionResult<List<SubmissionResponseDto>>> GetAllSubmissions(CancellationToken ct)
        {
            return Ok(await _submissionService.GetAllSubmissionsAsync(ct));
        }

        // GET /api/v1/submissions/mine — the caller's own submissions.
        [HttpGet("mine")]
        [Authorize(Roles = "Household,Corporate")]
        public async Task<ActionResult<List<SubmissionResponseDto>>> GetMySubmissions(CancellationToken ct)
        {
            return Ok(await _submissionService.GetSubmissionsForUserAsync(CurrentUserId, ct));
        }

        // GET /api/v1/submissions/{id} — owner or staff/admin. Anyone else
        // gets 404 rather than 403, so ids of other users' submissions can't
        // be probed.
        [HttpGet("{id:guid}")]
        public async Task<ActionResult<SubmissionResponseDto>> GetSubmissionById(Guid id, CancellationToken ct)
        {
            var submission = await _submissionService.GetSubmissionByIdAsync(id, ct);
            if (submission == null) return NotFound();

            var isPrivileged = User.IsInRole("Staff") || User.IsInRole("Admin");
            if (!isPrivileged && submission.UserId != CurrentUserId) return NotFound();

            return Ok(submission);
        }

        private Guid CurrentUserId =>
            Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? throw new UnauthorizedAccessException("Token is missing a user id claim."));
    }
}
