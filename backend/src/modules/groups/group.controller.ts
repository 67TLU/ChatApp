import { Request, Response, NextFunction } from 'express';
import { GroupService } from './group.service';
import * as validators from './group.validators';

export class GroupController {
  private service = new GroupService();

  createGroup = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = validators.createGroupSchema.parse(req.body);
      const result = await this.service.createGroup(req.user!.userId, data);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  getGroup = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getGroupInfo(req.user!.userId, req.params.id as string);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };
// Thêm vào class GroupController
getByConversation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { conversationId } = req.params as { conversationId: string };
    const result = await this.service.getGroupByConversation(req.user!.userId, conversationId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
  updateGroup = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = validators.updateGroupSchema.parse(req.body);
      const result = await this.service.updateGroup(req.user!.userId, req.params.id as string, data);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  deleteGroup = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.deleteGroup(req.user!.userId, req.params.id as string);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  // Members
  addMember = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = validators.memberActionSchema.parse(req.body);
      const result = await this.service.addMember(req.user!.userId, req.params.id as string, userId);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  kickMember = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, reason } = validators.memberActionSchema.parse(req.body);
      const result = await this.service.kickMember(req.user!.userId, req.params.id as string, userId, reason);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  banMember = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = validators.banSchema.parse(req.body);
      const result = await this.service.banMember(req.user!.userId, req.params.id as string, data.userId, {
        reason: data.reason,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  unbanMember = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.unbanMember(
        req.user!.userId,
        req.params.id as string,
        req.params.userId as string
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  leaveGroup = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.leaveGroup(req.user!.userId, req.params.id as string);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  // Roles
  createRole = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = validators.createRoleSchema.parse(req.body);
      const result = await this.service.createRole(req.user!.userId, req.params.id as string, data);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  updateRole = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = validators.updateRoleSchema.parse(req.body);
      const result = await this.service.updateRole(
        req.user!.userId,
        req.params.id as string,
        req.params.roleId as string,
        data
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  deleteRole = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.deleteRole(
        req.user!.userId,
        req.params.id as string,
        req.params.roleId as string
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  assignRole = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = validators.assignRoleSchema.parse(req.body);
      const result = await this.service.assignRole(
        req.user!.userId,
        req.params.id as string,
        data.userId,
        data.roleId
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  // Invites
  createInvite = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = validators.createInviteSchema.parse(req.body);
      const result = await this.service.createInviteLink(req.user!.userId, req.params.id as string, {
        maxUses: data.maxUses,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      });
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  joinByCode = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = validators.joinByCodeSchema.parse(req.body);
      const result = await this.service.joinByInviteCode(req.user!.userId, data.code);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  // Ownership
  transferOwnership = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = validators.transferOwnershipSchema.parse(req.body);
      const result = await this.service.transferOwnership(
        req.user!.userId,
        req.params.id as string,
        data.newOwnerId
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  // Join requests
  requestToJoin = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = validators.joinRequestSchema.parse(req.body);
      const result = await this.service.requestToJoin(
        req.user!.userId,
        req.params.id as string,
        data.message
      );
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  approveJoinRequest = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.approveJoinRequest(
        req.user!.userId,
        req.params.id as string,
        req.params.requestId as string
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  rejectJoinRequest = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.rejectJoinRequest(
        req.user!.userId,
        req.params.id as string,
        req.params.requestId as string
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };
}