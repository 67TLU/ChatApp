import { Request, Response, NextFunction } from 'express';
import { FriendshipService } from './friendship.service';
import {
  sendFriendRequestSchema,
  friendshipIdSchema,
  blockUserSchema,
  paginationSchema,
} from './friendship.validators';

export class FriendshipController {
  private service = new FriendshipService();

  // Gửi lời mời kết bạn
  sendRequest = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = sendFriendRequestSchema.parse(req.body);
      const result = await this.service.sendFriendRequest(
        req.user!.userId,
        data.addresseeId,
        data.message
      );

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // Chấp nhận lời mời
  acceptRequest = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = friendshipIdSchema.parse(req.params);
      const result = await this.service.acceptFriendRequest(req.user!.userId, id);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // Từ chối lời mời
  rejectRequest = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = friendshipIdSchema.parse(req.params);
      const result = await this.service.rejectFriendRequest(req.user!.userId, id);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // Hủy lời mời đã gửi
  cancelRequest = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = friendshipIdSchema.parse(req.params);
      const result = await this.service.cancelFriendRequest(req.user!.userId, id);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // Hủy kết bạn
  removeFriend = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = friendshipIdSchema.parse(req.params);
      const result = await this.service.removeFriend(req.user!.userId, id);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // Danh sách bạn bè
  getFriends = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { limit, offset } = paginationSchema.parse(req.query);
      const friends = await this.service.getFriendsList(req.user!.userId, limit, offset);

      res.json({
        success: true,
        data: friends,
      });
    } catch (error) {
      next(error);
    }
  };

  // Lời mời nhận được
  getReceivedRequests = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const requests = await this.service.getReceivedRequests(req.user!.userId);

      res.json({
        success: true,
        data: requests,
      });
    } catch (error) {
      next(error);
    }
  };

  // Lời mời đã gửi
  getSentRequests = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const requests = await this.service.getSentRequests(req.user!.userId);

      res.json({
        success: true,
        data: requests,
      });
    } catch (error) {
      next(error);
    }
  };

  // Kiểm tra quan hệ giữa 2 user
  getRelationship = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const relationship = await this.service.getRelationshipStatus(
        req.user!.userId,
        userId as string
      );

      res.json({
        success: true,
        data: relationship,
      });
    } catch (error) {
      next(error);
    }
  };

  // ===== BLOCK =====

  blockUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = blockUserSchema.parse(req.body);
      const result = await this.service.blockUser(
        req.user!.userId,
        data.userId,
        data.reason
      );

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  unblockUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const result = await this.service.unblockUser(req.user!.userId, userId as string);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getBlockedList = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const list = await this.service.getBlockedList(req.user!.userId);

      res.json({
        success: true,
        data: list,
      });
    } catch (error) {
      next(error);
    }
  };
}