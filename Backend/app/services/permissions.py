"""Role-based permissions for tenant users.

Temporary auth uses X-Demo-User-Id; replace with JWT without changing permission checks.
"""

from enum import StrEnum

from fastapi import HTTPException, status

from app.domain.models.user import User, UserRole, UserStatus


class Permission(StrEnum):
    manage_users = "manage_users"
    view_all_conversations = "view_all_conversations"
    view_agent_queue = "view_agent_queue"
    claim_conversation = "claim_conversation"
    assign_conversation = "assign_conversation"
    transfer_conversation = "transfer_conversation"
    reply_conversation = "reply_conversation"
    manage_bot_studio = "manage_bot_studio"


_ROLE_PERMISSIONS: dict[UserRole, set[Permission]] = {
    UserRole.owner: set(Permission),
    UserRole.admin: {
        Permission.manage_users,
        Permission.view_all_conversations,
        Permission.claim_conversation,
        Permission.assign_conversation,
        Permission.transfer_conversation,
        Permission.reply_conversation,
        Permission.manage_bot_studio,
    },
    UserRole.agent: {
        Permission.view_agent_queue,
        Permission.claim_conversation,
        Permission.reply_conversation,
        Permission.transfer_conversation,
    },
    UserRole.viewer: {
        Permission.view_all_conversations,
    },
}


def has_permission(user: User, permission: Permission) -> bool:
    if user.status != UserStatus.active:
        return False
    return permission in _ROLE_PERMISSIONS.get(user.role, set())


def require_permission(user: User, permission: Permission) -> None:
    if not has_permission(user, permission):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Missing permission: {permission.value}",
        )


def assert_can_manage_target_user(
    actor: User,
    target: User | None,
    *,
    new_role: UserRole | None = None,
) -> None:
    require_permission(actor, Permission.manage_users)

    if actor.role == UserRole.admin:
        if new_role == UserRole.owner:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admins cannot assign the owner role",
            )
        if target is not None and target.role == UserRole.owner:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admins cannot modify owner users",
            )


def can_assign_conversation(
    actor: User,
    *,
    conversation_assigned_agent_id: str | None,
    target_agent_id: str,
) -> bool:
    if has_permission(actor, Permission.assign_conversation) and actor.role in {
        UserRole.owner,
        UserRole.admin,
    }:
        return True

    if actor.role == UserRole.agent:
        return (
            conversation_assigned_agent_id is None
            and target_agent_id == actor.id
            and has_permission(actor, Permission.claim_conversation)
        )

    return False


def can_transfer_conversation(
    actor: User,
    *,
    conversation_assigned_agent_id: str | None,
) -> bool:
    if actor.role in {UserRole.owner, UserRole.admin}:
        return has_permission(actor, Permission.transfer_conversation)

    if actor.role == UserRole.agent:
        return (
            conversation_assigned_agent_id == actor.id
            and has_permission(actor, Permission.transfer_conversation)
        )

    return False


def can_reply_to_conversation(
    actor: User,
    *,
    conversation_assigned_agent_id: str | None,
) -> bool:
    if actor.role in {UserRole.owner, UserRole.admin, UserRole.agent}:
        if not has_permission(actor, Permission.reply_conversation):
            return False
        if actor.role in {UserRole.owner, UserRole.admin}:
            return True
        return conversation_assigned_agent_id == actor.id

    return False
