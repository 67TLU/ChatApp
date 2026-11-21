import { Router } from 'express';
import { GroupController } from './group.controller';
import { authMiddleware } from '@/common/middleware/auth.middleware';
import { validate } from '@/common/middleware/validate.middleware';
import * as validators from './group.validators';

const router = Router();
const controller = new GroupController();

router.use(authMiddleware);
router.post('/', validate(validators.createGroupSchema), controller.createGroup);
router.get('/by-conversation/:conversationId', controller.getByConversation); // ⭐ THÊM DÒNG NÀY
router.get('/:id', controller.getGroup);
// Group CRUD
router.patch('/:id', validate(validators.updateGroupSchema), controller.updateGroup);
router.delete('/:id', controller.deleteGroup);

// Members
router.post('/:id/members', validate(validators.memberActionSchema), controller.addMember);
router.post('/:id/members/kick', validate(validators.memberActionSchema), controller.kickMember);
router.post('/:id/members/ban', validate(validators.banSchema), controller.banMember);
router.delete('/:id/members/:userId/ban', controller.unbanMember);
router.post('/:id/leave', controller.leaveGroup);

// Roles
router.post('/:id/roles', validate(validators.createRoleSchema), controller.createRole);
router.patch('/:id/roles/:roleId', validate(validators.updateRoleSchema), controller.updateRole);
router.delete('/:id/roles/:roleId', controller.deleteRole);
router.post('/:id/roles/assign', validate(validators.assignRoleSchema), controller.assignRole);

// Invites
router.post('/:id/invites', validate(validators.createInviteSchema), controller.createInvite);
router.post('/join', validate(validators.joinByCodeSchema), controller.joinByCode);

// Ownership
router.post('/:id/transfer-owner', validate(validators.transferOwnershipSchema), controller.transferOwnership);

// Join requests
router.post('/:id/join-request', validate(validators.joinRequestSchema), controller.requestToJoin);
router.post('/:id/join-requests/:requestId/approve', controller.approveJoinRequest);
router.post('/:id/join-requests/:requestId/reject', controller.rejectJoinRequest);

export default router;