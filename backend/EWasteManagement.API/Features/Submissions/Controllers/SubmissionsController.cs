using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using EWasteManagement.Api.Dtos;
using EWasteManagement.Api.Entities;
using EWasteManagement.Api.Services;

namespace EWasteManagement.Api.Controllers
{
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

        [HttpPost]
        public async Task<IActionResult> CreateSubmission([FromBody] CreateSubmissionDto dto)
        {
            var currentUserId = GetCurrentUserId();
            if (currentUserId == null) return Unauthorized();

            // Never trust a client-supplied UserId — the submission is always
            // recorded as belonging to whoever is actually authenticated,
            // regardless of what the request body said.
            dto.UserId = currentUserId.Value;

            var submission = await _submissionService.CreateSubmissionAsync(dto);
            return CreatedAtAction(nameof(GetSubmissionById), new { id = submission.Id }, submission);
        }

        [HttpGet]
        public async Task<IActionResult> GetAllSubmissions()
        {
            if (IsStaffOrAdmin())
            {
                return Ok(await _submissionService.GetAllSubmissionsAsync());
            }

            var currentUserId = GetCurrentUserId();
            if (currentUserId == null) return Unauthorized();

            // Customers only ever see their own submissions.
            return Ok(await _submissionService.GetSubmissionsByUserIdAsync(currentUserId.Value));
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetSubmissionById(Guid id)
        {
            var submission = await _submissionService.GetSubmissionByIdAsync(id);
            if (submission == null) return NotFound();

            if (!IsStaffOrAdmin())
            {
                var currentUserId = GetCurrentUserId();
                if (currentUserId == null || submission.UserId != currentUserId.Value)
                {
                    // 404 rather than 403 so a customer probing random ids
                    // can't learn "that id exists but isn't yours".
                    return NotFound();
                }
            }

            return Ok(submission);
        }

        // Kept for backward compatibility with manual/admin correction tools
        // (see the note in SubmissionService.ProcessAICallbackAsync) — the
        // main create-submission flow no longer calls this endpoint, it goes
        // through the Planner/Analyzer/Validator/Matcher workflow chain
        // instead. Restricted to staff/admin since nothing else should be
        // writing AI analysis results directly.
        [HttpPost("{id}/ai-callback")]
        public async Task<IActionResult> AICallback(Guid id, [FromBody] AIAnalysisDto aiDto)
        {
            if (!IsStaffOrAdmin())
            {
                return Forbid();
            }

            await _submissionService.ProcessAICallbackAsync(id, aiDto);
            return Ok(new { message = "AI analysis saved successfully." });
        }

        [HttpPatch("{id}/status")]
        public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateStatusDto dto)
        {
            var submission = await _submissionService.GetSubmissionByIdAsync(id);
            if (submission == null) return NotFound();

            var currentUserId = GetCurrentUserId();
            if (currentUserId == null) return Unauthorized();

            var isStaffOrAdmin = IsStaffOrAdmin();
            var isOwner = submission.UserId == currentUserId.Value;

            if (!isStaffOrAdmin && !isOwner)
            {
                return NotFound();
            }

            if (!isStaffOrAdmin)
            {
                // A customer's only allowed transition is "send my own
                // submission for admin review" (the AI Assessment page's
                // "Generate report" button). Approving/rejecting is admin-only.
                if (dto.Status != SubmissionStatuses.PendingApproval)
                {
                    return Forbid();
                }
            }

            var updatedSubmission = await _submissionService.UpdateStatusAsync(id, dto.Status);
            if (updatedSubmission == null) return NotFound();
            return Ok(updatedSubmission);
        }

        // --- Claim helpers -------------------------------------------------
        // NOTE: written defensively against a few common claim-name variants
        // because I haven't seen JwtService.cs (whatever issues your tokens).
        // If you share that file, I can tighten these to the exact claim
        // types/names your tokens actually carry.

        private Guid? GetCurrentUserId()
        {
            var value = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                        ?? User.FindFirst("sub")?.Value
                        ?? User.FindFirst("userId")?.Value
                        ?? User.FindFirst("nameid")?.Value;

            return Guid.TryParse(value, out var id) ? id : (Guid?)null;
        }

        private bool IsStaffOrAdmin() => HasAnyRole("admin", "staff");

        private bool HasAnyRole(params string[] roles) =>
            User.Claims.Any(c =>
                (c.Type == ClaimTypes.Role || c.Type == "role" || c.Type == "roles") &&
                roles.Any(r => string.Equals(r, c.Value, StringComparison.OrdinalIgnoreCase)));
    }
}