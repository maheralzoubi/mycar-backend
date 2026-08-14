import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  findByEmail(email: string) {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  findById(id: string) {
    return this.userModel.findById(id).exec();
  }

  create(data: { email: string; passwordHash: string; name: string; phone: string }) {
    return this.userModel.create(data);
  }

  findAll() {
    return this.userModel.find().sort({ createdAt: -1 }).exec();
  }

  count() {
    return this.userModel.countDocuments().exec();
  }

  async setFcmToken(userId: string, fcmToken: string) {
    return this.userModel.findByIdAndUpdate(userId, { fcmToken }, { new: true }).exec();
  }
}
