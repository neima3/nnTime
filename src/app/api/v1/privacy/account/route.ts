/**
 * DELETE /api/v1/privacy/account — SEC-10 account deletion cascade.
 * Requires header Confirm: delete-my-account.
 */
import { requireSession } from "@/server/auth-session";
import { handleErrors, errorResponse } from "@/server/api-errors";
import { deleteAccount } from "@/server/services/privacy";

export async function DELETE(request: Request) {
  return handleErrors(async () => {
    const { userId } = await requireSession();
    const confirm = request.headers.get("confirm");
    if (confirm !== "delete-my-account") {
      return errorResponse(
        "precondition_required",
        'Send header Confirm: delete-my-account',
        428,
      );
    }
    await deleteAccount(userId);
    return new Response(null, { status: 204 });
  });
}
